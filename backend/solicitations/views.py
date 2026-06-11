import uuid
from datetime import timedelta
from django.db.models import Q, Max
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from django.http import HttpResponse
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import SolicitationTemplate, Solicitation, EvaluationCriterion, SolicitationAddendum, ClarificationRequest, SolicitationDocument
from .serializers import (
    SolicitationTemplateSerializer, SolicitationSerializer, SolicitationListSerializer,
    EvaluationCriterionSerializer, SolicitationAddendumSerializer,
    ClarificationRequestSerializer, SolicitationDocumentSerializer,
)

# BR-SOL-01: Minimum solicitation-to-closing periods by procurement method
MIN_BIDDING_PERIOD_DAYS = {
    'open_tender': 21,
    'international': 30,
    'limited': 14,
    'simplified': 14,
    'direct': 0,
}


def _validate_bidding_period(sol):
    """Validate closing_date meets minimum bidding period for the method."""
    min_days = MIN_BIDDING_PERIOD_DAYS.get(sol.method, 0)
    if min_days <= 0:
        return None
    reference_date = sol.issue_date or timezone.now().date()
    if isinstance(reference_date, timezone.datetime):
        reference_date = reference_date.date()
    closing = sol.closing_date
    if isinstance(closing, timezone.datetime):
        closing = closing.date()
    gap = (closing - reference_date).days
    if gap < min_days:
        return (
            f'Minimum bidding period for "{sol.method}" is {min_days} days. '
            f'Current gap between issue/reference date and closing is {gap} days.'
        )
    return None


def _validate_clarification_cutoff(sol):
    """Validate clarification cutoff is at least 5 working days before closing."""
    if not sol.clarification_cutoff:
        return None
    cutoff = sol.clarification_cutoff
    closing = sol.closing_date
    if isinstance(cutoff, str):
        from django.utils.dateparse import parse_datetime
        cutoff = parse_datetime(cutoff)
    if isinstance(closing, str):
        from django.utils.dateparse import parse_datetime
        closing = parse_datetime(closing)
    if not cutoff or not closing:
        return None
    if cutoff >= closing:
        return 'Clarification cutoff must be before the closing date.'
    remaining = (closing - cutoff).days
    if remaining < 5:
        return (
            f'Clarification cutoff must be at least 5 working days before closing. '
            f'Currently {remaining} day(s) before closing.'
        )
    return None

PROCUREMENT_STAFF_ROLES = ('procurement_officer', 'procurement_manager', 'director_procurement', 'system_admin')
SOLICITATION_APPROVER_ROLES = ('procurement_manager', 'director_procurement', 'system_admin')
ROLE_ALIASES = {
    'procurement manager': 'procurement_manager',
    'proc manager': 'procurement_manager',
    'proc. manager': 'procurement_manager',
    'procurement officer': 'procurement_officer',
    'proc officer': 'procurement_officer',
    'proc. officer': 'procurement_officer',
    'director procurement': 'director_procurement',
    'director of procurement': 'director_procurement',
    'system admin': 'system_admin',
}


def _normalize_role(role):
    if not role:
        return ''
    normalized = str(role).strip().lower().replace('-', '_')
    normalized = '_'.join(normalized.split())
    return ROLE_ALIASES.get(normalized, normalized)


METHOD_ALIASES = {
    'open': 'open_tender',
    'open tender': 'open_tender',
    'opentender': 'open_tender',
    'rfb': 'open_tender',
    'rfq': 'simplified',
    'rfp': 'proposal',
}


def _normalize_method(method):
    if not method:
        return ''
    normalized = str(method).strip().lower().replace('-', '_')
    normalized = '_'.join(normalized.split())
    return METHOD_ALIASES.get(normalized, normalized)


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class SolicitationFilter(django_filters.FilterSet):
    search = django_filters.CharFilter(method='filter_search')
    status = django_filters.CharFilter(lookup_expr='exact')
    method = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = Solicitation
        fields = ['status', 'method']

    def filter_search(self, queryset, name, value):
        return queryset.filter(Q(title__icontains=value) | Q(sol_number__icontains=value) | Q(description__icontains=value))


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class SolicitationTemplateListView(BaseView, generics.ListCreateAPIView):
    queryset = SolicitationTemplate.objects.all()
    serializer_class = SolicitationTemplateSerializer
    search_fields = ['template_name']
    ordering = ['template_name']


class SolicitationTemplateDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = SolicitationTemplate.objects.all()
    serializer_class = SolicitationTemplateSerializer
    permission_classes = [IsAuthenticated]


class SolicitationListView(BaseView, generics.ListCreateAPIView):
    queryset = Solicitation.objects.select_related('requisition').prefetch_related('evaluation_criteria', 'addenda', 'documents').all()
    filterset_class = SolicitationFilter
    search_fields = ['title', 'sol_number']
    ordering_fields = ['created_at', 'closing_date', 'status']
    ordering = ['-created_at']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return SolicitationListSerializer
        return SolicitationSerializer

    def perform_create(self, serializer):
        if _normalize_role(self.request.user.role) not in PROCUREMENT_STAFF_ROLES:
            raise PermissionDenied('Only authorized procurement staff can create solicitations.')
        
        # BR-CPP-01: No solicitation can be published without an approved CPP
        # Check that the requisition has an approved CPP
        requisition = serializer.validated_data.get('requisition')
        if requisition:
            approved_cpp = requisition.cpp.filter(status='approved').first()
            if not approved_cpp:
                raise PermissionDenied(
                    f'Cannot create solicitation for requisition {requisition.req_number}. '
                    'An approved Contract Procurement Plan (CPP) is required first.'
                )
        
        serializer.save(created_by=self.request.user)


class SolicitationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = Solicitation.objects.select_related('requisition').prefetch_related('evaluation_criteria', 'addenda', 'documents').all()
    serializer_class = SolicitationSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_submit_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status != 'draft':
        return Response({'error': 'Only draft solicitations can be submitted'}, status=400)

    # BR-SOL-01: Validate minimum bidding period
    period_error = _validate_bidding_period(sol)
    if period_error:
        return Response({'error': period_error}, status=400)

    # Validate clarification cutoff is ≥ 5 working days before closing
    cutoff_error = _validate_clarification_cutoff(sol)
    if cutoff_error:
        return Response({'error': cutoff_error}, status=400)

    criteria_sum = sum(float(c.weight) for c in sol.evaluation_criteria.all())
    if sol.evaluation_criteria.exists() and criteria_sum != 100.0:
        return Response({
            'error': f'Evaluation criteria weights must sum to 100% (currently {criteria_sum}%)'
        }, status=400)

    user_role = _normalize_role(request.user.role)
    if user_role not in PROCUREMENT_STAFF_ROLES:
        return Response({'error': 'Not authorized to submit for approval'}, status=403)

    sol.status = 'pending_approval'
    sol.save()
    return Response({'message': 'Solicitation sent for approval', 'status': sol.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_approve_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status != 'pending_approval':
        return Response({'error': 'Only pending approval solicitations can be approved'}, status=400)

    # BR-SOL-01: Validate minimum bidding period
    period_error = _validate_bidding_period(sol)
    if period_error:
        return Response({'error': period_error}, status=400)

    criteria_sum = sum(float(c.weight) for c in sol.evaluation_criteria.all())
    if sol.evaluation_criteria.exists() and criteria_sum != 100.0:
        return Response({
            'error': f'Evaluation criteria weights must sum to 100% (currently {criteria_sum}%)'
        }, status=400)

    user_role = _normalize_role(request.user.role)
    if user_role not in SOLICITATION_APPROVER_ROLES:
        return Response({'error': 'Not authorized to approve'}, status=403)
    if sol.created_by_id and sol.created_by_id == request.user.id:
        return Response({'error': 'Self-approval is not allowed'}, status=403)

    sol.status = 'approved'
    sol.approved_by = request.user
    sol.save()
    return Response({'message': 'Solicitation approved', 'status': sol.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_reject_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status != 'pending_approval':
        return Response({'error': 'Only pending approval solicitations can be rejected'}, status=400)

    user_role = _normalize_role(request.user.role)
    if user_role not in SOLICITATION_APPROVER_ROLES:
        return Response({'error': 'Not authorized to reject'}, status=403)

    reason = request.data.get('reason', '').strip()
    if not reason:
        return Response({'error': 'Rejection reason is required'}, status=400)

    sol.status = 'draft'
    sol.rejected_by = request.user
    sol.rejection_reason = reason
    sol.rejected_at = timezone.now()
    sol.save()
    return Response({'message': 'Solicitation returned to draft', 'status': sol.status, 'rejection_reason': reason})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_publish_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status != 'approved':
        return Response({'error': 'Only approved solicitations can be published'}, status=400)

    user_role = _normalize_role(request.user.role)
    if user_role not in PROCUREMENT_STAFF_ROLES:
        return Response({'error': 'Not authorized to publish'}, status=403)

    # BR-SOL-01: Validate minimum bidding period on publish
    if not sol.issue_date:
        sol.issue_date = timezone.now().date()
    period_error = _validate_bidding_period(sol)
    if period_error:
        return Response({'error': period_error}, status=400)

    # Validate clarification cutoff if set
    cutoff_error = _validate_clarification_cutoff(sol)
    if cutoff_error:
        return Response({'error': cutoff_error}, status=400)

    # BR-CPP-01: No solicitation can be published without an approved CPP
    if sol.requisition:
        has_approved_cpp = sol.requisition.cpp.filter(status='approved').exists()
        if not has_approved_cpp:
            return Response({
                'error': 'Cannot publish solicitation — the linked requisition has no approved CPP. '
                         'An approved Contract Procurement Plan (CPP) is required before publication.'
            }, status=status.HTTP_400_BAD_REQUEST)

    targets = request.data.get('targets', ['zammsa_website'])
    proofs = request.data.get('proofs', {})

    valid_targets = ['zammsa_website', 'egp_portal', 'email_suppliers']
    for t in targets:
        if t not in valid_targets:
            return Response(
                {'error': f'Invalid publication target: {t}. Valid: {valid_targets}'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    # Check non-open justification if method is not open_tender
    open_methods = ('open_tender', 'restricted', 'simplified')
    normalized_method = _normalize_method(sol.method)
    if normalized_method not in open_methods:
        from method_selection.models import NonOpenJustification
        has_approved = NonOpenJustification.objects.filter(
            solicitation=sol,
            status='zpc_approved',
        ).exists()
        if not has_approved:
            return Response(
                {'error': f'Non-open method "{sol.method}" requires an approved ZPC justification before publishing'},
                status=status.HTTP_400_BAD_REQUEST,
            )

    sol.status = 'published'
    sol.published_at = timezone.now()
    sol.publication_targets = targets
    sol.publication_proofs = proofs

    # e-GP portal integration stub
    if 'egp_portal' in targets:
        try:
            egp_ref = _publish_to_egp_portal(sol)
            sol.egp_reference = egp_ref
            proofs['egp_portal'] = {'reference': egp_ref, 'timestamp': timezone.now().isoformat()}
        except Exception as e:
            return Response(
                {'error': f'e-GP portal integration failed: {str(e)}'},
                status=status.HTTP_502_BAD_GATEWAY,
            )

    # Email notification to registered suppliers
    if 'email_suppliers' in targets:
        try:
            _notify_suppliers_of_publication(sol)
            proofs['email_suppliers'] = {'timestamp': timezone.now().isoformat()}
        except Exception:
            pass  # Don't fail publication if email fails

    sol.save()

    return Response({
        'message': 'Solicitation published',
        'status': sol.status,
        'publication_targets': targets,
        'published_at': sol.published_at.isoformat(),
        'egp_reference': sol.egp_reference if 'egp_portal' in targets else None,
    })


def _publish_to_egp_portal(sol):
    """Stub for e-GP portal API integration."""
    import hashlib
    ref = f"EGP-{sol.sol_number}-{hashlib.md5(str(sol.solicitation_id).encode()).hexdigest()[:8].upper()}"
    return ref


def _notify_suppliers_of_publication(sol):
    """Send email notifications to registered suppliers."""
    from suppliers.models import Supplier
    suppliers = Supplier.objects.filter(status='active')
    if not suppliers.exists():
        return

    recipient_emails = list(suppliers.values_list('email', flat=True))
    if not recipient_emails:
        return

    subject = f'New Solicitation Published: {sol.sol_number} - {sol.title}'
    body = (
        f'A new solicitation has been published on the ZAMMSA procurement portal.\n\n'
        f'Solicitation: {sol.sol_number}\n'
        f'Title: {sol.title}\n'
        f'Method: {sol.method}\n'
        f'Closing Date: {sol.closing_date}\n\n'
        f'Please log in to the portal to view the full details and submit your bid.\n\n'
        f'This is an automated notification from the ZAMMSA Procurement System.'
    )

    send_mail(
        subject,
        body,
        getattr(settings, 'DEFAULT_FROM_EMAIL', 'noreply@zammsa.gov.zm'),
        recipient_emails,
        fail_silently=False,
    )


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_close_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    sol.status = 'closed'
    sol.save()
    return Response({'message': 'Solicitation closed', 'status': sol.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_add_addendum_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    description = request.data.get('description')
    reason = request.data.get('reason', '')
    extend_days = request.data.get('extend_closing_days', None)

    if not description:
        return Response({'error': 'Description is required'}, status=400)

    last_num = sol.addenda.aggregate(m=Max('addendum_number'))['m'] or 0

    addendum = SolicitationAddendum.objects.create(
        solicitation=sol,
        addendum_number=last_num + 1,
        description=description,
        reason=reason,
    )

    days_remaining = (sol.closing_date - timezone.now()).days
    if days_remaining <= 7:
        if not extend_days:
            return Response({
                'error': f'Only {days_remaining} days remaining until closing. You must provide extend_closing_days to issue an addendum.'
            }, status=400)
        addendum.extended_closing_date = sol.closing_date + timezone.timedelta(days=int(extend_days))
        sol.closing_date = addendum.extended_closing_date
        sol.save()
        addendum.save()
    elif extend_days:
        addendum.extended_closing_date = sol.closing_date + timezone.timedelta(days=int(extend_days))
        sol.closing_date = addendum.extended_closing_date
        sol.save()
        addendum.save()

    return Response({
        'message': f'Addendum {addendum.addendum_number} issued',
        'addendum': SolicitationAddendumSerializer(addendum).data,
    })


class EvaluationCriterionFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(field_name='solicitation')
    criterion_type = django_filters.CharFilter(lookup_expr='exact')

    class Meta:
        model = EvaluationCriterion
        fields = ['solicitation', 'criterion_type']


class EvaluationCriterionListView(BaseView, generics.ListCreateAPIView):
    queryset = EvaluationCriterion.objects.select_related('solicitation').all()
    serializer_class = EvaluationCriterionSerializer
    filterset_class = EvaluationCriterionFilter
    ordering = ['order_index']


class EvaluationCriterionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = EvaluationCriterion.objects.all()
    serializer_class = EvaluationCriterionSerializer
    permission_classes = [IsAuthenticated]


class ClarificationRequestListView(BaseView, generics.ListCreateAPIView):
    queryset = ClarificationRequest.objects.select_related('solicitation', 'supplier').all()
    serializer_class = ClarificationRequestSerializer
    ordering = ['-asked_at']


class ClarificationRequestDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ClarificationRequest.objects.all()
    serializer_class = ClarificationRequestSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def clarification_answer_view(request, pk):
    try:
        cr = ClarificationRequest.objects.get(pk=pk)
    except ClarificationRequest.DoesNotExist:
        return Response({'error': 'Clarification not found'}, status=404)

    answer = request.data.get('answer')
    if not answer:
        return Response({'error': 'Answer is required'}, status=400)

    cr.answer = answer
    cr.answered_at = timezone.now()
    cr.save()
    return Response({'message': 'Clarification answered'})


class SolicitationDocumentListView(BaseView, generics.ListCreateAPIView):
    queryset = SolicitationDocument.objects.select_related('solicitation').all()
    serializer_class = SolicitationDocumentSerializer
    ordering = ['-document_id']

@api_view(['GET'])
@permission_classes([IsAuthenticated])
def template_preview_view(request):
    """Return template content as HTML for preview."""
    name = request.query_params.get('name', '').strip()
    method = request.query_params.get('method', '').strip()

    if not name:
        return Response({'error': 'Template name is required'}, status=400)

    # Build a query that tries to match by name and optionally by method
    q = Q(template_name__icontains=name) | Q(template_name__icontains=name.replace('Standard Document', '').strip())
    if method:
        q &= Q(method=method)

    template = SolicitationTemplate.objects.filter(q, is_active=True).first()

    if not template:
        # Try a broader search
        keywords = [w for w in name.split() if len(w) > 3]
        for kw in keywords:
            template = SolicitationTemplate.objects.filter(
                Q(template_name__icontains=kw) | Q(template_content__icontains=kw),
                is_active=True
            ).first()
            if template:
                break

    if not template:
        # Return a generated preview using the name as a title
        html = _generate_fallback_preview(name, method)
        return HttpResponse(html, content_type='text/html; charset=utf-8')

    html = _render_template_preview(template)
    return HttpResponse(html, content_type='text/html; charset=utf-8')


def _render_template_preview(template):
    """Render a SolicitationTemplate as an HTML document preview."""
    content = template.template_content or ''
    clauses_html = ''
    if template.mandatory_clauses:
        clauses = template.mandatory_clauses if isinstance(template.mandatory_clauses, list) else []
        if clauses:
            items = ''.join(
                '<li style="padding:8px 0;border-bottom:1px solid #e5e7eb;'
                'display:flex;align-items:start;gap:10px;">'
                '<span style="color:#059669;font-weight:bold;">ok</span> '
                '<span>' + c.get("clause_text", "") + '</span></li>'
                for c in clauses
            )
            clauses_html = (
                '<div style="margin-top:24px;">'
                '<h4 style="font-size:14px;font-weight:700;color:#111827;'
                'text-transform:uppercase;letter-spacing:0.05em;margin-bottom:12px;'
                'border-bottom:2px solid #d1d5db;padding-bottom:8px;">'
                'Mandatory Clauses</h4>'
                '<ul style="list-style:none;padding:0;margin:0;">' + items + '</ul></div>'
            )

    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        '<style>'
        '@import url("https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700;800;900&family=Merriweather:wght@400;700;900&display=swap");'
        '*{margin:0;padding:0;box-sizing:border-box;}'
        'body{font-family:"Merriweather",Georgia,serif;background:#f3f4f6;padding:40px;color:#1f2937;line-height:1.8;}'
        '.document{max-width:900px;margin:0 auto;background:white;border-radius:32px;'
        'box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;}'
        '.header{background:linear-gradient(135deg,#1e3a5f,#0f2440);color:white;padding:40px 48px;text-align:center;}'
        '.header h1{font-size:22px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;}'
        '.header .subtitle{font-size:13px;opacity:0.8;}'
        '.badge{display:inline-block;margin-top:16px;background:rgba(255,255,255,0.15);'
        'border:1px solid rgba(255,255,255,0.3);padding:6px 20px;border-radius:100px;'
        'font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;}'
        '.body{padding:48px;}'
        '.body h2{font-size:18px;font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;}'
        '.body p{margin-bottom:16px;text-align:justify;font-size:14px;line-height:1.9;}'
        '.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);'
        'font-size:120px;font-weight:900;color:rgba(0,0,0,0.03);pointer-events:none;z-index:0;text-transform:uppercase;}'
        '.footer{padding:24px 48px;border-top:1px solid #e5e7eb;text-align:center;'
        'font-size:11px;color:#9ca3af;font-family:"Inter",sans-serif;text-transform:uppercase;letter-spacing:0.1em;}'
        '</style></head><body>'
        '<div class="watermark">DRAFT</div>'
        '<div class="document">'
        '<div class="header">'
        '<h1>' + template.template_name + '</h1>'
        '<p class="subtitle">Zambia Medicines and Medical Supplies Agency - Standard Solicitation Document</p>'
        '<span class="badge">Version ' + template.version
        + (' - ZPPA-Approved' if template.is_zppa_template else ' - Internal Template') + '</span>'
        '</div><div class="body">'
        '<h2>Document Overview</h2>'
        + _format_content(content) + clauses_html
        + '</div><div class="footer">'
        'ZAMMSA Procurement System - Template ID: ' + str(template.template_id) + ' - Generated Preview'
        '</div></div></body></html>'
    )

def _generate_fallback_preview(name, method):
    """Generate a realistic-looking fallback preview when no template is found."""
    method_label = {
        'itb': 'Invitation to Bid (Goods)',
        'rfp': 'Request for Proposals (Consulting)',
        'rfq': 'Request for Quotations'
    }.get(method, 'Procurement Document')

    return (
        '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
        '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
        '<style>'
        '*{margin:0;padding:0;box-sizing:border-box;}'
        'body{font-family:Georgia,serif;background:#f3f4f6;padding:40px;color:#1f2937;line-height:1.8;}'
        '.document{max-width:900px;margin:0 auto;background:white;border-radius:32px;'
        'box-shadow:0 25px 50px -12px rgba(0,0,0,0.25);overflow:hidden;}'
        '.header{background:linear-gradient(135deg,#1e3a5f,#0f2440);color:white;padding:40px 48px;text-align:center;}'
        '.header h1{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:0.1em;margin-bottom:8px;}'
        '.badge{display:inline-block;margin-top:16px;background:rgba(255,255,255,0.15);'
        'border:1px solid rgba(255,255,255,0.3);padding:6px 20px;border-radius:100px;'
        'font-size:11px;font-weight:700;letter-spacing:0.1em;text-transform:uppercase;}'
        '.body{padding:48px;}'
        '.body h2{font-size:18px;font-weight:700;margin-bottom:16px;padding-bottom:8px;border-bottom:2px solid #e5e7eb;}'
        '.body p{margin-bottom:16px;text-align:justify;font-size:14px;line-height:1.9;}'
        '.section{margin-bottom:32px;}'
        '.section h3{font-size:15px;font-weight:700;margin-bottom:12px;color:#1e3a5f;}'
        '.section ul{padding-left:20px;}'
        '.section ul li{margin-bottom:8px;font-size:14px;}'
        '.watermark{position:fixed;top:50%;left:50%;transform:translate(-50%,-50%) rotate(-30deg);'
        'font-size:120px;font-weight:900;color:rgba(0,0,0,0.03);pointer-events:none;z-index:0;text-transform:uppercase;}'
        '.footer{padding:24px 48px;border-top:1px solid #e5e7eb;text-align:center;'
        'font-size:11px;color:#9ca3af;font-family:sans-serif;text-transform:uppercase;letter-spacing:0.1em;}'
        '</style></head><body>'
        '<div class="watermark">DRAFT</div>'
        '<div class="document">'
        '<div class="header">'
        '<h1>' + name + '</h1>'
        '<p style="font-size:13px;opacity:0.8;margin-top:8px;">Zambia Medicines and Medical Supplies Agency - ' + method_label + '</p>'
        '<span class="badge">Standard Template - ZPPA Compliant</span>'
        '</div><div class="body">'
        '<h2>Document Structure</h2>'
        '<div class="section">'
        '<h3>1. Purpose &amp; Scope</h3>'
        '<p>This document serves as the official ' + name.lower() + ' for procurement activities.</p>'
        '</div><div class="section">'
        '<h3>2. Key Provisions</h3><ul>'
        '<li><strong>Bid Submission:</strong> All bids must be submitted before the closing date and time.</li>'
        '<li><strong>Bid Security:</strong> As specified in the solicitation documents.</li>'
        '<li><strong>Evaluation:</strong> Bids evaluated in accordance with published criteria.</li>'
        '<li><strong>Tax Compliance:</strong> Valid ZRA Tax Clearance Certificate is mandatory.</li>'
        '</ul></div><div class="section">'
        '<h3>3. Compliance Framework</h3>'
        '<p>Complies with ZPPA regulations and ZAMMSA Procurement Policy.</p>'
        '</div><div class="section">'
        '<h3>4. Instructions to Bidders</h3><ul>'
        '<li>Examine all instructions, conditions, and specifications carefully.</li>'
        '<li>Non-compliance may result in disqualification.</li>'
        '<li>Enquiries must be submitted in writing within the clarification period.</li>'
        '</ul></div></div>'
        '<div class="footer">ZAMMSA Procurement System - Generated Preview</div>'
        '</div></body></html>'
    )


def _format_content(text):
    """Convert plain text or markdown-like text to HTML paragraphs.
    If the text already contains HTML block-level tags, return it as-is."""
    if not text:
        return '<p style="color:#9ca3af;font-style:italic;">No template content available.</p>'
    if '<h' in text or '<div' in text or '<p>' in text or '<table' in text or '<ul>' in text:
        return text
    paragraphs = text.split('\n')
    html_parts = []
    for p in paragraphs:
        p = p.strip()
        if not p:
            continue
        if p.startswith('## '):
            html_parts.append(
                '<h3 style="font-size:15px;font-weight:700;margin:24px 0 12px;'
                'color:#1e3a5f;">' + p[3:] + '</h3>'
            )
        elif p.startswith('### '):
            html_parts.append(
                '<h4 style="font-size:14px;font-weight:600;margin:20px 0 8px;'
                'color:#374151;">' + p[4:] + '</h4>'
            )
        elif p.startswith('- ') or p.startswith('* '):
            html_parts.append('<li style="padding:4px 0;font-size:14px;">' + p[2:] + '</li>')
        else:
            html_parts.append(
                '<p style="margin-bottom:14px;font-size:14px;line-height:1.9;'
                'text-align:justify;">' + p + '</p>'
            )
    return ''.join(html_parts)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_document_upload_view(request, solicitation_id):
    """Upload a document to a solicitation."""
    from .models import SolicitationDocument

    try:
        sol = Solicitation.objects.get(solicitation_id=solicitation_id)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=status.HTTP_404_NOT_FOUND)

    file = request.FILES.get('file')
    if not file:
        return Response({'error': 'No file provided'}, status=status.HTTP_400_BAD_REQUEST)

    doc = SolicitationDocument.objects.create(
        solicitation=sol,
        document_type=request.POST.get('document_type', 'other'),
        file=file,
        file_path=file.name,
        is_public=request.POST.get('is_public', 'true') == 'true',
    )

    serializer = SolicitationDocumentSerializer(doc, context={'request': request})
    return Response(serializer.data, status=status.HTTP_201_CREATED)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_copy_cpp_documents_view(request, solicitation_id):
    """Copy selected CPP documents into a solicitation's document store."""
    from django.core.files.base import ContentFile
    from procurement_planning.models import CPPDocument

    try:
        sol = Solicitation.objects.get(solicitation_id=solicitation_id)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=status.HTTP_404_NOT_FOUND)

    cpp_document_ids = request.data.get('cpp_document_ids', [])
    if not cpp_document_ids:
        return Response({'error': 'No CPP document IDs provided'}, status=status.HTTP_400_BAD_REQUEST)

    cpp_docs = CPPDocument.objects.filter(document_id__in=cpp_document_ids)
    if not cpp_docs.exists():
        return Response({'error': 'No valid CPP documents found'}, status=status.HTTP_404_NOT_FOUND)

    mapped = []
    for cpp_doc in cpp_docs:
        if not cpp_doc.document:
            continue
        try:
            source_file = cpp_doc.document
            source_file.open('rb')
            file_bytes = source_file.read()
            source_file.close()
        except Exception:
            continue

        sol_doc = SolicitationDocument(
            solicitation=sol,
            document_type='specification' if cpp_doc.document_type == 'specification' else 'other',
            file_path=cpp_doc.document.name,
            is_public=True,
        )
        sol_doc.file.save(cpp_doc.document.name, ContentFile(file_bytes))
        sol_doc.save()

        serializer = SolicitationDocumentSerializer(sol_doc, context={'request': request})
        mapped.append(serializer.data)

    return Response({'copied': mapped, 'count': len(mapped)}, status=status.HTTP_201_CREATED)


@api_view(['DELETE'])
@permission_classes([IsAuthenticated])
def solicitation_document_delete_view(request, solicitation_id, document_id):
    """Delete a solicitation document."""
    from .models import SolicitationDocument

    try:
        doc = SolicitationDocument.objects.get(document_id=document_id, solicitation__solicitation_id=solicitation_id)
    except SolicitationDocument.DoesNotExist:
        return Response({'error': 'Document not found'}, status=status.HTTP_404_NOT_FOUND)

    if doc.file:
        doc.file.delete()
    doc.delete()
    return Response({'message': 'Document deleted'}, status=status.HTTP_200_OK)
