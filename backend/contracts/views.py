from decimal import Decimal, ROUND_CEILING
from django.db.models import Q, Sum, Max
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
from django.conf import settings
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
from accounts.audit import log_audit_action

CONTRACT_GENERATION_ROLES = ('procurement_officer', 'system_admin')
CONTRACT_MANAGER_ROLES = ('contract_manager', 'procurement_manager', 'director_procurement', 'system_admin')
STANDSTILL_MANAGE_ROLES = CONTRACT_GENERATION_ROLES + ('contract_manager', 'procurement_manager')
SUPPLIER_CONTRACT_ROLES = ('supplier_user',)


def _update_activation_milestones_status(contract):
    """Update milestone statuses for seq 15-17 based on current contract state."""
    today = timezone.now().date()
    now = timezone.now()

    signed_milestone = contract.milestones.filter(sequence_number=15).first()
    if signed_milestone and signed_milestone.status != 'completed':
        if contract.signed_by_vendor and contract.signed_by_authority:
            signed_milestone.status = 'completed'
            signed_milestone.actual_date = today
            signed_milestone.completed_at = now
            signed_milestone.save()

    security_milestone = contract.milestones.filter(sequence_number=16).first()
    if security_milestone and security_milestone.status != 'completed':
        security_handled = (
            not contract.performance_security_required
            or contract.performance_security_validated
        )
        if security_handled:
            security_milestone.status = 'completed'
            security_milestone.actual_date = today
            security_milestone.completed_at = now
            security_milestone.save()

    active_milestone = contract.milestones.filter(sequence_number=17).first()
    if active_milestone and active_milestone.status != 'completed':
        if contract.status == 'active':
            active_milestone.status = 'completed'
            active_milestone.actual_date = today
            active_milestone.completed_at = now
            active_milestone.save()


def _copy_cpp_milestones_to_contract(contract):
    """Copy post-award milestones 15-22 from CPP to ContractMilestone when contract activates.
    
    If the CPP does not have milestones 15-22 defined, default post-award milestones
    are generated using the contract's date range as a guide.
    """
    try:
        solicitation = contract.solicitation
        cpp = None

        # Prefer direct CPP link on solicitation, fall back to requisition chain
        if solicitation and hasattr(solicitation, 'cpp') and solicitation.cpp:
            cpp = solicitation.cpp
        elif solicitation and solicitation.requisition:
            cpp = solicitation.requisition.cpp.filter(status='approved').first()

        if not cpp:
            return {'error': 'No approved CPP found — check that the solicitation is linked to a CPP'}

        # Get post-award milestones (seq 15-22) from CPP
        cpp_milestones = list(cpp.procurement_milestones.filter(
            sequence_number__gte=15,
            sequence_number__lte=22
        ).order_by('sequence_number'))

        if not cpp_milestones:
            # CPP has no seq 15-22 milestones (e.g. created before 22-milestone template).
            # Generate default post-award milestones using contract date range.
            from datetime import timedelta
            today = timezone.now().date()
            start = contract.start_date or today
            end = contract.end_date or (start + timedelta(days=365))
            duration = (end - start).days or 365

            default_milestones = [
                ('Contract Signed — Both Parties', 0),
                ('Performance Security Received', 7),
                ('Contract Active / Work Commences', 14),
                ('Delivery / Completion', int(duration * 0.6)),
                ('Final Inspection and Acceptance', int(duration * 0.7)),
                ('Final Invoice Submission', int(duration * 0.8)),
                ('Final Payment', int(duration * 0.9)),
                ('Contract Closure', int(duration * 1.0)),
            ]
            for seq_offset, (name, day_offset) in enumerate(default_milestones, start=15):
                planned = start + timedelta(days=day_offset)
                ContractMilestone.objects.create(
                    contract=contract,
                    sequence_number=seq_offset,
                    milestone_name=name,
                    planned_date=planned,
                    due_date=planned,
                    status='pending',
                    notes=f'Auto-generated post-award milestone #{seq_offset}',
                )
            _update_activation_milestones_status(contract)
            return {'success': True, 'created': len(default_milestones), 'source': 'default_template'}

        # Copy each milestone to contract, preserving the same sequence
        created_count = 0
        for cpp_milestone in cpp_milestones:
            ContractMilestone.objects.create(
                contract=contract,
                sequence_number=cpp_milestone.sequence_number,
                milestone_name=cpp_milestone.milestone_name,
                planned_date=cpp_milestone.planned_date,
                due_date=cpp_milestone.planned_date,
                source_procurement_milestone=cpp_milestone,
                status='pending',
                notes=f'Copied from CPP milestone #{cpp_milestone.sequence_number}',
            )
            created_count += 1

        _update_activation_milestones_status(contract)
        return {'success': True, 'created': created_count, 'source': 'cpp'}
    except Exception as e:
        return {'error': str(e)}


