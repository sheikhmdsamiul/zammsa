import uuid
import secrets
import json
import hashlib
import base64
import io
import mimetypes
from datetime import datetime, timedelta
from decimal import Decimal, InvalidOperation

from django.db import transaction
from django.utils import timezone
from django.conf import settings
from django.core.files.base import ContentFile
from django.core.files.storage import default_storage
from cryptography.fernet import Fernet

from .models import (
    BidSubmission, BidDocument, BidSecurity,
    BID_STATUS_CHOICES, BID_DOCUMENT_TYPE_CHOICES,
)
from accounts.audit import log_audit_action
from accounts.models import User
from solicitations.models import Solicitation
from system_config.notifications import create_notification

MAX_BID_UPLOAD_SIZE = 50 * 1024 * 1024

ALLOWED_MIME_MAP = {
    'application/pdf': {'.pdf'},
    'application/msword': {'.doc'},
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document': {'.docx'},
    'application/vnd.ms-excel': {'.xls'},
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet': {'.xlsx'},
    'image/jpeg': {'.jpg', '.jpeg'},
    'image/png': {'.png'},
    'application/zip': {'.zip'},
}

ALLOWED_EXTENSIONS = set()
for exts in ALLOWED_MIME_MAP.values():
    ALLOWED_EXTENSIONS.update(exts)

SUPPLIER_ROLES = ('supplier_user', 'system_admin')

FERNET_CACHE = {}


def _get_fernet():
    if 'instance' not in FERNET_CACHE:
        key = settings.SECRET_KEY.encode()[:32]
        FERNET_CACHE['instance'] = Fernet(base64.urlsafe_b64encode(key.ljust(32, b'=')[:32]))
    return FERNET_CACHE['instance']


def encrypt_financial_envelope(file_content):
    return _get_fernet().encrypt(file_content)


def decrypt_financial_envelope(encrypted_content):
    return _get_fernet().decrypt(encrypted_content)


def validate_mime_type(file_obj):
    if not file_obj:
        return None
    ext = f'.{file_obj.name.split(".")[-1].lower()}' if '.' in file_obj.name else ''
    if ext not in ALLOWED_EXTENSIONS:
        return f'File type "{ext}" is not allowed. Allowed: {", ".join(sorted(ALLOWED_EXTENSIONS))}'

    magic = file_obj.read(16)
    file_obj.seek(0)
    detected_mime, _ = mimetypes.guess_type(file_obj.name)
    if not detected_mime:
        return None
    if detected_mime in ALLOWED_MIME_MAP:
        return None
    return f'File content does not match expected MIME type for "{ext}"'


def compute_file_hash(file_obj):
    hasher = hashlib.sha256()
    for chunk in file_obj.chunks():
        hasher.update(chunk)
    file_obj.seek(0)
    return hasher.hexdigest()


class BidValidationService:
    @staticmethod
    def validate_solicitation(sol_id, user):
        try:
            sol = Solicitation.objects.get(pk=sol_id)
        except Solicitation.DoesNotExist:
            return None, {'error': 'Solicitation not found'}

        if sol.status != 'published':
            return None, {'error': 'Solicitation is not open for bids'}

        now = timezone.now()
        if sol.closing_date < now:
            return None, {
                'error': 'Bid submission deadline has passed',
                'is_late': True,
                'closed_at': sol.closing_date.isoformat(),
                'server_time': now.isoformat(),
            }
        return sol, None

    @staticmethod
    def check_existing_bid(sol, user):
        with transaction.atomic():
            existing = BidSubmission.objects.select_for_update().filter(
                solicitation=sol, supplier=user
            ).exclude(status='withdrawn').first()
            if existing:
                return {'error': 'You have already submitted a bid for this solicitation'}
        return None

    @staticmethod
    def parse_decimal(value, label, required=False):
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

    @staticmethod
    def validate_security_amount(security_amount, estimated_value):
        if security_amount is not None and estimated_value:
            security_pct = (security_amount / estimated_value) * 100
            if security_pct < 2 or security_pct > 5:
                return {
                    'error': f'Bid security must be between 2% and 5% of estimated value ({estimated_value})',
                    'security_amount': float(security_amount),
                    'estimated_value': float(estimated_value),
                    'percentage': float(security_pct),
                }
        return None

    @staticmethod
    def validate_security_expiry(security_expiry, validity_days):
        if security_expiry and validity_days:
            if isinstance(security_expiry, str):
                security_expiry = datetime.strptime(security_expiry[:10], '%Y-%m-%d').date()
            min_expiry = timezone.now().date() + timedelta(days=int(validity_days) + 28)
            if security_expiry < min_expiry:
                return {
                    'error': 'Bid security must be valid for at least 28 days beyond bid validity period',
                    'security_expiry': security_expiry.isoformat(),
                    'minimum_required_expiry': min_expiry.isoformat(),
                }
        return None


