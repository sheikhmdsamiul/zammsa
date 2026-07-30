import uuid
import json
from decimal import Decimal, InvalidOperation
from django.db import transaction
from django.db.models import Q, Max as MaxAgg
from django.utils import timezone
from django.utils.dateparse import parse_datetime
from django.conf import settings
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated, AllowAny
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters

from .models import BidSubmission, BidDocument, BidSecurity, BidOpening, BidOpeningDetail, PreBidConference
from accounts.models import User
from accounts.audit import log_audit_action
from system_config.notifications import create_notification
from .serializers import (
    BidSubmissionSerializer, BidSubmissionListSerializer, BidDocumentSerializer,
    BidSecuritySerializer, BidOpeningSerializer, BidOpeningDetailSerializer,
    PreBidConferenceSerializer,
)
from .services import BidSubmissionService, BidOpeningService
from solicitations.models import Solicitation
from solicitations.serializers import SolicitationAddendumSerializer

SUPPLIER_ROLES = ('supplier_user', 'system_admin')
BID_OPENING_ROLES = ('procurement_officer', 'procurement_manager', 'system_admin')


def _bool_from_request(value):
    return value in ('true', 'True', True, '1', 1)


def _parse_request_datetime(value):
    if not value:
        return None
    if hasattr(value, 'tzinfo'):
        return value
    parsed = parse_datetime(str(value))
    if not parsed:
        return None
    if timezone.is_naive(parsed):
        parsed = timezone.make_aware(parsed, timezone.get_current_timezone())
    return parsed


def _build_bid_opening_minutes_content(opening):
    sol = opening.solicitation
    details = opening.opening_details.all().order_by('opened_sequence')
    opened_details = [d for d in details if d.is_opened]
    total_late = BidSubmission.objects.filter(solicitation=sol, is_late=True).count()
    late_bids_list = BidSubmission.objects.filter(solicitation=sol, is_late=True)

    witnesses_text = '\n'.join(
        f'  - [{s.get("role", "Witness")}] {s.get("name", s)}' if isinstance(s, dict) else f'  - {s}'
        for s in opening.witnesses
    ) if opening.witnesses else '  None recorded'

    details_lines = '\n'.join(
        f'  {d.opened_sequence}. {d.bidder_name or d.bid.supplier.full_name}  |  '
        f'Price: {"SEALED" if d.financial_sealed else f"ZMW {d.price_read:>12,.2f}" if d.price_read else "---"}  |  '
        f'Security: {"VERIFIED" if d.security_verified_read else "PENDING"}  |  '
        f'Objections: {d.objections or "None"}'
        for d in opened_details
    ) if opened_details else '  No bids opened'

    late_details = ''
    if total_late > 0:
        late_details = '\n'.join(
            f'  - {b.submission_id or b.receipt_number} from {b.supplier.full_name} at {b.submitted_at.strftime("%H:%M:%S") if b.submitted_at else "unknown"}'
            for b in late_bids_list
        )

    witness_sigs = ''
    for s in opening.witness_signatures:
        if isinstance(s, dict):
            witness_sigs += f'  - {s.get("name", "Unknown")} ({s.get("role", "Witness")}) — Signed at {s.get("signed_at", "unknown")}\n'
    if not witness_sigs:
        witness_sigs = '  Pending signatures\n'

    opening_started_at = opening.started_at.strftime('%d %B %Y  %H:%M') if opening.started_at else opening.opened_at.strftime('%d %B %Y  %H:%M')
    minutes_content = f"""
╔══════════════════════════════════════════════════════════════════════════╗
║                   ZAMMSA — BID OPENING MINUTES                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║                                                                          ║
║  Solicitation: {sol.sol_number} — {sol.title or 'N/A'}
║  Opening Date: {opening_started_at} CAT
║  Location:     {opening.location or 'ZAMMSA Boardroom, Lusaka / Virtual'}
║  Procurement Officer: {opening.conducted_by.full_name}
║  Viewers:      {opening.viewers_connected}
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  BIDS RECEIVED AND OPENED:                                              ║
║                                                                          ║
{details_lines}
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  OBSERVATIONS:                                                          ║
║  {opening.observations or 'None recorded.'}
║                                                                          ║
╠══════════════════════════════════════════════════════════════════════════╣
║  LATE BIDS: {f'{total_late} received — automatically rejected.' if total_late else 'None.'}
{late_details}
╠══════════════════════════════════════════════════════════════════════════╣
║  WITNESSES:                                                             ║
{witnesses_text}
║                                                                          ║
║  DIGITAL SIGNATURES:                                                    ║
{witness_sigs}
╚══════════════════════════════════════════════════════════════════════════╝

Procurement Officer: {opening.conducted_by.full_name} ({opening.conducted_by.email})
Bids Received: {BidSubmission.objects.filter(solicitation=sol).count()}
Valid Bids Opened: {len(opened_details)}
Minutes Finalized: {timezone.now().strftime('%Y-%m-%d %H:%M')} CAT
Finalized By: {opening.conducted_by.full_name} ({opening.conducted_by.email})

This is an automated message from the ZAMMSA Procurement System.
Contact the procurement office if you have any objections within 3 working days.
"""
    return minutes_content.strip(), details, opened_details


