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


class SolicitationTemplate(models.Model):
    template_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_name = models.CharField(max_length=255)
    method = models.CharField(max_length=50)
    document_type = models.CharField(max_length=50)
    template_content = models.TextField()
    mandatory_clauses = models.JSONField(default=list, blank=True)  # [{clause_id, clause_text, is_locked}]
    is_zppa_template = models.BooleanField(default=False)
    version = models.CharField(max_length=20, default='1.0')
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'sol_template'
        verbose_name = 'Solicitation Template'
        verbose_name_plural = 'Solicitation Templates'

    def __str__(self):
        return f'{self.template_name} v{self.version}'


class Solicitation(models.Model):
    solicitation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    sol_number = models.CharField(max_length=50, unique=True)
    requisition = models.ForeignKey(Requisition, on_delete=models.PROTECT, related_name='solicitations', null=True, blank=True)
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
    publication_targets = models.JSONField(default=list, blank=True)  # ['zammsa_website', 'egp_portal', 'email_suppliers']
    publication_proofs = models.JSONField(default=dict, blank=True)  # {target: {url, timestamp, proof_file}}
    egp_reference = models.CharField(max_length=255, blank=True, default='')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='created_solicitations')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_solicitations')
    rejected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='rejected_solicitations')
    rejection_reason = models.TextField(blank=True, default='')
    rejected_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

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

    def __str__(self):
        return f'{self.sol_number} - {self.title}'


class EvaluationCriterion(models.Model):
    criterion_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='evaluation_criteria')
    criterion_name = models.CharField(max_length=255)
    criterion_type = models.CharField(max_length=20, choices=CRITERION_TYPE_CHOICES)
    weight = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    minimum_threshold = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    order_index = models.IntegerField(default=0)

    class Meta:
        db_table = 'sol_evaluation_criterion'
        verbose_name = 'Evaluation Criterion'
        verbose_name_plural = 'Evaluation Criteria'
        ordering = ['order_index']

    def __str__(self):
        return f'{self.criterion_name} ({self.criterion_type})'


class SolicitationAddendum(models.Model):
    addendum_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='addenda')
    addendum_number = models.IntegerField()
    description = models.TextField()
    reason = models.TextField(blank=True)
    extended_closing_date = models.DateTimeField(null=True, blank=True)
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
    file_path = models.CharField(max_length=500)
    is_public = models.BooleanField(default=True)
    fee_amount = models.DecimalField(max_digits=15, decimal_places=2, default=0)

    class Meta:
        db_table = 'sol_document'
        verbose_name = 'Solicitation Document'
        verbose_name_plural = 'Solicitation Documents'

    def __str__(self):
        return f'{self.solicitation.sol_number} - {self.document_type}'
