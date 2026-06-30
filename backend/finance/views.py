import logging
from decimal import Decimal
import hashlib
import hmac
from datetime import timedelta
from xml.etree.ElementTree import Element, SubElement, tostring
from django.conf import settings

logger = logging.getLogger(__name__)
from django.db.models import Q, Sum
from django.db import connection
from django.utils.dateparse import parse_date
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import (
    BudgetAllocation, BudgetEncumbrance, DeliveryAdvice, GoodsReceiptNote, GRNLineItem,
    Invoice, InvoiceLineItem, PurchaseOrder, PurchaseOrderLineItem,
    ThreeWayMatch, Payment, LetterOfCredit,
    RetentionRelease, INVOICE_APPROVAL_ROUTES, INVOICE_STATUS_CHOICES,
)
from .serializers import (
    BudgetAllocationSerializer, BudgetEncumbranceSerializer,
    DeliveryAdviceSerializer, GoodsReceiptNoteSerializer, GRNLineItemSerializer,
    InvoiceSerializer, InvoiceListSerializer, InvoiceLineItemSerializer,
    PurchaseOrderSerializer, ThreeWayMatchSerializer, PaymentSerializer,
    LetterOfCreditSerializer, RetentionReleaseSerializer,
)
from accounts.audit import log_audit_action
from contracts.models import Contract, ContractMilestone, LiquidatedDamages
from system_config.notifications import (
    alert_integration_manager,
    create_notification,
    notify_role,
    notify_roles,
)

FINANCE_PAYMENT_ROLES = ('finance_officer', 'budget_controller', 'system_admin')
APPROVAL_FLOW = ('finance_officer', 'department_head', 'director_general')


def _bool_from_request(value):
    return value in ('true', 'True', True, '1', 1)


def _verify_hmac_signature(request, secret_setting_name):
    secret = getattr(settings, secret_setting_name, '')
    if not secret:
        return True

    supplied = request.headers.get('X-ZAMMSA-Signature') or request.headers.get('X-Hub-Signature-256', '')
    if supplied.startswith('sha256='):
        supplied = supplied.split('=', 1)[1]
    if not supplied:
        return False

    expected = hmac.new(
        str(secret).encode('utf-8'),
        request.body,
        hashlib.sha256,
    ).hexdigest()
    return hmac.compare_digest(expected, supplied)


def _next_invoice_approval_step(invoice):
    if invoice.status != 'pending_approval':
        return 'finance_officer'
    if invoice.approval_route in APPROVAL_FLOW:
        return invoice.approval_route
    return 'finance_officer'


def _build_grn_from_items(
    *,
    contract,
    po_number,
    grn_number,
    items_data,
    received_by,
    notes='',
    source='webhook',
    raw_webhook=None,
    delivery_advice=None,
    verification_method='',
    verified_by='',
    quantity_key='quantity_received',
):
    total_qty = Decimal('0')
    total_amount = Decimal('0')
    item_desc_parts = []

    for it in items_data:
        qty = Decimal(str(it.get(quantity_key, it.get('quantity_received', it.get('quantity_delivered', 0)))))
        total_qty += qty
        total_amount += Decimal(str(it.get('total_amount', 0)))
        item_desc_parts.append(it.get('item_name', it.get('item_code', '')))

    unit_price = total_amount / total_qty if total_qty else Decimal('0')
    item_desc = ', '.join(item_desc_parts[:3])
    if len(item_desc_parts) > 3:
        item_desc += f' (+{len(item_desc_parts) - 3} more)'

    grn_status = 'complete'
    if any(Decimal(str(it.get(quantity_key, it.get('quantity_received', it.get('quantity_delivered', 0))))) < Decimal(str(it.get('quantity_ordered', 0))) for it in items_data):
        grn_status = 'partial'
    if any(str(it.get('condition', 'good')).lower() in ('damaged', 'rejected') for it in items_data):
        grn_status = 'rejected'

    grn = GoodsReceiptNote.objects.create(
        contract=contract,
        delivery_advice=delivery_advice,
        po_number=po_number,
        grn_number=grn_number,
        item_description=item_desc,
        quantity_received=total_qty,
        unit_price=unit_price,
        total_amount=total_amount,
        status=grn_status,
        received_by=received_by,
        verified_by=verified_by,
        verified_at=timezone.now() if verified_by else None,
        verification_method=verification_method,
        notes=notes,
        zamra_certificate_verified=_bool_from_request((raw_webhook or {}).get('zamra_certificate_verified', False)),
        cold_chain_maintained=_bool_from_request((raw_webhook or {}).get('cold_chain_maintained', True)),
        temperature_log_attached=_bool_from_request((raw_webhook or {}).get('temperature_log_attached', False)),
        source=source,
        raw_webhook=raw_webhook or {},
    )

    for idx, it in enumerate(items_data, start=1):
        received_qty = Decimal(str(it.get(quantity_key, it.get('quantity_received', it.get('quantity_delivered', 0)))))
        po_line_item_id = it.get('po_line_item_id')
        po_line_item = None
        if po_line_item_id:
            try:
                po_line_item = PurchaseOrderLineItem.objects.get(pk=po_line_item_id)
            except (PurchaseOrderLineItem.DoesNotExist, Exception):
                pass
        GRNLineItem.objects.create(
            grn=grn,
            po_line_item=po_line_item,
            line_number=idx,
            item_code=it.get('item_code', ''),
            item_name=it.get('item_name', ''),
            quantity_ordered=Decimal(str(it.get('quantity_ordered', received_qty))),
            quantity_received=received_qty,
            condition=str(it.get('condition', 'good')).lower(),
            batch_number=it.get('batch_number', ''),
            expiry_date=parse_date(str(it.get('expiry_date', ''))) if it.get('expiry_date') else None,
            unit_price=Decimal(str(it.get('unit_price', 0))),
            total_amount=Decimal(str(it.get('total_amount', 0))),
        )

    return grn


def _latest_ld_amount(contract):
    total = LiquidatedDamages.objects.filter(
        contract=contract,
        status__in=('assessed', 'applied'),
    ).aggregate(total=Sum('applied_amount'))['total'] or Decimal('0')
    return total


def _apply_invoice_finance_review(invoice, approved_amount, undelivered_amount=Decimal('0')):
    original_amount = invoice.original_amount or invoice.amount
    ld_amount = _latest_ld_amount(invoice.contract)
    net_before_retention = max(approved_amount - ld_amount, Decimal('0'))
    retention_rate = invoice.contract.retention_rate
    retention_amount = (net_before_retention * retention_rate).quantize(Decimal('0.01'))
    net_payable = max(net_before_retention - retention_amount, Decimal('0'))

    invoice.original_amount = original_amount
    invoice.undelivered_amount = undelivered_amount.quantize(Decimal('0.01'))
    invoice.liquidated_damages_amount = ld_amount.quantize(Decimal('0.01'))
    invoice.net_before_retention = net_before_retention.quantize(Decimal('0.01'))
    invoice.retention_amount = retention_amount
    invoice.net_payable_amount = net_payable
    invoice.amount = net_payable
    invoice.status = 'pending_approval'
    invoice.approval_route = 'finance_officer'
    invoice.save(update_fields=[
        'original_amount', 'undelivered_amount', 'liquidated_damages_amount',
        'net_before_retention', 'retention_amount', 'net_payable_amount',
        'amount', 'status', 'approval_route', 'updated_at',
    ])
    _notify_invoice_role(
        invoice,
        'finance_officer',
        title=f'Invoice ready for approval: {invoice.invoice_number}',
        message=f'Invoice {invoice.invoice_number} passed finance review and is ready for Finance Officer approval.',
        priority='high',
        alert_key='invoice_ready_finance_approval',
    )
    return {
        'original_amount': original_amount,
        'approved_amount': approved_amount,
        'undelivered_amount': invoice.undelivered_amount,
        'liquidated_damages_amount': invoice.liquidated_damages_amount,
        'net_before_retention': invoice.net_before_retention,
        'retention_amount': invoice.retention_amount,
        'net_payable_amount': invoice.net_payable_amount,
    }


def _invoice_supplier_user(invoice):
    winning_bid = getattr(getattr(invoice, 'contract', None), 'winning_bid', None)
    return getattr(winning_bid, 'supplier', None)


def _invoice_action_url(invoice):
    return f'/finance/invoices/{invoice.invoice_id}'


def _notify_invoice_role(invoice, role, *, title, message, priority='normal', alert_key='invoice_workflow'):
    return notify_role(
        role,
        title=title,
        message=message,
        notification_type='finance',
        priority=priority,
        source_module='finance',
        object_id=invoice.pk,
        action_url=_invoice_action_url(invoice),
        metadata={
            'alert_key': alert_key,
            'invoice_id': str(invoice.pk),
            'invoice_number': invoice.invoice_number,
            'status': invoice.status,
        },
        email_required=True,
    )


def _notify_invoice_supplier(invoice, *, title, message, priority='normal', alert_key='invoice_supplier'):
    supplier_user = _invoice_supplier_user(invoice)
    if not supplier_user:
        return None
    return create_notification(
        supplier_user,
        title=title,
        message=message,
        notification_type='finance',
        priority=priority,
        source_module='finance',
        object_id=invoice.pk,
        action_url=f'/vendor/invoices/{invoice.invoice_id}',
        metadata={
            'alert_key': alert_key,
            'invoice_id': str(invoice.pk),
            'invoice_number': invoice.invoice_number,
            'status': invoice.status,
        },
        email_required=True,
    )


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100

    def get_paginated_response(self, data):
        return Response({
            'count': self.page.paginator.count,
            'page': self.page.number,
            'page_size': self.page.paginator.per_page,
            'total_pages': self.page.paginator.num_pages,
            'next': self.get_next_link(),
            'previous': self.get_previous_link(),
            'results': data,
        })


