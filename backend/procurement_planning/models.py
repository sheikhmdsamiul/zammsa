import uuid
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords
from accounts.models import User
from master_data.models import FiscalYear, Department, Commodity, FundingSource

APP_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('dept_head_review', 'Department Head Review'),
    ('procurement_review', 'Procurement Review'),
    ('director_review', 'Director of Procurement Review'),
    ('zpc_review', 'ZPC Review'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('published', 'Published'),
]

APP_ACTION_CHOICES = [
    ('submitted', 'Submitted'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('returned', 'Returned for Revision'),
    ('published', 'Published'),
]

CPP_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('pending_zpc', 'Pending ZPC Approval'),
    ('approved', 'Approved'),
    ('rejected', 'Returned for Revision'),
    ('active', 'Active (Procurement In Progress)'),
    ('amended', 'Amended'),
    ('completed', 'Completed'),
    ('archived', 'Archived'),
    ('cancelled', 'Cancelled'),
]

GPN_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('published', 'Published'),
    ('archived', 'Archived'),
]


class AnnualProcurementPlan(models.Model):
    app_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    fiscal_year = models.ForeignKey(FiscalYear, on_delete=models.PROTECT)
    department = models.ForeignKey(Department, on_delete=models.PROTECT)
    status = models.CharField(max_length=50, choices=APP_STATUS_CHOICES, default='draft')
    total_estimated_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)

    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='app_submissions')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='app_approvals')
    approved_at = models.DateTimeField(null=True, blank=True)

    rejection_reason = models.TextField(blank=True, default='')
    rejected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='app_rejections')
    rejected_at = models.DateTimeField(null=True, blank=True)

    compliance_notes = models.TextField(blank=True, default='')
    is_consolidated = models.BooleanField(default=False)
    consolidated_into = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='consolidated_from')
    consolidation_notes = models.TextField(blank=True, default='')

    zpc_resolution = models.JSONField(default=dict, blank=True)
    approval_trail = models.JSONField(default=list, blank=True)

    # GPN publication tracking
    gpn_published_at = models.DateTimeField(null=True, blank=True)
    gpn_publication_targets = models.JSONField(default=list, blank=True)  # ['zammsa_website', 'egp_portal', 'govt_gazette']
    gpn_publication_proofs = models.JSONField(default=dict, blank=True)  # {target: {url, timestamp, proof_file}}

    # ZPPA submission tracking (must submit within 30 days of approval)
    zppa_deadline = models.DateTimeField(null=True, blank=True)
    zppa_submitted = models.BooleanField(default=False)
    zppa_submitted_at = models.DateTimeField(null=True, blank=True)
    zppa_submission_ref = models.CharField(max_length=255, blank=True, default='')
    zppa_deadline_alerted = models.BooleanField(default=False)

    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'proc_annual_plan'
        verbose_name = 'Annual Procurement Plan'
        verbose_name_plural = 'Annual Procurement Plans'
        ordering = ['-created_at']
        unique_together = ('fiscal_year', 'department')

    def __str__(self):
        return f'APP {self.fiscal_year.year_code} - {self.department.dept_name}'


PROCUREMENT_TYPE_CHOICES = [
    ('goods', 'Goods'),
    ('works', 'Works'),
    ('services', 'Services'),
]


class APPLineItem(models.Model):
    line_item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    app = models.ForeignKey(AnnualProcurementPlan, on_delete=models.CASCADE, related_name='line_items')
    description = models.CharField(max_length=500)
    procurement_type = models.CharField(max_length=50, choices=PROCUREMENT_TYPE_CHOICES, default='goods')
    estimated_value = models.DecimalField(max_digits=20, decimal_places=2)
    recommended_method = models.CharField(max_length=50, blank=True)
    planned_issue_date = models.DateField(null=True, blank=True)
    planned_award_date = models.DateField(null=True, blank=True)
    funding_source = models.ForeignKey(FundingSource, on_delete=models.SET_NULL, null=True, blank=True)
    commodity = models.ForeignKey(Commodity, on_delete=models.SET_NULL, null=True, blank=True)
    is_citizen_reserved = models.BooleanField(default=True)

    class Meta:
        db_table = 'proc_app_line_item'
        verbose_name = 'APP Line Item'
        verbose_name_plural = 'APP Line Items'

    def __str__(self):
        return f'{self.description[:50]}'


