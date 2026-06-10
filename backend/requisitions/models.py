import uuid
from django.db import models
from django.utils import timezone
from simple_history.models import HistoricalRecords
from accounts.models import User
from master_data.models import Department, Commodity, UnitOfMeasure
from procurement_planning.models import APPLineItem

REQ_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('submitted', 'Submitted'),
    ('pending_dept_head', 'Pending Department Head Approval'),
    ('pending_finance', 'Pending Finance Validation'),
    ('pending_dg', 'Pending Director General Approval'),
    ('pending_zpc', 'Pending ZPC Approval'),
    ('approved', 'Approved for Procurement'),
    ('rejected', 'Rejected'),
    ('amended', 'Amended'),
]

DECISION_CHOICES = [
    ('pending', 'Pending'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
    ('returned', 'Returned for Revision'),
]

ENCUMBRANCE_STATUS_CHOICES = [
    ('active', 'Active'),
    ('released', 'Released'),
    ('converted', 'Converted to PO'),
]

SPECIFICATION_TYPE_CHOICES = [
    ('goods', 'Goods Specification'),
    ('tor', 'Terms of Reference'),
    ('sow', 'Scope of Work'),
]


class Requisition(models.Model):
    requisition_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    req_number = models.CharField(max_length=50, unique=True)
    department = models.ForeignKey(Department, on_delete=models.PROTECT)
    requester = models.ForeignKey(User, on_delete=models.CASCADE, related_name='requisitions')
    description = models.TextField()
    estimated_total = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    required_date = models.DateField()
    delivery_location = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=50, choices=REQ_STATUS_CHOICES, default='draft')
    budget_validated = models.BooleanField(default=False)
    encumbrance_ref = models.CharField(max_length=100, blank=True)
    technical_review_required = models.BooleanField(default=False,
        help_text='Auto-set when any goods line item exceeds K1,000,000')
    app_line_item = models.ForeignKey(
        APPLineItem, on_delete=models.PROTECT,
        null=True, blank=True,
        related_name='requisitions'
    )
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    current_approver = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pending_approvals')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'req_requisition'
        verbose_name = 'Requisition'
        verbose_name_plural = 'Requisitions'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.req_number} - {self.department.dept_code}'

    def days_at_current_stage(self):
        from django.utils import timezone
        if self.submitted_at:
            return (timezone.now().date() - self.submitted_at.date()).days
        return 0

    def save(self, *args, **kwargs):
        if not self.req_number:
            import uuid
            from datetime import datetime
            self.req_number = f"REQ-{datetime.now().strftime('%Y%m%d')}-{uuid.uuid4().hex[:6].upper()}"
        super().save(*args, **kwargs)


class RequisitionItem(models.Model):
    item_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='items')
    item_code = models.CharField(max_length=50, blank=True)
    description = models.CharField(max_length=500)
    quantity = models.DecimalField(max_digits=15, decimal_places=2)
    unit_of_measure = models.ForeignKey(UnitOfMeasure, on_delete=models.PROTECT, null=True, blank=True)
    unit_price_estimate = models.DecimalField(max_digits=15, decimal_places=2)
    total_estimate = models.DecimalField(max_digits=20, decimal_places=2, editable=False)
    commodity = models.ForeignKey(Commodity, on_delete=models.SET_NULL, null=True, blank=True)
    attachment = models.FileField(upload_to='requisition_attachments/', blank=True, null=True,
        help_text='Supporting document for this line item (spec sheet, quote, etc.)')
    history = HistoricalRecords()

    class Meta:
        db_table = 'req_requisition_item'
        verbose_name = 'Requisition Item'
        verbose_name_plural = 'Requisition Items'

    def save(self, *args, **kwargs):
        self.total_estimate = self.quantity * self.unit_price_estimate
        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.item_code or self.description[:30]} x {self.quantity}'


class Specification(models.Model):
    specification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='specifications')
    specification_type = models.CharField(max_length=20, choices=SPECIFICATION_TYPE_CHOICES)
    content = models.JSONField()
    version = models.CharField(max_length=20, default='1.0')

    class Meta:
        db_table = 'req_specification'
        verbose_name = 'Specification'
        verbose_name_plural = 'Specifications'

    def __str__(self):
        return f'{self.get_specification_type_display()} v{self.version}'


class RequisitionApproval(models.Model):
    approval_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='approvals')
    approver = models.ForeignKey(User, on_delete=models.CASCADE)
    approval_level = models.CharField(max_length=50)
    decision = models.CharField(max_length=20, choices=DECISION_CHOICES, default='pending')
    comments = models.TextField(blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'req_approval'
        verbose_name = 'Requisition Approval'
        verbose_name_plural = 'Requisition Approvals'
        ordering = ['created_at']

    def __str__(self):
        return f'{self.requisition.req_number} - {self.approval_level}: {self.decision}'


class RequisitionVersion(models.Model):
    version_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='versions')
    version_number = models.IntegerField()
    data_snapshot = models.JSONField()
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'req_version'
        verbose_name = 'Requisition Version'
        verbose_name_plural = 'Requisition Versions'
        ordering = ['-version_number']
        unique_together = ('requisition', 'version_number')

    def __str__(self):
        return f'{self.requisition.req_number} v{self.version_number}'


class BudgetEncumbrance(models.Model):
    encumbrance_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='encumbrances')
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    erp_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, choices=ENCUMBRANCE_STATUS_CHOICES, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'req_encumbrance'
        verbose_name = 'Budget Encumbrance'
        verbose_name_plural = 'Budget Encumbrances'

    def __str__(self):
        return f'{self.requisition.req_number} - {self.amount}'
