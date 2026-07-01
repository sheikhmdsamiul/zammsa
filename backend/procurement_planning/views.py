import logging
from decimal import Decimal
from django.db.models import Q, Sum
from django.utils import timezone
from rest_framework import generics, filters, status

logger = logging.getLogger(__name__)
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.exceptions import PermissionDenied
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from accounts.models import User
from system_config.models import Notification
from system_config.notifications import create_notification, notify_role, notify_roles, send_external_bulk_email
from .models import AnnualProcurementPlan, APPLineItem, ContractProcurementPlan, ProcurementMilestone, GeneralProcurementNotice, CPPRisk, CPPDocument
from .serializers import (
    AnnualProcurementPlanSerializer, AnnualProcurementPlanListSerializer,
    APPLineItemSerializer, ContractProcurementPlanListSerializer,
    ContractProcurementPlanSerializer, ProcurementMilestoneSerializer,
    GeneralProcurementNoticeSerializer, CPPRiskSerializer,
    CPPDocumentSerializer,
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


ALLOWED_APP_CREATORS = ('user_dept_staff', 'procurement_officer', 'system_admin')


class AnnualProcurementPlanListView(BaseView, generics.ListCreateAPIView):
    queryset = AnnualProcurementPlan.objects.select_related('fiscal_year', 'department', 'created_by', 'submitted_by', 'approved_by').all()
    filterset_class = APPFilter
    ordering = ['-created_at']
    search_fields = ['department__dept_name', 'status']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return AnnualProcurementPlanListSerializer
        return AnnualProcurementPlanSerializer

    def create(self, request, *args, **kwargs):
        fiscal_year = request.data.get('fiscal_year')
        department = request.data.get('department')
        if fiscal_year and department:
            existing = AnnualProcurementPlan.objects.filter(
                fiscal_year_id=fiscal_year, department_id=department
            ).first()
            if existing:
                if existing.status not in ('draft', 'rejected'):
                    return Response(
                        {
                            'error': 'An Annual Procurement Plan already exists for this fiscal year and department.',
                            'app_id': str(existing.app_id),
                            'status': existing.status,
                        },
                        status=status.HTTP_400_BAD_REQUEST,
                    )
                if not existing.created_by_id:
                    existing.created_by = request.user
                    existing.save(update_fields=['created_by'])
                serializer = self.get_serializer(existing)
                return Response(serializer.data)
        try:
            return super().create(request, *args, **kwargs)
        except Exception as e:
            logger.error(f"APP creation failed: {e}", exc_info=True)
            return Response(
                {'error': f'Failed to create APP: {str(e)}'},
                status=status.HTTP_400_BAD_REQUEST
            )

    def perform_create(self, serializer):
        if self.request.user.role not in ALLOWED_APP_CREATORS:
            raise PermissionDenied('Only User Department Staff or Department Head can create an APP')
        serializer.save(created_by=self.request.user)


class AnnualProcurementPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = AnnualProcurementPlan.objects.select_related(
        'fiscal_year', 'department', 'created_by', 'submitted_by', 'approved_by', 'rejected_by',
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


APP_CURRENT_STAGE_ROLES = {
    'draft': None,
    'dept_head_review': 'department_head',
    'procurement_review': 'procurement_officer',
    'director_review': 'director_procurement',
    'zpc_review': 'zpc_member',
    # Backward compatibility for legacy APPs created before staged flow update.
    'pending_zpc': 'director_procurement',
}

APP_SUBMIT_TRANSITIONS = {
    'draft': 'dept_head_review',
}

APP_APPROVE_TRANSITIONS = {
    'dept_head_review': 'procurement_review',
    'procurement_review': 'director_review',
    'director_review': 'zpc_review',
    'zpc_review': 'approved',
    # Backward compatibility for legacy APPs.
    'pending_zpc': 'approved',
}

APP_SUBMIT_ACTOR_ROLES = {
    'draft': ('user_dept_staff', 'system_admin'),
}

APP_APPROVE_ACTOR_ROLES = {
    'dept_head_review': ('department_head', 'system_admin'),
    'procurement_review': ('procurement_officer', 'system_admin'),
    'director_review': ('director_procurement', 'system_admin'),
    'zpc_review': ('zpc_member', 'system_admin'),
    # Backward compatibility for legacy APPs.
    'pending_zpc': ('director_procurement', 'zpc_member', 'system_admin'),
}


CPP_SUBMIT_TRANSITIONS = {
    'draft': 'pending_zpc',
}

CPP_APPROVE_TRANSITIONS = {
    'pending_zpc': 'approved',
}

CPP_SUBMIT_ACTOR_ROLES = {
    'draft': ('procurement_officer', 'system_admin'),
}

CPP_APPROVE_ACTOR_ROLES = {
    'pending_zpc': ('director_procurement', 'zpc_member', 'system_admin'),
}

CPP_CURRENT_STAGE_ROLES = {
    'pending_zpc': 'zpc_member',
}

NON_OPEN_CPP_METHODS = ('limited', 'simplified', 'direct')


def _record_app_approval_trail(app, action, user, details=None):
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


def _app_action_url(app):
    return f'/procurement-planning/{app.app_id}'


def _notify_app_next_reviewer(app, actor, old_status, new_status):
    next_role = APP_CURRENT_STAGE_ROLES.get(new_status)
    if not next_role:
        return

    notify_role(
        next_role,
        title=f'APP review required: {app.app_number or app.app_id}',
        message=(
            f'{actor.full_name} moved {app.department.dept_name} APP '
            f'from {old_status.replace("_", " ")} to {new_status.replace("_", " ")}.'
        ),
        notification_type='approval',
        priority='high',
        source_module='procurement_planning',
        object_id=app.app_id,
        action_url=_app_action_url(app),
        metadata={'from_status': old_status, 'to_status': new_status},
        email_required=True,
        exclude_user=actor,
    )


def _notify_app_owner(app, title, message, actor=None, priority='normal'):
    recipients = []
    for user in (app.created_by, app.submitted_by):
        if user and user not in recipients:
            recipients.append(user)

    for recipient in recipients:
        if actor and recipient.pk == actor.pk:
            continue
        create_notification(
            recipient,
            title=title,
            message=message,
            notification_type='workflow',
            priority=priority,
            source_module='procurement_planning',
            object_id=app.app_id,
            action_url=_app_action_url(app),
            email_required=True,
        )


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


def _recommend_method(estimated_value, commodity_type=''):
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
        is_consulting = str(commodity_type or '').lower() in ('consulting', 'consulting services', 'tor', 'terms of reference', 'sow')
        if is_consulting:
            if estimated_value > 600000:
                return 'proposal', f'Consulting service value exceeds ZMW 600,000. Request for Proposals required.'
            elif estimated_value > 20000:
                return 'simplified', 'Consulting service value within simplified selection range.'
            else:
                return 'direct', 'Low-value consulting. Direct procurement permitted.'
        if estimated_value > 1000000:
            return 'open_tender', 'Value exceeds threshold. Open tendering required.'
        elif estimated_value > 20000:
            return 'simplified', 'Value within simplified bidding range.'
        else:
            return 'direct', 'Low-value procurement. Direct procurement permitted.'


def _auto_populate_cpp_from_requisition(requisition):
    """Auto-populate CPP fields from requisition data"""
    if not requisition:
        return {}
    
    # Get line items for detailed breakdown
    line_items = []
    total_from_items = 0
    for item in requisition.items.all():
        line_items.append({
            'description': item.description,
            'quantity': float(item.quantity),
            'unit_price': float(item.unit_price_estimate),
            'total_price': float(item.total_estimate),
        })
        total_from_items += float(item.total_estimate)
    
    # Use requisition estimated total or sum of line items
    estimated_value = float(requisition.estimated_total or total_from_items or 0)
    
    # Get system recommendation
    recommended_method, method_rationale = _recommend_method(estimated_value)
    
    # Determine if ZPC approval is required (non-open methods)
    non_open_methods = ('limited', 'simplified', 'direct')
    zpc_approval_required = recommended_method in non_open_methods
    
    # Prepare data
    data = {
        'requisition': requisition.id,
        'estimated_value': estimated_value,
        'procurement_strategy': recommended_method,
        'recommended_method': recommended_method,
        'method': recommended_method,
        'method_override': False,
        'zpc_approval_required': zpc_approval_required,
        'zpc_justification': '',
        'resource_requirements': {
            'evaluation_committee_size': 3,  # minimum
            'prebid_conference_required': False,
            'site_visit_required': False,
            'external_expert_required': False,
            'special_inspection_required': False,
            'special_delivery_requirements': False,
        },
        'risk_assessment': {
            'risks': [],  # Will be filled in step 5
            'overall_level': 'low',  # Will be calculated
        },
        'milestones': [],  # Will be generated in step 3
    }
    
    return data


# BR-CPP-08: Minimum solicitation-to-closing periods by method
MIN_SOLICITATION_PERIODS = {
    'open_tender': 21,
    'international': 30,
    'limited': 14,
    'simplified': 14,
    'direct': 0,
}

DEFAULT_MILESTONE_NAMES = [
    'Requisition to Solicitation',
    'Publication (Solicitation issued)',
    'Closing Date',
    'Bid Opening',
    'Evaluation Completion',
    'BER Approval (ZPC)',
    'Contract Award Notice',
    'Standstill Expires (10 working days)',
    'Contract Signing',
    'Delivery',
]


def _default_cpp_milestone_template(method, procurement_type='goods'):
    """Generate milestone template by procurement method and type.
    
    procuremt_type: 'goods', 'works', 'services', 'consulting'
    method: 'open_tender', 'international', 'limited', 'simplified', 'direct'
    """
    # Configurable template by method; values are day offsets from day-0.
    # BR-CPP-08: Closing date minimum periods
    if method == 'open_tender':
        solicitation_to_closing = 21
        closing_to_evaluation = 14
        evaluation_to_award = 5
        award_to_signing = 23
    elif method == 'international':
        solicitation_to_closing = 30
        closing_to_evaluation = 14
        evaluation_to_award = 5
        award_to_signing = 23
    elif method == 'simplified':
        solicitation_to_closing = 14
        closing_to_evaluation = 7
        evaluation_to_award = 3
        award_to_signing = 10
    elif method == 'limited':
        solicitation_to_closing = 14
        closing_to_evaluation = 10
        evaluation_to_award = 3
        award_to_signing = 10
    else:  # direct, simplified fallback
        solicitation_to_closing = 10
        closing_to_evaluation = 7
        evaluation_to_award = 3
        award_to_signing = 10
    
    # All templates now produce 22 milestones (seq 1-22) as per the Phase Guide.
    # Seq 1-14: Pre-contract / procurement phase
    # Seq 15-22: Post-award / contract execution phase
    base_pre = [
        ('CPP Approved', 0),
        ('Solicitation Document Ready', 2),
        ('Solicitation Published', 3),
        ('Pre-bid Conference Held', 4),
        ('Clarification Cutoff', 1 + solicitation_to_closing - 5),
        ('Bid Closing Date', 1 + solicitation_to_closing),
        ('Public Bid Opening', 1 + solicitation_to_closing),
        ('Preliminary Examination Complete', 1 + solicitation_to_closing + closing_to_evaluation),
        ('Technical Evaluation Complete', 1 + solicitation_to_closing + closing_to_evaluation + 7),
        ('Financial Evaluation Complete', 1 + solicitation_to_closing + closing_to_evaluation + 9),
        ('BER Generated and Signed', 1 + solicitation_to_closing + closing_to_evaluation + 11),
        ('BER Approved by ZPC', 1 + solicitation_to_closing + closing_to_evaluation + 16),
        ('Contract Award Notice Published', 1 + solicitation_to_closing + closing_to_evaluation + 17),
        ('Standstill Period Ends', 1 + solicitation_to_closing + closing_to_evaluation + 27),
    ]

    if procurement_type == 'consulting':
        return base_pre + [
            ('Contract Signed — Both Parties', 1 + solicitation_to_closing + closing_to_evaluation + 29),
            ('Performance Security Received', 1 + solicitation_to_closing + closing_to_evaluation + 32),
            ('Contract Active / Work Commences', 1 + solicitation_to_closing + closing_to_evaluation + 34),
            ('Delivery / Completion', 1 + solicitation_to_closing + closing_to_evaluation + 48),
            ('Final Inspection and Acceptance', 1 + solicitation_to_closing + closing_to_evaluation + 55),
            ('Final Invoice Submission', 1 + solicitation_to_closing + closing_to_evaluation + 58),
            ('Final Payment', 1 + solicitation_to_closing + closing_to_evaluation + 65),
            ('Contract Closure', 1 + solicitation_to_closing + closing_to_evaluation + 72),
        ]
    elif procurement_type == 'works':
        closing_to_completion = 14
        return base_pre + [
            ('Contract Signed — Both Parties', 1 + solicitation_to_closing + closing_to_evaluation + 29),
            ('Performance Security Received', 1 + solicitation_to_closing + closing_to_evaluation + 32),
            ('Contract Active / Work Commences', 1 + solicitation_to_closing + closing_to_evaluation + 34),
            ('Delivery / Completion', 1 + solicitation_to_closing + closing_to_evaluation + 34 + closing_to_completion),
            ('Final Inspection and Acceptance', 1 + solicitation_to_closing + closing_to_evaluation + 34 + closing_to_completion + 5),
            ('Final Invoice Submission', 1 + solicitation_to_closing + closing_to_evaluation + 34 + closing_to_completion + 8),
            ('Final Payment', 1 + solicitation_to_closing + closing_to_evaluation + 34 + closing_to_completion + 18),
            ('Contract Closure', 1 + solicitation_to_closing + closing_to_evaluation + 34 + closing_to_completion + 25),
        ]
    else:  # goods, non-consulting services
        delivery_to_completion = 7
        return base_pre + [
            ('Contract Signed — Both Parties', 1 + solicitation_to_closing + closing_to_evaluation + 29),
            ('Performance Security Received', 1 + solicitation_to_closing + closing_to_evaluation + 32),
            ('Contract Active / Work Commences', 1 + solicitation_to_closing + closing_to_evaluation + 34),
            ('Delivery / Completion', 1 + solicitation_to_closing + closing_to_evaluation + 36),
            ('Final Inspection and Acceptance', 1 + solicitation_to_closing + closing_to_evaluation + 36 + delivery_to_completion),
            ('Final Invoice Submission', 1 + solicitation_to_closing + closing_to_evaluation + 36 + delivery_to_completion + 3),
            ('Final Payment', 1 + solicitation_to_closing + closing_to_evaluation + 36 + delivery_to_completion + 10),
            ('Contract Closure', 1 + solicitation_to_closing + closing_to_evaluation + 36 + delivery_to_completion + 17),
        ]


def _validate_milestone_minimum_periods(milestones, method):
    """BR-CPP-08: Validate closing date meets minimum period for the method."""
    from datetime import date
    min_days = MIN_SOLICITATION_PERIODS.get(method, 0)
    if min_days <= 0:
        return []

    errors = []
    pub_date = None
    closing_date = None

    for m in milestones:
        name_lower = (m.get('milestone_name') or '').lower()
        if 'publication' in name_lower or 'solicitation issued' in name_lower or 'solicitation' in name_lower:
            pub_date = m.get('planned_date')
        if 'closing' in name_lower or 'bid deadline' in name_lower:
            closing_date = m.get('planned_date')

    if pub_date and closing_date:
        try:
            pub = date.fromisoformat(pub_date) if isinstance(pub_date, str) else pub_date
            closing = date.fromisoformat(closing_date) if isinstance(closing_date, str) else closing_date
            gap = (closing - pub).days
            if gap < min_days:
                errors.append(
                    f'Closing date must be at least {min_days} days after publication date '
                    f'for method "{method}". Current gap: {gap} days.'
                )
        except (ValueError, TypeError):
            errors.append('Invalid date format in milestones. Use YYYY-MM-DD.')

    # BR-CPP-09: Validate bid opening is on or after closing
    opening_date = None
    for m in milestones:
        name_lower = (m.get('milestone_name') or '').lower()
        if 'bid opening' in name_lower or 'opening' in name_lower:
            opening_date = m.get('planned_date')
            break
    if opening_date and closing_date:
        try:
            opening = date.fromisoformat(opening_date) if isinstance(opening_date, str) else opening_date
            closing = date.fromisoformat(closing_date) if isinstance(closing_date, str) else closing_date
            if opening < closing:
                errors.append('Bid opening date must be on or after the closing date.')
        except (ValueError, TypeError):
            errors.append('Invalid date format in milestones. Use YYYY-MM-DD.')

    return errors


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_submit_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if app.status not in APP_SUBMIT_TRANSITIONS:
        return Response(
            {'error': f'APP in status "{app.status}" cannot be submitted. Only draft can be submitted.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = APP_SUBMIT_ACTOR_ROLES.get(app.status)
    if not allowed or user.role not in allowed:
        return Response(
            {'error': f'Only {", ".join(allowed) if allowed else "no one"} can submit at this stage. Your role: {user.role}'},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_status = APP_SUBMIT_TRANSITIONS[app.status]

    budget_warnings = _check_budget_availability(app)
    if budget_warnings:
        return Response({
            'error': 'Budget validation failed. Insufficient funds for some line items.',
            'budget_warnings': budget_warnings,
        }, status=status.HTTP_400_BAD_REQUEST)

    _record_app_approval_trail(app, 'submitted', user)
    old_status = app.status
    app.status = new_status
    app.submitted_by = user
    app.submitted_at = timezone.now()
    app.save()
    _notify_app_next_reviewer(app, user, old_status, new_status)

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

    if app.status not in APP_APPROVE_TRANSITIONS:
        return Response(
            {'error': f'APP in status "{app.status}" cannot be approved.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = APP_APPROVE_ACTOR_ROLES.get(app.status)
    if not allowed or user.role not in allowed:
        return Response(
            {'error': f'Only {", ".join(allowed) if allowed else "no one"} can approve at this stage. Your role: {user.role}'},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_status = APP_APPROVE_TRANSITIONS[app.status]

    if app.status == 'zpc_review' and new_status == 'approved':
        zpc_minutes = request.data.get('zpc_minutes', '')
        zpc_resolution_number = request.data.get('zpc_resolution_number', '')
        app.zpc_resolution = {
            'resolution_number': zpc_resolution_number,
            'minutes': zpc_minutes,
            'approved_by': user.full_name,
            'approved_at': timezone.now().isoformat(),
        }

    _record_app_approval_trail(app, 'approved', user, {'new_status': new_status})
    old_status = app.status
    app.status = new_status
    app.approved_by = user
    app.approved_at = timezone.now()
    app.save()
    _notify_app_next_reviewer(app, user, old_status, new_status)

    if new_status == 'approved':
        _auto_generate_gpn(app, user)
        # Set ZPPA submission deadline (30 days from approval)
        app.zppa_deadline = timezone.now() + timezone.timedelta(days=30)
        app.zppa_submitted = False
        app.zppa_submitted_at = None
        app.zppa_submission_ref = ''
        app.zppa_deadline_alerted = False
        app.save(update_fields=[
            'zppa_deadline', 'zppa_submitted', 'zppa_submitted_at',
            'zppa_submission_ref', 'zppa_deadline_alerted',
        ])
        _notify_app_owner(
            app,
            title=f'APP approved: {app.app_number or app.app_id}',
            message=f'{app.department.dept_name} APP for {app.fiscal_year.year_code} has been approved.',
            actor=user,
            priority='high',
        )

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

    reviewer_role = APP_CURRENT_STAGE_ROLES.get(app.status)
    if reviewer_role and user.role != reviewer_role and user.role not in ('system_admin', 'director_general'):
        return Response(
            {'error': f'Only {reviewer_role} can reject at this stage.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    _record_app_approval_trail(app, 'rejected', user, {'reason': reason})
    app.status = 'rejected'
    app.rejection_reason = reason
    app.rejected_by = user
    app.rejected_at = timezone.now()
    app.save()
    _notify_app_owner(
        app,
        title=f'APP rejected: {app.app_number or app.app_id}',
        message=f'{user.full_name} rejected the APP. Reason: {reason}',
        actor=user,
        priority='high',
    )

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

    reviewer_role = APP_CURRENT_STAGE_ROLES.get(app.status)
    if reviewer_role and user.role != reviewer_role and user.role not in ('system_admin', 'director_general'):
        return Response(
            {'error': f'Only {reviewer_role} can return at this stage.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    _record_app_approval_trail(app, 'returned', user, {'reason': reason})
    app.status = 'draft'
    app.rejection_reason = reason
    app.save()
    _notify_app_owner(
        app,
        title=f'APP returned for revision: {app.app_number or app.app_id}',
        message=f'{user.full_name} returned the APP for revision. Reason: {reason}',
        actor=user,
        priority='normal',
    )

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
            'procurement_type': item.procurement_type,
            'procurement_type_display': item.get_procurement_type_display(),
            'planned_issue_date': str(item.planned_issue_date) if item.planned_issue_date else None,
            'planned_award_date': str(item.planned_award_date) if item.planned_award_date else None,
            'funding_source': item.funding_source.source_name if item.funding_source else None,
            'commodity_name': item.commodity.commodity_name if item.commodity else None,
            'commodity_category': item.commodity.category if item.commodity else None,
            'is_citizen_reserved': item.is_citizen_reserved,
        })

    dept_code = app.department.dept_code
    year_code = app.fiscal_year.year_code
    seq = GeneralProcurementNotice.objects.filter(
        app__department=app.department,
        app__fiscal_year=app.fiscal_year,
    ).count() + 1
    gpn_ref = f'GPN-{year_code}-{dept_code}-{seq:03d}'

    # Calculate ZPPA deadline (30 days from approval)
    zppa_deadline = None
    if app.approved_at:
        zppa_deadline = (app.approved_at + timezone.timedelta(days=30)).isoformat()

    content = {
        'gpn_reference': gpn_ref,
        'fiscal_year': year_code,
        'department': app.department.dept_name,
        'department_code': dept_code,
        'total_estimated_value': float(app.total_estimated_value),
        'generated_at': timezone.now().isoformat(),
        'line_items': line_items_data,
        'zpc_approved_at': app.approved_at.isoformat() if app.approved_at else None,
        'zppa_deadline': zppa_deadline,
        'issuing_authority': 'ZAMMSA \u2014 Zambia Medicines and Medical Supplies Agency',
        'contact_name': 'Director of Procurement',
        'contact_email': 'procurement@zammsa.gov.zm',
        'contact_phone': '+260 211 123456',
        'contact_address': 'Plot 1, Government Road, Lusaka',
        'notice_heading': f'GENERAL PROCUREMENT NOTICE \u2014 ZAMMSA ANNUAL PROCUREMENT PLAN {year_code}',
        'notice_body': (
            f'The Zambia Medicines and Medical Supplies Agency (ZAMMSA) intends to procure the following '
            f'goods and services during the financial year {year_code} and invites eligible suppliers to '
            f'register their interest.\n\n'
            f'Eligible suppliers are encouraged to register on the ZAMMSA Supplier Portal at: '
            f'https://portal.zammsa.gov.zm/suppliers'
        ),
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
def gpn_generate_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.role not in ('procurement_officer', 'director_procurement', 'system_admin'):
        return Response({'error': 'Only procurement team can generate GPN'}, status=status.HTTP_403_FORBIDDEN)

    gpn = _auto_generate_gpn(app, request.user)
    serializer = GeneralProcurementNoticeSerializer(gpn)
    return Response({'message': 'GPN generated successfully', 'gpn': serializer.data}, status=status.HTTP_201_CREATED)


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

    # Track publication targets and proofs
    targets = request.data.get('targets', ['zammsa_website'])
    proofs = request.data.get('proofs', {})

    valid_targets = ['zammsa_website', 'egp_portal', 'govt_gazette']
    for t in targets:
        if t not in valid_targets:
            return Response(
                {'error': f'Invalid publication target: {t}. Valid: {valid_targets}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    app.status = 'published'
    app.gpn_published_at = timezone.now()
    app.gpn_publication_targets = targets
    app.gpn_publication_proofs = proofs
    app.save()

    # Also update the associated GPN if it exists
    gpn = GeneralProcurementNotice.objects.filter(app=app).first()
    if gpn:
        gpn.publication_status = 'published'
        gpn.publication_targets = targets
        gpn.published_at = timezone.now()
        gpn.published_by = request.user
        gpn.save()

    return Response({
        'message': 'APP published',
        'status': app.status,
        'publication_targets': targets,
        'published_at': app.gpn_published_at.isoformat(),
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
        _record_app_approval_trail(app, 'returned', request.user, {'reason': 'Non-compliant: ' + notes})
        app.status = 'draft'
        app.rejection_reason = 'Non-compliant: ' + notes
        app.save()
        return Response({'message': 'APP returned for non-compliance', 'status': app.status})

    _record_app_approval_trail(app, 'complied', request.user, {'notes': notes})
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
    _record_app_approval_trail(app, 'consolidated', request.user, {
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
    ordering = ['-app__created_at', 'description']
    filterset_fields = ['app__department', 'app__fiscal_year', 'commodity']
    search_fields = ['description', 'app__department__dept_name']

    def get_queryset(self):
        qs = super().get_queryset()
        status_filter = self.request.query_params.get('app__status__in')
        if status_filter:
            statuses = [s.strip() for s in status_filter.split(',') if s.strip()]
            if statuses:
                qs = qs.filter(app__status__in=statuses)
        else:
            qs = qs.filter(app__status__in=['approved', 'published'])
        return qs

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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_bulk_line_items_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if app.status != 'draft':
        return Response({'error': 'Line items can only be added to draft APPs'}, status=status.HTTP_400_BAD_REQUEST)

    items = request.data.get('items', [])
    if not items or not isinstance(items, list):
        return Response({'error': 'Provide "items" as a list of line item objects'}, status=status.HTTP_400_BAD_REQUEST)

    created = []
    errors = []
    for idx, item_data in enumerate(items):
        description = item_data.get('description', '').strip()
        if not description:
            errors.append(f'Item #{idx + 1}: description is required')
            continue
        estimated_value = item_data.get('estimated_value', 0)
        try:
            estimated_value = float(estimated_value)
        except (ValueError, TypeError):
            errors.append(f'Item #{idx + 1}: invalid estimated_value')
            continue

        line_item = APPLineItem.objects.create(
            app=app,
            description=description,
            procurement_type=item_data.get('procurement_type', 'goods'),
            estimated_value=estimated_value,
            planned_issue_date=item_data.get('planned_issue_date') or None,
            planned_award_date=item_data.get('planned_award_date') or None,
            funding_source_id=item_data.get('funding_source') or None,
            commodity_id=item_data.get('commodity') or None,
            is_citizen_reserved=item_data.get('is_citizen_reserved', True),
        )
        method, rationale = _recommend_method(float(line_item.estimated_value))
        line_item.recommended_method = method
        line_item.save(update_fields=['recommended_method'])
        created.append(APPLineItemSerializer(line_item).data)

    new_total = app.line_items.aggregate(total=Sum('estimated_value'))['total'] or 0
    AnnualProcurementPlan.objects.filter(pk=app.pk).update(total_estimated_value=new_total)

    return Response({
        'message': f'{len(created)} line item(s) created',
        'created': created,
        'errors': errors,
        'total_estimated_value': float(new_total),
    }, status=status.HTTP_201_CREATED)


class ContractProcurementPlanListView(BaseView, generics.ListCreateAPIView):
    queryset = ContractProcurementPlan.objects.select_related(
        'requisition', 'requisition__department', 'created_by',
        'approved_by', 'baseline_locked_by', 'override_approved_by', 'zpc_approved_by'
    ).prefetch_related(
        'procurement_milestones', 'risks'
    ).all()
    serializer_class = ContractProcurementPlanListSerializer
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'POST':
            return ContractProcurementPlanSerializer
        return ContractProcurementPlanListSerializer

    def perform_create(self, serializer):
        if self.request.user.role not in ('procurement_officer', 'system_admin'):
            raise PermissionDenied('Only Procurement Officer can create CPPs.')

        data = serializer.validated_data
        requisition = data.get('requisition')

        if requisition and requisition.status != 'approved':
            raise PermissionDenied(
                f'CPP can only be created from approved requisitions. Current requisition status: {requisition.status}'
            )

        # Save core CPP first.
        cpp = serializer.save(created_by=self.request.user)
        if isinstance(self.request.data.get('resource_requirements'), dict):
            cpp.resource_requirements = self.request.data.get('resource_requirements')
            cpp.save(update_fields=['resource_requirements'])

        # Convert encumbrance from active to converted when CPP is created
        if requisition:
            from requisitions.models import BudgetEncumbrance
            BudgetEncumbrance.objects.filter(
                requisition=requisition, status='active'
            ).update(status='converted')

        # Auto-populate only model-backed fields when omitted.
        if requisition and (not cpp.estimated_value or float(cpp.estimated_value) == 0):
            auto_data = _auto_populate_cpp_from_requisition(requisition)
            updatable_fields = []
            for field in ('estimated_value', 'procurement_strategy', 'recommended_method', 'method', 'method_override', 'zpc_approval_required', 'zpc_justification'):
                value = auto_data.get(field)
                if value is not None and (getattr(cpp, field, None) in (None, '', 0, False)):
                    setattr(cpp, field, value)
                    updatable_fields.append(field)
            if updatable_fields:
                cpp.save(update_fields=updatable_fields)

        # Accept nested milestones and risks from request payload.
        milestones = self.request.data.get('milestones', []) or []
        for idx, m in enumerate(milestones, start=1):
            ProcurementMilestone.objects.create(
                cpp=cpp,
                milestone_name=m.get('milestone_name', ''),
                sequence_number=m.get('sequence_number') or idx,
                planned_date=m.get('planned_date'),
                actual_date=m.get('actual_date') or None,
            )
        if not milestones:
            from datetime import timedelta
            start_date = timezone.now().date()
            procurement_type = 'goods'
            if requisition and requisition.line_items.exists():
                procurement_type = requisition.line_items.first().procurement_type
            template = _default_cpp_milestone_template(cpp.method, procurement_type)
            for idx, (name, offset_days) in enumerate(template, start=1):
                ProcurementMilestone.objects.create(
                    cpp=cpp,
                    milestone_name=name,
                    sequence_number=idx,
                    planned_date=start_date + timedelta(days=offset_days),
                    actual_date=None,
                )

        risks = self.request.data.get('risks', []) or []
        for r in risks:
            CPPRisk.objects.create(
                cpp=cpp,
                risk_category=r.get('risk_category') or 'custom',
                risk_description=r.get('risk_description', ''),
                likelihood=r.get('likelihood') or 'medium',
                impact=r.get('impact') or 'medium',
                mitigation_strategy=r.get('mitigation_strategy', ''),
                risk_owner=r.get('risk_owner', ''),
            )

        return cpp


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_quarterly_update_view(request, pk):
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if request.user.role not in ('procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin'):
        return Response({'error': 'Only procurement team can create quarterly updates'}, status=status.HTTP_403_FORBIDDEN)

    if app.status not in ('approved', 'published'):
        return Response({'error': 'Quarterly updates can only be created from approved or published APPs'}, status=status.HTTP_400_BAD_REQUEST)

    justification = request.data.get('change_justification', '').strip()
    if not justification:
        return Response({'error': 'A change justification is required for quarterly updates'}, status=status.HTTP_400_BAD_REQUEST)

    items_data = request.data.get('items', [])
    if not items_data or not isinstance(items_data, list):
        return Response({'error': 'Provide "items" as a list of line item objects with the updated values'}, status=status.HTTP_400_BAD_REQUEST)

    original = app.amends if app.amends else app
    latest_version = AnnualProcurementPlan.objects.filter(amends=original).count() + 1
    previous_total = original.total_estimated_value

    amended = AnnualProcurementPlan.objects.create(
        fiscal_year=original.fiscal_year,
        department=original.department,
        status='draft',
        created_by=request.user,
        version=latest_version + 1,
        amends=original,
        change_justification=justification,
        previous_total_value=previous_total,
        submitted_by=request.user,
        submitted_at=timezone.now(),
    )

    created = []
    for item_data in items_data:
        line_item = APPLineItem.objects.create(
            app=amended,
            description=item_data.get('description', '').strip(),
            procurement_type=item_data.get('procurement_type', 'goods'),
            estimated_value=item_data.get('estimated_value', 0),
            planned_issue_date=item_data.get('planned_issue_date') or None,
            planned_award_date=item_data.get('planned_award_date') or None,
            funding_source_id=item_data.get('funding_source') or None,
            commodity_id=item_data.get('commodity') or None,
            is_citizen_reserved=item_data.get('is_citizen_reserved', True),
        )
        method, _ = _recommend_method(float(line_item.estimated_value))
        line_item.recommended_method = method
        line_item.save(update_fields=['recommended_method'])
        created.append(line_item)

    new_total = amended.line_items.aggregate(total=Sum('estimated_value'))['total'] or 0
    amended.total_estimated_value = new_total

    aggregate_change = sum(
        abs(float(item.estimated_value) - float(
            APPLineItem.objects.filter(app=original, description=item.description).first().estimated_value
            if APPLineItem.objects.filter(app=original, description=item.description).first() else 0
        ))
        for item in created
    )
    change_pct = (aggregate_change / float(previous_total) * 100) if previous_total > 0 else 0

    if change_pct <= 20:
        amended.status = 'procurement_review'
        amended.save()
        return Response({
            'message': f'Quarterly update created with {change_pct:.1f}% aggregate change (within 20% threshold). '
                       f'Automatically advanced to procurement review.',
            'version': amended.version,
            'app_id': amended.app_id,
            'aggregate_change_pct': round(change_pct, 2),
            'automatic_approval': True,
        }, status=status.HTTP_201_CREATED)

    amended.save()
    return Response({
        'message': f'Quarterly update created with {change_pct:.1f}% aggregate change (exceeds 20% threshold). '
                   f'Full re-approval workflow required.',
        'version': amended.version,
        'app_id': amended.app_id,
        'aggregate_change_pct': round(change_pct, 2),
        'automatic_approval': False,
    }, status=status.HTTP_201_CREATED)


class ContractProcurementPlanDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ContractProcurementPlan.objects.select_related('requisition', 'created_by').prefetch_related('procurement_milestones', 'risks', 'documents').all()
    serializer_class = ContractProcurementPlanSerializer
    permission_classes = [IsAuthenticated]

    def get_serializer_context(self):
        context = super().get_serializer_context()
        context['request'] = self.request
        return context

    def perform_update(self, serializer):
        cpp = self.get_object()
        
        # If baseline is locked, we restrict what can be updated
        if cpp.is_baseline_locked:
            if 'milestones' in self.request.data:
                # If they try to update milestones when locked, we should probably check if they are only updating actual_dates
                # but the current logic replaces all milestones. For now, let's just prevent it if they try to change milestones
                # or ensure the frontend doesn't allow it. 
                # According to business rules, once baseline is locked, milestones are fixed.
                pass # We'll just ignore milestone updates or raise an error.
                # Let's be strict for now if it's an intentional change to the schedule.
        
        cpp = serializer.save()

        # Handle resource_requirements if provided
        if 'resource_requirements' in self.request.data:
            rr = self.request.data.get('resource_requirements')
            if isinstance(rr, dict):
                cpp.resource_requirements = rr
                cpp.save(update_fields=['resource_requirements'])

        # Update milestones if provided and baseline NOT locked
        if 'milestones' in self.request.data and not cpp.is_baseline_locked:
            milestones_data = self.request.data.get('milestones') or []
            cpp.procurement_milestones.all().delete()
            for idx, m in enumerate(milestones_data, start=1):
                ProcurementMilestone.objects.create(
                    cpp=cpp,
                    milestone_name=m.get('milestone_name', ''),
                    sequence_number=m.get('sequence_number') or idx,
                    planned_date=m.get('planned_date'),
                    actual_date=m.get('actual_date') or None,
                )

        # Update risks if provided
        if 'risks' in self.request.data:
            risks_data = self.request.data.get('risks') or []
            cpp.risks.all().delete()
            for r in risks_data:
                CPPRisk.objects.create(
                    cpp=cpp,
                    risk_category=r.get('risk_category') or 'custom',
                    risk_description=r.get('risk_description', ''),
                    likelihood=r.get('likelihood') or 'medium',
                    impact=r.get('impact') or 'medium',
                    mitigation_strategy=r.get('mitigation_strategy', ''),
                    risk_owner=r.get('risk_owner', ''),
                )

        _record_cpp_approval_trail(cpp, 'updated', self.request.user, {
            'status': cpp.status,
            'method': cpp.method,
            'is_baseline_locked': cpp.is_baseline_locked,
        })


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
def cpp_submit_view(request, pk):
    """Submit CPP for approval (triggers ZPC approval if method is non-open)"""
    logger.info('CPP submit requested: pk=%s, user=%s, role=%s', pk, request.user.email, request.user.role)
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if cpp.status not in CPP_SUBMIT_TRANSITIONS:
        return Response(
            {'error': f'CPP in status "{cpp.status}" cannot be submitted. Only draft can be submitted.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = CPP_SUBMIT_ACTOR_ROLES.get(cpp.status)
    if not allowed or user.role not in allowed:
        return Response(
            {'error': f'Only {", ".join(allowed) if allowed else "no one"} can submit at this stage. Your role: {user.role}'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Validate before submission
    errors = []

    # Check that method is set (should be from auto-population)
    if not cpp.method:
        errors.append('Procurement method must be set')

    # SRS 7.7.1 step 10: the Procurement Officer completes the non-open
    # justification and attaches evidence before routing to ZPC.
    if cpp.method in NON_OPEN_CPP_METHODS:
        if not cpp.zpc_grounds.strip():
            errors.append('Non-open method grounds are required before ZPC submission')
        if not cpp.zpc_justification.strip():
            errors.append('Non-open method justification is required before ZPC submission')
        if not cpp.documents.exists():
            errors.append('At least one supporting evidence document is required for non-open method justification')

    if cpp.method_override and not cpp.override_approved_at:
        errors.append('Method override must be approved by the Director of Procurement before submission')


    # BR-CPP-10: At least one risk with mitigation strategy
    if cpp.risks.count() == 0:
        errors.append('At least one risk must be identified')
    else:
        risks_no_mitigation = cpp.risks.filter(mitigation_strategy='').count()
        if risks_no_mitigation > 0:
            errors.append(f'{risks_no_mitigation} risk(s) are missing a mitigation strategy')

    # BR-CPP-05: Direct Bidding cumulative annual limit K200,000 per department
    if cpp.method == 'direct':
        dept = cpp.requisition.department
        fy = timezone.now().strftime('%Y')
        from django.db.models import Sum
        cumulative = ContractProcurementPlan.objects.filter(
            requisition__department=dept,
            method='direct',
            created_at__year=fy,
        ).exclude(cpp_id=cpp.cpp_id).aggregate(
            total=Sum('estimated_value')
        )['total'] or 0
        current_value = float(cpp.estimated_value or 0)
        if float(cumulative) + current_value > 200000:
            errors.append(
                f'Direct Bidding cumulative annual limit (K200,000) exceeded for {dept.dept_name}. '
                f'Current cumulative: K{float(cumulative):,.2f} + this CPP: K{current_value:,.2f}. '
                'A waiver from Director of Procurement is required.'
            )

    # BR-CPP-08: Check milestones exist and validate closing date periods
    if cpp.procurement_milestones.count() == 0:
        errors.append('At least one milestone must be defined')
    else:
        milestones_qs = cpp.procurement_milestones.all()
        milestones_data = [{
            'milestone_name': m.milestone_name,
            'planned_date': m.planned_date.isoformat() if m.planned_date else '',
        } for m in milestones_qs]
        period_errors = _validate_milestone_minimum_periods(milestones_data, cpp.method)
        errors.extend(period_errors)

    # BR-CPP-11: Evaluation Committee minimum size (3)
    rr = cpp.resource_requirements or {}
    committee_size = rr.get('evaluation_committee_size') or rr.get('evaluationCommitteeSize') or 0
    try:
        if int(committee_size) < 3:
            errors.append('Evaluation Committee must have at least 3 members')
    except (ValueError, TypeError):
        errors.append('Invalid evaluation committee size')

    if errors:
        return Response({
            'error': 'Validation failed',
            'details': errors
        }, status=status.HTTP_400_BAD_REQUEST)

    # Record submit trail
    _record_cpp_approval_trail(cpp, 'submitted', user)

    old_status = cpp.status

    # Open methods do not require ZPC review and are auto-approved on submit.
    if cpp.method in ContractProcurementPlan.OPEN_METHODS:
        cpp.status = 'approved'
        cpp.approved_by = user
        cpp.approved_at = timezone.now()

        baseline_milestones = []
        for milestone in cpp.procurement_milestones.all().order_by('sequence_number', 'planned_date'):
            baseline_milestones.append({
                'milestone_name': milestone.milestone_name,
                'sequence_number': milestone.sequence_number,
                'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
            })
        cpp.is_baseline_locked = True
        cpp.baseline_locked_at = timezone.now()
        cpp.baseline_locked_by = user
        cpp.previous_baseline = {'milestones': baseline_milestones}
        cpp.save(update_fields=[
            'status', 'approved_by', 'approved_at',
            'is_baseline_locked', 'baseline_locked_at', 'baseline_locked_by',
            'previous_baseline', 'updated_at',
        ])
        _record_cpp_approval_trail(cpp, 'approved', user, {
            'auto': True,
            'reason': 'Open method selected; ZPC approval not required',
        })
        return Response({
            'message': f'CPP submitted from "{old_status}" to "approved" (auto-approved for open method)',
            'status': cpp.status,
        })

    # Non-open methods require ZPC workflow.
    new_status = CPP_SUBMIT_TRANSITIONS[cpp.status]
    cpp.status = new_status
    cpp.save(update_fields=['status', 'updated_at'])

    return Response({
        'message': f'CPP submitted from "{old_status}" to "{new_status}"',
        'status': cpp.status,
    })


def _record_cpp_approval_trail(obj, action, user, details=None):
    trail = list(obj.approval_trail or [])
    trail.append({
        'action': action,
        'role': user.role,
        'user_id': str(user.id),
        'user_name': user.full_name,
        'timestamp': timezone.now().isoformat(),
        'details': details or {},
    })
    obj.approval_trail = trail
    obj.save(update_fields=['approval_trail'])


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_approve_view(request, pk):
    """Approve CPP (ZPC approval for non-open methods, or direct approval for open methods)"""
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    if cpp.status not in CPP_APPROVE_TRANSITIONS:
        return Response(
            {'error': f'CPP in status "{cpp.status}" cannot be approved.'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    allowed = CPP_APPROVE_ACTOR_ROLES.get(cpp.status)
    if not allowed or user.role not in allowed:
        return Response(
            {'error': f'Only {", ".join(allowed) if allowed else "no one"} can approve at this stage. Your role: {user.role}'},
            status=status.HTTP_403_FORBIDDEN,
        )

    new_status = CPP_APPROVE_TRANSITIONS[cpp.status]

    # If approving from pending_zpc, record ZPC approval details.
    if cpp.status == 'pending_zpc' and new_status == 'approved':
        zpc_grounds = request.data.get('zpc_grounds', '').strip()
        zpc_justification = request.data.get('zpc_justification', '').strip()
        zpc_resolution_ref = request.data.get('zpc_resolution_ref', '').strip()

        if zpc_grounds:
            cpp.zpc_grounds = zpc_grounds
        if zpc_justification:
            cpp.zpc_justification = zpc_justification
        if zpc_resolution_ref:
            cpp.zpc_resolution_ref = zpc_resolution_ref

        if cpp.method in NON_OPEN_CPP_METHODS:
            missing = []
            if not cpp.zpc_grounds.strip():
                missing.append('non-open method grounds')
            if not cpp.zpc_justification.strip():
                missing.append('non-open method justification')
            if not cpp.documents.exists():
                missing.append('supporting evidence document')
            if missing:
                return Response(
                    {'error': f'Cannot approve CPP. Missing: {", ".join(missing)}.'},
                    status=status.HTTP_400_BAD_REQUEST,
                )
        cpp.zpc_approved_by = user
        cpp.zpc_approved_at = timezone.now()

    # Record approval trail
    _record_cpp_approval_trail(cpp, 'approved', user, {'new_status': new_status})

    old_status = cpp.status
    cpp.status = new_status
    cpp.approved_by = user
    cpp.approved_at = timezone.now()
    
    # If this is an open method, we can immediately activate the CPP
    # If non-open method, ZPC approval already happened via this endpoint
    if cpp.method in ContractProcurementPlan.OPEN_METHODS or cpp.status == 'approved':
        # We'll set to active after approval
        pass

    baseline_milestones = []
    for milestone in cpp.procurement_milestones.all().order_by('sequence_number', 'planned_date'):
        baseline_milestones.append({
            'milestone_name': milestone.milestone_name,
            'sequence_number': milestone.sequence_number,
            'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
        })
    cpp.is_baseline_locked = True
    cpp.baseline_locked_at = timezone.now()
    cpp.baseline_locked_by = user
    cpp.previous_baseline = {'milestones': baseline_milestones}
    cpp.save()

    return Response({
        'message': f'CPP approved from "{old_status}" to "{new_status}"',
        'status': cpp.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_reject_view(request, pk):
    """Reject CPP (return for revision or final rejection)"""
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    reason = request.data.get('reason', '').strip()
    return_for_revision = request.data.get('return_for_revision', False)
    
    if not reason:
        return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Only ZPC/Director/Procurement Officer can reject
    reviewer_role = CPP_CURRENT_STAGE_ROLES.get(cpp.status)
    if reviewer_role and user.role != reviewer_role and user.role not in ('system_admin', 'director_general', 'procurement_officer'):
        return Response(
            {'error': f'Only {reviewer_role} can reject at this stage.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    if return_for_revision:
        _record_cpp_approval_trail(cpp, 'returned', user, {'reason': reason})
        cpp.status = 'draft'
        cpp.rejection_reason = reason
        cpp.save()
        return Response({
            'message': 'CPP returned to draft for revision',
            'status': cpp.status,
            'rejection_reason': reason,
        })
    else:
        _record_cpp_approval_trail(cpp, 'rejected', user, {'reason': reason})
        cpp.status = 'rejected'
        cpp.rejection_reason = reason
        cpp.rejected_by = user
        cpp.rejected_at = timezone.now()
        cpp.save()

        return Response({
            'message': 'CPP rejected',
            'status': cpp.status,
            'rejection_reason': reason,
        })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_return_view(request, pk):
    """Return CPP to draft for revision"""
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    reason = request.data.get('reason', '').strip()
    if not reason:
        return Response({'error': 'Return reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    reviewer_role = CPP_CURRENT_STAGE_ROLES.get(cpp.status)
    if reviewer_role and user.role != reviewer_role and user.role not in ('system_admin', 'director_general'):
        return Response(
            {'error': f'Only {reviewer_role} can return at this stage.'},
            status=status.HTTP_403_FORBIDDEN,
        )

    _record_cpp_approval_trail(cpp, 'returned', user, {'reason': reason})
    cpp.status = 'draft'
    cpp.rejection_reason = reason
    cpp.save()

    return Response({
        'message': 'CPP returned to draft for revision',
        'status': cpp.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_method_override_approve_view(request, pk):
    """R-09 approve method override (Director of Procurement approval)"""
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    override_reason = request.data.get('override_reason', '').strip()
    if not override_reason and not cpp.override_reason:
        return Response({'error': 'Override reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Only R-09 (Director of Procurement) can approve method overrides
    if user.role not in ('director_procurement', 'system_admin'):
        return Response(
            {'error': 'Only Director of Procurement can approve method overrides'},
            status=status.HTTP_403_FORBIDDEN,
        )

    # Validate that method override is pending
    if not cpp.method_override:
        return Response(
            {'error': 'No method override pending approval'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Store R-09 approval
    cpp.override_approved_by = user
    cpp.override_approved_at = timezone.now()
    
    # Update method to the overridden value
    if 'new_method' in request.data:
        cpp.method = request.data['new_method']
    
    # Update approval trail
    _record_cpp_approval_trail(cpp, 'method_override_approved', user, {
        'override_reason': override_reason,
        'approved_by': user.full_name,
        'approved_at': timezone.now().isoformat(),
    })
    
    cpp.save()

    # If open method, auto-approve and lock baseline
    if cpp.method in ContractProcurementPlan.OPEN_METHODS:
        cpp.status = 'approved'
        cpp.approved_by = user
        cpp.approved_at = timezone.now()
        
        baseline_milestones = []
        for milestone in cpp.procurement_milestones.all().order_by('sequence_number', 'planned_date'):
            baseline_milestones.append({
                'milestone_name': milestone.milestone_name,
                'sequence_number': milestone.sequence_number,
                'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
            })
        cpp.is_baseline_locked = True
        cpp.baseline_locked_at = timezone.now()
        cpp.baseline_locked_by = user
        cpp.previous_baseline = {'milestones': baseline_milestones}
        cpp.save()
        
        _record_cpp_approval_trail(cpp, 'auto_approved', user, {
            'reason': 'Open method selected after override approval',
        })

        return Response({
            'message': 'Method override approved - CPP auto-approved and procurement may commence',
            'status': cpp.status,
        })

    # Non-open methods need ZPC approval
    cpp.status = 'pending_zpc'
    cpp.save()

    return Response({
        'message': 'Method override approved - CPP submitted for ZPC review',
        'status': cpp.status,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_lock_baseline_view(request, pk):
    """Lock the baseline for a CPP (prevents milestone changes)"""
    logger.info('CPP baseline lock requested: pk=%s, user=%s', pk, request.user.email)
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        logger.warning('CPP not found for baseline lock: pk=%s', pk)
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    # Only approved CPPs can have baseline locked
    if cpp.status != 'approved':
        return Response(
            {'error': f'Baseline can only be locked for approved CPPs. Current status: {cpp.status}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if cpp.is_baseline_locked:
        return Response({'error': 'Baseline is already locked'}, status=status.HTTP_400_BAD_REQUEST)

    # Store current milestones as baseline
    baseline_milestones = []
    for milestone in cpp.procurement_milestones.all():
        baseline_milestones.append({
            'milestone_name': milestone.milestone_name,
            'sequence_number': milestone.sequence_number,
            'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
        })

    cpp.is_baseline_locked = True
    cpp.baseline_locked_at = timezone.now()
    cpp.baseline_locked_by = user
    cpp.previous_baseline = {'milestones': baseline_milestones}
    cpp.save()

    return Response({
        'message': 'Baseline locked successfully',
        'is_baseline_locked': cpp.is_baseline_locked,
        'baseline_locked_at': cpp.baseline_locked_at.isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_update_milestone_view(request, pk, milestone_pk):
    """Update milestone actual date and calculate variance"""
    try:
        milestone = ProcurementMilestone.objects.get(pk=milestone_pk, cpp_id=pk)
    except ProcurementMilestone.DoesNotExist:
        return Response({'error': 'Milestone not found'}, status=status.HTTP_404_NOT_FOUND)

    before = {
        'milestone_name': milestone.milestone_name,
        'sequence_number': milestone.sequence_number,
        'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
        'actual_date': milestone.actual_date.isoformat() if milestone.actual_date else None,
    }

    # Check if baseline is locked - if so, only allow updating actual_date
    if milestone.cpp.is_baseline_locked and 'planned_date' in request.data:
        return Response(
            {'error': 'Cannot modify planned date when baseline is locked'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    actual_date_str = request.data.get('actual_date')
    if actual_date_str:
        try:
            from datetime import datetime
            actual_date = datetime.strptime(actual_date_str, '%Y-%m-%d').date()
            milestone.actual_date = actual_date
        except ValueError:
            return Response({'error': 'Invalid date format. Use YYYY-MM-DD'}, status=status.HTTP_400_BAD_REQUEST)

    # Update other fields if provided
    if 'milestone_name' in request.data:
        milestone.milestone_name = request.data['milestone_name']
    if 'sequence_number' in request.data:
        milestone.sequence_number = request.data['sequence_number']

    milestone.save()
    _record_cpp_approval_trail(milestone.cpp, 'milestone_updated', request.user, {
        'milestone_id': str(milestone.milestone_id),
        'before': before,
        'after': {
            'milestone_name': milestone.milestone_name,
            'sequence_number': milestone.sequence_number,
            'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
            'actual_date': milestone.actual_date.isoformat() if milestone.actual_date else None,
            'variance_days': milestone.variance_days,
            'variance_flag': milestone.variance_flag,
        },
    })

    # Return updated milestone with variance
    serializer = ProcurementMilestoneSerializer(milestone)
    return Response({
        'message': 'Milestone updated',
        'milestone': serializer.data
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_create_amendment_view(request, pk):
    """Create an amendment to a CPP"""
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user

    # Only approved or active CPPs can be amended
    if cpp.status not in ('approved', 'active'):
        return Response(
            {'error': f'Only approved or active CPPs can be amended. Current status: {cpp.status}'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    amendment_type = request.data.get('amendment_type', 'schedule')  # schedule, scope, method, resource
    reason = request.data.get('reason', '').strip()
    if not reason:
        return Response({'error': 'Amendment reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    # Increment amendment version
    cpp.amendment_version += 1
    
    # Store current baseline as previous
    if cpp.is_baseline_locked:
        baseline_milestones = []
        for milestone in cpp.procurement_milestones.all():
            baseline_milestones.append({
                'milestone_name': milestone.milestone_name,
                'sequence_number': milestone.sequence_number,
                'planned_date': milestone.planned_date.isoformat() if milestone.planned_date else None,
                'actual_date': milestone.actual_date.isoformat() if milestone.actual_date else None,
            })
        cpp.previous_baseline = {
            'milestones': baseline_milestones,
            'version': cpp.amendment_version - 1
        }

    # For method amendments, route to ZPC if changing to/from non-open
    if amendment_type == 'method':
        new_method = request.data.get('method')
        if new_method:
            old_method_is_open = cpp.method in ContractProcurementPlan.OPEN_METHODS
            new_method_is_open = new_method in ContractProcurementPlan.OPEN_METHODS
            
            if old_method_is_open != new_method_is_open:
                # Method openness changed, needs ZPC approval
                cpp.status = 'pending_zpc'  # Reset to pending ZPC approval
                # Store the proposed method change
                cpp.proposed_method_change = new_method
    
    cpp.save()

    return Response({
        'message': f'Amendment version {cpp.amendment_version} created',
        'amendment_version': cpp.amendment_version,
        'status': cpp.status,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cpp_dashboard_view(request):
    """Get CPP dashboard statistics"""
    stats = {
        'total': ContractProcurementPlan.objects.count(),
        'draft': ContractProcurementPlan.objects.filter(status='draft').count(),
        'pending_zpc': ContractProcurementPlan.objects.filter(status='pending_zpc').count(),
        'approved': ContractProcurementPlan.objects.filter(status='approved').count(),
        'rejected': ContractProcurementPlan.objects.filter(status='rejected').count(),
        'active': ContractProcurementPlan.objects.filter(status='active').count(),
        'completed': ContractProcurementPlan.objects.filter(status='completed').count(),
        'cancelled': ContractProcurementPlan.objects.filter(status='cancelled').count(),
        'baseline_locked': ContractProcurementPlan.objects.filter(is_baseline_locked=True).count(),
        'total_value': ContractProcurementPlan.objects.aggregate(total=Sum('estimated_value'))['total'] or 0,
    }
    return Response(stats)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_archive_view(request, pk):
    """BR-CPP-12: Archive CPP at contract closure. 7-year retention."""
    try:
        cpp = ContractProcurementPlan.objects.get(pk=pk)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    user = request.user
    if user.role not in ('procurement_officer', 'director_procurement', 'system_admin'):
        return Response({'error': 'Not authorized to archive CPPs'}, status=status.HTTP_403_FORBIDDEN)

    if cpp.status not in ('completed', 'approved', 'active', 'cancelled'):
        return Response({
            'error': f'Cannot archive CPP in status "{cpp.status}". Must be completed, approved, active, or cancelled.'
        }, status=status.HTTP_400_BAD_REQUEST)

    from datetime import timedelta
    cpp.status = 'archived'
    cpp.archived_at = timezone.now()
    cpp.retention_expiry = timezone.now().date() + timedelta(days=365 * 7)

    _record_cpp_approval_trail(cpp, 'archived', user, {
        'retention_expiry': str(cpp.retention_expiry),
    })
    cpp.save()

    return Response({
        'message': 'CPP archived successfully. 7-year retention period set.',
        'status': cpp.status,
        'archived_at': cpp.archived_at.isoformat(),
        'retention_expiry': str(cpp.retention_expiry),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def cpp_variance_alerts_view(request):
    """Get CPPs with milestone variances that need attention"""
    from datetime import date
    
    today = date.today()
    alerts = []
    
    # Get all active CPPs with baseline locked
    active_cpps = ContractProcurementPlan.objects.filter(
        status__in=['approved', 'active'],
        is_baseline_locked=True
    ).prefetch_related('procurement_milestones')
    
    for cpp in active_cpps:
        late_milestones = []
        at_risk = False
        
        for milestone in cpp.procurement_milestones.all():
            if milestone.actual_date:
                if milestone.variance_days and milestone.variance_days > 0:
                    if milestone.variance_days <= 5:
                        late_milestones.append({
                            'name': milestone.milestone_name,
                            'variance': milestone.variance_days,
                            'level': 'yellow'
                        })
                        at_risk = True
                    elif milestone.variance_days <= 14:
                        late_milestones.append({
                            'name': milestone.milestone_name,
                            'variance': milestone.variance_days,
                            'level': 'orange'
                        })
                        at_risk = True
                    else:
                        late_milestones.append({
                            'name': milestone.milestone_name,
                            'variance': milestone.variance_days,
                            'level': 'red'
                        })
                        at_risk = True
            # Check if milestone is past due date but not completed
            elif milestone.planned_date and milestone.planned_date < today and not milestone.actual_date:
                days_late = (today - milestone.planned_date).days
                if days_late <= 5:
                    late_milestones.append({
                        'name': milestone.milestone_name,
                        'variance': days_late,
                        'level': 'yellow'
                    })
                    at_risk = True
                elif days_late <= 14:
                    late_milestones.append({
                        'name': milestone.milestone_name,
                        'variance': days_late,
                        'level': 'orange'
                    })
                    at_risk = True
                else:
                    late_milestones.append({
                        'name': milestone.milestone_name,
                        'variance': days_late,
                        'level': 'red'
                    })
                    at_risk = True
        
        if late_milestones:
            object_id = str(cpp.cpp_id)
            if not Notification.objects.filter(
                notification_type='deadline',
                source_module='procurement_planning',
                object_id=object_id,
                metadata__alert_key='cpp_variance',
            ).exists():
                worst = max(item['variance'] for item in late_milestones)
                notify_roles(
                    ['procurement_officer', 'procurement_manager'],
                    title=f'CPP milestone variance: {cpp.cpp_number}',
                    message=f'{cpp.cpp_number} has {len(late_milestones)} delayed milestone(s); worst variance is {worst} day(s).',
                    notification_type='deadline',
                    priority='high' if worst > 14 else 'normal',
                    source_module='procurement_planning',
                    object_id=object_id,
                    action_url=f'/procurement-planning/cpp/{cpp.cpp_id}',
                    metadata={'alert_key': 'cpp_variance', 'late_milestones': late_milestones},
                    email_required=True,
                )
            alerts.append({
                'cpp_id': str(cpp.cpp_id),
                'cpp_number': cpp.cpp_number,
                'requisition_number': cpp.requisition.req_number if cpp.requisition else None,
                'department': cpp.requisition.department.dept_name if cpp.requisition and cpp.requisition.department else None,
                'late_milestones': late_milestones,
                'at_risk': at_risk,
            })
    
    return Response({
        'alerts': alerts,
        'total_alerts': len(alerts),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def gpn_publish_view(request, pk):
    try:
        gpn = GeneralProcurementNotice.objects.get(pk=pk)
    except GeneralProcurementNotice.DoesNotExist:
        return Response({'error': 'GPN not found'}, status=status.HTTP_404_NOT_FOUND)

    targets = request.data.get('targets', ['zammsa_website'])
    proof_urls = request.data.get('proof_urls', [])
    # Accept publication_proofs from request for detailed metadata
    publication_proofs = request.data.get('publication_proofs', {})

    valid_targets = ['zammsa_website', 'egp_portal', 'govt_gazette', 'registered_supplier_email']
    for t in targets:
        if t not in valid_targets:
            return Response({'error': f'Invalid publication target: {t}. Valid: {valid_targets}'}, status=status.HTTP_400_BAD_REQUEST)

    now = timezone.now()

    # Build publication proofs with detailed metadata
    proofs = {}
    for t in targets:
        if t in publication_proofs:
            proofs[t] = publication_proofs[t]
            if 'timestamp' not in proofs[t]:
                proofs[t]['timestamp'] = now.isoformat()
        else:
            # Auto-generate proof metadata
            proof_data = {
                'timestamp': now.isoformat(),
                'status': 'published',
            }
            if t == 'zammsa_website':
                proof_data['url'] = f'https://portal.zammsa.gov.zm/notices/{gpn.content.get("gpn_reference", "")}'
            elif t == 'egp_portal':
                proof_data['reference'] = f'ZPPA-{now.strftime("%Y")}-GPN-{gpn.gpn_id.hex[:4]}'
                proof_data['url'] = f'https://egp.zppa.org.zm/notices/{proof_data["reference"]}'
            elif t == 'registered_supplier_email':
                proof_data['delivered'] = request.data.get('email_count', 0)
                proof_data['failed'] = request.data.get('email_failed', 0)
            proofs[t] = proof_data

    gpn.publication_status = 'published'
    gpn.publication_targets = targets
    gpn.publication_proof_urls = proof_urls
    gpn.publication_proofs = proofs
    gpn.published_at = now
    gpn.published_by = request.user

    # Track email notifications if applicable
    if 'registered_supplier_email' in targets:
        supplier_users = User.objects.filter(role='supplier_user', is_active=True).exclude(email='')
        recipients = [
            {'name': user.full_name, 'email': user.email}
            for user in supplier_users
        ]
        email_result = send_external_bulk_email(
            subject=f'General Procurement Notice Published: {gpn.content.get("gpn_reference", gpn.gpn_id)}',
            message=(
                f'A General Procurement Notice has been published by ZAMMSA.\n\n'
                f'Department: {gpn.content.get("department", "")}\n'
                f'Fiscal Year: {gpn.content.get("fiscal_year", "")}\n'
                f'Total Estimated Value: {gpn.content.get("total_estimated_value", "")}\n\n'
                f'Please log in to the supplier portal for upcoming opportunities.'
            ),
            recipients=recipients,
        )
        gpn.email_notification_sent = True
        gpn.email_notification_count = email_result['sent']
        gpn.email_notification_failed = email_result['failed']
        gpn.email_notification_sent_at = now
        proofs['registered_supplier_email'] = {
            **proofs.get('registered_supplier_email', {}),
            'delivered': email_result['sent'],
            'failed': email_result['failed'],
            'recipients': email_result['recipients'],
        }

    # Track gazette if applicable
    if 'govt_gazette' in targets:
        gazette_path = request.data.get('gazette_file_path', '')
        if gazette_path:
            gpn.gazette_file_path = gazette_path

    gpn.save()

    # Also update the associated APP
    app = gpn.app
    app.gpn_published_at = now
    app.gpn_publication_targets = targets
    app.gpn_publication_proofs = proofs
    if app.status == 'approved':
        app.status = 'published'
    app.save()

    return Response({
        'message': 'GPN published successfully',
        'status': gpn.publication_status,
        'publication_targets': targets,
        'publication_proofs': proofs,
        'published_at': gpn.published_at.isoformat(),
        'email_notifications': proofs.get('registered_supplier_email'),
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
@permission_classes([AllowAny])
def public_gpn_list_view(request):
    """Public endpoint for GPNs published to zammsa_website."""
    gpns = GeneralProcurementNotice.objects.filter(
        publication_status='published',
        publication_targets__contains=['zammsa_website'],
    ).select_related('app__department', 'app__fiscal_year').order_by('-published_at')

    results = []
    for gpn in gpns:
        line_items = gpn.content.get('line_items', [])
        results.append({
            'gpn_id': str(gpn.gpn_id),
            'app_id': str(gpn.app.app_id),
            'fiscal_year': gpn.content.get('fiscal_year', ''),
            'department': gpn.content.get('department', ''),
            'total_estimated_value': gpn.content.get('total_estimated_value', 0),
            'line_items_count': len(line_items),
            'publication_targets': gpn.publication_targets,
            'published_at': gpn.published_at.isoformat() if gpn.published_at else None,
            'generated_at': gpn.generated_at.isoformat() if gpn.generated_at else None,
        })

    return Response({'results': results, 'count': len(results)})


@api_view(['GET'])
@permission_classes([AllowAny])
def public_gpn_detail_view(request, pk):
    """Public endpoint for a single GPN."""
    try:
        gpn = GeneralProcurementNotice.objects.select_related(
            'app__department', 'app__fiscal_year'
        ).get(pk=pk, publication_status='published')
    except GeneralProcurementNotice.DoesNotExist:
        return Response({'error': 'GPN not found'}, status=status.HTTP_404_NOT_FOUND)

    if 'zammsa_website' not in gpn.publication_targets:
        return Response({'error': 'GPN not published to public portal'}, status=status.HTTP_404_NOT_FOUND)

    line_items = gpn.content.get('line_items', [])
    return Response({
        'gpn_id': str(gpn.gpn_id),
        'app_id': str(gpn.app.app_id),
        'fiscal_year': gpn.content.get('fiscal_year', ''),
        'department': gpn.content.get('department', ''),
        'total_estimated_value': gpn.content.get('total_estimated_value', 0),
        'line_items': line_items,
        'publication_targets': gpn.publication_targets,
        'published_at': gpn.published_at.isoformat() if gpn.published_at else None,
        'generated_at': gpn.generated_at.isoformat() if gpn.generated_at else None,
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def app_zppa_submit_view(request, pk):
    """Submit approved APP to ZPPA (must be done within 30 days of approval)."""
    try:
        app = AnnualProcurementPlan.objects.get(pk=pk)
    except AnnualProcurementPlan.DoesNotExist:
        return Response({'error': 'APP not found'}, status=status.HTTP_404_NOT_FOUND)

    if app.status not in ('approved', 'published'):
        return Response(
            {'error': 'Only approved or published APPs can be submitted to ZPPA'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    if app.zppa_submitted:
        return Response(
            {'error': 'APP already submitted to ZPPA'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    submission_ref = request.data.get('submission_ref', '')
    if not submission_ref:
        return Response(
            {'error': 'submission_ref is required'},
            status=status.HTTP_400_BAD_REQUEST,
        )

    # Check if deadline has passed
    if app.zppa_deadline and timezone.now() > app.zppa_deadline:
        return Response(
            {
                'error': 'ZPPA submission deadline has passed',
                'deadline': app.zppa_deadline,
                'days_overdue': (timezone.now() - app.zppa_deadline).days,
            },
            status=status.HTTP_400_BAD_REQUEST,
        )

    app.zppa_submitted = True
    app.zppa_submitted_at = timezone.now()
    app.zppa_submission_ref = submission_ref
    app.save()

    _record_app_approval_trail(app, 'zppa_submitted', request.user, {
        'submission_ref': submission_ref,
        'deadline': app.zppa_deadline,
    })

    return Response({
        'message': 'APP submitted to ZPPA successfully',
        'zppa_submitted_at': app.zppa_submitted_at.isoformat(),
        'submission_ref': submission_ref,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def app_zppa_deadline_alerts_view(request):
    """Get list of APPs with approaching or overdue ZPPA deadlines."""
    now = timezone.now()
    approaching_deadline = now + timezone.timedelta(days=7)  # Alert 7 days before

    approaching = AnnualProcurementPlan.objects.filter(
        status__in=['approved', 'published'],
        zppa_submitted=False,
        zppa_deadline__isnull=False,
        zppa_deadline__gt=now,
        zppa_deadline__lte=approaching_deadline,
    )

    overdue = AnnualProcurementPlan.objects.filter(
        status__in=['approved', 'published'],
        zppa_submitted=False,
        zppa_deadline__isnull=False,
        zppa_deadline__lt=now,
    )

    def serialize_app(app):
        days_remaining = (app.zppa_deadline - now).days if app.zppa_deadline else None
        return {
            'app_id': str(app.app_id),
            'department_name': app.department.dept_name,
            'fiscal_year': app.fiscal_year.year_code,
            'status': app.status,
            'zppa_deadline': app.zppa_deadline.isoformat() if app.zppa_deadline else None,
            'days_remaining': days_remaining,
            'total_estimated_value': float(app.total_estimated_value),
        }

    for app in list(approaching) + list(overdue):
        if app.zppa_deadline_alerted:
            continue
        overdue_alert = app.zppa_deadline and app.zppa_deadline < now
        priority = 'urgent' if overdue_alert else 'high'
        title = f'ZPPA submission {"overdue" if overdue_alert else "deadline approaching"}: {app.app_number or app.app_id}'
        message = (
            f'{app.department.dept_name} APP for {app.fiscal_year.year_code} '
            f'{"is overdue for" if overdue_alert else "is approaching"} ZPPA submission deadline {app.zppa_deadline}.'
        )
        notify_roles(
            ['procurement_officer', 'director_procurement', 'zppa_reporting_officer'],
            title=title,
            message=message,
            notification_type='deadline',
            priority=priority,
            source_module='procurement_planning',
            object_id=app.app_id,
            action_url=_app_action_url(app),
            metadata={'alert_key': 'zppa_deadline', 'zppa_deadline': app.zppa_deadline.isoformat()},
            email_required=True,
        )
        _notify_app_owner(app, title, message, priority=priority)
        app.zppa_deadline_alerted = True
        app.save(update_fields=['zppa_deadline_alerted'])

    return Response({
        'approaching': [serialize_app(a) for a in approaching],
        'overdue': [serialize_app(a) for a in overdue],
        'total_alerts': approaching.count() + overdue.count(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def cpp_document_upload_view(request, cpp_id):
    """Upload a document to a CPP."""
    try:
        cpp = ContractProcurementPlan.objects.get(cpp_id=cpp_id)
    except ContractProcurementPlan.DoesNotExist:
        return Response({'error': 'CPP not found'}, status=status.HTTP_404_NOT_FOUND)

    if cpp.is_baseline_locked and request.method == 'POST':
        return Response({'error': 'Cannot modify CPP after baseline is locked'}, status=status.HTTP_400_BAD_REQUEST)

    file = request.FILES.get('document')
    if not file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    doc = CPPDocument.objects.create(
        cpp=cpp,
        document=file,
        document_type=request.POST.get('document_type', 'other'),
        description=request.POST.get('description', ''),
        uploaded_by=request.user,
    )

    serializer = CPPDocumentSerializer(doc, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def cpp_document_delete_view(request, cpp_id, document_id):
    """Delete a CPP document."""
    try:
        doc = CPPDocument.objects.get(document_id=document_id, cpp__cpp_id=cpp_id)
    except CPPDocument.DoesNotExist:
        return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

    if doc.cpp.is_baseline_locked:
        return Response({'error': 'Cannot modify CPP after baseline is locked'}, status=status.HTTP_400_BAD_REQUEST)

    doc.document.delete()
    doc.delete()
    return Response({'message': 'Document deleted'}, status=status.HTTP_200_OK)
