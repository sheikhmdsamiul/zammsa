import uuid
import secrets
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
from cryptography.fernet import Fernet

from .models import BidSubmission, BidDocument, BidSecurity, BidOpening, BidOpeningDetail, PreBidConference
from accounts.models import User
from accounts.audit import log_audit_action
from system_config.notifications import create_notification
from .serializers import (
    BidSubmissionSerializer, BidSubmissionListSerializer, BidDocumentSerializer,
    BidSecuritySerializer, BidOpeningSerializer, BidOpeningDetailSerializer,
    PreBidConferenceSerializer,
)
from solicitations.models import Solicitation
from solicitations.serializers import SolicitationAddendumSerializer

MAX_BID_UPLOAD_SIZE = 50 * 1024 * 1024
SUPPLIER_ROLES = ('supplier_user', 'system_admin')
BID_OPENING_ROLES = ('procurement_officer', 'procurement_manager', 'system_admin')


def _get_fernet():
    key = settings.SECRET_KEY.encode()[:32]
    import base64
    return Fernet(base64.urlsafe_b64encode(key.ljust(32, b'=')[:32]))


def _encrypt_financial_envelope(file_content):
    f = _get_fernet()
    return f.encrypt(file_content)


def _decrypt_financial_envelope(encrypted_content):
    f = _get_fernet()
    return f.decrypt(encrypted_content)


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


def _bool_from_request(value):
    return value in ('true', 'True', True, '1', 1)


def _validate_upload(file_obj, label):
    if not file_obj:
        return f'{label} is required'
    if getattr(file_obj, 'size', 0) > MAX_BID_UPLOAD_SIZE:
        return f'{label} exceeds 50MB maximum file size'
    return None