class BidDocumentService:
    @staticmethod
    def validate_upload(file_obj, label, required=False):
        if not file_obj:
            if required:
                return f'{label} is required'
            return None
        if getattr(file_obj, 'size', 0) > MAX_BID_UPLOAD_SIZE:
            return f'{label} exceeds 50MB maximum file size'
        mime_error = validate_mime_type(file_obj)
        if mime_error:
            return f'{label}: {mime_error}'
        return None

    @staticmethod
    def save_document(bid, document_type, file_obj, subfolder=''):
        if not file_obj:
            return None
        file_hash = compute_file_hash(file_obj)
        mime_type, _ = mimetypes.guess_type(file_obj.name)
        subpath = f'bids/{bid.bid_id}'
        if subfolder:
            subpath = f'{subpath}/{subfolder}'
        file_path = default_storage.save(f'{subpath}/{document_type}_{file_obj.name}', file_obj)
        doc = BidDocument.objects.create(
            bid=bid,
            document_type=document_type,
            file_path=file_path,
            file_size=file_obj.size,
            mime_type=mime_type or '',
            file_hash=file_hash,
        )
        return doc

    @staticmethod
    def save_financial_document(bid, file_obj, two_envelope):
        if not file_obj:
            return None
        file_hash = compute_file_hash(file_obj)
        mime_type, _ = mimetypes.guess_type(file_obj.name)
        subpath = f'bids/{bid.bid_id}'
        if two_envelope:
            enc_content = encrypt_financial_envelope(file_obj.read())
            enc_file = ContentFile(enc_content, name=f'sealed_{file_obj.name}')
            file_path = default_storage.save(f'{subpath}/sealed_financial_{file_obj.name}', enc_file)
        else:
            file_path = default_storage.save(f'{subpath}/financial_{file_obj.name}', file_obj)
        doc = BidDocument.objects.create(
            bid=bid,
            document_type='financial_proposal',
            file_path=file_path,
            file_size=file_obj.size,
            mime_type=mime_type or '',
            file_hash=file_hash,
        )
        return doc