class ContractProcurementPlan(models.Model):
    METHOD_CHOICES = [
        ('open_tender', 'Open National Bidding (ONB)'),
        ('international', 'International Bidding (INT)'),
        ('limited', 'Limited Bidding (LIM)'),
        ('simplified', 'Simplified Bidding (SIM)'),
        ('direct', 'Direct Bidding / Direct Procurement'),
    ]
    OPEN_METHODS = ('open_tender', 'international')

    cpp_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cpp_number = models.CharField(max_length=50, blank=True)
    requisition = models.ForeignKey('requisitions.Requisition', on_delete=models.CASCADE, related_name='cpp')

    # Procurement method
    method = models.CharField(max_length=50, choices=METHOD_CHOICES, blank=True)
    recommended_method = models.CharField(max_length=50, blank=True)
    method_override = models.BooleanField(default=False)
    override_reason = models.TextField(blank=True, default='')
    override_approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cpp_overrides_approved')
    override_approved_at = models.DateTimeField(null=True, blank=True)

    # ZPC approval (for non-open methods)
    zpc_approval_required = models.BooleanField(default=False)
    zpc_justification = models.TextField(blank=True, default='')
    zpc_grounds = models.CharField(max_length=100, blank=True)  # sole_source, emergency, etc.
    zpc_resolution_ref = models.CharField(max_length=100, blank=True, default='')
    zpc_approved_at = models.DateTimeField(null=True, blank=True)
    zpc_approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cpp_zpc_approved')

    # Core fields
    procurement_strategy = models.CharField(max_length=255, blank=True)
    estimated_value = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    overall_risk_level = models.CharField(max_length=20, blank=True, default='')
    resource_requirements = models.JSONField(default=dict, blank=True)

    # BR-CPP-09: Multi-year contract budget commitments
    is_multi_year = models.BooleanField(default=False)
    multi_year_commitments = models.JSONField(default=list, blank=True,
        help_text='Future year budget commitments: [{"fiscal_year": "2026", "amount": 500000, "funding_source": "GOZ"}]')

    # Baseline
    is_baseline_locked = models.BooleanField(default=False)
    baseline_locked_at = models.DateTimeField(null=True, blank=True)
    baseline_locked_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cpp_baseline_locked')

    # Status & workflow
    status = models.CharField(max_length=50, choices=CPP_STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cpp_created')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cpp_approved')
    approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    rejected_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='cpp_rejected')
    rejected_at = models.DateTimeField(null=True, blank=True)

    # Amendment tracking
    amendment_version = models.PositiveIntegerField(default=0)
    previous_baseline = models.JSONField(default=dict, blank=True)
    approval_trail = models.JSONField(default=list, blank=True)

    # Timestamps
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    completed_at = models.DateTimeField(null=True, blank=True)
    archived_at = models.DateTimeField(null=True, blank=True)
    retention_expiry = models.DateField(null=True, blank=True)

    class Meta:
        db_table = 'proc_contract_plan'
        verbose_name = 'Contract Procurement Plan'
        verbose_name_plural = 'Contract Procurement Plans'
        ordering = ['-created_at']

    def save(self, *args, **kwargs):
        if not self.cpp_number:
            dept = self.requisition.department.dept_code if self.requisition else 'XX'
            year = timezone.now().year
            count = ContractProcurementPlan.objects.filter(
                requisition__department__dept_code=dept
            ).count() + 1
            self.cpp_number = f'CPP-{year}-{dept}-{count:02d}'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.cpp_number} — {self.requisition.req_number}'


