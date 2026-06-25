import uuid
from django.db import models
from django.core.exceptions import ValidationError
from simple_history.models import HistoricalRecords
from accounts.models import User


DEPARTMENT_LEVEL_CHOICES = [
    ('national', 'National'),
    ('provincial', 'Provincial'),
    ('district', 'District'),
    ('facility', 'Facility'),
]

FUNDING_TYPE_CHOICES = [
    ('government', 'Government'),
    ('donor', 'Donor'),
    ('other', 'Other'),
]

DOCUMENT_TYPE_CHOICES = [
    ('ITB', 'Invitation to Bid'),
    ('RFP', 'Request for Proposal'),
    ('RFQ', 'Request for Quotation'),
    ('contract', 'Contract'),
    ('po', 'Purchase Order'),
]

RISK_SEVERITY_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
]

CHANGE_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('approved_first', 'Approved by Director Procurement'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]


class Department(models.Model):
    dept_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    dept_code = models.CharField(max_length=50, unique=True)
    dept_name = models.CharField(max_length=255)
    parent_department = models.ForeignKey('self', on_delete=models.SET_NULL, null=True, blank=True, related_name='children')
    level = models.CharField(max_length=50, choices=DEPARTMENT_LEVEL_CHOICES)
    region = models.CharField(max_length=255, blank=True)
    budget_code = models.CharField(max_length=100, blank=True)
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        db_table = 'master_department'
        verbose_name = 'Department'
        verbose_name_plural = 'Departments'
        ordering = ['dept_name']

    def __str__(self):
        return f'{self.dept_name} ({self.dept_code})'


class FiscalYear(models.Model):
    fiscal_year_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    year_code = models.CharField(max_length=20, unique=True)
    start_date = models.DateField()
    end_date = models.DateField()
    is_current = models.BooleanField(default=False)
    is_closed = models.BooleanField(default=False)

    class Meta:
        db_table = 'master_fiscal_year'
        verbose_name = 'Fiscal Year'
        verbose_name_plural = 'Fiscal Years'
        ordering = ['-year_code']

    def clean(self):
        if self.is_current:
            if FiscalYear.objects.filter(is_current=True).exclude(pk=self.pk).exists():
                raise ValidationError('Only one fiscal year can be current')
        if self.start_date and self.end_date and self.start_date >= self.end_date:
            raise ValidationError('End date must be after start date')

    def save(self, *args, **kwargs):
        self.clean()
        if self.is_current:
            FiscalYear.objects.filter(is_current=True).exclude(pk=self.pk).update(is_current=False)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.year_code


class IdSequence(models.Model):
    """Atomic per-prefix/fiscal-year/department counter for traceable document IDs."""

    sequence_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    prefix = models.CharField(max_length=4)
    fiscal_year = models.CharField(max_length=4)
    department_code = models.CharField(max_length=3)
    last_sequence = models.PositiveIntegerField(default=0)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'master_id_sequence'
        verbose_name = 'ID Sequence'
        verbose_name_plural = 'ID Sequences'
        unique_together = ('prefix', 'fiscal_year', 'department_code')
        ordering = ['prefix', 'fiscal_year', 'department_code']

    def __str__(self):
        return f'{self.prefix}-{self.fiscal_year}-{self.department_code}: {self.last_sequence}'


class UnitOfMeasure(models.Model):
    uom_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    uom_code = models.CharField(max_length=20, unique=True)
    uom_name = models.CharField(max_length=100)
    category = models.CharField(max_length=100, blank=True)

    class Meta:
        db_table = 'master_unit_of_measure'
        verbose_name = 'Unit of Measure'
        verbose_name_plural = 'Units of Measure'
        ordering = ['uom_name']

    def __str__(self):
        return f'{self.uom_code} - {self.uom_name}'


class Commodity(models.Model):
    commodity_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    commodity_code = models.CharField(max_length=50, unique=True)
    commodity_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100, blank=True)
    sub_category = models.CharField(max_length=100, blank=True)
    unit_of_measure = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, null=True, blank=True)
    is_active = models.BooleanField(default=True)
    history = HistoricalRecords()

    class Meta:
        db_table = 'master_commodity'
        verbose_name = 'Commodity'
        verbose_name_plural = 'Commodities'
        ordering = ['commodity_name']

    def __str__(self):
        return f'{self.commodity_code} - {self.commodity_name}'


class FundingSource(models.Model):
    source_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    source_code = models.CharField(max_length=50, unique=True)
    source_name = models.CharField(max_length=255)
    type = models.CharField(max_length=50, choices=FUNDING_TYPE_CHOICES)
    budget_reference = models.CharField(max_length=255, blank=True)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'master_funding_source'
        verbose_name = 'Funding Source'
        verbose_name_plural = 'Funding Sources'
        ordering = ['source_name']

    def __str__(self):
        return f'{self.source_code} - {self.source_name}'


class DocumentTemplate(models.Model):
    template_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    template_name = models.CharField(max_length=255)
    document_type = models.CharField(max_length=50, choices=DOCUMENT_TYPE_CHOICES)
    template_content = models.TextField()
    version = models.CharField(max_length=20, default='1.0')
    is_active = models.BooleanField(default=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'master_document_template'
        verbose_name = 'Document Template'
        verbose_name_plural = 'Document Templates'
        ordering = ['template_name']

    def __str__(self):
        return f'{self.template_name} v{self.version}'


class RiskLibrary(models.Model):
    risk_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    risk_category = models.CharField(max_length=255)
    risk_description = models.TextField()
    default_mitigation = models.TextField(blank=True)
    severity_level = models.CharField(max_length=20, choices=RISK_SEVERITY_CHOICES, default='medium')

    class Meta:
        db_table = 'master_risk_library'
        verbose_name = 'Risk Library'
        verbose_name_plural = 'Risk Libraries'
        ordering = ['risk_category']

    def __str__(self):
        return f'{self.risk_category}: {self.severity_level}'


class ApprovalMatrix(models.Model):
    matrix_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    procurement_type = models.CharField(max_length=100)
    value_threshold_min = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    value_threshold_max = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    approval_flow = models.JSONField(default=list, help_text='Ordered list of approval roles')
    requires_zpc = models.BooleanField(default=False)
    requires_legal_review = models.BooleanField(default=False)
    is_active = models.BooleanField(default=True)

    class Meta:
        db_table = 'master_approval_matrix'
        verbose_name = 'Approval Matrix'
        verbose_name_plural = 'Approval Matrices'
        ordering = ['value_threshold_min']

    def __str__(self):
        return f'{self.procurement_type} ({self.value_threshold_min} - {self.value_threshold_max or "∞"})'


class ChangeRequest(models.Model):
    request_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_type = models.CharField(max_length=100)
    entity_id = models.CharField(max_length=255)
    requested_change = models.JSONField()
    reason = models.TextField()
    requested_by = models.ForeignKey(User, on_delete=models.CASCADE, related_name='change_requests')
    status = models.CharField(max_length=50, choices=CHANGE_STATUS_CHOICES, default='pending')
    approved_by_first = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='first_approvals')
    approved_by_second = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='second_approvals')
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'master_change_request'
        verbose_name = 'Change Request'
        verbose_name_plural = 'Change Requests'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.entity_type} change by {self.requested_by} - {self.status}'
