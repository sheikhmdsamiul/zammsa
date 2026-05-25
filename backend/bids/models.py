import uuid
from django.db import models
from django.utils import timezone
from accounts.models import User
from solicitations.models import Solicitation

BID_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('submitted', 'Submitted'),
    ('opened', 'Opened'),
    ('responsive', 'Responsive'),
    ('non_responsive', 'Non-Responsive'),
    ('withdrawn', 'Withdrawn'),
    ('awarded', 'Awarded'),
]

BID_SECURITY_TYPE_CHOICES = [
    ('bank_guarantee', 'Bank Guarantee'),
    ('surety_bond', 'Surety Bond'),
    ('cash_deposit', 'Cash Deposit'),
]

SECURITY_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('verified', 'Verified'),
    ('rejected', 'Rejected'),
]

BID_DOCUMENT_TYPE_CHOICES = [
    ('technical_proposal', 'Technical Proposal'),
    ('financial_proposal', 'Financial Proposal'),
    ('bid_security', 'Bid Security'),
    ('other', 'Other'),
]


class BidSubmission(models.Model):
    bid_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    submission_id = models.CharField(max_length=50, unique=True)
    receipt_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='bids')
    supplier = models.ForeignKey(User, on_delete=models.CASCADE, related_name='bid_submissions')
    submission_timestamp = models.DateTimeField(auto_now_add=True)
    bid_price = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='ZMW')
    validity_period_days = models.IntegerField(null=True, blank=True)
    security_amount = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    security_type = models.CharField(max_length=50, blank=True, default='')
    security_expiry = models.DateField(null=True, blank=True)
    security_verified = models.BooleanField(default=False)
    submission_method = models.CharField(max_length=20, default='online')
    status = models.CharField(max_length=20, choices=BID_STATUS_CHOICES, default='submitted')
    is_late = models.BooleanField(default=False)
    technical_doc_url = models.URLField(blank=True)
    financial_doc_url = models.URLField(blank=True, help_text='Encrypted financial document URL')
    financial_envelope_encrypted = models.BooleanField(default=False)
    addenda_acknowledged = models.BooleanField(default=False)
    addenda_acknowledged_at = models.DateTimeField(null=True, blank=True)
    submitted_at = models.DateTimeField(auto_now_add=True)
    opened_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'bid_submission'
        verbose_name = 'Bid Submission'
        verbose_name_plural = 'Bid Submissions'
        ordering = ['-submission_timestamp']
        unique_together = ('solicitation', 'supplier')

    def __str__(self):
        return f'{self.submission_id or self.receipt_number} - {self.supplier.full_name}'


class BidDocument(models.Model):
    document_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='bid_documents')
    document_type = models.CharField(max_length=50, choices=BID_DOCUMENT_TYPE_CHOICES)
    file_path = models.CharField(max_length=500)
    uploaded_at = models.DateTimeField(default=timezone.now)

    class Meta:
        db_table = 'bid_document'
        verbose_name = 'Bid Document'
        verbose_name_plural = 'Bid Documents'

    def __str__(self):
        return f'{self.bid.submission_id} - {self.get_document_type_display()}'


class BidSecurity(models.Model):
    security_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='bid_securities')
    security_type = models.CharField(max_length=50, choices=BID_SECURITY_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    issuing_institution = models.CharField(max_length=255)
    reference_number = models.CharField(max_length=100)
    validity_date = models.DateField()
    verification_status = models.CharField(max_length=20, choices=SECURITY_STATUS_CHOICES, default='pending')

    class Meta:
        db_table = 'bid_security'
        verbose_name = 'Bid Security'
        verbose_name_plural = 'Bid Securities'

    def __str__(self):
        return f'{self.bid.submission_id} - {self.security_type}'


class PreBidConference(models.Model):
    conference_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='pre_bid_conferences')
    scheduled_date = models.DateTimeField()
    location = models.CharField(max_length=255)
    attendance_list = models.JSONField(default=list)
    minutes_file_path = models.CharField(max_length=500, blank=True)

    class Meta:
        db_table = 'bid_pre_bid_conference'
        verbose_name = 'Pre-Bid Conference'
        verbose_name_plural = 'Pre-Bid Conferences'

    def __str__(self):
        return f'{self.solicitation.sol_number} - {self.scheduled_date}'


OPENING_STATUS_CHOICES = [
    ('scheduled', 'Scheduled'),
    ('in_progress', 'In Progress'),
    ('completed', 'Completed'),
]


class BidOpening(models.Model):
    opening_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='bid_openings')
    opened_at = models.DateTimeField(default=timezone.now)
    conducted_by = models.ForeignKey(User, on_delete=models.CASCADE)
    status = models.CharField(max_length=20, choices=OPENING_STATUS_CHOICES, default='scheduled')
    scheduled_opening_time = models.DateTimeField(null=True, blank=True)
    started_at = models.DateTimeField(null=True, blank=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    public_live_link = models.CharField(max_length=255, blank=True, default='')
    viewers_connected = models.IntegerField(default=0)
    minutes_file_path = models.CharField(max_length=500, blank=True)
    observations = models.TextField(blank=True, default='')
    witnesses = models.JSONField(default=list)
    witness_signatures = models.JSONField(default=list, blank=True,
        help_text='List of {name, role, signed_at, signature_ref}')

    class Meta:
        db_table = 'bid_opening'
        verbose_name = 'Bid Opening'
        verbose_name_plural = 'Bid Openings'
        ordering = ['-opened_at']

    def __str__(self):
        return f'Opening {self.solicitation.sol_number} at {self.opened_at}'


class BidOpeningDetail(models.Model):
    detail_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    opening = models.ForeignKey(BidOpening, on_delete=models.CASCADE, related_name='opening_details')
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE)
    opened_sequence = models.IntegerField()
    is_opened = models.BooleanField(default=False)
    opened_at = models.DateTimeField(null=True, blank=True)
    bidder_name = models.CharField(max_length=255, blank=True, default='')
    price_read = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    security_amount_read = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    security_verified_read = models.BooleanField(default=False)
    financial_sealed = models.BooleanField(default=True,
        help_text='True = financial envelope not yet opened (two-envelope system)')
    objections = models.TextField(blank=True)

    class Meta:
        db_table = 'bid_opening_detail'
        verbose_name = 'Bid Opening Detail'
        verbose_name_plural = 'Bid Opening Details'
        ordering = ['opened_sequence']

    def __str__(self):
        return f'{self.opening.opening_id} - Seq {self.opened_sequence}'
