import uuid
from django.db import models
from django.db.models import F, Q
from django.utils import timezone
from accounts.models import User
from requisitions.models import Requisition
from master_data.models import Department, DocumentTemplate

SOL_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('pending_approval', 'Pending Approval'),
    ('approved', 'Approved'),
    ('published', 'Published'),
    ('closed', 'Closed'),
    ('awarded', 'Awarded'),
    ('cancelled', 'Cancelled'),
]

CRITERION_TYPE_CHOICES = [
    ('mandatory', 'Mandatory'),
    ('technical', 'Technical'),
    ('financial', 'Financial'),
]

DOCUMENT_TYPE_CHOICES = [
    ('bidding_document', 'Bidding Document'),
    ('specification', 'Specification'),
    ('addendum', 'Addendum'),
    ('clarification', 'Clarification'),
    ('minutes', 'Minutes'),
    ('other', 'Other'),
]

TEMPLATE_TYPE_CHOICES = [
    ('itb', 'Invitation to Bid (ITB)'),
    ('rfp', 'Request for Proposal (RFP)'),
    ('rfq', 'Request for Quotation (RFQ)'),
]

PROCUREMENT_TYPE_CHOICES = [
    ('goods', 'Goods'),
    ('works', 'Works'),
    ('consulting', 'Consulting Services'),
    ('non_consulting', 'Non-Consulting Services'),
]


class SolicitationTemplate(models.Model):
    template_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_name = models.CharField(max_length=255)
    
    # SRS FR-SOL-01: ZPPA-approved templates for ITB, RFP, RFQ
    template_type = models.CharField(max_length=10, choices=TEMPLATE_TYPE_CHOICES, default='itb')
    procurement_type = models.CharField(max_length=20, choices=PROCUREMENT_TYPE_CHOICES, default='goods')
    method = models.CharField(max_length=50, blank=True, help_text='Specific procurement method (e.g. open_tender)')
    
    document_type = models.CharField(max_length=50, default='bidding_document')
    template_content = models.TextField()
    
    # SRS FR-SOL-02: Mandatory clauses SHALL be read-only and cannot be modified
    mandatory_clauses = models.JSONField(default=list, blank=True, 
        help_text='[{"clause_id": "GC.1", "clause_text": "...", "is_locked": true}] (FR-SOL-02)')
    is_zppa_template = models.BooleanField(default=True,
        help_text='Indicates if this is a standard ZPPA-approved template')
    
    version = models.CharField(max_length=20, default='1.0')
    is_active = models.BooleanField(default=True)
    
    template_description = models.TextField(blank=True, default='')
    applicable_value_range = models.JSONField(default=dict, blank=True, 
        help_text='Min/max value range where this template applies: {"min": 0, "max": 1000000}')
    requires_cpp = models.BooleanField(default=True,
        help_text='Whether this template requires an approved CPP')
    auto_populate_fields = models.JSONField(default=list, blank=True,
        help_text='List of fields to auto-populate from CPP: ["method", "estimated_value", "procurement_strategy"]')
    
    # Fix for makemigrations error: use default=timezone.now instead of auto_now_add
    created_at = models.DateTimeField(default=timezone.now)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sol_template'
        verbose_name = 'Solicitation Template'
        verbose_name_plural = 'Solicitation Templates'
        ordering = ['template_name', 'version']

    def __str__(self):
        return f'{self.template_name} v{self.version} ({self.get_template_type_display()})'


