from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import AnnualProcurementPlan, APPLineItem, ContractProcurementPlan, ProcurementMilestone, GeneralProcurementNotice
from .serializers import (
    AnnualProcurementPlanSerializer, AnnualProcurementPlanListSerializer,
    APPLineItemSerializer, ContractProcurementPlanSerializer,
    ProcurementMilestoneSerializer, GeneralProcurementNoticeSerializer,
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


class APPFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(lookup_expr='exact')
    status_in = django_filters.CharFilter(field_name='status', lookup_expr='in', method='filter_status_in')
    fiscal_year = django_filters.CharFilter(field_name='fiscal_year__year_code', lookup_expr='exact')
    department = django_filters.CharFilter(field_name='department__dept_code', lookup_expr='exact')
    is_consolidated = django_filters.BooleanFilter()

    def filter_status_in(self, queryset, name, value):
        statuses = value.split(',')
        return queryset.filter(status__in=statuses)

    class Meta:
        model = AnnualProcurementPlan
        fields = ['status', 'fiscal_year', 'department', 'is_consolidated']


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


ALLOWED_APP_CREATORS = ('user_dept_staff', 'department_head', 'procurement_officer', 'system_admin')


class AnnualProcurementPlanListView(BaseView, generics.ListCreateAPIView):
    queryset = AnnualProcurementPlan.objects.select_related('fiscal_year', 'department', 'submitted_by', 'approved_by').all()
    filterset_class = APPFilter
    ordering = ['-created_at']
    search_fields = ['department__dept_name', 'status']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return AnnualProcurementPlanListSerializer
        return AnnualProcurementPlanSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ALLOWED_APP_CREATORS:
            raise PermissionDenied('Only User Department Staff or Department Head can create an APP')
        serializer.save()


class AnnualProcurementPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = AnnualProcurementPlan.objects.select_related(
        'fiscal_year', 'department', 'submitted_by', 'approved_by', 'rejected_by',
    ).prefetch_related('line_items', 'gpns').all()
    serializer_class = AnnualProcurementPlanSerializer
    permission_classes = [IsAuthenticated]

    def destroy(self, request, *args, **kwargs):
        instance = self.get_object()
        if instance.status not in ('draft', 'rejected'):
            return Response(
                {'error': 'Only draft or rejected APPs can be deleted'},
                status=status.HTTP_403_FORBIDDEN,
            )
        self.perform_destroy(instance)
        return Response(status=status.HTTP_204_NO_CONTENT)


CURRENT_STAGE_ROLES = {
    'draft': None,
    'dept_head_review': 'department_head',
    'procurement_review': 'procurement_officer',
    'director_review': 'director_procurement',
    'zpc_review': 'zpc_member',
}

SUBMIT_TRANSITIONS = {
    'draft': 'dept_head_review',
}

APPROVE_TRANSITIONS = {
    'dept_head_review': 'procurement_review',
    'procurement_review': 'zpc_review',
    'director_review': 'zpc_review',
    'zpc_review': 'approved',
}

SUBMIT_ACTOR_ROLES = {
    'draft': ('user_dept_staff', 'department_head'),
}

APPROVE_ACTOR_ROLES = {
    'dept_head_review': ('department_head',),
    'procurement_review': ('director_procurement', 'director_general', 'system_admin'),
    'director_review': ('director_procurement',),
    'zpc_review': ('zpc_member', 'director_general'),
}


def _record_approval_trail(app, action, user, details=None):
    trail = list(app.approval_trail or [])
    trail.append({
        'action': action,
        'role': user.role,
        'user_id': str(user.id),
        'user_name': user.full_name,
        'timestamp': timezone.now().isoformat(),
        'details': details or {},
    })
    app.approval_trail = trail


def _check_budget_availability(app):
    warnings = []
    for item in app.line_items.all():
        try:
            from finance.models import BudgetAllocation
            dept_code = app.department.budget_code or app.department.dept_code
            ba = BudgetAllocation.objects.filter(
                entity_code=dept_code,
                fiscal_year=app.fiscal_year.year_code,
            ).first()
            if ba and float(item.estimated_value) > float(ba.available):
                warnings.append({
                    'item_id': str(item.line_item_id),
                    'description': item.description[:50],
                    'estimated_value': float(item.estimated_value),
                    'available': float(ba.available),
                    'shortfall': float(item.estimated_value) - float(ba.available),
                })
        except Exception:
            pass
    return warnings


def _recommend_method(estimated_value):
    try:
        from system_config.models import ThresholdRule
        rules = ThresholdRule.objects.filter(
            applies_to='procurement', is_active=True,
        ).order_by('min_value')
        for rule in rules:
            if rule.min_value <= estimated_value:
                if rule.max_value is None or estimated_value <= rule.max_value:
                    return rule.default_method or 'open_tender', rule.rule_name
        return 'open_tender', 'Default to open tender for high-value procurement'
    except Exception:
        if estimated_value > 1000000:
            return 'open_tender', 'Value exceeds threshold. Open tendering required.'
        elif estimated_value > 20000:
            return 'simplified', 'Value within simplified bidding range.'
        else:
            return 'direct', 'Low-value procurement. Direct procurement permitted.'


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_submit_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if app.status not in SUBMIT_TRANSITIONS:
        return Response(
            {'error': f'APP in status "{app.status}" cannot be submitted. Only draft can be submitted.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = SUBMIT_ACTOR_ROLES.get(app.status)
    if not allowed or user.role not in allowed:
        return Response(
            {'error': f'Only {", ".join(allowed) if allowed else "no one"} can submit at this stage. Your role: {user.role}'},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_status = SUBMIT_TRANSITIONS[app.status]

    budget_warnings = _check_budget_availability(app)
    if budget_warnings:
        return Response({
            'error': 'Budget validation failed. Insufficient funds for some line items.',
            'budget_warnings': budget_warnings,
        }, status=status.HTTP_400_BAD_REQUEST)

    _record_approval_trail(app, 'submitted', user)
    old_status = app.status
    app.status = new_status
    app.submitted_by = user
    app.submitted_at = timezone.now()
    app.save()

    return Response({
        'message': f'APP submitted from "{old_status}" to "{new_status}"',
        'status': app.status,
        'approval_trail': app.approval_trail,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_approve_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if app.status not in APPROVE_TRANSITIONS:
        return Response(
            {'error': f'APP in status "{app.status}" cannot be approved.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = APPROVE_ACTOR_ROLES.get(app.status)
    if not allowed or user.role not in allowed:
        return Response(
            {'error': f'Only {", ".join(allowed) if allowed else "no one"} can approve at this stage. Your role: {user.role}'},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_status = APPROVE_TRANSITIONS[app.status]

    if app.status == 'zpc_review' and new_status == 'approved':
        zpc_minutes = request.data.get('zpc_minutes', '')
        zpc_resolution_number = request.data.get('zpc_resolution_number', '')
        app.zpc_resolution = {
            'resolution_number': zpc_resolution_number,
            'minutes': zpc_minutes,
            'approved_by': user.full_name,
            'approved_at': timezone.now().isoformat(),
        }

    _record_approval_trail(app, 'approved', user, {'new_status': new_status})
    old_status = app.status
    app.status = new_status
    app.approved_by = user
    app.approved_at = timezone.now()
    app.save()

    if new_status == 'approved':
        _auto_generate_gpn(app, user)

    return Response({
        'message': f'APP approved from "{old_status}" to "{new_status}"',
        'status': app.status,
        'approval_trail': app.approval_trail,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_reject_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    reason = request.data.get('reason', '').strip()
    if not reason:
        return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    reviewer_role = CURRENT_STAGE_ROLES.get(app.status)
    if reviewer_role and user.role != reviewer_role and user.role not in ('system_admin', 'director_general'):
        return Response(
            {'error': f'Only {reviewer_role} can reject at this stage.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    _record_approval_trail(app, 'rejected', user, {'reason': reason})
    app.status = 'rejected'
    app.rejection_reason = reason
    app.rejected_by = user
    app.rejected_at = timezone.now()
    app.save()

    return Response({
        'message': 'APP rejected',
        'status': app.status,
        'rejection_reason': reason,
        'approval_trail': app.approval_trail,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_return_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    reason = request.data.get('reason', '').strip()
    if not reason:
        return Response({'error': 'Return reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    reviewer_role = CURRENT_STAGE_ROLES.get(app.status)
    if reviewer_role and user.role != reviewer_role and user.role not in ('system_admin', 'director_general'):
        return Response(
            {'error': f'Only {reviewer_role} can return at this stage.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    _record_approval_trail(app, 'returned', user, {'reason': reason})
    app.status = 'draft'
    app.rejection_reason = reason
    app.save()

    return Response({
        'message': 'APP returned to draft for revision',
        'status': app.status,
    })


def _auto_generate_gpn(app, user):
    existing = GeneralProcurementNotice.objects.filter(app=app).first()
    if existing:
        return existing

    line_items_data = []
    for item in app.line_items.all():
        line_items_data.append({
            'description': item.description,
            'estimated_value': float(item.estimated_value),
            'recommended_method': item.recommended_method or _recommend_method(float(item.estimated_value))[0],
            'planned_issue_date': str(item.planned_issue_date) if item.planned_issue_date else None,
            'planned_award_date': str(item.planned_award_date) if item.planned_award_date else None,
        })

    content = {
        'fiscal_year': app.fiscal_year.year_code,
        'department': app.department.dept_name,
        'total_estimated_value': float(app.total_estimated_value),
        'generated_at': timezone.now().isoformat(),
        'line_items': line_items_data,
    }

    gpn = GeneralProcurementNotice.objects.create(
        app=app,
        content=content,
        generated_by=user,
        publication_status='draft',
    )
    return gpn


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_publish_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if app.status != 'approved':
        return Response(
            {'error': 'Only approved APPs can be published. Current status: ' + app.status},
            status=status.HTTP_400_BAD_REQUEST,
        )

    app.status = 'published'
    app.save()

    return Response({
        'message': 'APP published',
        'status': app.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_compliance_check_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.role not in ('procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'):
        return Response({'error': 'Only procurement officers can perform compliance checks'}, status=status.HTTP_403_FORBIDDEN)

    if app.status not in ('procurement_review',):
        return Response({'error': 'Compliance check can only be done during procurement review'}, status=status.HTTP_400_BAD_REQUEST)

    compliance_status = request.data.get('compliance_status', 'compliant')
    notes = request.data.get('notes', '')
    app.compliance_notes = notes

    if compliance_status == 'non_compliant':
        _record_approval_trail(app, 'returned', request.user, {'reason': 'Non-compliant: ' + notes})
        app.status = 'draft'
        app.rejection_reason = 'Non-compliant: ' + notes
        app.save()
        return Response({'message': 'APP returned for non-compliance', 'status': app.status})

    _record_approval_trail(app, 'complied', request.user, {'notes': notes})
    app.save()

    return Response({
        'message': 'Compliance check passed',
        'status': app.status,
        'compliance_notes': notes,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_consolidate_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.role not in ('procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'):
        return Response({'error': 'Only procurement officers can consolidate APPs'}, status=status.HTTP_403_FORBIDDEN)

    if app.status != 'procurement_review':
        return Response({'error': 'Consolidation can only be done during procurement review stage'}, status=status.HTTP_400_BAD_REQUEST)

    target_app_id = request.data.get('consolidate_into')
    if not target_app_id:
        return Response({'error': 'consolidate_into (target APP ID) is required'}, status=status.HTTP_400_BAD_REQUEST)

    try:
        target_app = AnnualProcurementPlan.objects.get(pk=target_app_id)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'Target APP not found'}, status=status.HTTP_404_NOT_FOUND)

    notes = request.data.get('notes', '')
    app.is_consolidated = True
    app.consolidated_into = target_app
    app.consolidation_notes = notes
    _record_approval_trail(app, 'consolidated', request.user, {
        'consolidated_into': str(target_app.app_id),
        'notes': notes,
    })
    app.save()

    for item in app.line_items.all():
        item.app = target_app
        item.save()

    target_app.total_estimated_value = target_app.line_items.aggregate(
        total=Sum('estimated_value')
    )['total'] or 0
    target_app.save()

    return Response({
        'message': 'APP consolidated into target',
        'consolidated_app': str(app.app_id),
        'consolidated_into': str(target_app.app_id),
        'new_total_value': float(target_app.total_estimated_value),
    })


class APPLineItemListView(BaseView, generics.ListCreateAPIView):
    queryset = APPLineItem.objects.select_related('app__department', 'app__fiscal_year', 'commodity').all()
    serializer_class = APPLineItemSerializer
    ordering = ['-line_item_id']
    filterset_fields = ['app__department', 'app__fiscal_year', 'commodity']
    search_fields = ['description', 'app__department__dept_name']

    def perform_create(self, serializer):
        item = serializer.save()
        method, rationale = _recommend_method(float(item.estimated_value))
        item.recommended_method = method
        item.save(update_fields=['recommended_method'])

        app = item.app
        new_total = app.line_items.aggregate(total=Sum('estimated_value'))['total'] or 0
        AnnualProcurementPlan.objects.filter(pk=app.pk).update(total_estimated_value=new_total)


class APPLineItemDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = APPLineItem.objects.all()
    serializer_class = APPLineItemSerializer
    permission_classes = [IsAuthenticated]

    def perform_update(self, serializer):
        item = serializer.save()
        method, rationale = _recommend_method(float(item.estimated_value))
        item.recommended_method = method
        item.save(update_fields=['recommended_method'])

        app = item.app
        new_total = app.line_items.aggregate(total=Sum('estimated_value'))['total'] or 0
        AnnualProcurementPlan.objects.filter(pk=app.pk).update(total_estimated_value=new_total)


class ContractProcurementPlanListView(BaseView, generics.ListCreateAPIView):
    queryset = ContractProcurementPlan.objects.select_related('requisition', 'created_by').prefetch_related('procurement_milestones').all()
    serializer_class = ContractProcurementPlanSerializer
    ordering = ['-created_at']


class ContractProcurementPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ContractProcurementPlan.objects.select_related('requisition', 'created_by').prefetch_related('procurement_milestones').all()
    serializer_class = ContractProcurementPlanSerializer
    permission_classes = [IsAuthenticated]


class ProcurementMilestoneListView(BaseView, generics.ListCreateAPIView):
    queryset = ProcurementMilestone.objects.all()
    serializer_class = ProcurementMilestoneSerializer
    ordering = ['planned_date']


class ProcurementMilestoneDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProcurementMilestone.objects.all()
    serializer_class = ProcurementMilestoneSerializer
    permission_classes = [IsAuthenticated]


class GeneralProcurementNoticeListView(BaseView, generics.ListCreateAPIView):
    queryset = GeneralProcurementNotice.objects.select_related('app', 'generated_by', 'published_by').all()
    serializer_class = GeneralProcurementNoticeSerializer
    ordering = ['-generated_at']
    filterset_fields = ['publication_status', 'app']


class GeneralProcurementNoticeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = GeneralProcurementNotice.objects.select_related('app', 'generated_by', 'published_by').all()
    serializer_class = GeneralProcurementNoticeSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gpn_generate_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if app.status not in ('approved', 'published'):
        return Response({'error': 'GPN can only be generated for approved APPs'}, status=status.HTTP_400_BAD_REQUEST)

    gpn = _auto_generate_gpn(app, request.user)
    serializer = GeneralProcurementNoticeSerializer(gpn)
    return Response({
        'message': 'GPN generated successfully',
        'gpn': serializer.data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gpn_publish_view(request, pk):
    try:
        gpn = GeneralProcurementNotice.objects.get(pk=pk)
    except GeneralProcurementNotice.DoesNotExist:
        return Response({'error': 'GPN not found'}, status=status.HTTP_404_NOT_FOUND)

    targets = request.data.get('targets', ['website'])
    proof_urls = request.data.get('proof_urls', [])

    valid_targets = ['website', 'e_gp_portal', 'government_gazette']
    for t in targets:
        if t not in valid_targets:
            return Response({'error': f'Invalid publication target: {t}. Valid: {valid_targets}'}, status=status.HTTP_400_BAD_REQUEST)

    gpn.publication_status = 'published'
    gpn.publication_targets = targets
    gpn.publication_proof_urls = proof_urls
    gpn.published_at = timezone.now()
    gpn.published_by = request.user
    gpn.save()

    return Response({
        'message': 'GPN published',
        'status': gpn.publication_status,
        'publication_targets': targets,
        'published_at': gpn.published_at.isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gpn_archive_view(request, pk):
    try:
        gpn = GeneralProcurementNotice.objects.get(pk=pk)
    except GeneralProcurementNotice.DoesNotExist:
        return Response({'error': 'GPN not found'}, status=status.HTTP_404_NOT_FOUND)

    gpn.publication_status = 'archived'
    gpn.save()

    return Response({
        'message': 'GPN archived',
        'status': gpn.publication_status,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def app_dashboard_view(request):
    stats = {
        'total': AnnualProcurementPlan.objects.count(),
        'draft': AnnualProcurementPlan.objects.filter(status='draft').count(),
        'dept_head_review': AnnualProcurementPlan.objects.filter(status='dept_head_review').count(),
        'procurement_review': AnnualProcurementPlan.objects.filter(status='procurement_review').count(),
        'director_review': AnnualProcurementPlan.objects.filter(status='director_review').count(),
        'zpc_review': AnnualProcurementPlan.objects.filter(status='zpc_review').count(),
        'approved': AnnualProcurementPlan.objects.filter(status='approved').count(),
        'published': AnnualProcurementPlan.objects.filter(status='published').count(),
        'rejected': AnnualProcurementPlan.objects.filter(status='rejected').count(),
        'total_value': AnnualProcurementPlan.objects.aggregate(total=Sum('total_estimated_value'))['total'] or 0,
        'consolidated': AnnualProcurementPlan.objects.filter(is_consolidated=True).count(),
    }
    return Response(stats)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def app_approval_trail_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    return Response({
        'app_id': str(app.app_id),
        'status': app.status,
        'approval_trail': app.approval_trail,
    })
