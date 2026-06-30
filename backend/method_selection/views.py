from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from rest_framework.exceptions import PermissionDenied
from django.utils import timezone
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import ProcurementMethodType, MethodRecommendation, MethodOverride, NonOpenJustification, PreferenceScheme
from .serializers import (
    ProcurementMethodTypeSerializer, MethodRecommendationSerializer,
    MethodOverrideSerializer, NonOpenJustificationSerializer, PreferenceSchemeSerializer,
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


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class ProcurementMethodTypeListView(BaseView, generics.ListCreateAPIView):
    queryset = ProcurementMethodType.objects.all()
    serializer_class = ProcurementMethodTypeSerializer
    ordering = ['threshold_min']


class ProcurementMethodTypeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = ProcurementMethodType.objects.all()
    serializer_class = ProcurementMethodTypeSerializer
    permission_classes = [IsAuthenticated]


class MethodRecommendationListView(BaseView, generics.ListCreateAPIView):
    queryset = MethodRecommendation.objects.select_related('requisition').all()
    serializer_class = MethodRecommendationSerializer
    ordering = ['-created_at']


class MethodRecommendationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = MethodRecommendation.objects.all()
    serializer_class = MethodRecommendationSerializer
    permission_classes = [IsAuthenticated]


class MethodOverrideListView(BaseView, generics.ListCreateAPIView):
    queryset = MethodOverride.objects.select_related('requisition', 'approved_by').all()
    serializer_class = MethodOverrideSerializer
    ordering = ['-created_at']


class NonOpenJustificationListView(BaseView, generics.ListCreateAPIView):
    queryset = NonOpenJustification.objects.select_related('requisition', 'solicitation', 'submitted_by', 'approved_by').all()
    serializer_class = NonOpenJustificationSerializer
    ordering = ['-created_at']

    def perform_create(self, serializer):
        serializer.save(submitted_by=self.request.user)


class NonOpenJustificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = NonOpenJustification.objects.select_related('requisition', 'solicitation', 'submitted_by', 'approved_by').all()
    serializer_class = NonOpenJustificationSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def justification_submit_view(request, pk):
    try:
        justification = NonOpenJustification.objects.get(pk=pk)
    except NonOpenJustification.DoesNotExist:
        return Response({'error': 'Justification not found'}, status=status.HTTP_404_NOT_FOUND)

    if justification.status != 'draft':
        return Response({'error': 'Only draft justifications can be submitted'}, status=status.HTTP_400_BAD_REQUEST)

    user_role = request.user.role
    if user_role not in ('procurement_officer', 'system_admin'):
        raise PermissionDenied('Only Procurement Officer can submit justifications')

    justification.status = 'submitted'
    justification.submitted_by = request.user
    justification.submitted_at = timezone.now()
    justification.save()

    return Response({'message': 'Justification submitted for ZPC approval', 'status': justification.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def justification_approve_view(request, pk):
    try:
        justification = NonOpenJustification.objects.get(pk=pk)
    except NonOpenJustification.DoesNotExist:
        return Response({'error': 'Justification not found'}, status=status.HTTP_404_NOT_FOUND)

    if justification.status != 'submitted':
        return Response({'error': 'Only submitted justifications can be approved'}, status=status.HTTP_400_BAD_REQUEST)

    user_role = request.user.role
    if user_role not in ('zpc_member', 'director_general', 'director_procurement', 'system_admin'):
        raise PermissionDenied('Only ZPC/Director can approve non-open justifications')

    justification.status = 'zpc_approved'
    justification.approved_by = request.user
    justification.zpc_approved_at = timezone.now()
    justification.save()

    return Response({'message': 'Justification approved by ZPC', 'status': justification.status})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def justification_reject_view(request, pk):
    try:
        justification = NonOpenJustification.objects.get(pk=pk)
    except NonOpenJustification.DoesNotExist:
        return Response({'error': 'Justification not found'}, status=status.HTTP_404_NOT_FOUND)

    if justification.status not in ('submitted', 'draft'):
        return Response({'error': 'Only submitted or draft justifications can be rejected'}, status=status.HTTP_400_BAD_REQUEST)

    user_role = request.user.role
    if user_role not in ('zpc_member', 'director_general', 'director_procurement', 'system_admin'):
        raise PermissionDenied('Only ZPC/Director can reject non-open justifications')

    reason = request.data.get('reason', '').strip()
    if not reason:
        return Response({'error': 'Rejection reason is required'}, status=status.HTTP_400_BAD_REQUEST)

    justification.status = 'rejected'
    justification.rejection_reason = reason
    justification.save()

    return Response({'message': 'Justification rejected', 'status': justification.status, 'rejection_reason': reason})


class PreferenceSchemeListView(BaseView, generics.ListCreateAPIView):
    queryset = PreferenceScheme.objects.all()
    serializer_class = PreferenceSchemeSerializer
    ordering = ['scheme_name']


class PreferenceSchemeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PreferenceScheme.objects.all()
    serializer_class = PreferenceSchemeSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def recommend_method_view(request):
    estimated_value = float(request.data.get('estimated_value', 0))
    commodity_type = request.data.get('commodity_type', '')
    department_id = request.data.get('department_id', '')

    try:
        from system_config.models import ThresholdRule
        rules = ThresholdRule.objects.filter(
            applies_to='procurement', is_active=True,
        ).order_by('min_value')
        for rule in rules:
            if rule.min_value <= estimated_value:
                if rule.max_value is None or estimated_value <= rule.max_value:
                    method = rule.default_method or 'open_tender'
                    rationale = f'Value ZMW {estimated_value:,.2f} falls within {rule.rule_name} range (ZMW {rule.min_value:,.2f} - ZMW {rule.max_value:,.2f if rule.max_value else "∞"}). {rule.rule_name} is applicable.'
                    return Response({
                        'recommended_method': method,
                        'rationale': rationale,
                        'rule_key': rule.rule_key,
                        'estimated_value': estimated_value,
                    })
    except Exception:
        pass

    is_consulting = str(commodity_type or '').lower() in ('consulting', 'consulting services', 'tor', 'terms of reference', 'sow')
    if is_consulting:
        if estimated_value > 600000:
            method = 'proposal'
            rationale = f'Consulting service value ZMW {estimated_value:,.2f} exceeds ZMW 600,000. Request for Proposals (QCBS) is required.'
        elif estimated_value > 20000:
            method = 'simplified'
            rationale = f'Consulting service value ZMW {estimated_value:,.2f} is between ZMW 20,001 and ZMW 600,000. Simplified selection is applicable.'
        else:
            method = 'direct'
            rationale = f'Consulting service value ZMW {estimated_value:,.2f} is ZMW 20,000 or less. Direct procurement is permitted.'
    elif estimated_value > 1000000:
        method = 'open_tender'
        rationale = 'Value exceeds ZMW 1,000,000. Open tendering is required by regulation.'
    elif estimated_value > 20000:
        method = 'simplified'
        rationale = 'Value is between ZMW 20,001 and ZMW 1,000,000. Simplified bidding is applicable.'
    else:
        method = 'direct'
        rationale = 'Value is ZMW 20,000 or less. Direct procurement is permitted.'

    return Response({
        'recommended_method': method,
        'rationale': rationale,
        'estimated_value': estimated_value,
    })