def _send_bid_opening_minutes_to_suppliers(sol, minutes_content):
    recipients = []
    bids = BidSubmission.objects.filter(solicitation=sol).select_related('supplier')
    for bid in bids:
        if not bid.supplier:
            continue
        message = (
            f'Dear {bid.supplier.full_name},\n\n'
            f'Please find below the bid opening minutes for solicitation {sol.sol_number} — {sol.title}.\n\n'
            f'{minutes_content}\n\n'
            f'This is an automated message from the ZAMMSA Procurement System.\n'
            f'Contact the procurement office if you have any objections within 3 working days.'
        )
        notification = create_notification(
            bid.supplier,
            title=f'Bid Opening Minutes: {sol.sol_number}',
            message=message,
            notification_type='supplier',
            priority='normal',
            source_module='bids',
            object_id=bid.pk,
            action_url=f'/vendor/bids/{bid.pk}',
            metadata={'solicitation_id': str(sol.pk), 'sol_number': sol.sol_number},
            email_required=True,
        )
        recipients.append({
            'supplier': bid.supplier.full_name,
            'email': bid.supplier.email,
            'sent': notification.email_status == 'sent' if notification else False,
            'error': notification.email_last_error if notification else '',
        })
    return recipients


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class BidFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(lookup_expr='exact')
    solicitation = django_filters.CharFilter(method='filter_solicitation')
    is_late = django_filters.BooleanFilter()
    lot_number = django_filters.CharFilter(lookup_expr='exact')

    def filter_solicitation(self, queryset, name, value):
        try:
            uuid.UUID(value)
            return queryset.filter(solicitation_id=value)
        except (ValueError, AttributeError):
            return queryset.filter(solicitation__sol_number=value)

    class Meta:
        model = BidSubmission
        fields = ['status', 'is_late', 'lot_number']


class BidOpeningFilter(django_filters.FilterSet):
    status = django_filters.CharFilter(lookup_expr='exact')
    solicitation = django_filters.CharFilter(method='filter_solicitation')

    def filter_solicitation(self, queryset, name, value):
        try:
            uuid.UUID(value)
            return queryset.filter(solicitation_id=value)
        except (ValueError, AttributeError):
            return queryset.filter(solicitation__sol_number=value)

    class Meta:
        model = BidOpening
        fields = ['status']


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
        if getattr(self.request.user, 'role', '') == 'supplier_user':
            qs = qs.filter(supplier=self.request.user)
        return qs


class BidSubmissionDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BidSubmission.objects.select_related('solicitation', 'supplier').prefetch_related('bid_documents', 'bid_securities').all()
    serializer_class = BidSubmissionSerializer
    permission_classes = [IsAuthenticated]

    def get_queryset(self):
        qs = super().get_queryset()
        if getattr(self.request.user, 'role', '') == 'supplier_user':
            qs = qs.filter(supplier=self.request.user)
        return qs


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_submit_view(request):
    result, status_code = BidSubmissionService.submit_bid(request)
    return Response(result, status=status_code)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_withdraw_view(request, pk):
    if getattr(request.user, 'role', '') not in SUPPLIER_ROLES:
        return Response({'error': 'Only supplier users can withdraw bids'}, status=403)
    try:
        bid = BidSubmission.objects.get(pk=pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)
    if bid.supplier != request.user:
        return Response({'error': 'You can only withdraw your own bids'}, status=403)
    reason = request.data.get('reason', '')
    result, status_code = BidSubmissionService.withdraw_bid(bid, request.user, reason)
    return Response(result, status=status_code)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_modify_view(request, pk):
    if getattr(request.user, 'role', '') not in SUPPLIER_ROLES:
        return Response({'error': 'Only supplier users can modify bids'}, status=403)
    try:
        bid = BidSubmission.objects.get(pk=pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)
    if bid.supplier != request.user:
        return Response({'error': 'You can only modify your own bids'}, status=403)
    result, status_code = BidSubmissionService.modify_bid(bid, request.user, request.data)
    return Response(result, status=status_code)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def solicitation_addenda_view(request, pk):
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


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_unseal_financial_view(request, pk):
    if getattr(request.user, 'role', '') not in ('evaluation_committee_chair', 'system_admin', 'auditor'):
        return Response({'error': 'Only evaluation committee chair can unseal financial envelopes'}, status=403)

    try:
        bid = BidSubmission.objects.get(pk=pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)

    if not bid.financial_envelope_encrypted:
        return Response({'error': 'Financial envelope is not encrypted'}, status=400)

    from evaluations.models import TechnicalScore
    opening_detail = BidOpeningDetail.objects.filter(bid=bid).order_by('-opened_at').first()
    if not opening_detail or opening_detail.financial_sealed:
        return Response({'error': 'Financial envelope has not been authorized for opening'}, status=400)
    if not TechnicalScore.objects.filter(bid=bid, is_final=True).exists():
        return Response({'error': 'Technical evaluation must be finalized before unsealing financial envelope'}, status=400)

    doc = BidDocument.objects.filter(bid=bid, document_type='financial_proposal').first()
    if not doc:
        return Response({'error': 'Financial document not found'}, status=404)

    from django.core.files.storage import default_storage
    from .services import decrypt_financial_envelope
    try:
        file_content = default_storage.open(doc.file_path).read()
        decrypted = decrypt_financial_envelope(file_content)
        import base64
        return Response({
            'message': 'Financial envelope unsealed',
            'bid_id': str(bid.bid_id),
            'financial_content_base64': base64.b64encode(decrypted).decode('utf-8'),
            'filename': doc.file_path.split('/')[-1].replace('sealed_', ''),
        })
    except Exception as e:
        return Response({'error': f'Failed to decrypt financial envelope: {str(e)}'}, status=500)


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
    filterset_class = BidOpeningFilter
    search_fields = ['solicitation__sol_number', 'solicitation__title', 'conducted_by__full_name', 'status', 'public_live_link']
    ordering = ['-opened_at']


