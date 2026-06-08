from decimal import Decimal
import hashlib
import hmac
from datetime import timedelta
from xml.etree.ElementTree import Element, SubElement, tostring
from django.conf import settings
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
    Invoice, InvoiceLineItem, PurchaseOrder, ThreeWayMatch, Payment, LetterOfCredit,
    RetentionRelease, INVOICE_APPROVAL_ROUTES,
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
        zamra_certificate_verified=bool((raw_webhook or {}).get('zamra_certificate_verified', False)),
        cold_chain_maintained=bool((raw_webhook or {}).get('cold_chain_maintained', True)),
        temperature_log_attached=bool((raw_webhook or {}).get('temperature_log_attached', False)),
        source=source,
        raw_webhook=raw_webhook or {},
    )

    for idx, it in enumerate(items_data, start=1):
        received_qty = Decimal(str(it.get(quantity_key, it.get('quantity_received', it.get('quantity_delivered', 0)))))
        GRNLineItem.objects.create(
            grn=grn,
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
    return {
        'original_amount': original_amount,
        'approved_amount': approved_amount,
        'undelivered_amount': invoice.undelivered_amount,
        'liquidated_damages_amount': invoice.liquidated_damages_amount,
        'net_before_retention': invoice.net_before_retention,
        'retention_amount': invoice.retention_amount,
        'net_payable_amount': invoice.net_payable_amount,
    }


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
    status = django_filters.CharFilter(lookup_expr='exact')
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
        inv = Invoice.objects.get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    inv.status = 'submitted'
    inv.submitted_at = timezone.now()
    inv.save()

    # Auto-update Final Invoice milestone actual_date
    from contracts.models import ContractMilestone
    ContractMilestone.objects.filter(
        contract=inv.contract, milestone_name__icontains='Invoice'
    ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())

    return Response({'message': 'Invoice submitted for processing', 'status': inv.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_match_view(request, pk):
    try:
        inv = Invoice.objects.select_related('grn', 'contract').prefetch_related(
            'line_items', 'grn__line_items',
        ).get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    # Find the Purchase Order for this contract to use as baseline
    po = PurchaseOrder.objects.filter(contract=inv.contract, status='active').prefetch_related('line_items').first()
    po_line_items = list(po.line_items.all().order_by('line_number')) if po else []

    inv_line_items = list(inv.line_items.all().order_by('line_number'))
    grn_line_items = list(inv.grn.line_items.all().order_by('line_number')) if inv.grn else []

    # True 3-way matching: PO vs GRN vs Invoice
    line_matches = []
    overall_qty_match = True
    overall_price_match = True
    total_discrepancies = {}

    if po_line_items:
        # Use PO line items as the primary reference
        match_sources = [po_line_items, grn_line_items, inv_line_items]
        max_lines = max(len(s) for s in match_sources if s) if any(match_sources) else 0

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

            # Compare invoice to PO (ordered qty) and invoice to GRN (received qty)
            inv_vs_po_qty = (inv_qty == po_qty)
            inv_vs_po_price = (inv_price == po_price)
            inv_vs_grn_qty = (inv_qty == grn_qty)

            if not inv_vs_po_qty:
                overall_qty_match = False
            if not inv_vs_po_price:
                overall_price_match = False

            line_match = {
                'line_number': i + 1,
                'item_name': po_item.item_name if po_item else (grn_item.item_name if grn_item else (inv_item.item_name if inv_item else '')),
                'item_code': po_item.item_code if po_item else (grn_item.item_code if grn_item else (inv_item.item_code if inv_item else '')),
                'po_qty': float(po_qty),
                'grn_qty': float(grn_qty),
                'invoice_qty': float(inv_qty),
                'po_price': float(po_price),
                'grn_price': float(grn_price),
                'invoice_price': float(inv_price),
                'qty_match': inv_vs_po_qty,
                'price_match': inv_vs_po_price,
                'grn_qty_match': inv_vs_grn_qty,
            }
            line_matches.append(line_match)

            if not inv_vs_po_qty:
                total_discrepancies[f'line_{i+1}_qty'] = {
                    'po': float(po_qty), 'grn': float(grn_qty), 'invoice': float(inv_qty),
                }
            if not inv_vs_po_price:
                total_discrepancies[f'line_{i+1}_price'] = {
                    'po': float(po_price), 'invoice': float(inv_price),
                }
    elif inv_line_items and grn_line_items:
        # Fallback: GRN vs Invoice (no PO)
        max_lines = max(len(inv_line_items), len(grn_line_items))
        for i in range(max_lines):
            inv_item = inv_line_items[i] if i < len(inv_line_items) else None
            grn_item = grn_line_items[i] if i < len(grn_line_items) else None

            inv_qty = inv_item.quantity if inv_item else Decimal('0')
            inv_price = inv_item.unit_price if inv_item else Decimal('0')
            grn_qty = grn_item.quantity_received if grn_item else Decimal('0')
            grn_price = grn_item.unit_price if grn_item else Decimal('0')

            qty_ok = (inv_qty == grn_qty)
            price_ok = (inv_price == grn_price)

            if not qty_ok:
                overall_qty_match = False
            if not price_ok:
                overall_price_match = False

            line_match = {
                'line_number': i + 1,
                'item_name': (inv_item.item_name if inv_item else grn_item.item_name),
                'item_code': (inv_item.item_code if inv_item else grn_item.item_code),
                'po_qty': float(grn_qty),
                'grn_qty': float(grn_qty),
                'invoice_qty': float(inv_qty),
                'po_price': float(grn_price),
                'grn_price': float(grn_price),
                'invoice_price': float(inv_price),
                'qty_match': qty_ok,
                'price_match': price_ok,
                'grn_qty_match': qty_ok,
            }
            line_matches.append(line_match)

            if not qty_ok:
                total_discrepancies[f'line_{i+1}_qty'] = {
                    'grn': float(grn_qty), 'invoice': float(inv_qty),
                }
            if not price_ok:
                total_discrepancies[f'line_{i+1}_price'] = {
                    'grn': float(grn_price), 'invoice': float(inv_price),
                }
    else:
        # Fallback: header-level matching (legacy — no line items)
        po_qty = Decimal('1')
        po_price = inv.contract.value

        grn_qty = Decimal('0')
        grn_price = Decimal('0')

        if inv.grn:
            grn_qty = inv.grn.quantity_received
            grn_price = inv.grn.unit_price
            po_price = inv.grn.unit_price
            po_qty = inv.grn.quantity_received

        inv_qty = Decimal('1')
        inv_price = inv.amount

        if request.data:
            po_qty = Decimal(str(request.data.get('po_quantity', po_qty)))
            grn_qty = Decimal(str(request.data.get('grn_quantity', grn_qty)))
            inv_qty = Decimal(str(request.data.get('invoice_quantity', inv_qty)))
            po_price = Decimal(str(request.data.get('po_price', po_price)))
            inv_price = Decimal(str(request.data.get('invoice_price', inv_price)))
        elif inv.grn:
            inv_qty = grn_qty
            inv_price = (inv.amount / inv_qty) if inv_qty else Decimal('0')

        overall_qty_match = (grn_qty == inv_qty)
        overall_price_match = (po_price == inv_price)

        if not overall_qty_match:
            total_discrepancies['quantity_mismatch_grn_inv'] = {
                'grn': float(grn_qty), 'invoice': float(inv_qty),
            }
        if not overall_price_match:
            total_discrepancies['price_mismatch'] = {
                'po': float(po_price), 'invoice': float(inv_price),
            }

        line_matches = [{
            'line_number': 1,
            'item_name': inv.grn.item_description if inv.grn else '',
            'item_code': '',
            'po_qty': float(po_qty),
            'grn_qty': float(grn_qty),
            'invoice_qty': float(inv_qty),
            'po_price': float(po_price),
            'grn_price': float(grn_price),
            'invoice_price': float(inv_price),
            'qty_match': overall_qty_match,
            'price_match': overall_price_match,
            'grn_qty_match': overall_qty_match,
        }]

    if overall_qty_match and overall_price_match:
        match_status = 'complete'
    elif overall_qty_match or overall_price_match:
        match_status = 'partial'
    else:
        match_status = 'no_match'

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

    finance_review = None
    if match_status == 'complete':
        finance_review = _apply_invoice_finance_review(inv, inv.original_amount or inv.amount)
    else:
        inv.status = 'pending_matching'
        inv.approval_route = None
        inv.save()

    status_label = 'Ready for Approval' if match_status == 'complete' else 'Discrepancy - Requires Review'

    return Response({
        'message': f'3-way match completed: {match_status}',
        'match_status': match_status,
        'workflow_status': status_label,
        'match': {
            'overall_match': match_status == 'complete',
            'flag_for_review': match_status != 'complete',
            'invoice_amount': float(inv.amount),
            'line_matches': line_matches,
            'quantity_match': overall_qty_match,
            'price_match': overall_price_match,
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
        return Response({'message': 'Invoice fully approved for payment', 'status': inv.status, 'approval_route': final_route})

    next_step = APPROVAL_FLOW[APPROVAL_FLOW.index(current_step) + 1]
    inv.approval_route = next_step
    inv.save(update_fields=['approval_route', 'updated_at'])
    return Response({
        'message': f'Invoice approved and routed to {dict(INVOICE_APPROVAL_ROUTES).get(next_step, next_step)}',
        'status': inv.status,
        'approval_route': next_step,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_accept_partial_view(request, pk):
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

        return Response({'message': 'Payment confirmed by bank', 'status': inv.status, 'bank_reference': bank_ref})
    else:
        payment.status = 'failed'
        payment.bank_reconciliation_status = 'unpaid'
        payment.bank_reconciled_at = timezone.now()
        payment.save(update_fields=['status', 'bank_reconciliation_status', 'bank_reconciled_at'])
        inv.status = 'payment_failed'
        inv.save(update_fields=['status', 'updated_at'])
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

    return Response({
        'message': 'Payment advice sent to supplier',
        'supplier': inv.supplier.name,
        'amount': float(inv.amount),
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

    return Response({
        'message': 'GRN created manually',
        'grn': GoodsReceiptNoteSerializer(grn).data,
        'note': 'Use grn-webhook endpoint in production with WMS integration',
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def retention_release_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if request.user.role not in FINANCE_PAYMENT_ROLES:
        return Response({'error': 'Only finance officers can release retention'}, status=403)

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
        'retention_rate': 0.05,
        'payment_terms': '30 days from invoice approval',
        'milestones': list(milestones),
        'grns': list(grns),
        'start_date': contract.start_date,
        'end_date': contract.end_date,
        'status': contract.status,
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
    grn.save(update_fields=['delivery_advice', 'verified_by', 'verified_at', 'verification_method'])

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
            }
            for inv in invoices_list
        ],
        'shortages': shortages,
        'shortage_count': len(shortages),
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