class InvoiceFilter(django_filters.FilterSet):
    status = django_filters.MultipleChoiceFilter(choices=INVOICE_STATUS_CHOICES)
    contract = django_filters.CharFilter(field_name='contract__contract_number', lookup_expr='exact')

    class Meta:
        model = Invoice
        fields = ['status']


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class BudgetAllocationListView(BaseView, generics.ListCreateAPIView):
    queryset = BudgetAllocation.objects.all()
    serializer_class = BudgetAllocationSerializer
    ordering = ['entity_code']
    filterset_fields = ['entity_code', 'fiscal_year', 'entity_level']

    def get_permissions(self):
        if self.request.method in ('POST', 'PUT', 'PATCH', 'DELETE'):
            self.permission_classes = [IsAuthenticated]
        return super().get_permissions()


class BudgetAllocationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BudgetAllocation.objects.all()
    serializer_class = BudgetAllocationSerializer
    permission_classes = [IsAuthenticated]


class BudgetEncumbranceListView(BaseView, generics.ListCreateAPIView):
    queryset = BudgetEncumbrance.objects.select_related('requisition').all()
    serializer_class = BudgetEncumbranceSerializer
    ordering = ['-created_at']


class InvoiceListView(BaseView, generics.ListCreateAPIView):
    filterset_class = InvoiceFilter
    search_fields = ['invoice_number', 'contract__contract_number']
    ordering_fields = ['created_at', 'amount', 'status']
    ordering = ['-created_at']

    def get_queryset(self):
        queryset = Invoice.objects.select_related('contract', 'supplier').prefetch_related('three_way_matches', 'payments')
        user = self.request.user
        if user.role == 'supplier_user':
            if user.employee_id and user.employee_id.startswith('SUP-'):
                reg_num = user.employee_id.replace('SUP-', '', 1)
                return queryset.filter(supplier__registration_number=reg_num)
            return queryset.none()
        return queryset.all()

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return InvoiceListSerializer
        return InvoiceSerializer


class InvoiceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Invoice.objects.select_related('contract', 'supplier').prefetch_related('three_way_matches', 'payments').all()
    serializer_class = InvoiceSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_submit_view(request, pk):
    try:
        inv = Invoice.objects.select_related('contract', 'grn').get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    inv.status = 'submitted'
    inv.submitted_at = timezone.now()
    if not inv.due_date:
        inv.due_date = timezone.now().date() + timedelta(days=30)
    inv.save()

    # Notify R-07 and R-12 (via audit log)
    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='INVOICE_SUBMITTED', module='finance',
        record_id=str(inv.invoice_id), ip_address=ip,
    )
    _notify_invoice_role(
        inv,
        'contract_manager',
        title=f'Invoice submitted: {inv.invoice_number}',
        message=f'Invoice {inv.invoice_number} was submitted and needs contract/GRN verification.',
        priority='high',
        alert_key='invoice_submitted_contract_manager',
    )

    return Response({
        'message': 'Invoice submitted for contract manager verification',
        'invoice_number': inv.invoice_number,
        'status': inv.status,
        'payment_deadline': inv.due_date,
        'next_step': 'Contract manager verifies GRN linkage, then Finance Officer runs 3-way match',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_match_view(request, pk):
    try:
        inv = Invoice.objects.select_related('grn', 'contract').prefetch_related(
            'line_items', 'grn__line_items',
        ).get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    po = PurchaseOrder.objects.filter(contract=inv.contract, status='active').prefetch_related('line_items').first()
    po_line_items = list(po.line_items.all().order_by('line_number')) if po else []
    inv_line_items = list(inv.line_items.all().order_by('line_number'))
    grn_line_items = list(inv.grn.line_items.all().order_by('line_number')) if inv.grn else []

    line_matches = []
    total_discrepancies = {}
    overall_overbilling = False
    overall_price_above_po = False
    overall_price_significantly_low = False
    overall_item_mismatch = False
    overall_warnings = False

    max_lines = max(
        len(po_line_items), len(grn_line_items), len(inv_line_items)
    ) if any([po_line_items, grn_line_items, inv_line_items]) else 0

    for i in range(max_lines):
        po_item = po_line_items[i] if i < len(po_line_items) else None
        grn_item = grn_line_items[i] if i < len(grn_line_items) else None
        inv_item = inv_line_items[i] if i < len(inv_line_items) else None

        po_qty = po_item.quantity if po_item else Decimal('0')
        po_price = po_item.unit_price if po_item else Decimal('0')
        grn_qty = grn_item.quantity_received if grn_item else Decimal('0')
        grn_price = grn_item.unit_price if grn_item else Decimal('0')
        inv_qty = inv_item.quantity if inv_item else Decimal('0')
        inv_price = inv_item.unit_price if inv_item else Decimal('0')

        # ---- CHECK 1: Quantity ----
        qty_overbilled = inv_qty > grn_qty
        qty_underbilled = inv_qty < grn_qty
        qty_overdelivered = grn_qty > po_qty
        qty_exact = inv_qty == grn_qty
        qty_match = qty_exact or qty_underbilled

        if qty_overbilled:
            overall_overbilling = True
            total_discrepancies[f'line_{i+1}_qty_overbilled'] = {
                'grn': float(grn_qty), 'invoice': float(inv_qty),
                'severity': 'error', 'message': f'Invoice qty ({inv_qty}) exceeds GRN qty ({grn_qty}) — overbilling',
            }
        elif qty_underbilled:
            overall_warnings = True
            total_discrepancies[f'line_{i+1}_qty_underbilled'] = {
                'grn': float(grn_qty), 'invoice': float(inv_qty),
                'severity': 'warn', 'message': f'Invoice qty ({inv_qty}) is less than GRN qty ({grn_qty}) — acceptable',
            }
        if qty_overdelivered:
            overall_warnings = True
            total_discrepancies[f'line_{i+1}_qty_overdelivered'] = {
                'po': float(po_qty), 'grn': float(grn_qty),
                'severity': 'warn', 'message': f'GRN qty ({grn_qty}) exceeds PO qty ({po_qty}) — over-delivery',
            }

        # ---- CHECK 2: Unit Price ----
        price_tolerance = po_price * Decimal('0.005') if po_price else Decimal('0')
        price_above_po = po_price > 0 and (inv_price - po_price) > price_tolerance
        price_below_po = po_price > 0 and (po_price - inv_price) > price_tolerance
        price_match = not price_above_po and not price_below_po

        if price_above_po:
            overall_price_above_po = True
            total_discrepancies[f'line_{i+1}_price_above_po'] = {
                'po': float(po_price), 'invoice': float(inv_price),
                'severity': 'error', 'message': f'Invoice unit price ({inv_price}) exceeds PO price ({po_price}) by more than 0.5%',
            }
        elif price_below_po:
            overall_price_significantly_low = True
            total_discrepancies[f'line_{i+1}_price_below_po'] = {
                'po': float(po_price), 'invoice': float(inv_price),
                'severity': 'warn', 'message': f'Invoice unit price ({inv_price}) is below PO price ({po_price}) — flag for R-07 review',
            }

        # ---- CHECK 3: Item description match ----
        names = []
        if po_item and po_item.item_name:
            names.append(po_item.item_name.lower().strip())
        if grn_item and grn_item.item_name:
            names.append(grn_item.item_name.lower().strip())
        if inv_item and inv_item.item_name:
            names.append(inv_item.item_name.lower().strip())
        item_name_matched = len(set(names)) <= 1 if names else True
        codes = []
        if po_item and po_item.item_code:
            codes.append(po_item.item_code.lower().strip())
        if grn_item and grn_item.item_code:
            codes.append(grn_item.item_code.lower().strip())
        if inv_item and inv_item.item_code:
            codes.append(inv_item.item_code.lower().strip())
        item_code_matched = len(set(codes)) <= 1 if codes else True
        item_match = item_name_matched or item_code_matched

        if not item_match:
            overall_item_mismatch = True
            total_discrepancies[f'line_{i+1}_item_mismatch'] = {
                'severity': 'error', 'message': f'Item mismatch across PO/GRN/Invoice — review required',
                'po_item': po_item.item_name if po_item else '',
                'grn_item': grn_item.item_name if grn_item else '',
                'inv_item': inv_item.item_name if inv_item else '',
            }

        item_display = (po_item.item_name if po_item else
                        grn_item.item_name if grn_item else
                        inv_item.item_name if inv_item else '')

        line_matches.append({
            'line_number': i + 1,
            'item_name': item_display,
            'item_code': po_item.item_code if po_item else (grn_item.item_code if grn_item else (inv_item.item_code if inv_item else '')),
            'po_qty': float(po_qty),
            'grn_qty': float(grn_qty),
            'invoice_qty': float(inv_qty),
            'po_price': float(po_price),
            'grn_price': float(grn_price),
            'invoice_price': float(inv_price),
            'qty_match': qty_match,
            'qty_status': 'pass' if qty_exact else ('warn' if qty_underbilled or qty_overdelivered else 'fail'),
            'price_match': price_match,
            'price_status': 'pass' if price_match else 'fail',
            'item_match': item_match,
        })

    if not max_lines and inv.grn:
        line_matches.append({
            'line_number': 1,
            'item_name': inv.grn.item_description or '',
            'item_code': '',
            'po_qty': float(inv.grn.quantity_received),
            'grn_qty': float(inv.grn.quantity_received),
            'invoice_qty': float(inv.amount / inv.grn.unit_price) if inv.grn.unit_price else 0,
            'po_price': float(inv.grn.unit_price),
            'grn_price': float(inv.grn.unit_price),
            'invoice_price': float(inv.amount),
            'qty_match': True,
            'qty_status': 'pass',
            'price_match': True,
            'price_status': 'pass',
            'item_match': True,
        })
        overall_warnings = True
        total_discrepancies['header_level'] = {
            'severity': 'info',
            'message': 'No line items — matched at header level using GRN unit_price and invoice amount',
        }

    # Determine match status
    if overall_overbilling or overall_price_above_po or overall_item_mismatch:
        match_status = 'no_match'
    elif overall_price_significantly_low or overall_warnings:
        match_status = 'partial'
    else:
        match_status = 'complete'

    # GRN compliance checks
    grn_compliance_fail = False
    if not inv.grn:
        match_status = 'no_match'
        total_discrepancies['missing_grn'] = {'message': 'Invoice does not have a linked Goods Receipt Note (GRN)'}
    else:
        if not inv.grn.zamra_certificate_verified:
            grn_compliance_fail = True
            total_discrepancies['zamra_verification_missing'] = {'grn_value': False, 'required': True}
        if not inv.grn.cold_chain_maintained:
            grn_compliance_fail = True
            total_discrepancies['cold_chain_violation'] = {'grn_value': False, 'required': True}
        if not inv.grn.temperature_log_attached:
            grn_compliance_fail = True
            total_discrepancies['temperature_log_missing'] = {'grn_value': False, 'required': True}
        if grn_compliance_fail:
            match_status = 'no_match'

    inv.three_way_matches.all().delete()
    ThreeWayMatch.objects.create(
        invoice=inv,
        po_quantity=sum(m['po_qty'] for m in line_matches),
        grn_quantity=sum(m['grn_qty'] for m in line_matches),
        invoice_quantity=sum(m['invoice_qty'] for m in line_matches),
        po_price=sum(m['po_price'] for m in line_matches) / len(line_matches) if line_matches else 0,
        invoice_price=sum(m['invoice_price'] for m in line_matches) / len(line_matches) if line_matches else 0,
        match_status=match_status,
        discrepancies={'line_matches': line_matches, **total_discrepancies},
    )

    has_no_match_issues = overall_overbilling or overall_price_above_po or overall_item_mismatch or grn_compliance_fail
    has_warnings = overall_price_significantly_low or overall_warnings

    finance_review = None
    if match_status == 'complete':
        finance_review = _apply_invoice_finance_review(inv, inv.original_amount or inv.amount)
    else:
        inv.status = 'pending_matching'
        inv.approval_route = None
        inv.save()
        _notify_invoice_role(
            inv,
            'finance_officer',
            title=f'Invoice match needs review: {inv.invoice_number}',
            message=f'Invoice {inv.invoice_number} returned a {match_status} 3-way match and needs finance review.',
            priority='high',
            alert_key=f'invoice_match_{match_status}',
        )

    status_label = (
        'Ready for Approval' if match_status == 'complete'
        else 'Partial Match — Acceptable Discrepancies' if match_status == 'partial'
        else 'Discrepancy — Requires Review'
    )

    po_total = sum((m['po_qty'] * m['po_price']) for m in line_matches)
    grn_total = sum((m['grn_qty'] * m['grn_price']) for m in line_matches)
    inv_total_qty = sum(m['invoice_qty'] for m in line_matches)
    grn_total_qty = sum(m['grn_qty'] for m in line_matches)
    inv_amount_val = float(inv.amount)

    overbilling = any(m.get('qty_status') == 'fail' for m in line_matches)
    price_issues = any(m.get('price_status') == 'fail' for m in line_matches)
    item_issues = any(not m.get('item_match', True) for m in line_matches)

    return Response({
        'message': f'3-way match completed: {match_status}',
        'match_status': match_status,
        'workflow_status': status_label,
        'match': {
            'match_status': match_status,
            'overall_match': match_status == 'complete',
            'flag_for_review': match_status != 'complete',
            'has_overbilling': overall_overbilling,
            'has_price_above_po': overall_price_above_po,
            'has_price_below_po': overall_price_significantly_low,
            'has_item_mismatch': overall_item_mismatch,
            'has_warnings': has_warnings,
            'invoice_amount': inv_amount_val,
            'invoice_price': inv_amount_val / inv_total_qty if inv_total_qty else 0,
            'po_amount': po_total,
            'grn_amount': grn_total,
            'invoice_vs_po': not overbilling and not price_issues,
            'po_vs_grn': abs(po_total - grn_total) < 0.01,
            'invoice_vs_grn': not overbilling,
            'invoice_qty': inv_total_qty,
            'grn_qty': grn_total_qty,
            'line_matches': line_matches,
            'quantity_match': not overall_overbilling,
            'price_match': not overall_price_above_po,
            'item_match': not overall_item_mismatch,
            'zamra_certificate_verified': inv.grn.zamra_certificate_verified if inv.grn else False,
            'cold_chain_maintained': inv.grn.cold_chain_maintained if inv.grn else True,
            'temperature_log_attached': inv.grn.temperature_log_attached if inv.grn else False,
            'finance_review': {
                key: float(value) if isinstance(value, Decimal) else value
                for key, value in (finance_review or {}).items()
            },
        },
        'discrepancies': total_discrepancies,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_reject_view(request, pk):
    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    reason = request.data.get('reason', request.data.get('rejection_reason', ''))
    inv.status = 'rejected'
    inv.rejection_reason = reason
    inv.save()
    _notify_invoice_supplier(
        inv,
        title=f'Invoice rejected: {inv.invoice_number}',
        message=f'Invoice {inv.invoice_number} was rejected. Reason: {reason or "No reason provided."}',
        priority='high',
        alert_key='invoice_rejected',
    )
    return Response({'message': 'Invoice rejected', 'status': inv.status, 'rejection_reason': reason})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_approve_view(request, pk):
    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    if inv.status != 'pending_approval':
        return Response({'error': 'Invoice must be ready for approval before approval can continue'}, status=400)

    contract = inv.contract

    # Self-approval prohibition (Phase E.3):
    # R-07 (finance_officer) cannot approve payment for a contract they manage as R-12
    if request.user.role == 'finance_officer' and contract.contract_manager_id == request.user.id:
        return Response({
            'error': 'Self-approval prohibited: Finance Officer (R-07) cannot approve payment for a contract they also manage as Contract Manager (R-12).',
        }, status=403)

    # R-02 (department_head) cannot approve payment for a requisition raised by their own department
    if request.user.role == 'department_head' and contract.solicitation and contract.solicitation.requisition:
        req_dept_name = getattr(contract.solicitation.requisition.department, 'name', '') or ''
        if request.user.department and req_dept_name and request.user.department.lower() == req_dept_name.lower():
            return Response({
                'error': 'Self-approval prohibited: Department Head (R-02) cannot approve payment for a requisition raised by their own department.',
            }, status=403)

    final_route = inv.determine_approval_route()
    current_step = _next_invoice_approval_step(inv)

    if request.user.role != current_step:
        return Response({
            'error': f'This invoice requires approval from {dict(INVOICE_APPROVAL_ROUTES).get(current_step, current_step)}',
            'required_route': current_step,
        }, status=403)

    if current_step == final_route:
        inv.status = 'fully_approved'
        inv.approved_at = timezone.now()
        inv.approval_route = final_route
        inv.save(update_fields=['status', 'approved_at', 'approval_route', 'updated_at'])
        ip = request.META.get('REMOTE_ADDR', '')
        log_audit_action(
            user=request.user, action='INVOICE_APPROVED', module='finance',
            record_id=str(inv.invoice_id), ip_address=ip,
        )
        notify_roles(
            FINANCE_PAYMENT_ROLES,
            title=f'Invoice fully approved: {inv.invoice_number}',
            message=f'Invoice {inv.invoice_number} is fully approved and ready for payment processing.',
            notification_type='finance',
            priority='high',
            source_module='finance',
            object_id=inv.pk,
            action_url=_invoice_action_url(inv),
            metadata={
                'alert_key': 'invoice_fully_approved',
                'invoice_id': str(inv.pk),
                'invoice_number': inv.invoice_number,
            },
            email_required=True,
        )
        return Response({'message': 'Invoice fully approved for payment', 'status': inv.status, 'approval_route': final_route})

    next_step = APPROVAL_FLOW[APPROVAL_FLOW.index(current_step) + 1]
    inv.approval_route = next_step
    inv.save(update_fields=['approval_route', 'updated_at'])
    _notify_invoice_role(
        inv,
        next_step,
        title=f'Invoice approval required: {inv.invoice_number}',
        message=f'Invoice {inv.invoice_number} was approved by {dict(INVOICE_APPROVAL_ROUTES).get(current_step, current_step)} and now requires your approval.',
        priority='high',
        alert_key=f'invoice_routed_{next_step}',
    )
    return Response({
        'message': f'Invoice approved and routed to {dict(INVOICE_APPROVAL_ROUTES).get(next_step, next_step)}',
        'status': inv.status,
        'approval_route': next_step,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_accept_partial_view(request, pk):
    try:
        return _invoice_accept_partial(request, pk)
    except Exception as e:
        logger.exception('Error in invoice_accept_partial_view: %s', e)
        return Response({'error': f'Server error: {str(e)}'}, status=500)


def _invoice_accept_partial(request, pk):
    if request.user.role not in FINANCE_PAYMENT_ROLES:
        return Response({'error': 'Only finance officers can accept partial match discrepancies'}, status=403)

    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    match = inv.three_way_matches.order_by('-match_id').first()
    if not match or match.match_status != 'partial':
        return Response({'error': 'Only invoices with a partial 3-way match can be accepted for adjusted payment'}, status=400)

    original_amount = inv.original_amount or inv.amount
    approved_amount = Decimal(str(request.data.get('approved_amount', original_amount)))
    if approved_amount <= 0:
        return Response({'error': 'approved_amount must be positive'}, status=400)
    if approved_amount > original_amount:
        return Response({'error': 'approved_amount cannot exceed invoice amount'}, status=400)
    undelivered_amount = max(original_amount - approved_amount, Decimal('0'))

    discrepancies = match.discrepancies or {}
    discrepancies['partial_review'] = {
        'accepted': True,
        'approved_amount': float(approved_amount),
        'original_invoice_amount': float(original_amount),
        'note': request.data.get('notes', ''),
        'reviewed_by': str(request.user.id),
        'reviewed_at': timezone.now().isoformat(),
    }
    match.discrepancies = discrepancies
    match.save(update_fields=['discrepancies'])

    finance_review = _apply_invoice_finance_review(inv, approved_amount, undelivered_amount)

    return Response({
        'message': 'Partial match accepted. Invoice routed for adjusted approval.',
        'status': inv.status,
        'approved_amount': float(approved_amount),
        'net_payable_amount': float(inv.net_payable_amount),
        'retention_amount': float(inv.retention_amount),
        'liquidated_damages_amount': float(inv.liquidated_damages_amount),
        'finance_review': {
            key: float(value) if isinstance(value, Decimal) else value
            for key, value in finance_review.items()
        },
        'approval_route': inv.approval_route,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def grn_webhook_view(request):
    if not _verify_hmac_signature(request, 'WMS_WEBHOOK_SECRET'):
        return Response({'error': 'Invalid webhook signature'}, status=403)

    grn_number = request.data.get('grn_number', '')
    po_number = request.data.get('po_number', '')
    contract_id = request.data.get('contract_id', '')
    delivery_advice_id = request.data.get('delivery_advice_id', '')

    if not grn_number or not po_number:
        return Response({'error': 'grn_number and po_number are required'}, status=400)

    contract = None
    if contract_id:
        try:
            contract = Contract.objects.get(pk=contract_id)
        except Contract.DoesNotExist:
            pass
    if contract is None and po_number:
        contract = Contract.objects.filter(contract_number=po_number, status__in=('active', 'pending_acceptance')).first()

    delivery_advice = None
    if delivery_advice_id:
        try:
            delivery_advice = DeliveryAdvice.objects.select_related('contract', 'supplier').get(pk=delivery_advice_id)
        except DeliveryAdvice.DoesNotExist:
            return Response({'error': 'delivery_advice_id not found'}, status=404)
        if contract is None:
            contract = delivery_advice.contract

    # Support both flat payload and items array
    items_data = request.data.get('items', [])
    if not items_data:
        # Legacy flat format
        quantity = Decimal(str(request.data.get('quantity_received', 0)))
        unit_price = Decimal(str(request.data.get('unit_price', 0)))
        item_desc = request.data.get('item_description', '')
        received_by = request.data.get('received_by', '')
        total_amount = quantity * unit_price

        grn, created = GoodsReceiptNote.objects.update_or_create(
            grn_number=grn_number,
            defaults={
                'contract': contract,
                'delivery_advice': delivery_advice,
                'po_number': po_number,
                'item_description': item_desc,
                'quantity_received': quantity,
                'unit_price': unit_price,
                'total_amount': total_amount,
                'status': request.data.get('status', 'complete'),
                'received_by': received_by,
                'verified_by': 'wms_webhook',
                'verified_at': timezone.now(),
                'verification_method': 'wms_webhook',
                'zamra_certificate_verified': _bool_from_request(request.data.get('zamra_certificate_verified', False)),
                'cold_chain_maintained': _bool_from_request(request.data.get('cold_chain_maintained', True)),
                'temperature_log_attached': _bool_from_request(request.data.get('temperature_log_attached', False)),
                'source': 'webhook',
                'raw_webhook': request.data,
            }
        )
        # Create a single line item from the legacy flat data
        GRNLineItem.objects.update_or_create(
            grn=grn,
            line_number=1,
            defaults={
                'item_code': request.data.get('item_code', ''),
                'item_name': item_desc or request.data.get('item_name', ''),
                'quantity_ordered': quantity,
                'quantity_received': quantity,
                'condition': request.data.get('condition', 'good'),
                'batch_number': request.data.get('batch_number', ''),
                'expiry_date': parse_date(str(request.data.get('expiry_date', ''))) if request.data.get('expiry_date') else None,
                'unit_price': unit_price,
                'total_amount': total_amount,
            }
        )
    else:
        # Items array format — compute summary from items
        total_qty = Decimal('0')
        total_amount = Decimal('0')
        received_by = request.data.get('received_by', '')
        item_desc = ', '.join(
            str(it.get('item_name', it.get('item_code', '')))
            for it in items_data[:3]
        )
        if len(items_data) > 3:
            item_desc += f' (+{len(items_data) - 3} more)'

        for it in items_data:
            total_qty += Decimal(str(it.get('quantity_received', 0)))
            total_amount += Decimal(str(it.get('total_amount', 0)))

        unit_price = total_amount / total_qty if total_qty else Decimal('0')
        grn_status = 'complete'
        if any(Decimal(str(it.get('quantity_received', 0))) < Decimal(str(it.get('quantity_ordered', 0))) for it in items_data):
            grn_status = 'partial'
        if any(str(it.get('condition', 'good')).lower() in ('damaged', 'rejected') for it in items_data):
            grn_status = 'rejected'

        grn, created = GoodsReceiptNote.objects.update_or_create(
            grn_number=grn_number,
            defaults={
                'contract': contract,
                'delivery_advice': delivery_advice,
                'po_number': po_number,
                'item_description': item_desc,
                'quantity_received': total_qty,
                'unit_price': unit_price,
                'total_amount': total_amount,
                'status': request.data.get('status', grn_status),
                'received_by': received_by,
                'verified_by': 'wms_webhook',
                'verified_at': timezone.now(),
                'verification_method': 'wms_webhook',
                'zamra_certificate_verified': _bool_from_request(request.data.get('zamra_certificate_verified', False)),
                'cold_chain_maintained': _bool_from_request(request.data.get('cold_chain_maintained', True)),
                'temperature_log_attached': _bool_from_request(request.data.get('temperature_log_attached', False)),
                'source': 'webhook',
                'raw_webhook': request.data,
            }
        )

        # Create/replace line items from the items array
        grn.line_items.all().delete()
        for idx, it in enumerate(items_data, start=1):
            GRNLineItem.objects.create(
                grn=grn,
                line_number=idx,
                item_code=it.get('item_code', ''),
                item_name=it.get('item_name', ''),
                quantity_ordered=Decimal(str(it.get('quantity_ordered', 0))),
                quantity_received=Decimal(str(it.get('quantity_received', 0))),
                condition=str(it.get('condition', 'good')).lower(),
                batch_number=it.get('batch_number', ''),
                expiry_date=parse_date(str(it.get('expiry_date', ''))) if it.get('expiry_date') else None,
                unit_price=Decimal(str(it.get('unit_price', 0))),
                total_amount=Decimal(str(it.get('total_amount', 0))),
            )

    # Update related milestone if contract has one (auto-set actual_date)
    if contract:
        milestone_name = request.data.get('milestone_name', '')
        if milestone_name:
            ContractMilestone.objects.filter(
                contract=contract, milestone_name=milestone_name
            ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())
        else:
            # Auto-update Delivery milestone when no milestone_name specified
            ContractMilestone.objects.filter(
                contract=contract, milestone_name__icontains='Delivery'
            ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())

    return Response({
        'message': 'GRN received',
        'created': created,
        'grn': GoodsReceiptNoteSerializer(grn).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payment_bank_confirm_view(request, pk):
    if not _verify_hmac_signature(request, 'BANK_WEBHOOK_SECRET'):
        return Response({'error': 'Invalid webhook signature'}, status=403)

    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    payment = inv.payments.filter(status='sent').first()
    if not payment:
        return Response({'error': 'No sent payment found for this invoice'}, status=400)

    status_val = (request.data.get('status') or '').lower()
    confirmed = request.data.get('confirmed', False) or status_val in ('confirmed', 'paid')
    bank_ref = request.data.get('bank_reference', request.data.get('paymentRef', request.data.get('reference', '')))

    if confirmed:
        payment.status = 'confirmed'
        payment.reference = bank_ref
        payment.bank_reconciliation_status = 'paid'
        payment.bank_reconciled_at = timezone.now()
        payment.save(update_fields=['status', 'reference', 'bank_reconciliation_status', 'bank_reconciled_at'])
        inv.status = 'paid'
        inv.paid_at = timezone.now()
        inv.save(update_fields=['status', 'paid_at', 'updated_at'])

        # Auto-update Final Payment milestone actual_date
        from contracts.models import ContractMilestone
        ContractMilestone.objects.filter(
            contract=inv.contract, milestone_name__icontains='Payment'
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())
        _notify_invoice_supplier(
            inv,
            title=f'Payment confirmed: {inv.invoice_number}',
            message=f'Payment for invoice {inv.invoice_number} has been confirmed by the bank. Reference: {bank_ref or "N/A"}.',
            priority='normal',
            alert_key='payment_confirmed',
        )

        return Response({'message': 'Payment confirmed by bank', 'status': inv.status, 'bank_reference': bank_ref})
    else:
        payment.status = 'failed'
        payment.bank_reconciliation_status = 'unpaid'
        payment.bank_reconciled_at = timezone.now()
        payment.save(update_fields=['status', 'bank_reconciliation_status', 'bank_reconciled_at'])
        inv.status = 'payment_failed'
        inv.save(update_fields=['status', 'updated_at'])
        notify_roles(
            FINANCE_PAYMENT_ROLES,
            title=f'Payment failed: {inv.invoice_number}',
            message=f'Payment for invoice {inv.invoice_number} failed bank reconciliation and needs action.',
            notification_type='finance',
            priority='urgent',
            source_module='finance',
            object_id=inv.pk,
            action_url=_invoice_action_url(inv),
            metadata={'alert_key': 'payment_failed', 'invoice_number': inv.invoice_number},
            email_required=True,
        )
        alert_integration_manager(
            title=f'Bank payment failure: {inv.invoice_number}',
            message=f'Bank confirmation reported a payment failure for invoice {inv.invoice_number}.',
            metadata={'alert_key': 'bank_payment_failed', 'invoice_id': str(inv.pk), 'bank_reference': bank_ref},
            sms_required=True,
        )
        return Response({'message': 'Payment failed', 'status': payment.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payment_manual_confirm_view(request, pk):
    """Alternative to bank webhook — finance officer manually confirms payment (for testing)."""
    if request.user.role not in FINANCE_PAYMENT_ROLES:
        return Response({'error': 'Only finance officers can confirm payments'}, status=403)

    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    payment = inv.payments.filter(status='sent').first()
    if not payment:
        return Response({'error': 'No sent payment found for this invoice. Process payment first.'}, status=400)

    bank_ref = request.data.get('bank_reference', '')
    if not bank_ref:
        bank_ref = f'MANUAL-{timezone.now().strftime("%Y%m%d-%H%M%S")}'

    reconcile_status = (request.data.get('status') or request.data.get('reconciliation_status') or 'paid').lower()
    confirmed = request.data.get('confirmed')
    if confirmed is not None:
        reconcile_status = 'paid' if _bool_from_request(confirmed) else 'unpaid'

    if reconcile_status not in ('paid', 'unpaid'):
        return Response({'error': 'status must be paid or unpaid'}, status=400)

    payment.status = 'confirmed' if reconcile_status == 'paid' else 'failed'
    payment.reference = bank_ref
    payment.bank_reconciliation_status = reconcile_status
    payment.bank_reconciled_by = request.user
    payment.bank_reconciled_at = timezone.now()
    payment.save(update_fields=['status', 'reference', 'bank_reconciliation_status', 'bank_reconciled_by', 'bank_reconciled_at'])

    inv.status = 'paid' if reconcile_status == 'paid' else 'payment_failed'
    inv.paid_at = timezone.now() if reconcile_status == 'paid' else None
    inv.save(update_fields=['status', 'paid_at', 'updated_at'])

    # Auto-update Final Payment milestone actual_date
    if reconcile_status == 'paid':
        from contracts.models import ContractMilestone
        ContractMilestone.objects.filter(
            contract=inv.contract, milestone_name__icontains='Payment'
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())
        _notify_invoice_supplier(
            inv,
            title=f'Payment confirmed: {inv.invoice_number}',
            message=f'Payment for invoice {inv.invoice_number} was manually confirmed. Reference: {bank_ref}.',
            priority='normal',
            alert_key='payment_manual_confirmed',
        )
    else:
        notify_roles(
            FINANCE_PAYMENT_ROLES,
            title=f'Payment reconciliation failed: {inv.invoice_number}',
            message=f'Payment for invoice {inv.invoice_number} was manually marked unpaid and needs action.',
            notification_type='finance',
            priority='urgent',
            source_module='finance',
            object_id=inv.pk,
            action_url=_invoice_action_url(inv),
            metadata={'alert_key': 'payment_manual_failed', 'invoice_number': inv.invoice_number},
            email_required=True,
        )
        alert_integration_manager(
            title=f'Manual payment failure: {inv.invoice_number}',
            message=f'Payment reconciliation for invoice {inv.invoice_number} was marked unpaid.',
            metadata={'alert_key': 'manual_payment_failed', 'invoice_id': str(inv.pk), 'bank_reference': bank_ref},
            sms_required=True,
        )

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='PAYMENT_MANUAL_CONFIRM', module='finance',
        record_id=str(inv.invoice_id), ip_address=ip,
    )

    return Response({
        'message': 'Payment reconciliation updated successfully',
        'status': inv.status,
        'bank_reference': bank_ref,
        'reconciliation_status': reconcile_status,
        'note': 'Use bank-confirm webhook endpoint in production',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_send_payment_advice_view(request, pk):
    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    if inv.status != 'paid':
        return Response({'error': 'Invoice must be paid before sending advice'}, status=400)

    inv.payment_advice_sent = True
    inv.payment_advice_sent_at = timezone.now()
    inv.save()
    notification = _notify_invoice_supplier(
        inv,
        title=f'Payment advice: {inv.invoice_number}',
        message=f'Payment advice for invoice {inv.invoice_number} has been issued. Amount: {inv.amount} {getattr(inv, "currency", "ZMW")}.',
        priority='normal',
        alert_key='payment_advice_sent',
    )

    return Response({
        'message': 'Payment advice sent to supplier',
        'supplier': inv.supplier.name,
        'amount': float(inv.amount),
        'email_sent': notification.email_status == 'sent' if notification else False,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_post_to_erp_view(request, pk):
    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    if inv.status != 'paid':
        return Response({'error': 'Only paid invoices can be posted to ERP'}, status=400)

    inv.erp_posted = True
    inv.erp_posted_at = timezone.now()
    inv.save()

    return Response({
        'message': 'Expenditure posted to ERP general ledger',
        'invoice': inv.invoice_number,
        'amount': float(inv.amount),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def payment_process_view(request, pk):
    try:
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    if request.user.role not in FINANCE_PAYMENT_ROLES:
        return Response({'error': 'Only finance officers can process payments'}, status=403)

    if inv.status not in ('approved', 'fully_approved'):
        return Response({'error': 'Invoice must be approved for payment before processing'}, status=400)

    has_complete_match = ThreeWayMatch.objects.filter(invoice=inv, match_status='complete').exists()
    has_accepted_partial = any(
        (m.discrepancies or {}).get('partial_review', {}).get('accepted')
        for m in ThreeWayMatch.objects.filter(invoice=inv, match_status='partial')
    )
    if not has_complete_match and not has_accepted_partial:
        return Response({
            'error': '3-way match must be complete or a partial discrepancy must be accepted before payment can be processed',
            'invoice': inv.invoice_number,
        }, status=400)

    payment_method = request.data.get('payment_method', 'electronic')
    amount = Decimal(str(request.data.get('amount', inv.net_payable_amount or inv.amount)))
    if amount <= 0:
        return Response({'error': 'Payment amount must be positive'}, status=400)
    if amount > inv.amount:
        return Response({'error': 'Payment amount cannot exceed invoice amount'}, status=400)

    apply_retention = _bool_from_request(request.data.get('apply_retention', inv.retention_amount <= 0))
    retained_amount = inv.retention_amount or Decimal('0')
    if apply_retention and not retained_amount:
        retention_rate = inv.contract.retention_rate
        retained_amount = (amount * retention_rate).quantize(Decimal('0.01'))
        amount -= retained_amount

    pmt = Payment.objects.create(
        invoice=inv,
        contract=inv.contract,
        amount=amount,
        retained_amount=retained_amount,
        payment_method=payment_method,
        status='processing',
    )

    if payment_method == 'iso20022':
        pain001 = Element('Document', xmlns='urn:iso:std:iso:20022:tech:xsd:pain.001.001.03')
        cdt_trf_instr = SubElement(pain001, 'CdtTrfTxInf')
        pmt_inf = SubElement(cdt_trf_instr, 'PmtInf')
        pmt_id = SubElement(pmt_inf, 'PmtId')
        instr_id = SubElement(pmt_id, 'InstrId')
        instr_id.text = str(pmt.payment_id)
        end_to_end = SubElement(pmt_id, 'EndToEndId')
        end_to_end.text = inv.invoice_number
        amt_el = SubElement(pmt_inf, 'Amt')
        amt_el.text = str(amount)
        xml_bytes = tostring(pain001, encoding='unicode')
        file_hash = hashlib.sha256(xml_bytes.encode()).hexdigest()
        pmt.iso20022_file_ref = file_hash
        pmt.pgp_encrypted_file_ref = f'{file_hash}.pgp'
        pmt.sftp_outbox_ref = f'sftp/outbox/{file_hash}.xml.pgp'
        pmt.status = 'sent'
        pmt.processed_at = timezone.now()
        pmt.save(update_fields=['iso20022_file_ref', 'pgp_encrypted_file_ref', 'sftp_outbox_ref', 'status', 'processed_at'])
        notify_roles(
            FINANCE_PAYMENT_ROLES,
            title=f'Payment file sent: {inv.invoice_number}',
            message=f'ISO 20022 payment file for invoice {inv.invoice_number} was generated and sent for bank processing.',
            notification_type='finance',
            priority='normal',
            source_module='finance',
            object_id=inv.pk,
            action_url=_invoice_action_url(inv),
            metadata={'alert_key': 'payment_sent_iso20022', 'payment_id': str(pmt.pk)},
            email_required=True,
        )

        return Response({
            'message': 'ISO 20022 payment file generated and sent for bank processing',
            'status': pmt.status,
            'iso20022_file_ref': file_hash,
            'pgp_encrypted_file_ref': pmt.pgp_encrypted_file_ref,
            'sftp_outbox_ref': pmt.sftp_outbox_ref,
            'xml_content': xml_bytes if getattr(settings, 'DEBUG', False) else '',
        })

    pmt.status = 'sent'
    pmt.processed_at = timezone.now()
    pmt.save(update_fields=['status', 'processed_at'])
    notify_roles(
        FINANCE_PAYMENT_ROLES,
        title=f'Payment sent: {inv.invoice_number}',
        message=f'Payment for invoice {inv.invoice_number} was sent for bank processing.',
        notification_type='finance',
        priority='normal',
        source_module='finance',
        object_id=inv.pk,
        action_url=_invoice_action_url(inv),
        metadata={'alert_key': 'payment_sent', 'payment_id': str(pmt.pk)},
        email_required=True,
    )

    return Response({'message': 'Payment sent for bank processing', 'status': pmt.status})


class PaymentListView(BaseView, generics.ListAPIView):
    queryset = Payment.objects.select_related('invoice').all()
    serializer_class = PaymentSerializer
    ordering = ['-created_at']


class GRNListView(BaseView, generics.ListAPIView):
    queryset = GoodsReceiptNote.objects.select_related('contract').all()
    serializer_class = GoodsReceiptNoteSerializer
    ordering = ['-received_date']
    filterset_fields = ['contract']


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def supplier_available_grns_view(request, pk):
    """Return GRNs available for invoicing: COMPLETE/PARTIAL, not already invoiced, for the supplier's contract."""
    from contracts.models import Contract
    from django.db.models import Q
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)
    if getattr(request.user, 'role', '') == 'supplier_user':
        if not _user_can_access_supplier_contract(request.user, contract):
            return Response({'error': 'Access denied'}, status=403)
    grns = GoodsReceiptNote.objects.filter(
        contract=contract,
        status__in=['complete', 'partial'],
    ).exclude(
        grn_id__in=Invoice.objects.filter(
            contract=contract, status__in=['submitted', 'pending_matching', 'finance_reviewed', 'pending_approval', 'approved', 'fully_approved', 'paid']
        ).values('grn_id')
    ).order_by('-received_date')
    has_items_table = 'fin_grn_line_item' in connection.introspection.table_names()
    if has_items_table:
        grns = grns.prefetch_related('line_items')
    result = []
    for g in grns:
        items = list(g.line_items.all()) if has_items_table else []
        result.append({
            'grn_id': str(g.grn_id),
            'grn_number': g.grn_number,
            'status': g.status,
            'received_date': g.received_date,
            'item_description': g.item_description,
            'quantity_received': float(g.quantity_received),
            'unit_price': float(g.unit_price),
            'total_amount': float(g.total_amount),
            'line_items': [
                {
                    'line_item_id': str(li.line_item_id),
                    'line_number': li.line_number,
                    'item_code': li.item_code,
                    'item_name': li.item_name,
                    'quantity_ordered': float(li.quantity_ordered),
                    'quantity_received': float(li.quantity_received),
                    'unit_price': float(li.unit_price),
                    'total_amount': float(li.total_amount),
                }
                for li in items
            ],
        })
    return Response({'grns': result})


def _user_can_access_supplier_contract(user, contract):
    from suppliers.models import VendorApplication
    filters = Q(winning_bid__supplier=user)
    if user.employee_id and str(user.employee_id).startswith('SUP-'):
        reg = str(user.employee_id).replace('SUP-', '', 1)
        filters |= Q(supplier__registration_number=reg)
    app = VendorApplication.objects.filter(email=user.email).first()
    if app and app.registration_number:
        filters |= Q(supplier__registration_number=app.registration_number)
    return Contract.objects.filter(pk=contract.pk).filter(filters).exists()


class DeliveryAdviceListView(BaseView, generics.ListAPIView):
    queryset = DeliveryAdvice.objects.select_related('contract', 'supplier').all()
    serializer_class = DeliveryAdviceSerializer
    ordering = ['-submitted_at']
    filterset_fields = ['contract', 'status', 'supplier']
    search_fields = ['advice_number', 'contract__contract_number', 'supplier__name']


class LetterOfCreditListView(BaseView, generics.ListCreateAPIView):
    queryset = LetterOfCredit.objects.select_related('contract').all()
    serializer_class = LetterOfCreditSerializer
    ordering = ['-issued_at']


class LetterOfCreditDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LetterOfCredit.objects.all()
    serializer_class = LetterOfCreditSerializer
    permission_classes = [IsAuthenticated]


class PurchaseOrderListView(BaseView, generics.ListAPIView):
    queryset = PurchaseOrder.objects.select_related('contract', 'supplier').prefetch_related('line_items').all()
    serializer_class = PurchaseOrderSerializer
    ordering = ['-created_at']
    filterset_fields = ['contract', 'status']
    search_fields = ['po_number', 'contract__contract_number', 'supplier__name']


class PurchaseOrderDetailView(generics.RetrieveAPIView):
    queryset = PurchaseOrder.objects.select_related('contract', 'supplier').prefetch_related('line_items').all()
    serializer_class = PurchaseOrderSerializer
    permission_classes = [IsAuthenticated]


FINANCE_OFFICER_ROLES = ('finance_officer', 'budget_controller', 'integration_manager', 'system_admin')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_sync_from_erp_view(request):
    if request.user.role not in FINANCE_OFFICER_ROLES:
        return Response({'error': 'Only finance officers can sync budgets from ERP'}, status=status.HTTP_403_FORBIDDEN)

    allocations_data = request.data.get('allocations', [])
    if not allocations_data:
        return Response({'error': 'allocations array is required'}, status=status.HTTP_400_BAD_REQUEST)

    synced_count = 0
    errors = []

    for entry in allocations_data:
        entity_code = entry.get('entity_code', '').strip()
        fiscal_year = entry.get('fiscal_year', '').strip()
        allocated_amount = entry.get('allocated_amount', 0)
        entity_level = entry.get('entity_level', 'department')
        entity_name = entry.get('entity_name', '')

        if not entity_code or not fiscal_year:
            errors.append({'entity_code': entity_code, 'error': 'entity_code and fiscal_year are required'})
            continue

        try:
            allocation, created = BudgetAllocation.objects.update_or_create(
                entity_code=entity_code,
                fiscal_year=fiscal_year,
                defaults={
                    'entity_level': entity_level,
                    'entity_name': entity_name,
                    'allocated_amount': Decimal(str(allocated_amount)),
                    'last_synced_at': timezone.now(),
                    'sync_source': 'erp_api',
                    'raw_data': entry,
                },
            )
            synced_count += 1
        except Exception as e:
            errors.append({'entity_code': entity_code, 'error': str(e)})

    return Response({
        'message': f'Budget sync completed. {synced_count} allocations synced.',
        'synced_count': synced_count,
        'errors': errors,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_encumber_view(request, pk):
    try:
        allocation = BudgetAllocation.objects.get(pk=pk)
    except BudgetAllocation.DoesNotExist:
        return Response({'error': 'Budget allocation not found'}, status=404)

    amount = Decimal(str(request.data.get('amount', 0)))
    if amount <= 0:
        return Response({'error': 'Amount must be positive'}, status=400)
    if amount > allocation.available:
        return Response({'error': 'Insufficient available budget'}, status=400)

    from requisitions.models import Requisition
    req_id = request.data.get('requisition', '')
    try:
        requisition = Requisition.objects.get(pk=req_id)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    encumbrance = BudgetEncumbrance.objects.create(
        requisition=requisition,
        amount=amount,
    )
    allocation.encumbered_amount += amount
    allocation.save(update_fields=['encumbered_amount'])

    return Response({
        'message': 'Budget encumbered successfully',
        'encumbrance_id': str(encumbrance.encumbrance_id),
        'amount': float(amount),
        'available': float(allocation.available),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def budget_release_view(request, pk):
    try:
        encumbrance = BudgetEncumbrance.objects.get(pk=pk, status='active')
    except BudgetEncumbrance.DoesNotExist:
        return Response({'error': 'Active encumbrance not found'}, status=404)

    allocation = BudgetAllocation.objects.filter(
        entity_code=encumbrance.requisition.department.budget_code,
        fiscal_year=timezone.now().year,
    ).first()

    encumbrance.status = 'released'
    encumbrance.released_at = timezone.now()
    encumbrance.save(update_fields=['status', 'released_at'])

    if allocation:
        allocation.encumbered_amount = max(allocation.encumbered_amount - encumbrance.amount, 0)
        allocation.save(update_fields=['encumbered_amount'])

    return Response({
        'message': 'Encumbrance released',
        'encumbrance_id': str(encumbrance.encumbrance_id),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def lc_drawdown_view(request, pk):
    try:
        lc = LetterOfCredit.objects.get(pk=pk)
    except LetterOfCredit.DoesNotExist:
        return Response({'error': 'Letter of Credit not found'}, status=404)

    if lc.status in ('exhausted', 'expired'):
        return Response({'error': f'LC is already {lc.status}'}, status=400)

    amount = Decimal(str(request.data.get('amount', 0)))
    if amount <= 0:
        return Response({'error': 'Drawdown amount must be positive'}, status=400)

    # For now, mark as utilized and reduce available (future: track used_amount)
    lc.status = 'utilized'
    lc.save(update_fields=['status'])

    return Response({
        'message': 'LC drawdown recorded',
        'lc_id': str(lc.loc_id),
        'amount': float(amount),
        'status': lc.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def manual_grn_create_view(request):
    """Alternative to WMS webhook — R-12 manually creates a GRN (for testing)."""
    if request.user.role not in ('contract_manager', 'procurement_officer', 'system_admin'):
        return Response({'error': 'Only contract managers and procurement officers can create GRNs manually'}, status=403)

    contract_id = request.data.get('contract_id', '')
    if not contract_id:
        return Response({'error': 'contract_id is required'}, status=400)

    try:
        contract = Contract.objects.get(pk=contract_id)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    grn_number = request.data.get('grn_number', '')
    if not grn_number:
        count = GoodsReceiptNote.objects.filter(contract=contract).count() + 1
        grn_number = f'GRN-{contract.contract_number}-{count:04d}'

    received_by = request.data.get('received_by', request.user.full_name if hasattr(request.user, 'full_name') else str(request.user))
    verifier_name = request.user.full_name if hasattr(request.user, 'full_name') else str(request.user)

    items_data = request.data.get('items', [])
    if not items_data:
        # Flat single-item format
        quantity = Decimal(str(request.data.get('quantity_received', 0)))
        unit_price = Decimal(str(request.data.get('unit_price', 0)))
        item_desc = request.data.get('item_description', '')
        total_amount = quantity * unit_price

        grn = _build_grn_from_items(
            contract=contract,
            po_number=contract.contract_number,
            grn_number=grn_number,
            items_data=[{
                'item_code': request.data.get('item_code', ''),
                'item_name': item_desc or request.data.get('item_name', ''),
                'quantity_ordered': quantity,
                'quantity_received': quantity,
                'unit_price': unit_price,
                'total_amount': total_amount,
            }],
            received_by=received_by,
            notes=request.data.get('notes', ''),
            source='manual',
            raw_webhook={'source': 'manual_grn_create', **request.data},
            verification_method='manual_receipt',
            verified_by=verifier_name,
        )
    else:
        grn = _build_grn_from_items(
            contract=contract,
            po_number=contract.contract_number,
            grn_number=grn_number,
            items_data=items_data,
            received_by=received_by,
            notes=request.data.get('notes', ''),
            source='manual',
            raw_webhook={'source': 'manual_grn_create', **request.data},
            verification_method='manual_receipt',
            verified_by=verifier_name,
        )

    # Update milestone if specified (auto-set actual_date)
    milestone_name = request.data.get('milestone_name', '')
    if milestone_name and contract:
        ContractMilestone.objects.filter(
            contract=contract, milestone_name=milestone_name
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())
    elif contract:
        # Auto-update Delivery milestone
        ContractMilestone.objects.filter(
            contract=contract, milestone_name__icontains='Delivery'
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='GRN_MANUAL_CREATE', module='finance',
        record_id=str(grn.grn_id), ip_address=ip,
    )

    # If a delivery_advice_id was provided, link GRN to advice and mark verified
    delivery_advice_id = request.data.get('delivery_advice_id', '')
    advice_linked = None
    if delivery_advice_id:
        try:
            advice = DeliveryAdvice.objects.get(pk=delivery_advice_id)
            if advice.status == 'submitted':
                grn.delivery_advice = advice
                grn.verified_by = verifier_name
                grn.verified_at = timezone.now()
                grn.save(update_fields=['delivery_advice', 'verified_by', 'verified_at'])
                advice.status = 'verified'
                advice.verified_by = verifier_name
                advice.verified_at = timezone.now()
                advice.save(update_fields=['status', 'verified_by', 'verified_at'])
                advice_linked = {'advice_id': str(advice.advice_id), 'status': 'verified'}
        except DeliveryAdvice.DoesNotExist:
            pass

    return Response({
        'message': 'GRN created manually',
        'grn': GoodsReceiptNoteSerializer(grn).data,
        'advice_linked': advice_linked,
        'note': 'Use grn-webhook endpoint in production with WMS integration',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def retention_release_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    RETENTION_RELEASE_ROLES = FINANCE_PAYMENT_ROLES + ('contract_manager',)
    if request.user.role not in RETENTION_RELEASE_ROLES:
        return Response({'error': 'Only finance officers or contract managers can release retention'}, status=403)

    if contract.completed_at:
        releasable_on = contract.completed_at + timedelta(days=30)
        if timezone.now().date() < releasable_on and not _bool_from_request(request.data.get('override')):
            return Response({
                'error': 'Retention cannot be released before 30 days after final acceptance/completion',
                'releasable_on': releasable_on,
            }, status=400)

    amount = Decimal(str(request.data.get('amount', 0)))
    if amount <= 0:
        return Response({'error': 'Release amount must be positive'}, status=400)

    cert_ref = request.data.get('acceptance_certificate_ref', '')
    notes = request.data.get('notes', '')

    release = RetentionRelease.objects.create(
        contract=contract,
        amount=amount,
        released_by=request.user,
        acceptance_certificate_ref=cert_ref,
        notes=notes,
    )

    Payment.objects.filter(contract=contract).update(retention_released=True)
    from contracts.models import ClosureChecklist
    ClosureChecklist.objects.filter(contract=contract).update(retention_released=True)

    return Response({
        'message': 'Retention released successfully',
        'amount': float(amount),
        'release': RetentionReleaseSerializer(release).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def contract_financial_summary_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    total_paid = Payment.objects.filter(
        contract=contract, status='confirmed'
    ).aggregate(total=Sum('amount'))['total'] or 0

    total_retained = Payment.objects.filter(
        contract=contract, status='confirmed'
    ).aggregate(total=Sum('retained_amount'))['total'] or 0

    total_invoiced = Invoice.objects.filter(
        contract=contract, status__in=('paid', 'fully_approved', 'pending_approval', 'finance_reviewed')
    ).aggregate(total=Sum('original_amount'))['total'] or 0

    total_ld = LiquidatedDamages.objects.filter(
        contract=contract, status__in=('assessed', 'applied')
    ).aggregate(total=Sum('applied_amount'))['total'] or 0

    total_retention_released = RetentionRelease.objects.filter(
        contract=contract
    ).aggregate(total=Sum('amount'))['total'] or 0

    amendment_total = contract.amendments.aggregate(
        total=Sum('financial_impact')
    )['total'] or 0

    milestones = ContractMilestone.objects.filter(contract=contract).values(
        'milestone_id', 'milestone_name', 'actual_date', 'due_date', 'status', 'variance_flag'
    ).order_by('due_date')

    po = PurchaseOrder.objects.filter(contract=contract).order_by('-created_at').first()
    purchase_orders_list = PurchaseOrder.objects.filter(contract=contract).values(
        'po_id', 'po_number', 'total_amount', 'status', 'created_at'
    ).order_by('-created_at')

    grns = GoodsReceiptNote.objects.filter(contract=contract).values(
        'grn_id', 'grn_number', 'item_description', 'quantity_received',
        'unit_price', 'total_amount', 'received_date', 'status'
    ).order_by('-received_date')

    supplier_bank = {}
    if contract.supplier:
        bank_number = contract.supplier.bank_account_number or ''
        masked = f'••••{bank_number[-4:]}' if len(bank_number) >= 4 else ''
        supplier_bank = {
            'bank_name': contract.supplier.bank_name or '',
            'bank_account_number': masked,
            'bank_account_name': contract.supplier.bank_account_name or '',
        }

    final_value = contract.value + amendment_total
    budget_savings = max(final_value - total_invoiced, Decimal('0'))

    return Response({
        'contract_id': str(contract.contract_id),
        'contract_number': contract.contract_number,
        'title': contract.title,
        'po_number': po.po_number if po else None,
        'purchase_orders': [
            {
                'id': str(po_entry['po_id']),
                'po_number': po_entry['po_number'],
                'total_amount': float(po_entry['total_amount']),
                'status': po_entry['status'],
            }
            for po_entry in purchase_orders_list
        ],
        'original_value': float(contract.value),
        'amendment_total': float(amendment_total),
        'final_contract_value': float(final_value),
        'currency': contract.currency,
        'total_invoiced': float(total_invoiced),
        'total_ld_deducted': float(total_ld),
        'payments_to_date': float(total_paid),
        'retained_to_date': float(total_retained),
        'retention_released_to_date': float(total_retention_released),
        'budget_savings': float(budget_savings),
        'balance': float(final_value - total_paid - total_retained),
        'retention_rate': float(contract.retention_rate),
        'payment_terms': '30 days from invoice approval',
        'milestones': list(milestones),
        'grns': list(grns),
        'start_date': contract.start_date,
        'end_date': contract.end_date,
        'status': contract.status,
        'supplier_bank': supplier_bank,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def supplier_delivery_log_view(request):
    """Supplier-facing endpoint to submit a delivery advice against a contract."""
    if request.user.role != 'supplier_user':
        return Response({'error': 'Only suppliers can submit delivery advice'}, status=403)

    contract_id = request.data.get('contract_id', '')
    if not contract_id:
        return Response({'error': 'contract_id is required'}, status=400)

    try:
        contract = Contract.objects.get(pk=contract_id)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    advice_number = request.data.get('advice_number', '')
    if not advice_number:
        count = DeliveryAdvice.objects.filter(contract=contract).count() + 1
        advice_number = f'ADV-{contract.contract_number}-{count:04d}'

    items_data = request.data.get('items', [])
    if not items_data:
        return Response({'error': 'At least one delivery item is required'}, status=400)

    total_qty = Decimal('0')
    total_amount = Decimal('0')
    item_desc_parts = []

    for it in items_data:
        total_qty += Decimal(str(it.get('quantity_delivered', 0)))
        total_amount += Decimal(str(it.get('total_amount', 0)))
        item_desc_parts.append(it.get('item_name', it.get('item_code', '')))

    item_desc = ', '.join(item_desc_parts[:3])
    if len(item_desc_parts) > 3:
        item_desc += f' (+{len(item_desc_parts) - 3} more)'

    advice = DeliveryAdvice.objects.create(
        advice_number=advice_number,
        contract=contract,
        supplier=contract.supplier,
        item_description=item_desc,
        quantity_advised=total_qty,
        total_amount=total_amount,
        notes=request.data.get('notes', ''),
        status='submitted',
        source='supplier_portal',
        submitted_by=request.user.full_name if hasattr(request.user, 'full_name') else str(request.user),
        raw_payload=request.data,
    )

    return Response({
        'message': 'Delivery advice submitted successfully',
        'advice': DeliveryAdviceSerializer(advice).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def verify_delivery_advice_view(request, pk):
    if request.user.role not in ('contract_manager', 'procurement_officer', 'system_admin'):
        return Response({'error': 'Only contract managers and procurement officers can verify delivery advice'}, status=403)

    try:
        advice = DeliveryAdvice.objects.select_related('contract', 'supplier').get(pk=pk)
    except DeliveryAdvice.DoesNotExist:
        return Response({'error': 'Delivery advice not found'}, status=404)

    if advice.status == 'verified':
        return Response({'error': 'Delivery advice has already been verified'}, status=400)

    grn_number = request.data.get('grn_number', '').strip()
    grn = None
    if grn_number:
        grn = GoodsReceiptNote.objects.select_related('contract', 'delivery_advice').filter(
            contract=advice.contract,
            grn_number=grn_number,
        ).first()
    if grn is None:
        grn = GoodsReceiptNote.objects.select_related('contract', 'delivery_advice').filter(
            contract=advice.contract,
            delivery_advice=advice,
        ).order_by('-received_date').first()
    if grn is None:
        webhook_grns = GoodsReceiptNote.objects.select_related('contract', 'delivery_advice').filter(
            contract=advice.contract,
            source='webhook',
        ).order_by('-received_date')
        if webhook_grns.count() == 1:
            grn = webhook_grns.first()
        elif webhook_grns.count() > 1 and not grn_number:
            return Response({
                'error': 'Multiple WMS GRNs were found for this contract. Please provide a GRN number to verify.',
                'manual_grn_required': False,
            }, status=400)

    if grn is None:
        return Response({
            'error': 'WMS has not sent the GRN webhook yet, or the warehouse system is offline. No GRN was found for this delivery advice. Please check WMS or create the GRN manually.',
            'manual_grn_required': True,
        }, status=404)

    received_by = request.data.get(
        'received_by',
        request.user.full_name if hasattr(request.user, 'full_name') else str(request.user)
    )
    notes = request.data.get('notes', advice.notes)
    verifier_name = request.user.full_name if hasattr(request.user, 'full_name') else str(request.user)

    if not grn.delivery_advice_id:
        grn.delivery_advice = advice

    milestone_name = request.data.get('milestone_name', '') or grn.raw_webhook.get('milestone_name', '') or advice.raw_payload.get('milestone_name', '')
    if milestone_name:
        ContractMilestone.objects.filter(
            contract=advice.contract, milestone_name=milestone_name
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())
    elif advice.contract:
        ContractMilestone.objects.filter(
            contract=advice.contract, milestone_name__icontains='Delivery'
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())

    grn.verified_by = verifier_name
    grn.verified_at = timezone.now()
    grn.verification_method = 'wms_webhook_verification'
    
    # Update compliance and certificates verified during manual inspection
    if 'zamra_certificate_verified' in request.data:
        grn.zamra_certificate_verified = _bool_from_request(request.data['zamra_certificate_verified'])
    if 'cold_chain_maintained' in request.data:
        grn.cold_chain_maintained = _bool_from_request(request.data['cold_chain_maintained'])
    if 'temperature_log_attached' in request.data:
        grn.temperature_log_attached = _bool_from_request(request.data['temperature_log_attached'])
        
    grn.save(update_fields=[
        'delivery_advice', 'verified_by', 'verified_at', 'verification_method',
        'zamra_certificate_verified', 'cold_chain_maintained', 'temperature_log_attached'
    ])

    advice.status = 'verified'
    advice.verified_by = verifier_name
    advice.verified_at = timezone.now()
    advice.verification_method = 'wms_webhook_verification'
    advice.save(update_fields=['status', 'verified_by', 'verified_at', 'verification_method'])

    return Response({
        'message': 'WMS GRN verified and contract milestone updated',
        'advice': DeliveryAdviceSerializer(advice).data,
        'grn': GoodsReceiptNoteSerializer(grn).data,
        'milestone_name': milestone_name,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def execution_dashboard_view(request, pk):
    """Contract manager dashboard showing milestones, deliveries, and shortages."""
    try:
        contract = Contract.objects.select_related('supplier').prefetch_related(
            'goods_receipt_notes', 'invoices', 'payments', 'milestones',
        ).get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    has_grn_line_items_table = 'fin_grn_line_item' in connection.introspection.table_names()
    grns_queryset = GoodsReceiptNote.objects.filter(contract=contract).order_by('-received_date')
    if has_grn_line_items_table:
        grns_queryset = grns_queryset.prefetch_related('line_items')
    grns = grns_queryset
    milestones = ContractMilestone.objects.filter(contract=contract).order_by('due_date')
    invoices_list = Invoice.objects.filter(contract=contract).order_by('-created_at')
    payments_list = Payment.objects.filter(contract=contract).order_by('-created_at')

    # Delivery shortages: compare ordered vs received per item
    shortages = []
    for grn in grns:
        line_items = list(grn.line_items.all()) if has_grn_line_items_table else []
        for item in line_items:
            shortage = item.quantity_ordered - item.quantity_received
            if shortage > 0:
                shortages.append({
                    'grn_number': grn.grn_number,
                    'item_code': item.item_code,
                    'item_name': item.item_name,
                    'ordered': float(item.quantity_ordered),
                    'received': float(item.quantity_received),
                    'shortage': float(shortage),
                })

    total_paid = sum(p.amount for p in payments_list if p.status == 'confirmed')
    total_retained = sum(p.retained_amount for p in payments_list if p.status == 'confirmed')
    balance = float(contract.value - total_paid - total_retained)

    po = PurchaseOrder.objects.filter(contract=contract, status='active').first()

    # Delivery progress: aggregate PO line items vs total received across all GRNs
    from collections import defaultdict
    delivery_progress = []
    try:
        po_items = PurchaseOrderLineItem.objects.filter(
            po__contract=contract, po__status='active'
        ).order_by('line_number')
        received_by_key = defaultdict(lambda: Decimal('0'))
        if has_grn_line_items_table:
            for grn in grns:
                for li in grn.line_items.all():
                    for key in [li.item_code, li.item_name]:
                        if key:
                            received_by_key[key] += li.quantity_received
        for po_item in po_items:
            display_name = po_item.item_name or po_item.description
            qty_ordered = po_item.quantity
            qty_received = Decimal('0')
            for key in [po_item.item_code, po_item.item_name, po_item.description]:
                if key and key in received_by_key:
                    qty_received = received_by_key[key]
                    break
            pct = float(qty_received / qty_ordered * 100) if qty_ordered > 0 else 0
            delivery_progress.append({
                'item_code': po_item.item_code,
                'item_name': display_name,
                'quantity_ordered': float(qty_ordered),
                'quantity_received': float(qty_received),
                'unit_price': float(po_item.unit_price),
                'total_ordered_value': float(po_item.total_price),
                'total_received_value': float(qty_received * po_item.unit_price),
                'progress_pct': round(pct, 1),
            })
    except Exception:
        pass

    return Response({
        'contract_id': str(contract.contract_id),
        'contract_number': contract.contract_number,
        'title': contract.title,
        'supplier': contract.supplier.name if contract.supplier else '',
        'po_number': po.po_number if po else None,
        'value': float(contract.value),
        'currency': contract.currency,
        'status': contract.status,
        'start_date': contract.start_date,
        'end_date': contract.end_date,
        'payments_to_date': float(total_paid),
        'retained_to_date': float(total_retained),
        'balance': balance,
        'milestones': [
            {
                'milestone_id': str(m.milestone_id),
                'milestone_name': m.milestone_name,
                'planned_date': m.planned_date,
                'due_date': m.due_date,
                'actual_date': m.actual_date,
                'variance_days': m.variance_days,
                'variance_flag': m.variance_flag,
                'sequence_number': m.sequence_number,
                'status': m.status,
            }
            for m in milestones
        ],
        'deliveries': [
            {
                'grn_id': str(g.grn_id),
                'grn_number': g.grn_number,
                'item_description': g.item_description,
                'quantity_received': float(g.quantity_received),
                'total_amount': float(g.total_amount),
                'received_date': g.received_date,
                'line_items': [
                    {
                        'item_code': li.item_code,
                        'item_name': li.item_name,
                        'quantity_ordered': float(li.quantity_ordered),
                        'quantity_received': float(li.quantity_received),
                        'unit_price': float(li.unit_price),
                    }
                    for li in (g.line_items.all() if has_grn_line_items_table else [])
                ],
            }
            for g in grns
        ],
        'invoices': [
            {
                'invoice_id': str(inv.invoice_id),
                'invoice_number': inv.invoice_number,
                'amount': float(inv.amount),
                'status': inv.status,
                'submitted_at': inv.submitted_at,
                'document': inv.document,
                'delivery_note': getattr(inv, 'delivery_note', ''),
                'zamra_certificate': getattr(inv, 'zamra_certificate', ''),
                'temperature_log': getattr(inv, 'temperature_log', ''),
            }
            for inv in invoices_list
        ],
        'shortages': shortages,
        'shortage_count': len(shortages),
        'delivery_progress': delivery_progress,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def budget_summary_view(request):
    fiscal_year = request.query_params.get('fiscal_year', '')
    entity_code = request.query_params.get('entity_code', '')

    filters = {}
    if fiscal_year:
        filters['fiscal_year'] = fiscal_year
    if entity_code:
        filters['entity_code'] = entity_code

    allocations = BudgetAllocation.objects.filter(**filters)
    summary = allocations.aggregate(
        total_allocated=Sum('allocated_amount'),
        total_encumbered=Sum('encumbered_amount'),
        total_expended=Sum('expended_amount'),
    )
    total_allocated = summary['total_allocated'] or 0
    total_encumbered = summary['total_encumbered'] or 0
    total_expended = summary['total_expended'] or 0

    return Response({
        'total_allocated': float(total_allocated),
        'total_encumbered': float(total_encumbered),
        'total_expended': float(total_expended),
        'total_available': float(total_allocated - total_encumbered - total_expended),
        'allocation_count': allocations.count(),
        'fiscal_year': fiscal_year or 'all',
    })
