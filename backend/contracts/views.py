from decimal import Decimal
from django.db.models import Q, Sum, Max
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import Contract, ContractSecurity, ContractAmendment, ContractMilestone, LiquidatedDamages, ContractTermination, Appeal, ClosureChecklist
from .serializers import (
    ContractSerializer, ContractListSerializer, ContractSecuritySerializer,
    ContractAmendmentSerializer, ContractMilestoneSerializer,
    LiquidatedDamagesSerializer, ContractTerminationSerializer,
    AppealSerializer, ClosureChecklistSerializer,
)
from django.utils import timezone
from datetime import timedelta

CONTRACT_GENERATION_ROLES = ('procurement_officer', 'system_admin')
CONTRACT_MANAGER_ROLES = ('contract_manager', 'procurement_manager', 'director_procurement', 'system_admin')


def _add_working_days(start_date, days):
    current = start_date
    added = 0
    while added < days:
        current += timedelta(days=1)
        if current.weekday() < 5:
            added += 1
    return current


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class ContractFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    status = django_filters.CharFilter(lookup_expr='exact')
    contract_type = django_filters.CharFilter(lookup_expr='exact')
    archived = django_filters.BooleanFilter(method='filter_archived')
    archived_at__isnull = django_filters.BooleanFilter(field_name='archived_at', lookup_expr='isnull')
    retention_expiry__gte = django_filters.DateFilter(field_name='retention_expiry', lookup_expr='gte')
    retention_expiry__lte = django_filters.DateFilter(field_name='retention_expiry', lookup_expr='lte')
    legal_hold = django_filters.BooleanFilter()

    class Meta:
        model = Contract
        fields = ['status', 'contract_type', 'legal_hold']

    def filter_search(self, queryset, name, value):
        return queryset.filter(Q(contract_number__icontains=value) | Q(supplier__name__icontains=value))

    def filter_archived(self, queryset, name, value):
        if value:
            return queryset.filter(archived_at__isnull=False)
        return queryset.filter(archived_at__isnull=True)


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class ContractListView(BaseView, generics.ListCreateAPIView):
    queryset = Contract.objects.select_related('supplier', 'solicitation').prefetch_related('securities', 'amendments', 'milestones', 'appeals').all()
    filterset_class = ContractFilter
    search_fields = ['contract_number', 'supplier__name']
    ordering_fields = ['created_at', 'value', 'start_date', 'end_date']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return ContractListSerializer
        return ContractSerializer


class ContractDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Contract.objects.select_related('supplier', 'solicitation', 'winning_bid').prefetch_related('securities', 'amendments', 'milestones', 'appeals', 'closure_checklists').all()
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_publish_award_view(request, pk):
    if getattr(request.user, 'role', '') not in CONTRACT_GENERATION_ROLES:
        return Response({'error': 'Only procurement officers can publish award notices'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    contract.award_notice_published = True
    contract.award_notice_published_at = timezone.now()
    contract.waiting_period_start = timezone.now().date()
    contract.waiting_period_end = _add_working_days(timezone.now().date(), contract.waiting_period_days)
    contract.status = 'draft'
    contract.save()

    return Response({
        'message': 'Award notice published. Waiting period started.',
        'waiting_period_end': contract.waiting_period_end,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_supplier_sign_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if contract.appeal_pending:
        return Response({'error': 'Cannot sign contract while an appeal is pending'}, status=400)
    if not contract.award_notice_published:
        return Response({'error': 'Award notice must be published before supplier signature'}, status=400)
    if contract.waiting_period_end and timezone.now().date() < contract.waiting_period_end:
        return Response({'error': 'Standstill period has not expired'}, status=400)

    contract.signed_by_vendor = True
    contract.signed_vendor_date = timezone.now().date()
    contract.status = 'pending_acceptance'
    contract.save()

    return Response({'message': 'Contract signed by supplier', 'status': contract.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_countersign_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if request.user.role != 'director_general':
        return Response({'error': 'Only Director General can countersign'}, status=403)

    if not contract.signed_by_vendor:
        return Response({'error': 'Supplier must sign before Director General countersignature'}, status=400)
    if contract.appeal_pending:
        return Response({'error': 'Cannot countersign contract while an appeal is pending'}, status=400)
    if contract.waiting_period_end and timezone.now().date() < contract.waiting_period_end:
        return Response({'error': 'Standstill period has not expired'}, status=400)

    contract.signed_by_authority = True
    contract.signed_authority_date = timezone.now().date()
    contract.award_date = timezone.now().date()

    if contract.requires_performance_bond():
        contract.performance_security_required = True
        contract.status = 'pending_acceptance'
    else:
        contract.status = 'active'

    contract.save()

    return Response({
        'message': 'Contract countersigned by Director General',
        'status': contract.status,
        'performance_security_required': contract.performance_security_required,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_upload_security_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    security_type = request.data.get('security_type', 'performance')
    amount = Decimal(str(request.data.get('amount', 0)))
    issuing_bank = request.data.get('issuing_bank', '')
    reference_number = request.data.get('reference_number', '')
    expiry_date = request.data.get('expiry_date')

    if not amount or not issuing_bank:
        return Response({'error': 'Amount and issuing bank are required'}, status=400)

    ContractSecurity.objects.create(
        contract=contract,
        security_type=security_type,
        amount=amount,
        issuing_bank=issuing_bank,
        reference_number=reference_number,
        expiry_date=expiry_date,
        status='active',
    )

    contract.performance_security_uploaded = True
    contract.save()

    return Response({'message': 'Security uploaded, pending validation'})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_validate_security_view(request, pk, security_pk):
    try:
        contract = Contract.objects.get(pk=pk)
        security = ContractSecurity.objects.get(pk=security_pk, contract=contract)
    except (Contract.DoesNotExist, ContractSecurity.DoesNotExist):
        return Response({'error': 'Contract or security not found'}, status=404)

    valid = request.data.get('valid', False)
    if valid:
        security.status = 'active'
        security.save()
        contract.performance_security_validated = True
        contract.status = 'active'
        contract.save()
        return Response({'message': 'Security validated. Contract activated.', 'status': contract.status})
    else:
        security.status = 'rejected'
        security.save()
        return Response({'message': 'Security rejected'}, status=400)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_assign_manager_view(request, pk):
    if getattr(request.user, 'role', '') not in CONTRACT_MANAGER_ROLES:
        return Response({'error': 'Only contract management roles can assign contract managers'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    manager_id = request.data.get('contract_manager_id')
    if not manager_id:
        return Response({'error': 'contract_manager_id is required'}, status=400)

    from accounts.models import User
    try:
        manager = User.objects.get(pk=manager_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    contract.contract_manager = manager
    contract.save()

    milestones_data = request.data.get('milestones', [])
    for m in milestones_data:
        ContractMilestone.objects.create(
            contract=contract,
            milestone_name=m.get('name', 'Milestone'),
            due_date=m.get('due_date'),
            status='pending',
        )

    return Response({
        'message': f'Manager assigned: {manager.full_name}',
        'contract_manager': manager.full_name,
        'milestones_created': len(milestones_data),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_file_appeal_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    grounds = request.data.get('grounds')
    if not grounds:
        return Response({'error': 'Appeal grounds are required'}, status=400)

    appeal = Appeal.objects.create(
        contract=contract,
        bidder=request.user,
        grounds=grounds,
        supporting_docs=request.data.get('supporting_docs', []),
    )

    contract.appeal_pending = True
    contract.save()

    return Response({
        'message': 'Appeal filed',
        'appeal': AppealSerializer(appeal).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_resolve_appeal_view(request, pk, appeal_pk):
    try:
        contract = Contract.objects.get(pk=pk)
        appeal = Appeal.objects.get(pk=appeal_pk, contract=contract)
    except (Contract.DoesNotExist, Appeal.DoesNotExist):
        return Response({'error': 'Contract or appeal not found'}, status=404)

    if request.user.role != 'director_procurement':
        return Response({'error': 'Only Director of Procurement can resolve appeals'}, status=403)

    resolution = request.data.get('resolution', 'dismissed')
    notes = request.data.get('notes', '')

    if resolution == 'upheld':
        appeal.status = 'upheld'
        contract.status = 'cancelled'
    else:
        appeal.status = 'dismissed'

    appeal.resolved_at = timezone.now()
    appeal.resolved_by = request.user
    appeal.resolution_notes = notes
    appeal.save()

    contract.appeal_pending = False
    contract.appeal_resolved_at = timezone.now()
    contract.save()

    return Response({
        'message': f'Appeal {appeal.status}',
        'appeal': AppealSerializer(appeal).data,
        'contract_status': contract.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_activate_after_waiting_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if contract.appeal_pending:
        return Response({'error': 'Cannot activate: appeal is pending'}, status=400)

    if not contract.award_notice_published:
        return Response({'error': 'Award notice not yet published'}, status=400)

    if contract.waiting_period_end and timezone.now().date() < contract.waiting_period_end:
        return Response({
            'error': 'Standstill period has not expired',
            'waiting_period_end': contract.waiting_period_end,
        }, status=400)

    contract.status = 'pending_acceptance'
    contract.save()

    return Response({
        'message': 'Standstill complete. Contract ready for supplier signature.',
        'status': contract.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_closure_checklist_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    checklist, _ = ClosureChecklist.objects.get_or_create(contract=contract)

    for field in ['all_deliverables_received', 'final_inspection_passed', 'all_payments_processed',
                  'performance_security_released', 'snagging_items_resolved', 'staff_warranty_training_done',
                  'as_built_docs_received']:
        val = request.data.get(field)
        if val is not None:
            setattr(checklist, field, val)

    checklist.notes = request.data.get('notes', checklist.notes)

    if checklist.is_complete():
        checklist.status = 'completed'
        checklist.completed_by = request.user
        checklist.completed_at = timezone.now()
        contract.status = 'completed'
        contract.completed_at = timezone.now().date()
        contract.save()

    checklist.save()

    return Response({
        'message': 'Closure checklist updated',
        'is_complete': checklist.is_complete(),
        'checklist': ClosureChecklistSerializer(checklist).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_calculate_ld_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    days_delayed = int(request.data.get('days_delayed', 0))
    daily_rate = Decimal(str(request.data.get('daily_rate', 0)))
    ten_pct = contract.value * Decimal('0.1')
    calculated = Decimal(str(days_delayed)) * daily_rate
    applied = min(calculated, ten_pct)

    ld = LiquidatedDamages.objects.create(
        contract=contract,
        assessment_date=timezone.now().date(),
        days_delayed=days_delayed,
        daily_rate=daily_rate,
        calculated_amount=calculated,
        applied_amount=applied,
        status='assessed',
    )

    return Response({
        'message': 'Liquidated damages calculated (capped at 10%)',
        'calculated_amount': float(calculated),
        'applied_amount': float(applied),
        'cap_amount': float(ten_pct),
        'ld': LiquidatedDamagesSerializer(ld).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_archive_view(request, pk):
    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    contract.status = 'archived'
    contract.archived_at = timezone.now()
    contract.retention_expiry = timezone.now().date() + timedelta(days=365 * 7)
    contract.save()

    # BR-CPP-12: Also archive the linked CPP
    try:
        requisition = contract.solicitation.requisition
        if requisition:
            from procurement_planning.models import ContractProcurementPlan
            cpp = requisition.cpp.filter(
                status__in=('approved', 'active', 'completed')
            ).first()
            if cpp:
                cpp.status = 'archived'
                cpp.archived_at = timezone.now()
                cpp.retention_expiry = contract.retention_expiry
                cpp.save()
    except Exception:
        pass  # CPP archiving is best-effort; don't fail contract archive

    return Response({
        'message': 'Contract archived with linked CPP. Retention set to 7 years.',
        'retention_expiry': contract.retention_expiry,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_amend_view(request, pk):
    if getattr(request.user, 'role', '') not in CONTRACT_MANAGER_ROLES:
        return Response({'error': 'Only contract management roles can request amendments'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    reason = request.data.get('reason')
    description = request.data.get('description')
    financial_impact = Decimal(str(request.data.get('financial_impact', 0)))

    if not reason or not description:
        return Response({'error': 'Reason and description are required'}, status=400)

    cumulative = contract.amendments.aggregate(s=Sum('financial_impact'))['s'] or Decimal('0')
    new_total = cumulative + abs(financial_impact)
    variation_pct = (new_total / contract.value) * Decimal('100') if contract.value > 0 else Decimal('0')

    legal_required = variation_pct > Decimal('25')
    if legal_required:
        legal_opinion = request.data.get('legal_opinion_ref', '')
        if not legal_opinion:
            return Response({'error': 'Legal opinion required for variations exceeding 25%'}, status=400)

    last_num = contract.amendments.aggregate(m=Max('amendment_number'))['m'] or 0

    amendment = ContractAmendment.objects.create(
        contract=contract,
        amendment_number=last_num + 1,
        reason=reason,
        description=description,
        financial_impact=financial_impact,
        variation_percentage=variation_pct,
        legal_review_required=legal_required,
        legal_opinion_ref=request.data.get('legal_opinion_ref', ''),
        approved_by=request.user,
    )

    return Response({
        'message': f'Amendment {amendment.amendment_number} created',
        'variation_percentage': float(variation_pct),
        'legal_review_required': legal_required,
        'amendment': ContractAmendmentSerializer(amendment).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_approve_amendment_view(request, pk, amendment_pk):
    try:
        contract = Contract.objects.get(pk=pk)
        amendment = ContractAmendment.objects.get(pk=amendment_pk, contract=contract)
    except (Contract.DoesNotExist, ContractAmendment.DoesNotExist):
        return Response({'error': 'Contract or amendment not found'}, status=404)

    if request.user.role != 'zpc_member':
        return Response({'error': 'Only ZPC members can approve amendments'}, status=403)

    if amendment.variation_percentage > Decimal('25') and not amendment.legal_opinion_ref:
        return Response({'error': 'Legal opinion required before ZPC approval for >25% variation'}, status=400)

    amendment.approved_by = request.user
    amendment.save()

    contract.value += amendment.financial_impact
    contract.save()

    return Response({
        'message': f'Amendment {amendment.amendment_number} approved',
        'new_contract_value': float(contract.value),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_sign_amendment_view(request, pk, amendment_pk):
    try:
        contract = Contract.objects.get(pk=pk)
        amendment = ContractAmendment.objects.get(pk=amendment_pk, contract=contract)
    except (Contract.DoesNotExist, ContractAmendment.DoesNotExist):
        return Response({'error': 'Contract or amendment not found'}, status=404)

    signed_by = request.data.get('signed_by', 'supplier')
    amendment.signed_by_supplier = signed_by == 'supplier' or amendment.signed_by_supplier
    amendment.signed_by_authority = signed_by == 'authority'
    amendment.save()

    if amendment.signed_by_supplier and amendment.signed_by_authority:
        contract.status = 'active'
        contract.save()

    return Response({
        'message': f'Amendment signed by {signed_by}',
        'amendment': ContractAmendmentSerializer(amendment).data,
    })


class ContractSecurityListView(BaseView, generics.ListCreateAPIView):
    queryset = ContractSecurity.objects.select_related('contract').all()
    serializer_class = ContractSecuritySerializer
    ordering = ['-security_id']


class ContractMilestoneListView(BaseView, generics.ListCreateAPIView):
    queryset = ContractMilestone.objects.select_related('contract').all()
    serializer_class = ContractMilestoneSerializer
    ordering = ['due_date']


class ContractAmendmentListView(BaseView, generics.ListCreateAPIView):
    queryset = ContractAmendment.objects.select_related('contract').all()
    serializer_class = ContractAmendmentSerializer
    ordering = ['-created_at']


class ClosureChecklistListView(BaseView, generics.ListCreateAPIView):
    queryset = ClosureChecklist.objects.select_related('contract', 'completed_by').all()
    serializer_class = ClosureChecklistSerializer
    ordering = ['-completed_at']


class ContractMilestoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ContractMilestone.objects.all()
    serializer_class = ContractMilestoneSerializer
    permission_classes = [IsAuthenticated]


class LiquidatedDamagesListView(BaseView, generics.ListCreateAPIView):
    queryset = LiquidatedDamages.objects.select_related('contract').all()
    serializer_class = LiquidatedDamagesSerializer
    ordering = ['-assessment_date']


class TerminationListView(BaseView, generics.ListCreateAPIView):
    queryset = ContractTermination.objects.select_related('contract').all()
    serializer_class = ContractTerminationSerializer
    ordering = ['-created_at']


class AppealListView(BaseView, generics.ListCreateAPIView):
    queryset = Appeal.objects.select_related('contract', 'bidder', 'resolved_by').all()
    serializer_class = AppealSerializer
    ordering = ['-filed_at']
