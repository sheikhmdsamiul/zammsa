from django.db.models import Q, Max
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import SolicitationTemplate, Solicitation, EvaluationCriterion, SolicitationAddendum, ClarificationRequest, SolicitationDocument
from .serializers import (
    SolicitationTemplateSerializer, SolicitationSerializer, SolicitationListSerializer,
    EvaluationCriterionSerializer, SolicitationAddendumSerializer,
    ClarificationRequestSerializer, SolicitationDocumentSerializer,
)


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
        if self.request.user.role not in ('procurement_officer', 'system_admin'):
            from rest_framework.exceptions import PermissionDenied
            raise PermissionDenied('Only Procurement Officer can create solicitations.')
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

    criteria_sum = sum(float(c.weight) for c in sol.evaluation_criteria.all())
    if sol.evaluation_criteria.exists() and criteria_sum != 100.0:
        return Response({
            'error': f'Evaluation criteria weights must sum to 100% (currently {criteria_sum}%)'
        }, status=400)

    user_role = request.user.role
    if user_role not in ('procurement_officer', 'system_admin'):
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

    criteria_sum = sum(float(c.weight) for c in sol.evaluation_criteria.all())
    if sol.evaluation_criteria.exists() and criteria_sum != 100.0:
        return Response({
            'error': f'Evaluation criteria weights must sum to 100% (currently {criteria_sum}%)'
        }, status=400)

    user_role = request.user.role
    if user_role not in ('procurement_manager', 'system_admin'):
        return Response({'error': 'Not authorized to approve'}, status=403)
    if sol.created_by_id and sol.created_by_id == request.user.id:
        return Response({'error': 'Self-approval is not allowed'}, status=403)

    sol.status = 'approved'
    sol.approved_by = request.user
    sol.save()
    return Response({'message': 'Solicitation approved', 'status': sol.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def solicitation_publish_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status != 'approved':
        return Response({'error': 'Only approved solicitations can be published'}, status=400)

    user_role = request.user.role
    if user_role not in ('procurement_officer', 'system_admin'):
        return Response({'error': 'Not authorized to publish'}, status=403)

    sol.status = 'published'
    sol.published_at = timezone.now()
    sol.save()
    return Response({'message': 'Solicitation published to e-GP portal', 'status': sol.status})


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

    last_num = sol.addenda.aggregate(m=Max('addendum_number'))['addendum_number__max'] or 0

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


class EvaluationCriterionListView(BaseView, generics.ListCreateAPIView):
    queryset = EvaluationCriterion.objects.select_related('solicitation').all()
    serializer_class = EvaluationCriterionSerializer
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
