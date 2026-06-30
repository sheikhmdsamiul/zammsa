import hashlib
import time
from decimal import Decimal
from django.db.models import Q
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import IntegrationEndpoint, IntegrationLog, SyncStatus, WebhookDelivery
from .serializers import (
    IntegrationEndpointSerializer, IntegrationLogSerializer,
    SyncStatusSerializer, WebhookDeliverySerializer,
)
from system_config.notifications import alert_integration_manager


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class IntegrationEndpointListView(BaseView, generics.ListCreateAPIView):
    queryset = IntegrationEndpoint.objects.all()
    serializer_class = IntegrationEndpointSerializer
    search_fields = ['system_name', 'endpoint_url']
    ordering = ['system_name']


class IntegrationEndpointDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = IntegrationEndpoint.objects.all()
    serializer_class = IntegrationEndpointSerializer
    permission_classes = [IsAuthenticated]


class IntegrationLogListView(BaseView, generics.ListAPIView):
    queryset = IntegrationLog.objects.select_related('endpoint').all()
    serializer_class = IntegrationLogSerializer
    ordering = ['-timestamp']


class SyncStatusListView(BaseView, generics.ListCreateAPIView):
    queryset = SyncStatus.objects.all()
    serializer_class = SyncStatusSerializer
    ordering = ['-last_sync_time']


class WebhookDeliveryListView(BaseView, generics.ListAPIView):
    queryset = WebhookDelivery.objects.all()
    serializer_class = WebhookDeliverySerializer
    ordering = ['-received_at']


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def call_budget_validation_view(request):
    endpoint_id = request.data.get('endpoint_id')
    requisition_id = request.data.get('requisition_id')
    amount = request.data.get('amount')

    if not endpoint_id or not amount:
        return Response({'error': 'endpoint_id and amount are required'}, status=400)

    try:
        endpoint = IntegrationEndpoint.objects.get(pk=endpoint_id, is_enabled=True)
    except IntegrationEndpoint.DoesNotExist:
        return Response({'error': 'Endpoint not found or disabled'}, status=404)

    start = time.time()
    last_error = 'No integration attempts were executed'
    for attempt in range(endpoint.retry_count):
        backoff = min(2 ** attempt * 1, 30)
        try:
            import requests
            headers = {'Authorization': f'Bearer {endpoint.auth_config.get("api_key", "")}'}
            resp = requests.post(
                endpoint.endpoint_url,
                json={'requisition_id': str(requisition_id), 'amount': float(amount)},
                headers=headers,
                timeout=endpoint.timeout_seconds,
            )
            elapsed = int((time.time() - start) * 1000)
            IntegrationLog.objects.create(
                endpoint=endpoint,
                request_method='POST',
                request_url=endpoint.endpoint_url,
                response_status=resp.status_code,
                response_time_ms=elapsed,
            )
            if resp.status_code == 200:
                return Response({'message': 'Budget validated', 'response': resp.json()})
            raise Exception(f'ERP returned {resp.status_code}')
        except Exception as e:
            last_error = str(e)
            time.sleep(backoff)
            continue

    elapsed = int((time.time() - start) * 1000)
    IntegrationLog.objects.create(
        endpoint=endpoint,
        request_method='POST',
        request_url=endpoint.endpoint_url,
        response_status=0,
        response_time_ms=elapsed,
        error_message=last_error,
    )
    alert_integration_manager(
        title=f'Integration failure: {endpoint.system_name}',
        message=f'Budget validation failed after {endpoint.retry_count} retries for {endpoint.system_name}.',
        metadata={
            'endpoint_id': str(endpoint.pk),
            'endpoint_url': endpoint.endpoint_url,
            'retry_count': endpoint.retry_count,
            'response_time_ms': elapsed,
            'error': last_error,
        },
        sms_required=True,
    )
    return Response({'error': 'Budget validation failed after all retries'}, status=502)


@api_view(['POST'])
@permission_classes([AllowAny])
def wms_webhook_view(request):
    import hashlib
    payload = request.data
    payload_str = str(payload)
    payload_hash = hashlib.sha256(payload_str.encode()).hexdigest()

    webhook = WebhookDelivery.objects.create(
        source_system='WMS',
        payload_hash=payload_hash,
        processed_status='processing',
    )

    po_number = payload.get('po_number')
    grn_quantity = payload.get('received_quantity')
    if po_number and grn_quantity:
        from finance.models import Invoice, ThreeWayMatch
        from contracts.models import Contract
        from django.db.models import Q
        invoices = Invoice.objects.filter(po_number=po_number, status='submitted')
        for inv in invoices:
            ThreeWayMatch.objects.create(
                invoice=inv,
                po_quantity=0,
                grn_quantity=Decimal(str(grn_quantity)),
                invoice_quantity=0,
                po_price=0,
                invoice_price=0,
                match_status='partial',
                discrepancies={'grn_received': float(grn_quantity)},
            )
            inv.status = 'pending_matching'
            inv.save()

    webhook.processed_status = 'completed'
    webhook.save()

    return Response({'message': 'Webhook received', 'webhook_id': str(webhook.webhook_id)})