def _parse_decimal(value, label, required=False):
    if value in (None, ''):
        if required:
            raise ValueError(f'{label} is required')
        return None
    try:
        parsed = Decimal(str(value))
    except (InvalidOperation, ValueError):
        raise ValueError(f'{label} must be a valid number')
    if parsed < 0:
        raise ValueError(f'{label} cannot be negative')
    return parsed


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
    if getattr(request.user, 'role', '') not in SUPPLIER_ROLES:
        return Response({'error': 'Only supplier users can submit bids'}, status=403)

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
        return Response({
            'error': 'Bid submission deadline has passed',
            'is_late': True,
            'closed_at': sol.closing_date.isoformat(),
            'server_time': now.isoformat(),
        }, status=400)

    with transaction.atomic():
        existing = BidSubmission.objects.select_for_update().filter(
            solicitation=sol, supplier=request.user
        ).exclude(status='withdrawn').first()
        if existing:
            return Response({'error': 'You have already submitted a bid for this solicitation'}, status=400)

    addenda_acknowledged = _bool_from_request(request.data.get('addenda_acknowledged', False))

    sol_addenda_count = sol.addenda.count()
    if sol_addenda_count > 0 and not addenda_acknowledged:
        return Response({'error': 'You must acknowledge all addenda before submitting'}, status=400)

    technical_file = request.FILES.get('technical_proposal')
    financial_file = request.FILES.get('financial_proposal')
    security_file = request.FILES.get('bid_security')
    zamra_file = request.FILES.get('zamra_registration')
    supporting_file = request.FILES.get('other_supporting')

    upload_errors = [
        _validate_upload(technical_file, 'Technical proposal'),
        _validate_upload(financial_file, 'Financial proposal'),
    ]
    if getattr(sol, 'bid_security_required', True):
        upload_errors.append(_validate_upload(security_file, 'Bid security'))
    for optional_file, label in (
        (zamra_file, 'ZAMRA registration'),
        (supporting_file, 'Supporting document'),
    ):
        if optional_file and optional_file.size > MAX_BID_UPLOAD_SIZE:
            upload_errors.append(f'{label} exceeds 50MB maximum file size')
    upload_errors = [err for err in upload_errors if err]
    if upload_errors:
        return Response({'error': 'Bid submission validation failed', 'details': upload_errors}, status=400)

    try:
        bid_price = _parse_decimal(request.data.get('bid_price'), 'bid_price')
        security_amount = _parse_decimal(request.data.get('security_amount'), 'security_amount')
    except ValueError as exc:
        return Response({'error': str(exc)}, status=400)

    if security_amount is not None and sol.estimated_value:
        security_pct = (security_amount / sol.estimated_value) * 100
        if security_pct < 2 or security_pct > 5:
            return Response({
                'error': f'Bid security must be between 2% and 5% of estimated value ({sol.estimated_value})',
                'security_amount': float(security_amount),
                'estimated_value': float(sol.estimated_value),
                'percentage': float(security_pct),
            }, status=400)

    if security_amount is not None and request.data.get('validity_period_days') and request.data.get('security_expiry'):
        from datetime import datetime, timedelta
        security_expiry = request.data.get('security_expiry')
        if isinstance(security_expiry, str):
            security_expiry = datetime.strptime(security_expiry[:10], '%Y-%m-%d').date()
        validity = int(request.data.get('validity_period_days', 0))
        min_expiry = now.date() + timedelta(days=validity + 28)
        if security_expiry < min_expiry:
            return Response({
                'error': f'Bid security must be valid for at least 28 days beyond bid validity period',
                'security_expiry': security_expiry.isoformat(),
                'minimum_required_expiry': min_expiry.isoformat(),
            }, status=400)

    two_envelope = getattr(sol, 'submission_format', 'single') == 'two'
    submission_id = f"BID-{now.strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"
    receipt_number = f"RCT-{now.strftime('%Y%m%d')}-{secrets.token_hex(4).upper()}"

    line_items_raw = request.data.get('line_items')
    line_items = []
    if line_items_raw:
        try:
            line_items = json.loads(line_items_raw) if isinstance(line_items_raw, str) else line_items_raw
        except (json.JSONDecodeError, TypeError):
            pass

    with transaction.atomic():
        bid = BidSubmission.objects.create(
        solicitation=sol,
        supplier=request.user,
        submission_id=submission_id,
        receipt_number=receipt_number,
        bid_price=bid_price,
        line_items=line_items,
        validity_period_days=request.data.get('validity_period_days') or None,
        security_amount=security_amount,
        security_type=request.data.get('security_type', ''),
        security_expiry=request.data.get('security_expiry') or None,
        status='submitted',
        is_late=False,
        submitted_at=now,
        addenda_acknowledged=addenda_acknowledged,
        addenda_acknowledged_at=now if addenda_acknowledged else None,
        financial_envelope_encrypted=two_envelope,
    )

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
        if two_envelope:
            enc_content = _encrypt_financial_envelope(financial_file.read())
            import io
            from django.core.files.base import ContentFile
            enc_file = ContentFile(enc_content, name=f'sealed_{financial_file.name}')
            fin_path = default_storage.save(f'bids/{bid.bid_id}/sealed_financial_{financial_file.name}', enc_file)
        else:
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

    ip = request.META.get('REMOTE_ADDR', '')
    log_audit_action(
        user=request.user, action='BID_SUBMIT', module='bids',
        record_id=str(bid.bid_id), ip_address=ip,
    )

    return Response({
        'message': 'Bid submitted successfully',
        'receipt_number': receipt_number,
        'submission_id': submission_id,
        'bid_id': str(bid.bid_id),
        'submitted_at': now.isoformat(),
        'financial_envelope_encrypted': two_envelope,
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
    try:
        file_content = default_storage.open(doc.file_path).read()
        decrypted = _decrypt_financial_envelope(file_content)
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
    """Step 1: Create bid opening session without opening bids"""
    if getattr(request.user, 'role', '') not in BID_OPENING_ROLES:
        return Response({'error': 'Only procurement officers can start bid openings'}, status=403)

    try:
        sol = Solicitation.objects.get(pk=pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    if sol.status not in ('closed', 'published'):
        return Response({'error': 'Only published or closed solicitations can be opened'}, status=400)

    now = timezone.now()
    opening_time = _parse_request_datetime(request.data.get('scheduled_opening_time')) or sol.opening_date or sol.closing_date
    if opening_time and opening_time > now:
        return Response({
            'error': 'Bid opening cannot start before the scheduled opening time',
            'scheduled_opening_time': opening_time.isoformat(),
            'server_time': now.isoformat(),
        }, status=400)

    if BidOpening.objects.filter(solicitation=sol, status='in_progress').exists():
        return Response({'error': 'An opening session is already in progress'}, status=400)

    bids = BidSubmission.objects.filter(solicitation=sol, status='submitted').order_by('submitted_at')
    if not bids.exists():
        return Response({'error': 'No bids to open'}, status=400)

    # Resolve witness UUIDs to structured data (name, role, id)
    raw_witnesses = request.data.get('witnesses', [])
    resolved_witnesses = []
    for w in raw_witnesses:
        if isinstance(w, dict):
            resolved_witnesses.append(w)
        elif isinstance(w, str):
            try:
                user = User.objects.get(pk=w)
                resolved_witnesses.append({
                    'id': str(user.pk),
                    'name': user.full_name,
                    'role': user.role,
                })
            except User.DoesNotExist:
                resolved_witnesses.append({'id': w, 'name': w, 'role': 'Witness'})
        else:
            resolved_witnesses.append(w)

    opening = BidOpening.objects.create(
        solicitation=sol,
        conducted_by=request.user,
        status='in_progress',
        started_at=timezone.now(),
        scheduled_opening_time=opening_time,
        location=request.data.get('location', 'ZAMMSA Boardroom, Lusaka / Virtual'),
        public_live_link=request.data.get('public_live_link', f'https://portal.zammsa.gov.zm/opening/{sol.sol_number}-live'),
        viewers_connected=int(request.data.get('viewers_connected', 0) or 0),
        witnesses=resolved_witnesses,
        witness_signatures=request.data.get('witness_signatures', []),
        observations=request.data.get('observations', ''),
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

    financial_sealed = _bool_from_request(request.data.get(
        'financial_sealed',
        getattr(opening.solicitation, 'submission_format', 'single') == 'two',
    ))

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
    """Generate/download bid opening minutes"""
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
    """Finalize bid opening: save observations, sign, generate minutes, email bidders, mark completed"""
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
    """Resend final bid opening minutes to all bidders without mutating the opening."""
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
    """Track a viewer connecting to the public bid opening"""
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