def _generate_po_for_contract(contract):
    """Generate a PurchaseOrder from the winning bid's line items when contract goes active"""
    from finance.models import PurchaseOrder, PurchaseOrderLineItem
    try:
        winning_bid = contract.winning_bid
        if not winning_bid:
            return {'error': 'No winning bid found for this contract'}
        
        bid_line_items = winning_bid.line_items
        if not bid_line_items:
            return {'error': 'No line items in winning bid'}
        
        # Build PO number from contract number
        import datetime
        po_number = f'PO-{contract.contract_number}'
        
        # Calculate total from bid line items
        total = Decimal('0')
        for item in bid_line_items:
            qty = Decimal(str(item.get('quantity', item.get('qty', 0))))
            price = Decimal(str(item.get('unit_price', item.get('price', 0))))
            total += qty * price
        
        # Create PO
        po = PurchaseOrder.objects.create(
            po_number=po_number,
            contract=contract,
            supplier=contract.supplier,
            total_amount=contract.value if contract.value > 0 else total,
            status='active',
        )
        
        # Create PO line items from bid line items
        for idx, item in enumerate(bid_line_items, start=1):
            qty = Decimal(str(item.get('quantity', item.get('qty', 0))))
            price = Decimal(str(item.get('unit_price', item.get('price', 0))))
            total_price = qty * price
            desc = item.get('description', '')
            raw_name = item.get('item_name', item.get('name', ''))
            PurchaseOrderLineItem.objects.create(
                po=po,
                line_number=idx,
                item_code=item.get('item_code', item.get('code', '')),
                item_name=raw_name or desc,
                description=desc,
                quantity=qty,
                unit_price=price,
                total_price=total_price,
            )
        
        return {'success': True, 'po_number': po_number}
    except Exception as e:
        return {'error': str(e)}


def _supplier_contract_filter(user):
    """Contracts visible to a supplier portal user."""
    from suppliers.models import VendorApplication
    filters = Q(winning_bid__supplier=user)
    if user.employee_id and str(user.employee_id).startswith('SUP-'):
        reg = str(user.employee_id).replace('SUP-', '', 1)
        filters |= Q(supplier__registration_number=reg)
    app = VendorApplication.objects.filter(email=user.email).first()
    if app and app.registration_number:
        filters |= Q(supplier__registration_number=app.registration_number)
    return filters


def _user_can_access_contract(user, contract):
    role = getattr(user, 'role', '')
    if role == 'supplier_user':
        return Contract.objects.filter(pk=contract.pk).filter(_supplier_contract_filter(user)).exists()
    return True


def _contracts_queryset_for_user(user, queryset=None):
    qs = queryset if queryset is not None else Contract.objects.all()
    if getattr(user, 'role', '') == 'supplier_user':
        return qs.filter(_supplier_contract_filter(user)).distinct()
    return qs


def _standstill_active(contract):
    """True while today is before waiting_period_end (proceed on or after end date)."""
    if not contract.waiting_period_end:
        return False
    return timezone.now().date() < contract.waiting_period_end