class BidSubmissionService:
    @staticmethod
    def submit_bid(request):
        user = request.user
        if getattr(user, 'role', '') not in SUPPLIER_ROLES:
            return {'error': 'Only supplier users can submit bids'}, 403

        sol_id = request.data.get('solicitation_id') or request.data.get('solicitation')
        if not sol_id:
            return {'error': 'solicitation_id is required'}, 400

        sol, error = BidValidationService.validate_solicitation(sol_id, user)
        if error:
            return error, 400

        existing_error = BidValidationService.check_existing_bid(sol, user)
        if existing_error:
            return existing_error, 400

        addenda_acknowledged = request.data.get('addenda_acknowledged') in ('true', 'True', True, '1', 1)
        sol_addenda_count = sol.addenda.count()
        if sol_addenda_count > 0 and not addenda_acknowledged:
            return {'error': 'You must acknowledge all addenda before submitting'}, 400

        # Validate documents
        doc_map = {
            'technical_proposal': ('Technical proposal', True),
            'financial_proposal': ('Financial proposal', True),
            'bid_security': ('Bid security', getattr(sol, 'bid_security_required', True)),
            'zamra_registration': ('ZAMRA registration', False),
            'other_supporting': ('Other supporting documents', False),
        }

        upload_errors = []
        files = {}
        for field_key, (label, required) in doc_map.items():
            file_obj = request.FILES.get(field_key)
            err = BidDocumentService.validate_upload(file_obj, label, required=required)
            if err:
                upload_errors.append(err)
            files[field_key] = file_obj

        if upload_errors:
            return {'error': 'Bid submission validation failed', 'details': upload_errors}, 400

        try:
            bid_price = BidValidationService.parse_decimal(request.data.get('bid_price'), 'bid_price')
            security_amount = BidValidationService.parse_decimal(request.data.get('security_amount'), 'security_amount')
        except ValueError as exc:
            return {'error': str(exc)}, 400

        security_error = BidValidationService.validate_security_amount(security_amount, sol.estimated_value)
        if security_error:
            return security_error, 400

        expiry_error = BidValidationService.validate_security_expiry(
            request.data.get('security_expiry'),
            request.data.get('validity_period_days'),
        )
        if expiry_error:
            return expiry_error, 400

        two_envelope = getattr(sol, 'submission_format', 'single') == 'two'
        now = timezone.now()

        line_items_raw = request.data.get('line_items')
        line_items = []
        if line_items_raw:
            try:
                line_items = json.loads(line_items_raw) if isinstance(line_items_raw, str) else line_items_raw
            except (json.JSONDecodeError, TypeError):
                pass

        ip = request.META.get('REMOTE_ADDR', '')

        with transaction.atomic():
            bid = BidSubmission.objects.create(
                solicitation=sol,
                supplier=user,
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
                submitted_from_ip=ip or None,
                lot_number=request.data.get('lot_number', ''),
                joint_venture_name=request.data.get('joint_venture_name', ''),
                joint_venture_partners=request.data.get('joint_venture_partners', []),
            )

            BidDocumentService.save_document(bid, 'technical_proposal', files['technical_proposal'])
            BidDocumentService.save_financial_document(bid, files['financial_proposal'], two_envelope)

            if files.get('bid_security'):
                BidDocumentService.save_document(bid, 'bid_security', files['bid_security'])

            if files.get('zamra_registration'):
                BidDocumentService.save_document(bid, 'zamra_registration', files['zamra_registration'])

            if files.get('other_supporting'):
                BidDocumentService.save_document(bid, 'other', files['other_supporting'])

        log_audit_action(
            user=user, action='BID_SUBMIT', module='bids',
            record_id=str(bid.bid_id), ip_address=ip,
        )

        return {
            'message': 'Bid submitted successfully',
            'receipt_number': bid.receipt_number,
            'submission_id': bid.submission_id,
            'bid_id': str(bid.bid_id),
            'submitted_at': now.isoformat(),
            'financial_envelope_encrypted': two_envelope,
            'documents_uploaded': {
                'technical_proposal': files['technical_proposal'] is not None,
                'financial_proposal': files['financial_proposal'] is not None,
                'bid_security': files.get('bid_security') is not None,
                'zamra_registration': files.get('zamra_registration') is not None,
                'other_supporting': files.get('other_supporting') is not None,
            },
        }, 201

    @staticmethod
    def withdraw_bid(bid, user, reason=''):
        if bid.status in ('withdrawn', 'awarded'):
            return {'error': f'Bid cannot be withdrawn in status: {bid.status}'}, 400
        if bid.opened_at:
            return {'error': 'Bid cannot be withdrawn after opening'}, 400

        bid.status = 'withdrawn'
        bid.save(update_fields=['status'])

        log_audit_action(
            user=user, action='BID_WITHDRAW', module='bids',
            record_id=str(bid.bid_id),
            new_value={'status': 'withdrawn', 'reason': reason},
        )
        return {'message': 'Bid withdrawn successfully'}, 200

    @staticmethod
    def modify_bid(bid, user, data):
        if bid.status not in ('submitted', 'modified'):
            return {'error': 'Only submitted bids can be modified'}, 400

        reason = data.get('modification_reason', '')
        notes = data.get('modification_notes', '')
        if not reason:
            return {'error': 'modification_reason is required'}, 400

        with transaction.atomic():
            old_bid = BidSubmission.objects.select_for_update().get(pk=bid.pk)
            if old_bid.status not in ('submitted', 'modified'):
                return {'error': 'Bid has been processed and cannot be modified'}, 400

            new_bid = BidSubmission.objects.create(
                solicitation=bid.solicitation,
                supplier=bid.supplier,
                bid_price=data.get('bid_price', bid.bid_price),
                line_items=data.get('line_items', bid.line_items),
                validity_period_days=data.get('validity_period_days', bid.validity_period_days),
                security_amount=data.get('security_amount', bid.security_amount),
                security_type=data.get('security_type', bid.security_type),
                security_expiry=data.get('security_expiry', bid.security_expiry),
                status='submitted',
                addenda_acknowledged=bid.addenda_acknowledged,
                financial_envelope_encrypted=bid.financial_envelope_encrypted,
                submitted_from_ip=bid.submitted_from_ip,
                lot_number=bid.lot_number,
                joint_venture_name=bid.joint_venture_name,
                joint_venture_partners=bid.joint_venture_partners,
                modification_reason=reason,
                modification_notes=notes,
                parent_bid=bid,
                version=bid.version + 1,
            )

            old_bid.status = 'modified'
            old_bid.save(update_fields=['status'])

            for doc in BidDocument.objects.filter(bid=bid):
                doc.bid = new_bid
                doc.save()

        log_audit_action(
            user=user, action='BID_MODIFY', module='bids',
            record_id=str(new_bid.bid_id),
            old_value={'bid_id': str(bid.bid_id)},
            new_value={'reason': reason, 'notes': notes},
        )

        return {
            'message': 'Bid modified successfully',
            'bid_id': str(new_bid.bid_id),
            'version': new_bid.version,
        }, 200


