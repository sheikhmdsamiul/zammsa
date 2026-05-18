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
    ('active', 'Active'),
    ('completed', 'Completed'),
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


class APPLineItem(models.Model):
    line_item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    app = models.ForeignKey(AnnualProcurementPlan, on_delete=models.CASCADE, related_name='line_items')
    description = models.CharField(max_length=500)
    estimated_value = models.DecimalField(max_digits=20, decimal_places=2)
    recommended_method = models.CharField(max_length=50, blank=True)
    planned_issue_date = models.DateField(null=True, blank=True)
    planned_award_date = models.DateField(null=True, blank=True)
    funding_source = models.ForeignKey(FundingSource, on_delete=models.SET_NULL, null=True, blank=True)
    commodity = models.ForeignKey(Commodity, on_delete=models.SET_NULL, null=True, blank=True)

    class Meta:
        db_table = 'proc_app_line_item'
        verbose_name = 'APP Line Item'
        verbose_name_plural = 'APP Line Items'

    def __str__(self):
        return f'{self.description[:50]}'


class ContractProcurementPlan(models.Model):
    cpp_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey('requisitions.Requisition', on_delete=models.CASCADE, related_name='cpp')
    procurement_strategy = models.CharField(max_length=255, blank=True)
    milestones = models.JSONField(default=list)
    resource_requirements = models.JSONField(default=dict)
    risk_assessment = models.JSONField(default=dict)
    status = models.CharField(max_length=50, choices=CPP_STATUS_CHOICES, default='draft')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'proc_contract_plan'
        verbose_name = 'Contract Procurement Plan'
        verbose_name_plural = 'Contract Procurement Plans'

    def __str__(self):
        return f'CPP for {self.requisition.req_number}'


class ProcurementMilestone(models.Model):
    milestone_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    cpp = models.ForeignKey(ContractProcurementPlan, on_delete=models.CASCADE, related_name='procurement_milestones')
    milestone_name = models.CharField(max_length=255)
    planned_date = models.DateField()
    actual_date = models.DateField(null=True, blank=True)
    variance_days = models.IntegerField(null=True, blank=True)

    class Meta:
        db_table = 'proc_milestone'
        verbose_name = 'Procurement Milestone'
        verbose_name_plural = 'Procurement Milestones'
        ordering = ['planned_date']

    def save(self, *args, **kwargs):
        if self.actual_date and self.planned_date:
            self.variance_days = (self.actual_date - self.planned_date).days
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
    published_at = models.DateTimeField(null=True, blank=True)
    published_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='published_gpns')

    class Meta:
        db_table = 'proc_gpn'
        verbose_name = 'General Procurement Notice'
        verbose_name_plural = 'General Procurement Notices'

    def __str__(self):
        return f'GPN for {self.app}'