class CPPRisk(models.Model):
    RISK_CATEGORY_CHOICES = [
        ('supply', 'Supply Risk'),
        ('price', 'Price Risk'),
        ('quality', 'Quality Risk'),
        ('delivery', 'Delivery Risk'),
        ('regulatory', 'Regulatory Risk'),
        ('capacity', 'Capacity Risk'),
        ('custom', 'Custom'),
    ]
    LIKELIHOOD_CHOICES = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High')]
    IMPACT_CHOICES = [('low', 'Low'), ('medium', 'Medium'), ('high', 'High'), ('critical', 'Critical')]

    risk_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cpp = models.ForeignKey(ContractProcurementPlan, on_delete=models.CASCADE, related_name='risks')
    risk_category = models.CharField(max_length=50, choices=RISK_CATEGORY_CHOICES)
    risk_description = models.TextField()
    likelihood = models.CharField(max_length=20, choices=LIKELIHOOD_CHOICES)
    impact = models.CharField(max_length=20, choices=IMPACT_CHOICES)
    mitigation_strategy = models.TextField()
    risk_owner = models.CharField(max_length=255, blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'proc_cpp_risk'
        verbose_name = 'CPP Risk'
        verbose_name_plural = 'CPP Risks'

    def __str__(self):
        return f'{self.risk_category}: {self.risk_description[:50]}'


class ProcurementMilestone(models.Model):
    VARIANCE_FLAG_CHOICES = [
        ('green', 'On Time / Early'),
        ('yellow', '1-5 Days Late'),
        ('orange', '6-14 Days Late'),
        ('red', '>14 Days Late / At Risk'),
    ]

    milestone_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cpp = models.ForeignKey(ContractProcurementPlan, on_delete=models.CASCADE, related_name='procurement_milestones')
    milestone_name = models.CharField(max_length=255)
    sequence_number = models.PositiveIntegerField(default=0)
    planned_date = models.DateField()
    actual_date = models.DateField(null=True, blank=True)
    variance_days = models.IntegerField(null=True, blank=True)
    variance_flag = models.CharField(max_length=20, choices=VARIANCE_FLAG_CHOICES, blank=True, default='')
    is_system_updated = models.BooleanField(default=False)

    class Meta:
        db_table = 'proc_milestone'
        verbose_name = 'Procurement Milestone'
        verbose_name_plural = 'Procurement Milestones'
        ordering = ['sequence_number']

    def save(self, *args, **kwargs):
        if self.actual_date and self.planned_date:
            delta = (self.actual_date - self.planned_date).days
            self.variance_days = delta
            if delta <= 0:
                self.variance_flag = 'green'
            elif delta <= 5:
                self.variance_flag = 'yellow'
            elif delta <= 14:
                self.variance_flag = 'orange'
            else:
                self.variance_flag = 'red'
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.milestone_name} - {self.planned_date}'


class GeneralProcurementNotice(models.Model):
    gpn_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    app = models.ForeignKey(AnnualProcurementPlan, on_delete=models.CASCADE, related_name='gpns')
    generated_at = models.DateTimeField(auto_now_add=True)
    generated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='generated_gpns')
    content = models.JSONField(default=dict)
    publication_status = models.CharField(max_length=50, choices=GPN_STATUS_CHOICES, default='draft')
    publication_targets = models.JSONField(default=list, blank=True)
    publication_proof_urls = models.JSONField(default=list, blank=True)
    # Enhanced publication proofs with detailed metadata
    # Format: { target_key: { url: string, timestamp: string, reference?: string, delivered?: number, failed?: number, status: string } }
    publication_proofs = models.JSONField(default=dict, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='published_gpns')
    # Email notification tracking
    email_notification_sent = models.BooleanField(default=False)
    email_notification_count = models.IntegerField(default=0)
    email_notification_failed = models.IntegerField(default=0)
    email_notification_sent_at = models.DateTimeField(null=True, blank=True)
    # Gazette file tracking
    gazette_file_path = models.CharField(max_length=500, blank=True, default='')
    gazette_submitted = models.BooleanField(default=False)
    gazette_submitted_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'proc_gpn'
        verbose_name = 'General Procurement Notice'
        verbose_name_plural = 'General Procurement Notices'

    def __str__(self):
        return f'GPN for {self.app}'