class BidOpeningDetailView(generics.RetrieveAPIView):
    queryset = BidOpening.objects.select_related('solicitation', 'conducted_by').prefetch_related('opening_details').all()
    serializer_class = BidOpeningSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_start_view(request, pk):
    if getattr(request.user, 'role', '') not in BID_OPENING_ROLES:
        return Response({'error': 'Only procurement officers can start bid openings'}, status=403)
    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    result, status_code = BidOpeningService.start_opening(sol, request.user, request.data)
    if status_code != 201:
        return Response(result, status=status_code)

    opening = BidOpening.objects.get(pk=result['opening_id'])
    return Response({
        **result,
        'opening': BidOpeningSerializer(opening).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_open_single_view(request, opening_pk, bid_pk):
    if getattr(request.user, 'role', '') not in BID_OPENING_ROLES:
        return Response({'error': 'Only procurement officers can open bids'}, status=403)

    try:
        opening = BidOpening.objects.get(pk=opening_pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening session not found'}, status=404)

    if opening.status != 'in_progress':
        return Response({'error': 'Opening session is not in progress'}, status=400)

    opening_time = opening.scheduled_opening_time or opening.solicitation.opening_date or opening.solicitation.closing_date
    if opening_time and opening_time > timezone.now():
        return Response({
            'error': 'Bid cannot be opened before the scheduled opening time',
            'scheduled_opening_time': opening_time.isoformat(),
        }, status=400)

    try:
        bid = BidSubmission.objects.get(pk=bid_pk, solicitation=opening.solicitation)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found for this solicitation'}, status=404)

    if bid.status not in ('submitted', 'modified'):
        return Response({'error': f'Bid is not in submittable status: {bid.status}'}, status=400)

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

    financial_sealed = _bool_from_request(request.data.get(
        'financial_sealed',
        getattr(opening.solicitation, 'submission_format', 'single') == 'two',
    ))

    bid.status = 'opened'
    bid.opened_at = timezone.now()
    bid.save(update_fields=['status', 'opened_at'])

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
    try:
        opening = BidOpening.objects.get(pk=pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening not found'}, status=404)

    minutes_content, _, _ = _build_bid_opening_minutes_content(opening)

    opening.minutes_file_path = f'opening_minutes_{opening.solicitation.sol_number}_{opening.opened_at.strftime("%Y%m%d")}.txt'
    opening.save(update_fields=['minutes_file_path'])

    return Response({
        'message': 'Minutes generated',
        'minutes_file': opening.minutes_file_path,
        'minutes_content': minutes_content,
        'opening_id': str(opening.opening_id),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_finalize_view(request, pk):
    if getattr(request.user, 'role', '') not in BID_OPENING_ROLES:
        return Response({'error': 'Only procurement officers can finalize bid openings'}, status=403)

    try:
        opening = BidOpening.objects.get(pk=pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening not found'}, status=404)

    sol = opening.solicitation
    details = opening.opening_details.all().order_by('opened_sequence')
    unopened_count = details.filter(is_opened=False).count()
    if unopened_count:
        return Response({'error': f'Cannot finalize opening while {unopened_count} bid(s) remain unopened'}, status=400)

    observations = request.data.get('observations', opening.observations)
    witness_signatures = request.data.get('witness_signatures', opening.witness_signatures)
    opening.observations = observations
    opening.witness_signatures = witness_signatures
    opening.status = 'completed'
    opening.completed_at = timezone.now()
    minutes_content, _, _ = _build_bid_opening_minutes_content(opening)
    minutes_filename = f'opening_minutes_{sol.sol_number}_{opening.opened_at.strftime("%Y%m%d_%H%M")}.txt'
    opening.minutes_file_path = minutes_filename
    opening.save(update_fields=[
        'observations', 'witness_signatures', 'status',
        'completed_at', 'minutes_file_path',
    ])

    opened_details_qs = opening.opening_details.filter(is_opened=True)
    for detail in opened_details_qs:
        if detail.bid and detail.bid.status != 'opened':
            detail.bid.status = 'opened'
            detail.bid.opened_at = detail.bid.opened_at or timezone.now()
            detail.bid.save(update_fields=['status', 'opened_at'])

    recipients = _send_bid_opening_minutes_to_suppliers(sol, minutes_content)
    log_audit_action(
        user=request.user, action='BID_OPENING_FINALIZED', module='bids',
        record_id=str(opening.opening_id), ip_address=request.META.get('REMOTE_ADDR', ''),
    )

    return Response({
        'message': f'Bid opening finalized and minutes sent to {len(recipients)} supplier(s)',
        'opening_id': str(opening.opening_id),
        'status': 'completed',
        'minutes_content': minutes_content,
        'minutes_file': minutes_filename,
        'recipients': recipients,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_send_minutes_view(request, pk):
    if getattr(request.user, 'role', '') not in BID_OPENING_ROLES:
        return Response({'error': 'Only procurement officers can resend bid opening minutes'}, status=403)

    try:
        opening = BidOpening.objects.select_related('solicitation', 'conducted_by').get(pk=pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening not found'}, status=404)

    if opening.status != 'completed':
        return Response({'error': 'Minutes can only be resent after the opening is completed'}, status=400)

    minutes_content, _, _ = _build_bid_opening_minutes_content(opening)
    recipients = _send_bid_opening_minutes_to_suppliers(opening.solicitation, minutes_content)

    log_audit_action(
        user=request.user, action='BID_OPENING_MINUTES_RESENT', module='bids',
        record_id=str(opening.opening_id), ip_address=request.META.get('REMOTE_ADDR', ''),
    )

    return Response({
        'message': f'Minutes resent to {len(recipients)} supplier(s)',
        'opening_id': str(opening.opening_id),
        'recipients': recipients,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def bid_opening_conduct_view(request, pk):
    if getattr(request.user, 'role', '') not in BID_OPENING_ROLES:
        return Response({'error': 'Only procurement officers can conduct bid openings'}, status=403)

    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.closing_date > timezone.now():
        return Response({'error': 'Bid opening cannot start before the closing deadline'}, status=400)

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


@api_view(['POST'])
@permission_classes([AllowAny])
def bid_opening_track_viewer_view(request, pk):
    try:
        opening = BidOpening.objects.get(pk=pk)
    except BidOpening.DoesNotExist:
        return Response({'error': 'Opening not found'}, status=404)

    opening.viewers_connected = (opening.viewers_connected or 0) + 1
    opening.save(update_fields=['viewers_connected'])

    return Response({
        'viewers_connected': opening.viewers_connected,
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