class BidOpeningService:
    @staticmethod
    def start_opening(solicitation, conducted_by, data):
        from .models import BidOpening, BidOpeningDetail

        if solicitation.status not in ('closed', 'published'):
            return {'error': 'Only published or closed solicitations can be opened'}, 400

        now = timezone.now()
        opening_time = data.get('scheduled_opening_time') or solicitation.opening_date or solicitation.closing_date
        if opening_time and opening_time > now:
            return {
                'error': 'Bid opening cannot start before the scheduled opening time',
                'scheduled_opening_time': opening_time.isoformat(),
                'server_time': now.isoformat(),
            }, 400

        from .models import BidOpening as BO
        if BO.objects.filter(solicitation=solicitation, status='in_progress').exists():
            return {'error': 'An opening session is already in progress'}, 400

        bids = BidSubmission.objects.filter(solicitation=solicitation, status='submitted').order_by('submitted_at')
        if not bids.exists():
            return {'error': 'No bids to open'}, 400

        opening = BO.objects.create(
            solicitation=solicitation,
            conducted_by=conducted_by,
            status='in_progress',
            started_at=timezone.now(),
            scheduled_opening_time=opening_time,
            location=data.get('location', 'ZAMMSA Boardroom, Lusaka / Virtual'),
            public_live_link=data.get('public_live_link', ''),
            viewers_connected=int(data.get('viewers_connected', 0) or 0),
            witnesses=data.get('witnesses', []),
            witness_signatures=data.get('witness_signatures', []),
            observations=data.get('observations', ''),
        )

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

        log_audit_action(
            user=conducted_by, action='BID_OPENING_START', module='bids',
            record_id=str(opening.opening_id),
        )

        return {
            'message': 'Bid opening session started',
            'opening_id': str(opening.opening_id),
            'total_bids': bids.count(),
        }, 201