class Solicitation(models.Model):
    solicitation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sol_number = models.CharField(max_length=50, unique=True)
    requisition = models.ForeignKey(Requisition, on_delete=models.PROTECT, related_name='solicitations', null=True, blank=True)
    cpp = models.ForeignKey(
        'procurement_planning.ContractProcurementPlan',
        on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='solicitations',
        help_text='The approved CPP under which this solicitation is created',
    )
    title = models.CharField(max_length=255)
    description = models.TextField()
    method = models.CharField(max_length=50)
    estimated_value = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    currency = models.CharField(max_length=10, default='ZMW')
    budget_code = models.CharField(max_length=100, blank=True, default='')
    issue_date = models.DateField(null=True, blank=True)
    department = models.ForeignKey(Department, on_delete=models.SET_NULL, null=True, blank=True)
    closing_date = models.DateTimeField()
    opening_date = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=50, choices=SOL_STATUS_CHOICES, default='draft')
    published_at = models.DateTimeField(null=True, blank=True)
    publication_targets = models.JSONField(default=list, blank=True)
    publication_proofs = models.JSONField(default=dict, blank=True)
    egp_reference = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_solicitations')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_solicitations')
    rejected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_solicitations')
    rejection_reason = models.TextField(blank=True, default='')
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    # Fields added for complete solicitation detail
    submission_format = models.CharField(max_length=10, choices=[('single', 'Single Envelope'), ('two', 'Two Envelope')], default='single')
    bid_validity_days = models.IntegerField(default=90)
    pre_bid_date = models.DateField(null=True, blank=True)
    pre_bid_venue = models.CharField(max_length=255, blank=True, default='')
    citizen_preference = models.BooleanField(default=True)
    bid_security_required = models.BooleanField(default=True)
    bid_security_type = models.CharField(max_length=50, blank=True, default='bank_guarantee')
    bid_security_rate = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    contact_person = models.CharField(max_length=255, blank=True, default='')
    contact_phone = models.CharField(max_length=50, blank=True, default='')
    contact_email = models.EmailField(max_length=255, blank=True, default='')
    minimum_technical_threshold = models.IntegerField(null=True, blank=True)
    clarification_cutoff = models.DateTimeField(null=True, blank=True,
        help_text='Deadline for suppliers to submit clarification requests (≥5 working days before closing)')
    document_fee_enabled = models.BooleanField(default=False)
    document_fee_amount = models.DecimalField(max_digits=15, decimal_places=2, null=True, blank=True)
    evaluation_method = models.CharField(max_length=20, blank=True, default='lowest_price',
        choices=[
            ('lowest_price', 'Lowest Evaluated Price'),
            ('qcbs', 'QCBS — Quality and Cost Based Selection'),
            ('qbs', 'QBS — Quality Based Selection'),
            ('lcs', 'LCS — Least Cost Selection'),
            ('fbs', 'FBS — Fixed Budget Selection'),
        ],
        help_text='Evaluation methodology used for bid scoring and ranking')
    financial_weight = models.IntegerField(null=True, blank=True,
        help_text='Weight of financial score in QCBS combined scoring (e.g. 20 = 80:20 quality:cost)')

    class Meta:
        db_table = 'sol_solicitation'
        verbose_name = 'Solicitation'
        verbose_name_plural = 'Solicitations'
        ordering = ['-created_at']
        constraints = [
            models.CheckConstraint(
                check=~Q(created_by=F('approved_by')),
                name='sol_no_self_approval',
            ),
        ]

    def save(self, *args, **kwargs):
        if not self.sol_number:
            from zammsa_backend.utils import generate_traceable_id, resolve_solicitation_context

            dept, fiscal_year = resolve_solicitation_context(self)
            self.sol_number = generate_traceable_id('SOL', dept, Solicitation, 'sol_number', fiscal_year)
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.sol_number} - {self.title}'


class EvaluationCriterion(models.Model):
    criterion_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='evaluation_criteria')
    criterion_name = models.CharField(max_length=255)
    criterion_type = models.CharField(max_length=20, choices=CRITERION_TYPE_CHOICES)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    max_score = models.DecimalField(max_digits=5, decimal_places=2, default=100,
        help_text='Maximum possible score for this criterion (default: 100)')
    scoring_guidance = models.TextField(blank=True, default='',
        help_text='Detailed guidance shown to evaluators during scoring')
    minimum_threshold = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    order_index = models.IntegerField(default=0)

    class Meta:
        db_table = 'sol_evaluation_criterion'
        verbose_name = 'Evaluation Criterion'
        verbose_name_plural = 'Evaluation Criteria'
        ordering = ['order_index']

    def __str__(self):
        return f'{self.criterion_name} ({self.criterion_type})'


ADDENDUM_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('pending_approval', 'Pending Approval'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]


class SolicitationAddendum(models.Model):
    addendum_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='addenda')
    addendum_number = models.IntegerField()
    description = models.TextField()
    reason = models.TextField(blank=True)
    original_text = models.TextField(blank=True, default='',
        help_text='The original text being amended (section reference)')
    revised_text = models.TextField(blank=True, default='',
        help_text='The revised/replacement text')
    extended_closing_date = models.DateTimeField(null=True, blank=True)
    addendum_status = models.CharField(max_length=30, choices=ADDENDUM_STATUS_CHOICES, default='pending_approval')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_addenda')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sol_addendum'
        verbose_name = 'Solicitation Addendum'
        verbose_name_plural = 'Solicitation Addenda'
        ordering = ['-addendum_number']
        unique_together = ('solicitation', 'addendum_number')

    def __str__(self):
        return f'{self.solicitation.sol_number} - Addendum {self.addendum_number}'


class ClarificationRequest(models.Model):
    clarification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='clarifications')
    supplier = models.ForeignKey(User, on_delete=models.CASCADE)
    question = models.TextField()
    answer = models.TextField(blank=True)
    is_public = models.BooleanField(default=True)
    asked_at = models.DateTimeField(auto_now_add=True)
    answered_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'sol_clarification'
        verbose_name = 'Clarification Request'
        verbose_name_plural = 'Clarification Requests'
        ordering = ['-asked_at']

    def __str__(self):
        return f'Clarification {self.clarification_id}'[:30]


class SolicitationDocument(models.Model):
    document_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    file = models.FileField(upload_to='solicitation_documents/', blank=True, null=True,
        help_text='Uploaded solicitation document file')
    file_path = models.CharField(max_length=500, blank=True, default='',
        help_text='Legacy path/name reference')
    is_public = models.BooleanField(default=True)
    fee_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        db_table = 'sol_document'
        verbose_name = 'Solicitation Document'
        verbose_name_plural = 'Solicitation Documents'

    def __str__(self):
        return f'{self.solicitation.sol_number} - {self.document_type}'
