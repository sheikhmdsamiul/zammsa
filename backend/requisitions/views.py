import json
from decimal import Decimal
import django.db.models as models
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import Requisition, RequisitionItem, Specification, RequisitionApproval, RequisitionVersion, BudgetEncumbrance
from .serializers import (
    RequisitionSerializer, RequisitionListSerializer, RequisitionItemSerializer,
    SpecificationSerializer, RequisitionApprovalSerializer, BudgetEncumbranceSerializer,
    RequisitionTrackingSerializer,
)
from finance.models import BudgetAllocation
from system_config.notifications import create_notification, notify_role


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class RequisitionFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    status = django_filters.CharFilter(lookup_expr='exact')
    department = django_filters.CharFilter(field_name='department__dept_code', lookup_expr='exact')
    requester = django_filters.CharFilter(field_name='requester__email', lookup_expr='icontains')
    date_from = django_filters.DateFilter(field_name='created_at', lookup_expr='gte')
    date_to = django_filters.DateFilter(field_name='created_at', lookup_expr='lte')
    estimated_min = django_filters.NumberFilter(field_name='estimated_total', lookup_expr='gte')
    estimated_max = django_filters.NumberFilter(field_name='estimated_total', lookup_expr='lte')
    has_approved_cpp = django_filters.BooleanFilter(method='filter_has_approved_cpp')

    class Meta:
        model = Requisition
        fields = ['status', 'department', 'budget_validated']

    def filter_search(self, queryset, name, value):
        return queryset.filter(
            Q(req_number__icontains=value) |
            Q(description__icontains=value) |
            Q(department__dept_name__icontains=value)
        )

    def filter_has_approved_cpp(self, queryset, name, value):
        if value:
            return queryset.filter(cpp__status='approved').distinct()
        return queryset


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class RequisitionListView(BaseView, generics.ListCreateAPIView):
    queryset = Requisition.objects.select_related('department', 'requester').all()
    filterset_class = RequisitionFilter
    search_fields = ['req_number', 'description']
    ordering_fields = ['created_at', 'estimated_total', 'required_date', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET':
            return RequisitionListSerializer
        return RequisitionSerializer

    def perform_create(self, serializer):
        if self.request.user.role != 'user_dept_staff':
            raise PermissionDenied('Only User Department Staff can create requisitions.')
        serializer.save(requester=self.request.user)


class RequisitionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Requisition.objects.select_related('department', 'requester').prefetch_related('items', 'approvals').all()
    serializer_class = RequisitionSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        if self.request.user.role != 'user_dept_staff':
            raise PermissionDenied('Only User Department Staff can edit requisitions.')
        instance = self.get_object()
        if instance.requester_id != self.request.user.id:
            raise PermissionDenied('You can only edit requisitions you created.')
        if instance.status not in ('draft', 'rejected', 'amended'):
            raise PermissionDenied('Only draft, rejected, or amended requisitions can be edited.')
        serializer.save()

    def perform_destroy(self, instance):
        if self.request.user.role != 'user_dept_staff':
            raise PermissionDenied('Only User Department Staff can delete requisitions.')
        if instance.status not in ('draft', 'rejected'):
            raise PermissionDenied('Only draft or rejected requisitions can be deleted.')
        instance.delete()


def _check_budget_and_encumber(req):
    warnings = []
    try:
        dept_code = req.department.budget_code or req.department.dept_code
        ba = BudgetAllocation.objects.filter(
            entity_code=dept_code,
            fiscal_year=timezone.now().strftime('%Y'),
        ).first()
        if ba:
            if float(req.estimated_total) > float(ba.available):
                warnings.append({
                    'requisition': req.req_number,
                    'estimated_total': float(req.estimated_total),
                    'budget_available': float(ba.available),
                    'shortfall': float(req.estimated_total) - float(ba.available),
                })
            else:
                if not BudgetEncumbrance.objects.filter(requisition=req, status='active').exists():
                    BudgetEncumbrance.objects.create(
                        requisition=req,
                        amount=req.estimated_total,
                        status='active',
                    )
                    ba.encumbered_amount += req.estimated_total
                    ba.save(update_fields=['encumbered_amount'])
                req.budget_validated = True
                from requisitions.models import Requisition as ReqModel
                from zammsa_backend.utils import generate_traceable_id, is_traceable_id, resolve_requisition_context

                if not req.encumbrance_ref or not is_traceable_id(req.encumbrance_ref):
                    dept, fiscal_year = resolve_requisition_context(req)
                    req.encumbrance_ref = generate_traceable_id('ENC', dept, ReqModel, 'encumbrance_ref', fiscal_year)
                req.save(update_fields=['budget_validated', 'encumbrance_ref'])
    except Exception:
        pass
    return warnings


REQUISITION_NEXT_REVIEWER_ROLE = {
    'pending_dept_head': 'department_head',
    'pending_finance': 'finance_officer',
    'pending_dg': 'director_general',
    'pending_zpc': 'zpc_member',
}


def _notify_requisition_next_reviewer(req, actor=None):
    role = REQUISITION_NEXT_REVIEWER_ROLE.get(req.status)
    if not role:
        return []

    return notify_role(
        role,
        title=f'Requisition {req.req_number} requires review',
        message=f'{req.req_number} is awaiting your approval for {req.description}. Estimated value: K{req.estimated_total}.',
        notification_type='approval',
        priority='high' if req.status == 'pending_zpc' else 'normal',
        source_module='requisitions',
        object_id=req.pk,
        action_url=f'/requisitions/{req.pk}',
        metadata={
            'req_number': req.req_number,
            'status': req.status,
            'estimated_total': str(req.estimated_total),
            'actor_id': str(actor.pk) if actor else '',
        },
        email_required=True,
        exclude_user=actor,
    )


def _notify_requisition_requester(req, title, message, priority='normal'):
    return create_notification(
        req.requester,
        title=title,
        message=message,
        notification_type='workflow',
        priority=priority,
        source_module='requisitions',
        object_id=req.pk,
        action_url=f'/requisitions/{req.pk}',
        metadata={'req_number': req.req_number, 'status': req.status},
        email_required=True,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def requisition_submit_view(request, pk):
    try:
        req = Requisition.objects.get(pk=pk)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    if req.status != 'draft':
        return Response({'error': 'Only draft requisitions can be submitted'}, status=400)
    if req.requester_id != request.user.id:
        return Response({'error': 'Only the requester can submit this requisition'}, status=403)

    # BR-REQ-04: Requisition expires after 90 days without action
    if req.is_expired:
        return Response({
            'error': f'This requisition has expired after {req.days_since_creation} days. '
                     f'Please create a new requisition.',
            'days_since_creation': req.days_since_creation,
        }, status=400)

    # Validate every line item has an attachment
    items = req.items.all()
    missing_attachments = [str(item.item_id) for item in items if not item.attachment]
    if missing_attachments:
        return Response({
            'error': 'All line items must have a supporting document attached before submission.',
            'items_missing_attachment': missing_attachments,
        }, status=400)

    # Auto-set technical review flag when any goods item exceeds K1,000,000
    technical_review = False
    for item in items:
        if float(item.total_estimate) > 1_000_000:
            technical_review = True
            break
    if technical_review:
        req.technical_review_required = True

    budget_warnings = _check_budget_and_encumber(req)
    if budget_warnings:
        return Response({
            'error': 'Budget validation failed. Insufficient funds.',
            'budget_warnings': budget_warnings,
        }, status=400)

    specs = request.data.get('specifications', [])
    for spec_data in specs:
        Specification.objects.create(
            requisition=req,
            specification_type=spec_data.get('specification_type', 'goods'),
            content=spec_data.get('content', {}),
        )

    req.status = 'pending_dept_head'
    req.submitted_at = timezone.now()
    req.current_approver = None
    req.save()

    RequisitionApproval.objects.create(
        requisition=req,
        approver=request.user,
        approval_level='submission',
        decision='approved',
        approved_at=timezone.now(),
        comments='Submitted by requester',
    )
    _notify_requisition_next_reviewer(req, request.user)

    return Response({
        'message': 'Requisition submitted and sent for Department Head approval',
        'status': req.status,
        'req_number': req.req_number,
        'budget_validated': req.budget_validated,
        'encumbrance_ref': req.encumbrance_ref,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def requisition_budget_validate_view(request, pk):
    try:
        req = Requisition.objects.get(pk=pk)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    budget_warnings = _check_budget_and_encumber(req)
    if budget_warnings:
        return Response({
            'budget_validated': False,
            'budget_warnings': budget_warnings,
        })
    return Response({
        'budget_validated': req.budget_validated,
        'encumbrance_ref': req.encumbrance_ref,
        'message': 'Budget validated and encumbered',
    })


def _get_flow_for_role(user_role, req):
    if user_role == 'department_head':
        return {'from': 'pending_dept_head', 'to': 'pending_finance', 'level': 'department_head_approval'}
    if user_role == 'finance_officer':
        return {'from': 'pending_finance', 'to': 'pending_dg', 'level': 'finance_validation'}
    if user_role == 'director_general':
        estimated = float(req.estimated_total)
        if estimated <= 250000:
            return {'from': 'pending_dg', 'to': 'approved', 'level': 'dg_approval'}
        return {'from': 'pending_dg', 'to': 'pending_zpc', 'level': 'dg_approval'}
    if user_role == 'zpc_member':
        estimated = float(req.estimated_total)
        if estimated > 250000:
            return {'from': 'pending_zpc', 'to': 'approved', 'level': 'zpc_approval'}
        return None
    return None


def _advance_requisition(req, user, decision, comments):
    if decision not in ('approved', 'rejected', 'returned'):
        return None, 'Invalid decision'

    flow = _get_flow_for_role(user.role, req)
    if not flow:
        return None, 'You are not authorized to approve this requisition'

    if req.status != flow['from']:
        return None, f'Requisition is not at the {flow["from"]} stage. Current status: {req.status}'
    if req.requester_id == user.id:
        return None, 'Self-approval is not allowed'
    if req.is_expired:
        return None, f'This requisition has expired after {req.days_since_creation} days. Please create a new requisition.'

    if decision == 'rejected':
        req.status = 'rejected'
        req.current_approver = None
    elif decision == 'returned':
        req.status = 'draft'
        req.current_approver = None
        BudgetEncumbrance.objects.filter(requisition=req, status='active').update(status='released', released_at=timezone.now())
    else:
        req.status = flow['to']
        if req.status == 'pending_dg':
            # Finance stage confirms budget hold; keep it idempotent.
            _check_budget_and_encumber(req)
        if req.status == 'approved':
            req.approved_at = timezone.now()
            req.current_approver = None

    req.save()

    RequisitionApproval.objects.create(
        requisition=req,
        approver=user,
        approval_level=flow['level'],
        decision=decision,
        comments=comments or '',
        approved_at=timezone.now() if decision == 'approved' else None,
    )

    if req.status in ('rejected', 'draft'):
        _notify_requisition_requester(
            req,
            title=f'Requisition {req.req_number} {req.status}',
            message=f'{req.req_number} was {req.status}. {comments or "Please review the requisition details."}',
            priority='high',
        )
        return req.status, f'Requisition {req.status}'
    if req.status == 'approved':
        _notify_requisition_requester(
            req,
            title=f'Requisition {req.req_number} approved',
            message=f'{req.req_number} has completed approval and is ready for procurement planning.',
        )
    else:
        _notify_requisition_next_reviewer(req, user)
    return req.status, f'Requisition approved, moved to {req.status}'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def requisition_approve_view(request, pk):
    try:
        req = Requisition.objects.get(pk=pk)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    decision = request.data.get('decision', 'approved')
    comments = request.data.get('comments', '')
    new_status, message = _advance_requisition(req, request.user, decision, comments)
    if new_status is None:
        return Response({'error': message}, status=400)

    return Response({'message': message, 'status': new_status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def requisition_amend_view(request, pk):
    try:
        req = Requisition.objects.get(pk=pk)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    if req.status not in ('draft', 'approved'):
        return Response({'error': 'Only draft or approved requisitions can be amended'}, status=400)

    last_version = RequisitionVersion.objects.filter(requisition=req).first()
    version_number = (last_version.version_number + 1) if last_version else 1

    serializer = RequisitionSerializer(req)
    RequisitionVersion.objects.create(
        requisition=req,
        version_number=version_number,
        data_snapshot=serializer.data,
        created_by=request.user,
    )

    if req.status == 'approved':
        req.status = 'draft'
        req.save()

    return Response({'message': f'Version {version_number} created. Requisition re-opened for amendment.', 'version': version_number})


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def requisition_diff_view(request, pk):
    try:
        req = Requisition.objects.get(pk=pk)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    versions = RequisitionVersion.objects.filter(requisition=req).order_by('-version_number')[:2]
    if versions.count() < 2:
        return Response({'message': 'Need at least 2 versions for diff'}, status=400)

    v1, v2 = versions[1], versions[0]
    return Response({
        'requisition': req.req_number,
        'version_old': v1.version_number,
        'version_new': v2.version_number,
        'old_data': v1.data_snapshot,
        'new_data': v2.data_snapshot,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def requisition_tracking_view(request, pk):
    try:
        req = Requisition.objects.get(pk=pk)
    except Requisition.DoesNotExist:
        return Response({'error': 'Requisition not found'}, status=404)

    approvals = RequisitionApproval.objects.filter(requisition=req).order_by('created_at')
    data = {
        'requisition_id': str(req.requisition_id),
        'req_number': req.req_number,
        'status': req.status,
        'days_at_stage': req.days_at_current_stage(),
        'current_approver': req.current_approver.full_name if req.current_approver else None,
        'approval_history': RequisitionApprovalSerializer(approvals, many=True).data,
    }
    return Response(data)


class RequisitionItemListView(BaseView, generics.ListCreateAPIView):
    queryset = RequisitionItem.objects.select_related('requisition', 'unit_of_measure', 'commodity').all()
    serializer_class = RequisitionItemSerializer
    ordering = ['-item_id']


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def requisition_item_upload_attachment_view(request, item_id):
    try:
        item = RequisitionItem.objects.get(pk=item_id)
    except RequisitionItem.DoesNotExist:
        return Response({'error': 'Line item not found'}, status=404)

    req = item.requisition
    if req.status not in ('draft', 'rejected', 'amended'):
        return Response({'error': 'Only draft, rejected, or amended requisitions can be edited'}, status=400)
    if req.requester_id != request.user.id:
        return Response({'error': 'You can only edit requisitions you created'}, status=403)

    file = request.FILES.get('attachment')
    if not file:
        return Response({'error': 'No file provided'}, status=400)

    item.attachment = file
    item.save(update_fields=['attachment'])
    return Response({
        'message': 'Attachment uploaded',
        'item_id': str(item.item_id),
        'filename': file.name,
    })


class SpecificationListView(BaseView, generics.ListCreateAPIView):
    queryset = Specification.objects.select_related('requisition').all()
    serializer_class = SpecificationSerializer
    ordering = ['-specification_id']


class SpecificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Specification.objects.all()
    serializer_class = SpecificationSerializer
    permission_classes = [IsAuthenticated]


class RequisitionApprovalListView(BaseView, generics.ListAPIView):
    queryset = RequisitionApproval.objects.select_related('requisition', 'approver').all()
    serializer_class = RequisitionApprovalSerializer
    ordering = ['-created_at']


class BudgetEncumbranceListView(BaseView, generics.ListCreateAPIView):
    queryset = BudgetEncumbrance.objects.select_related('requisition').all()
    serializer_class = BudgetEncumbranceSerializer
    ordering = ['-created_at']


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def requisition_dashboard_view(request):
    stats = {
        'total': Requisition.objects.count(),
        'draft': Requisition.objects.filter(status='draft').count(),
        'submitted': Requisition.objects.filter(status='submitted').count(),
        'pending_dept_head': Requisition.objects.filter(status='pending_dept_head').count(),
        'pending_finance': Requisition.objects.filter(status='pending_finance').count(),
        'pending_dg': Requisition.objects.filter(status='pending_dg').count(),
        'pending_zpc': Requisition.objects.filter(status='pending_zpc').count(),
        'approved': Requisition.objects.filter(status='approved').count(),
        'rejected': Requisition.objects.filter(status='rejected').count(),
        'total_value': Requisition.objects.filter(status__in=['approved', 'submitted', 'pending_dept_head', 'pending_finance', 'pending_dg', 'pending_zpc']).aggregate(total=models.Sum('estimated_total'))['total'] or 0,
    }
    return Response(stats)