def _parse_date(value):
    if not value:
        return None
    if hasattr(value, 'year'):
        return value
    from datetime import datetime
    try:
        return datetime.strptime(str(value)[:10], '%Y-%m-%d').date()
    except (ValueError, TypeError):
        return None


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

    def get_queryset(self):
        qs = super().get_queryset()
        qs = _contracts_queryset_for_user(self.request.user, qs)
        if self.request.query_params.get('pending_dg_signature') == 'true':
            qs = qs.filter(signed_by_vendor=True, signed_by_authority=False)
        if self.request.query_params.get('pending_security_validation') == 'true':
            qs = qs.filter(
                performance_security_required=True,
                performance_security_uploaded=True,
                performance_security_validated=False,
            )
        if self.request.query_params.get('pending_supplier_signature') == 'true':
            qs = qs.filter(signed_by_vendor=False, award_notice_published=True)
        return qs

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return ContractListSerializer
        return ContractSerializer


class ContractDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Contract.objects.select_related('supplier', 'solicitation', 'winning_bid').prefetch_related(
        'securities',
        'amendments',
        'milestones',
        'appeals',
        'closure_checklists',
        'invoices',
        'goods_receipt_notes',
        'payments',
        'retention_releases',
        'supplier_performances',
    ).all()
    serializer_class = ContractSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        return _contracts_queryset_for_user(self.request.user, super().get_queryset())


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_publish_award_view(request, pk):
    if getattr(request.user, 'role', '') not in CONTRACT_GENERATION_ROLES:
        return Response({'error': 'Only procurement officers can publish award notices'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    days = request.data.get('waiting_period_days')
    if days is not None:
        try:
            days_val = int(days)
            if days_val < 10:
                return Response({'error': 'Waiting period must be at least 10 working days'}, status=400)
            contract.waiting_period_days = days_val
        except (TypeError, ValueError):
            return Response({'error': 'waiting_period_days must be a number'}, status=400)

    start_override = _parse_date(request.data.get('waiting_period_start'))
    end_override = _parse_date(request.data.get('waiting_period_end'))

    contract.award_notice_published = True
    contract.award_notice_published_at = timezone.now()
    contract.waiting_period_start = start_override or timezone.now().date()
    if end_override:
        contract.waiting_period_end = end_override
    else:
        contract.waiting_period_end = _add_working_days(
            contract.waiting_period_start, contract.waiting_period_days
        )
    contract.status = 'draft'
    contract.save()

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='CONTRACT_PUBLISH_AWARD', module='contracts',
        record_id=str(contract.contract_id), ip_address=ip,
    )

    return Response({
        'message': 'Award notice published. Waiting period started.',
        'waiting_period_start': contract.waiting_period_start,
        'waiting_period_end': contract.waiting_period_end,
        'waiting_period_days': contract.waiting_period_days,
        'standstill_expired': not _standstill_active(contract),
    })


@api_view(['POST', 'PATCH'])
@permission_classes([IsAuthenticated])
def contract_set_standstill_view(request, pk):
    """Manually configure standstill dates (e.g. shorten period for testing)."""
    if getattr(request.user, 'role', '') not in STANDSTILL_MANAGE_ROLES:
        return Response({'error': 'Not permitted to adjust standstill period'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if request.data.get('waiting_period_days') is not None:
        try:
            contract.waiting_period_days = max(0, int(request.data['waiting_period_days']))
        except (TypeError, ValueError):
            return Response({'error': 'waiting_period_days must be a number'}, status=400)

    if request.data.get('expire_now'):
        if not settings.DEBUG:
            return Response({'error': 'expire_now is only available in DEBUG mode'}, status=400)
        today = timezone.now().date()
        contract.waiting_period_end = today
        if not contract.waiting_period_start:
            contract.waiting_period_start = today
        if not contract.award_notice_published:
            contract.award_notice_published = True
            contract.award_notice_published_at = timezone.now()
    else:
        start = _parse_date(request.data.get('waiting_period_start'))
        end = _parse_date(request.data.get('waiting_period_end'))
        if start:
            contract.waiting_period_start = start
        if end:
            contract.waiting_period_end = end

    if request.data.get('recalculate_end') and contract.waiting_period_start is not None:
        contract.waiting_period_end = _add_working_days(
            contract.waiting_period_start, contract.waiting_period_days
        )

    if request.data.get('publish_award') and not contract.award_notice_published:
        contract.award_notice_published = True
        contract.award_notice_published_at = timezone.now()
        if not contract.waiting_period_start:
            contract.waiting_period_start = timezone.now().date()
        if not contract.waiting_period_end:
            contract.waiting_period_end = _add_working_days(
                contract.waiting_period_start, contract.waiting_period_days
            )

    contract.save()
    serializer = ContractSerializer(contract)

    return Response({
        'message': 'Standstill period updated',
        'contract': serializer.data,
        'standstill_expired': not _standstill_active(contract),
        'waiting_period_start': contract.waiting_period_start,
        'waiting_period_end': contract.waiting_period_end,
        'waiting_period_days': contract.waiting_period_days,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_supplier_sign_view(request, pk):
    if getattr(request.user, 'role', '') not in SUPPLIER_CONTRACT_ROLES:
        return Response({'error': 'Only supplier users can sign contracts'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if not _user_can_access_contract(request.user, contract):
        return Response({'error': 'You do not have access to this contract'}, status=403)

    if contract.signed_by_vendor:
        return Response({'error': 'Contract already signed by supplier'}, status=400)

    if contract.appeal_pending:
        return Response({'error': 'Cannot sign contract while an appeal is pending'}, status=400)
    if not contract.award_notice_published:
        return Response({'error': 'Award notice must be published before supplier signature'}, status=400)
    if _standstill_active(contract):
        return Response({
            'error': 'Standstill period has not expired',
            'waiting_period_end': contract.waiting_period_end,
        }, status=400)

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
    if _standstill_active(contract):
        return Response({
            'error': 'Standstill period has not expired',
            'waiting_period_end': contract.waiting_period_end,
        }, status=400)

    contract.signed_by_authority = True
    contract.signed_authority_date = timezone.now().date()
    contract.award_date = timezone.now().date()

    if contract.requires_performance_bond():
        contract.performance_security_required = True
        contract.status = 'pending_acceptance'
    else:
        contract.status = 'active'
    
    # Auto-copy CPP milestones to contract when it becomes active
    if contract.status == 'active':
        result = _copy_cpp_milestones_to_contract(contract)
        if not result.get('success') and not result.get('error', '').startswith('No CPP'):
           pass
        # Auto-generate Purchase Order from winning bid
        po_result = _generate_po_for_contract(contract)

    contract.save()

    _update_activation_milestones_status(contract)

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='CONTRACT_COUNTERSIGN', module='contracts',
        record_id=str(contract.contract_id), ip_address=ip,
    )

    return Response({
        'message': 'Contract countersigned by Director General',
        'status': contract.status,
        'performance_security_required': contract.performance_security_required,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_upload_security_view(request, pk):
    role = getattr(request.user, 'role', '')
    if role not in SUPPLIER_CONTRACT_ROLES:
        return Response({'error': 'Only supplier users can upload performance security'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if not _user_can_access_contract(request.user, contract):
        return Response({'error': 'You do not have access to this contract'}, status=403)

    if not contract.signed_by_vendor:
        return Response({'error': 'Supplier must sign the contract before uploading security'}, status=400)

    security_type = request.data.get('security_type', 'performance')
    amount = Decimal(str(request.data.get('amount', 0)))
    issuing_bank = request.data.get('issuing_bank', '')
    reference_number = request.data.get('reference_number', '')
    expiry_date = _parse_date(request.data.get('expiry_date'))
    if not expiry_date and contract.end_date:
        expiry_date = contract.end_date + timedelta(days=90)
    if not expiry_date:
        expiry_date = timezone.now().date() + timedelta(days=365)

    if not amount or not issuing_bank:
        return Response({'error': 'Amount and issuing bank are required'}, status=400)

    security_pct = (amount / contract.value) * 100 if contract.value > 0 else 0
    if security_pct < 5 or security_pct > 10:
        return Response({
            'error': f'Performance security must be between 5% and 10% of contract value ({contract.value})',
            'amount': float(amount),
            'contract_value': float(contract.value),
            'percentage': float(security_pct),
        }, status=400)

    if expiry_date < contract.end_date:
        return Response({
            'error': f'Security expiry ({expiry_date}) must be at or after contract end date ({contract.end_date})',
        }, status=400)

    security = ContractSecurity.objects.create(
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

    return Response({
        'message': 'Security uploaded, pending validation',
        'id': str(security.pk),
        'security_id': str(security.pk),
        'security': ContractSecuritySerializer(security).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_validate_security_view(request, pk, security_pk):
    if getattr(request.user, 'role', '') not in CONTRACT_MANAGER_ROLES:
        return Response({'error': 'Only contract management roles can validate performance security'}, status=403)

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
        
        # Auto-copy CPP milestones when contract becomes active via security validation
        result = _copy_cpp_milestones_to_contract(contract)
        if not result.get('success') and not result.get('error', '').startswith('No CPP'):
            pass
        
        # Auto-generate Purchase Order from winning bid
        po_result = _generate_po_for_contract(contract)
        
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
    for idx, m in enumerate(milestones_data, start=1):
        ContractMilestone.objects.create(
            contract=contract,
            sequence_number=idx,
            milestone_name=m.get('name', 'Milestone'),
            planned_date=m.get('planned_date') or m.get('due_date'),
            due_date=m.get('due_date'),
            status=m.get('status', 'pending'),
            notes=m.get('notes', ''),
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

    if _standstill_active(contract):
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

    for field in ['all_deliverables_received', 'final_inspection_passed', 'all_invoices_submitted_approved', 'all_payments_processed',
                  'performance_security_released', 'snagging_items_resolved', 'staff_warranty_training_done',
                  'as_built_docs_received', 'acceptance_certificate_issued', 'liquidated_damages_deducted',
                  'retention_released', 'no_outstanding_disputes', 'no_pending_amendments',
                  'supplier_evaluation_completed', 'all_docs_saved']:
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
        # Auto-update Contract Closure milestone
        ContractMilestone.objects.filter(
            contract=contract, milestone_name__icontains='Closure'
        ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())
        ip = request.META.get('REMOTE_ADDR', '')
        log_audit_action(
            user=request.user, action='CONTRACT_CLOSED', module='contracts',
            record_id=str(contract.contract_id), ip_address=ip,
        )

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
    if days_delayed < 0:
        return Response({'error': 'days_delayed cannot be negative'}, status=400)

    weekly_rate = Decimal(str(request.data.get('weekly_rate', contract.liquidated_damages_rate)))
    weeks_late = int((Decimal(days_delayed) / Decimal('7')).to_integral_value(rounding=ROUND_CEILING)) if days_delayed else 0
    cap_amount = (contract.value * contract.liquidated_damages_cap_rate).quantize(Decimal('0.01'))
    calculated = (contract.value * weekly_rate * Decimal(weeks_late)).quantize(Decimal('0.01'))
    applied = min(calculated, cap_amount)

    ld = LiquidatedDamages.objects.create(
        contract=contract,
        assessment_date=timezone.now().date(),
        days_delayed=days_delayed,
        weeks_late=weeks_late,
        daily_rate=Decimal('0'),
        weekly_rate=weekly_rate,
        cap_amount=cap_amount,
        calculated_amount=calculated,
        applied_amount=applied,
        status='assessed',
    )

    return Response({
        'message': 'Liquidated damages calculated (capped at 10%)',
        'calculated_amount': float(calculated),
        'applied_amount': float(applied),
        'weeks_late': weeks_late,
        'weekly_rate': float(weekly_rate),
        'cap_amount': float(cap_amount),
        'ld': LiquidatedDamagesSerializer(ld).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_final_acceptance_view(request, pk):
    """R-12 issues Final Acceptance Certificate — triggers retention release countdown."""
    if getattr(request.user, 'role', '') not in CONTRACT_MANAGER_ROLES:
        return Response({'error': 'Only contract management roles can issue final acceptance'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    cert_ref = request.data.get('acceptance_certificate_ref', '')
    if not cert_ref:
        cert_ref = f'FAC-{contract.contract_number}-{timezone.now().strftime("%Y%m%d")}'

    contract.acceptance_date = timezone.now().date()
    contract.completed_at = timezone.now().date()
    contract.save(update_fields=['acceptance_date', 'completed_at'])

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='FINAL_ACCEPTANCE_ISSUED', module='contracts',
        record_id=str(contract.contract_id), ip_address=ip,
    )

    # Update closure checklist if exists
    ClosureChecklist.objects.filter(contract=contract).update(
        all_deliverables_received=True,
        final_inspection_passed=True,
        acceptance_certificate_issued=True,
    )

    # Auto-update Final Inspection milestone
    ContractMilestone.objects.filter(
        contract=contract, milestone_name__icontains='Inspection'
    ).update(status='completed', completed_at=timezone.now(), actual_date=timezone.now().date())

    return Response({
        'message': 'Final Acceptance Certificate issued. Retention release countdown started (30 days).',
        'acceptance_certificate_ref': cert_ref,
        'acceptance_date': contract.acceptance_date,
        'retention_releasable_on': (contract.completed_at + timedelta(days=30)).isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_archive_view(request, pk):
    if getattr(request.user, 'role', '') not in CONTRACT_MANAGER_ROLES + ('records_manager',):
        return Response({'error': 'Only contract management or records roles can archive contracts'}, status=403)

    try:
        contract = Contract.objects.get(pk=pk)
    except Contract.DoesNotExist:
        return Response({'error': 'Contract not found'}, status=404)

    if contract.status == 'archived':
        return Response({
            'message': 'Contract is already archived',
            'archive_filename': f'ZAMMSA-{contract.contract_number}-ARCHIVE.zip.enc',
            'encryption': 'AES-256',
            'legal_hold': contract.legal_hold,
            'retention_expiry': contract.retention_expiry,
        })

    if contract.status not in ('completed', 'closed'):
        return Response({'error': 'Only completed or closed contracts can be archived'}, status=400)
    if contract.completed_at:
        earliest_archive_date = contract.completed_at + timedelta(days=contract.archive_after_days)
        if timezone.now().date() < earliest_archive_date and not request.data.get('force'):
            return Response({
                'error': 'Contract can only be archived 30 days after completion unless force=true is supplied by an authorized records workflow.',
                'earliest_archive_date': earliest_archive_date,
            }, status=400)

    contract.status = 'archived'
    contract.archived_at = timezone.now()
    contract.retention_expiry = timezone.now().date() + timedelta(days=365 * contract.archive_retention_years)
    contract.save()

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='CONTRACT_ARCHIVED', module='contracts',
        record_id=str(contract.contract_id), ip_address=ip,
    )

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
        'message': f'Contract archived with linked CPP. Retention set to {contract.archive_retention_years} years.',
        'archive_filename': f'ZAMMSA-{contract.contract_number}-ARCHIVE.zip.enc',
        'encryption': 'AES-256',
        'legal_hold': contract.legal_hold,
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

    cap_pct = contract.amendment_cap_rate * Decimal('100')
    if variation_pct > cap_pct:
        return Response({
            'error': 'Amendment exceeds the 25% cumulative cap and is blocked. Re-procurement and Attorney General review are required.',
            'cumulative_variation_percentage': float(variation_pct),
            'cap_percentage': float(cap_pct),
        }, status=400)

    legal_required = False

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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def contract_milestone_update_actual_view(request, pk):
    """Update ContractMilestone actual_date and recalculate variance"""
    try:
        milestone = ContractMilestone.objects.get(pk=pk)
    except ContractMilestone.DoesNotExist:
        return Response({'error': 'Milestone not found'}, status=404)

    # Only contract managers can update milestones
    if getattr(request.user, 'role', '') not in CONTRACT_MANAGER_ROLES:
        return Response({'error': 'Only contract management roles can update milestones'}, status=403)

    actual_date_str = request.data.get('actual_date')
    if actual_date_str:
        try:
            from datetime import datetime
            actual_date = datetime.strptime(actual_date_str, '%Y-%m-%d').date()
            milestone.actual_date = actual_date
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=400)

    notes = request.data.get('notes', None)
    if notes is not None:
        milestone.notes = notes

    milestone.save()

    return Response({
        'message': 'Milestone updated',
        'milestone': ContractMilestoneSerializer(milestone).data,
    })
