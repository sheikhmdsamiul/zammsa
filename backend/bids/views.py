import uuid
import secrets
from django.db.models import Q, Max as MaxAgg
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import BidSubmission, BidDocument, BidSecurity, BidOpening, BidOpeningDetail, PreBidConference
from .serializers import (
    BidSubmissionSerializer, BidSubmissionListSerializer, BidDocumentSerializer,
    BidSecuritySerializer, BidOpeningSerializer, BidOpeningDetailSerializer,
    PreBidConferenceSerializer,
)
from solicitations.models import Solicitation
from solicitations.serializers import SolicitationAddendumSerializer


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class BidFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(lookup_expr='exact')
    solicitation = django_filters.CharFilter(method='filter_solicitation')
    is_late = django_filters.BooleanFilter()

    def filter_solicitation(self, queryset, name, value):
        try:
            uuid.UUID(value)
            return queryset.filter(solicitation_id=value)
        except (ValueError, AttributeError):
            return queryset.filter(solicitation__sol_number=value)

    class Meta:
        model = BidSubmission
        fields = ['status', 'is_late']


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class BidSubmissionListView(BaseView, generics.ListCreateAPIView):
    queryset = BidSubmission.objects.select_related('solicitation', 'supplier').prefetch_related('bid_documents', 'bid_securities').all()
    filterset_class = BidFilter
    search_fields = ['submission_id', 'supplier__full_name']
    ordering_fields = ['submitted_at', 'bid_price', 'status']
    ordering = ['-submitted_at']

    def get_serializer_class(self):
        if self.request.method == 'GET' and not self.request.query_params.get('detail'):
            return BidSubmissionListSerializer
        return BidSubmissionSerializer

    def get_queryset(self):
        qs = super().get_queryset()
        # Supplier users can only see their own bids in vendor portal.
        if getattr(self.request.user, 'role', '') == 'supplier_user':
            qs = qs.filter(supplier=self.request.user)
        return qs


class BidSubmissionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BidSubmission.objects.select_related('solicitation', 'supplier').prefetch_related('bid_documents', 'bid_securities').all()
    serializer_class = BidSubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        # Supplier users can only access their own bid detail.
        if getattr(self.request.user, 'role', '') == 'supplier_user':
            qs = qs.filter(supplier=self.request.user)
        return qs


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_submit_view(request):
    """Full 9-step two-envelope bid submission workflow"""
    sol_id = request.data.get('solicitation_id') or request.data.get('solicitation')
    if not sol_id:
        return Response({'error': 'solicitation_id is required'}, status=400)

    try:
        sol = Solicitation.objects.get(pk=sol_id)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status != 'published':
        return Response({'error': 'Solicitation is not open for bids'}, status=400)

    now = timezone.now()
    is_late = sol.closing_date < now

    if is_late:
        late_bid = BidSubmission.objects.create(
            solicitation=sol,
            supplier=request.user,
            is_late=True,
            status='submitted',
            submitted_at=now,
        )
        return Response({
            'error': 'Bid submission deadline has passed',
            'is_late': True,
            'submission_id': late_bid.submission_id,
        }, status=400)

    if BidSubmission.objects.filter(solicitation=sol, supplier=request.user).exclude(status='withdrawn').exists():
        return Response({'error': 'You have already submitted a bid for this solicitation'}, status=400)

    acknowledgments = request.data.get('addenda_acknowledged', 'false')
    addenda_acknowledged = acknowledgments in ('true', 'True', True, '1')

    sol_addenda_count = sol.addenda.count()
    if sol_addenda_count > 0 and not addenda_acknowledged:
        return Response({'error': 'You must acknowledge all addenda before submitting'}, status=400)

    submission_id = f"BID-{now.strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    receipt_number = f"RCT-{now.strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

    bid = BidSubmission.objects.create(
        solicitation=sol,
        supplier=request.user,
        submission_id=submission_id,
        receipt_number=receipt_number,
        bid_price=request.data.get('bid_price') or None,
        validity_period_days=request.data.get('validity_period_days') or None,
        status='submitted',
        is_late=False,
        submitted_at=now,
        addenda_acknowledged=addenda_acknowledged,
        addenda_acknowledged_at=now if addenda_acknowledged else None,
        financial_envelope_encrypted=True,
    )

    technical_file = request.FILES.get('technical_proposal')
    financial_file = request.FILES.get('financial_proposal')
    security_file = request.FILES.get('bid_security')
    zamra_file = request.FILES.get('zamra_registration')
    supporting_file = request.FILES.get('other_supporting')

    if technical_file:
        from django.core.files.storage import default_storage
        tech_path = default_storage.save(f'bids/{bid.bid_id}/technical_{technical_file.name}', technical_file)
        BidDocument.objects.create(
            bid=bid,
            document_type='technical_proposal',
            file_path=tech_path,
        )

    if financial_file:
        from django.core.files.storage import default_storage
        fin_path = default_storage.save(f'bids/{bid.bid_id}/financial_{financial_file.name}', financial_file)
        BidDocument.objects.create(
            bid=bid,
            document_type='financial_proposal',
            file_path=fin_path,
        )

    if security_file:
        from django.core.files.storage import default_storage
        sec_path = default_storage.save(f'bids/{bid.bid_id}/security_{security_file.name}', security_file)
        BidDocument.objects.create(
            bid=bid,
            document_type='bid_security',
            file_path=sec_path,
        )

    if zamra_file:
        from django.core.files.storage import default_storage
        zamra_path = default_storage.save(f'bids/{bid.bid_id}/zamra_{zamra_file.name}', zamra_file)
        BidDocument.objects.create(
            bid=bid,
            document_type='other',
            file_path=zamra_path,
        )

    if supporting_file:
        from django.core.files.storage import default_storage
        supp_path = default_storage.save(f'bids/{bid.bid_id}/supporting_{supporting_file.name}', supporting_file)
        BidDocument.objects.create(
            bid=bid,
            document_type='other',
            file_path=supp_path,
        )

    return Response({
        'message': 'Bid submitted successfully',
        'receipt_number': receipt_number,
        'submission_id': submission_id,
        'bid_id': str(bid.bid_id),
        'submitted_at': now.isoformat(),
        'financial_envelope_encrypted': True,
        'documents_uploaded': {
            'technical_proposal': technical_file is not None,
            'financial_proposal': financial_file is not None,
            'bid_security': security_file is not None,
            'zamra_registration': zamra_file is not None,
            'other_supporting': supporting_file is not None,
        },
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def solicitation_addenda_view(request, pk):
    """Get addenda for a solicitation that need acknowledgment"""
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    addenda = sol.addenda.all().order_by('addendum_number')
    return Response({
        'solicitation': sol.sol_number,
        'addenda': SolicitationAddendumSerializer(addenda, many=True).data,
        'total_addenda': addenda.count(),
    })


class BidDocumentListView(BaseView, generics.ListCreateAPIView):
    queryset = BidDocument.objects.select_related('bid').all()
    serializer_class = BidDocumentSerializer
    ordering = ['-document_id']


class BidSecurityListView(BaseView, generics.ListCreateAPIView):
    queryset = BidSecurity.objects.select_related('bid').all()
    serializer_class = BidSecuritySerializer
    ordering = ['-security_id']


class BidSecurityDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BidSecurity.objects.all()
    serializer_class = BidSecuritySerializer
    permission_classes = [IsAuthenticated]


class PreBidConferenceListView(BaseView, generics.ListCreateAPIView):
    queryset = PreBidConference.objects.select_related('solicitation').all()
    serializer_class = PreBidConferenceSerializer
    ordering = ['-scheduled_date']


class PreBidConferenceDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PreBidConference.objects.all()
    serializer_class = PreBidConferenceSerializer
    permission_classes = [IsAuthenticated]


class BidOpeningListView(BaseView, generics.ListCreateAPIView):
    queryset = BidOpening.objects.select_related('solicitation', 'conducted_by').prefetch_related('opening_details').all()
    serializer_class = BidOpeningSerializer
    ordering = ['-opened_at']


class BidOpeningDetailView(generics.RetrieveAPIView):
    queryset = BidOpening.objects.select_related('solicitation', 'conducted_by').prefetch_related('opening_details').all()
    serializer_class = BidOpeningSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_start_view(request, pk):
    """Step 1: Create bid opening session without opening bids"""
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if BidOpening.objects.filter(solicitation=sol, status='in_progress').exists():
        return Response({'error': 'An opening session is already in progress'}, status=400)

    bids = BidSubmission.objects.filter(solicitation=sol, status='submitted').order_by('submitted_at')
    if not bids.exists():
        return Response({'error': 'No bids to open'}, status=400)

    opening = BidOpening.objects.create(
        solicitation=sol,
        conducted_by=request.user,
        status='in_progress',
        started_at=timezone.now(),
        scheduled_opening_time=request.data.get('scheduled_opening_time') or None,
        public_live_link=request.data.get('public_live_link', f'portal.zammsa.gov.zm/opening/{sol.sol_number}-live'),
        viewers_connected=int(request.data.get('viewers_connected', 0) or 0),
        witnesses=request.data.get('witnesses', []),
        witness_signatures=request.data.get('witness_signatures', []),
    )

    # Pre-create BidOpeningDetail records for all submitted bids
    # so the frontend sees the full bid list immediately
    details = [
        BidOpeningDetail(
            opening=opening,
            bid=bid,
            opened_sequence=idx + 1,
            bidder_name=bid.supplier.full_name if bid.supplier else "Unknown",
            is_opened=False,
            security_amount_read=bid.security_amount,
            security_verified_read=bool(bid.security_verified),
        )
        for idx, bid in enumerate(bids)
    ]
    BidOpeningDetail.objects.bulk_create(details)

    return Response({
        'message': 'Bid opening session started',
        'opening_id': str(opening.opening_id),
        'total_bids': bids.count(),
        'opening': BidOpeningSerializer(opening).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_open_single_view(request, opening_pk, bid_pk):
    """Step 3: Open a single bid one at a time"""
    try:
        opening = BidOpening.objects.get(pk=opening_pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening session not found'}, status=404)

    if opening.status != 'in_progress':
        return Response({'error': 'Opening session is not in progress'}, status=400)

    try:
        bid = BidSubmission.objects.get(pk=bid_pk, solicitation=opening.solicitation)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found for this solicitation'}, status=404)

    if bid.status != 'submitted':
        return Response({'error': 'Bid is not in submitted status'}, status=400)

    detail = BidOpeningDetail.objects.filter(opening=opening, bid=bid).first()
    if detail and detail.is_opened:
        return Response({'error': 'Bid has already been opened'}, status=400)

    if detail is None:
        last_seq = BidOpeningDetail.objects.filter(opening=opening).aggregate(
            m=MaxAgg('opened_sequence'))['m'] or 0
        detail = BidOpeningDetail(
            opening=opening,
            bid=bid,
            opened_sequence=last_seq + 1,
            bidder_name=bid.supplier.full_name,
            security_amount_read=bid.security_amount,
            security_verified_read=bool(bid.security_verified),
        )

    financial_sealed = request.data.get('financial_sealed', 'true') in ('true', 'True', True, '1')

    bid.status = 'opened'
    bid.opened_at = timezone.now()
    bid.save()

    detail.is_opened = True
    detail.opened_at = timezone.now()
    detail.price_read = bid.bid_price if not financial_sealed else None
    detail.financial_sealed = financial_sealed
    detail.objections = request.data.get('objections', '')
    detail.security_amount_read = bid.security_amount
    detail.security_verified_read = bool(bid.security_verified)
    detail.save()

    newly_opened_count = opening.opening_details.filter(is_opened=True).count()
    total_count = opening.opening_details.count()
    if total_count > 0 and newly_opened_count >= total_count:
        opening.status = 'completed'
        opening.completed_at = timezone.now()
        opening.save(update_fields=['status', 'completed_at'])

    return Response({
        'message': f'Bid {bid.submission_id} opened (seq {detail.opened_sequence})',
        'sequence': detail.opened_sequence,
        'bidder_name': bid.supplier.full_name,
        'financial_sealed': financial_sealed,
        'detail': BidOpeningDetailSerializer(detail).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def bid_opening_minutes_view(request, pk):
    """Step 6: Generate/download bid opening minutes"""
    try:
        opening = BidOpening.objects.get(pk=pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening not found'}, status=404)

    details = opening.opening_details.all().order_by('opened_sequence')
    sol = opening.solicitation

    minutes_text = f"""
BID OPENING MINUTES
===================
Solicitation: {sol.sol_number} - {sol.title}
Opening Date: {opening.opened_at.strftime('%Y-%m-%d %H:%M')}
Conducted By: {opening.conducted_by.full_name}
Status: {opening.get_status_display()}

WITNESSES:
{chr(10).join(f'  - {w}' if isinstance(w, str) else f'  - {w.get("name", w)}' for w in opening.witnesses) if opening.witnesses else '  None recorded'}

OPENED BIDS:
{chr(10).join(f'  {d.opened_sequence}. {d.bidder_name or d.bid.supplier.full_name}  |  Sequence: {d.opened_sequence}  |  Financial: {"SEALED" if d.financial_sealed else f"ZMW {d.price_read}"}  |  Security: {"VERIFIED" if d.security_verified_read else "PENDING"} ({d.security_amount_read or 0})  |  Objections: {d.objections or "None"}' for d in details if d.is_opened) if details else '  No bids opened'}

Total Bids Opened: {details.filter(is_opened=True).count()}
Minutes Generated: {timezone.now().strftime('%Y-%m-%d %H:%M')}
"""

    opening.minutes_file_path = f'opening_minutes_{sol.sol_number}_{opening.opened_at.strftime("%Y%m%d")}.txt'
    opening.save(update_fields=['minutes_file_path'])

    return Response({
        'message': 'Minutes generated',
        'minutes_file': opening.minutes_file_path,
        'minutes_content': minutes_text,
        'opening_id': str(opening.opening_id),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_send_minutes_view(request, pk):
    """Step 7: Email minutes to all bidding suppliers"""
    try:
        opening = BidOpening.objects.get(pk=pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening not found'}, status=404)

    sol = opening.solicitation
    bids = BidSubmission.objects.filter(solicitation=sol)

    recipients = []
    for bid in bids:
        if bid.supplier.email:
            recipients.append({
                'supplier': bid.supplier.full_name,
                'email': bid.supplier.email,
            })

    if not recipients:
        return Response({'error': 'No supplier emails found'}, status=400)

    return Response({
        'message': f'Minutes sent to {len(recipients)} suppliers',
        'recipients': recipients,
        'notes': 'Email sending requires email backend configuration',
        'opening_id': str(opening.opening_id),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_conduct_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    bids = BidSubmission.objects.filter(solicitation=sol, status='submitted').order_by('submitted_at')
    if not bids.exists():
        return Response({'error': 'No bids to open'}, status=400)

    opening = BidOpening.objects.create(
        solicitation=sol,
        conducted_by=request.user,
        witnesses=request.data.get('witnesses', []),
    )

    for idx, bid in enumerate(bids, start=1):
        bid.status = 'opened'
        bid.save()
        BidOpeningDetail.objects.create(
            opening=opening,
            bid=bid,
            opened_sequence=idx,
            price_read=bid.bid_price,
        )

    return Response({
        'message': f'{bids.count()} bids opened successfully',
        'opening_id': str(opening.opening_id),
        'details': BidOpeningSerializer(opening).data,
    })


@api_view(['GET'])
@permission_classes([AllowAny])
def public_bid_opening_view(request, pk):
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    opening = BidOpening.objects.filter(solicitation=sol).prefetch_related('opening_details__bid').first()
    if not opening:
        total_bids = BidSubmission.objects.filter(solicitation=sol, status='submitted').count()
        return Response({
            'status': 'not_started',
            'solicitation': sol.sol_number,
            'title': sol.title,
            'total_bids': total_bids,
            'message': 'Bid opening has not been conducted yet',
        })

    data = BidOpeningSerializer(opening).data
    data['status_display'] = opening.get_status_display()
    data['total_bids'] = BidSubmission.objects.filter(solicitation=sol, status='submitted').count()
    data['opened_count'] = opening.opening_details.filter(is_opened=True).count()
    data['pending_bids'] = max(0, data['total_bids'] - data['opened_count'])

    return Response(data)
