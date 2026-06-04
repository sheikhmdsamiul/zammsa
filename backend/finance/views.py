from decimal import Decimal
import hashlib
import hmac
from xml.etree.ElementTree import Element, SubElement, tostring
from django.conf import settings
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import BudgetAllocation, BudgetEncumbrance, GoodsReceiptNote, Invoice, ThreeWayMatch, Payment, LetterOfCredit, INVOICE_APPROVAL_ROUTES
from .serializers import (
    BudgetAllocationSerializer, BudgetEncumbranceSerializer, GoodsReceiptNoteSerializer,
    InvoiceSerializer, InvoiceListSerializer, ThreeWayMatchSerializer,
    PaymentSerializer, LetterOfCreditSerializer,
)
from contracts.models import Contract

FINANCE_PAYMENT_ROLES = ('finance_officer', 'budget_controller', 'system_admin')
APPROVAL_FLOW = ('finance_officer', 'department_head', 'director_general')


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
    return Response({'message': 'Invoice submitted for processing', 'status': inv.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def invoice_match_view(request, pk):
    try:
        inv = Invoice.objects.select_related('grn', 'contract').get(pk=pk)
    except Invoice.DoesNotExist:
        return Response({'error': 'Invoice not found'}, status=404)

    # Robust matching logic
    po_qty = Decimal('1') # Default for value-based matching
    po_price = inv.contract.value
    
    grn_qty = Decimal('0')
    grn_price = Decimal('0')
    
    if inv.grn:
        grn_qty = inv.grn.quantity_received
        grn_price = inv.grn.unit_price
        # If we have a GRN, we use its unit price as the target PO price for this item
        po_price = inv.grn.unit_price
        po_qty = inv.grn.quantity_received # Expecting same qty as GRN
    
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

    # Comparisons
    qty_match = (po_qty == grn_qty == inv_qty)
    price_match = (po_price == inv_price)
    
    if qty_match and price_match:
        match_status = 'complete'
    elif qty_match or price_match:
        match_status = 'partial'
    else:
        match_status = 'no_match'

    discrepancies = {}
    if po_qty != inv_qty:
        discrepancies['quantity_mismatch_po_inv'] = {'po': float(po_qty), 'invoice': float(inv_qty)}
    if grn_qty != inv_qty:
        discrepancies['quantity_mismatch_grn_inv'] = {'grn': float(grn_qty), 'invoice': float(inv_qty)}
    if po_price != inv_price:
        discrepancies['price_mismatch'] = {'po': float(po_price), 'invoice': float(inv_price)}

    ThreeWayMatch.objects.create(
        invoice=inv,
        po_quantity=po_qty,
        grn_quantity=grn_qty,
        invoice_quantity=inv_qty,
        po_price=po_price,
        invoice_price=inv_price,
        match_status=match_status,
        discrepancies=discrepancies,
    )

    if match_status == 'complete':
        inv.status = 'pending_approval'
    else:
        inv.status = 'pending_matching'
    inv.save()

    return Response({
        'message': f'3-way match completed: {match_status}',
        'match_status': match_status,
        'match': {
            'overall_match': match_status == 'complete',
            'flag_for_review': match_status != 'complete',
            'invoice_amount': float(inv.amount),
            'po_amount': float(po_qty * po_price),
            'grn_amount': float(grn_qty * po_price),
            'invoice_vs_po': po_price == inv_price,
            'po_vs_grn': po_qty == grn_qty,
            'invoice_vs_grn': grn_qty == inv_qty,
            'quantity_match': qty_match,
            'invoice_qty': float(inv_qty),
            'grn_qty': float(grn_qty),
            'po_qty': float(po_qty),
        },
        'discrepancies': discrepancies,
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

    final_route = inv.determine_approval_route()
    current_step = _next_invoice_approval_step(inv)

    if request.user.role != current_step:
        return Response({
            'error': f'This invoice requires approval from {dict(INVOICE_APPROVAL_ROUTES).get(current_step, current_step)}',
            'required_route': current_step,
        }, status=403)

    if current_step == final_route:
        inv.status = 'approved'
        inv.approved_at = timezone.now()
        inv.approval_route = final_route
        inv.save(update_fields=['status', 'approved_at', 'approval_route', 'updated_at'])
        return Response({'message': 'Invoice approved for payment', 'status': inv.status, 'approval_route': final_route})

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
def grn_webhook_view(request):
    if not _verify_hmac_signature(request, 'WMS_WEBHOOK_SECRET'):
        return Response({'error': 'Invalid webhook signature'}, status=403)

    grn_number = request.data.get('grn_number', '')
    po_number = request.data.get('po_number', '')
    contract_id = request.data.get('contract_id', '')
    quantity = Decimal(str(request.data.get('quantity_received', 0)))
    unit_price = Decimal(str(request.data.get('unit_price', 0)))
    item_desc = request.data.get('item_description', '')
    received_by = request.data.get('received_by', '')

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

    total_amount = quantity * unit_price

    grn, created = GoodsReceiptNote.objects.update_or_create(
        grn_number=grn_number,
        defaults={
            'contract': contract,
            'po_number': po_number,
            'item_description': item_desc,
            'quantity_received': quantity,
            'unit_price': unit_price,
            'total_amount': total_amount,
            'received_by': received_by,
            'source': 'webhook',
            'raw_webhook': request.data,
        }
    )

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
        payment.save(update_fields=['status', 'reference'])
        inv.status = 'paid'
        inv.paid_at = timezone.now()
        inv.save(update_fields=['status', 'paid_at', 'updated_at'])
        return Response({'message': 'Payment confirmed by bank', 'status': inv.status, 'bank_reference': bank_ref})
    else:
        payment.status = 'failed'
        payment.save()
        return Response({'message': 'Payment failed', 'status': payment.status})


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

    if inv.status != 'approved':
        return Response({'error': 'Invoice must be approved for payment before processing'}, status=400)

    payment_method = request.data.get('payment_method', 'electronic')
    amount = Decimal(str(request.data.get('amount', inv.amount)))
    if amount <= 0:
        return Response({'error': 'Payment amount must be positive'}, status=400)
    if amount > inv.amount:
        return Response({'error': 'Payment amount cannot exceed invoice amount'}, status=400)

    pmt = Payment.objects.create(
        invoice=inv,
        contract=inv.contract,
        amount=amount,
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
        pmt.status = 'sent'
        pmt.processed_at = timezone.now()
        pmt.save(update_fields=['iso20022_file_ref', 'status', 'processed_at'])

        return Response({
            'message': 'ISO 20022 payment file generated and sent for bank processing',
            'status': pmt.status,
            'iso20022_file_ref': file_hash,
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


class LetterOfCreditListView(BaseView, generics.ListCreateAPIView):
    queryset = LetterOfCredit.objects.select_related('contract').all()
    serializer_class = LetterOfCreditSerializer
    ordering = ['-issued_at']


class LetterOfCreditDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = LetterOfCredit.objects.all()
    serializer_class = LetterOfCreditSerializer
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
