import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from accounts.models import User
from solicitations.models import Solicitation
from bids.models import BidSubmission
from evaluations.models import BidEvaluationReport

CONTRACT_TYPE_CHOICES = [
    ('po', 'Purchase Order'),
    ('exc', 'Framework Contract'),
]

SECURITY_TYPE_CHOICES = [
    ('performance', 'Performance Bond'),
    ('advance', 'Advance Payment Guarantee'),
]

SECURITY_STATUS_CHOICES = [
    ('active', 'Active'),
    ('released', 'Released'),
    ('called', 'Called'),
    ('expired', 'Expired'),
    ('rejected', 'Rejected'),
]

LD_STATUS_CHOICES = [
    ('assessed', 'Assessed'),
    ('waived', 'Waived'),
    ('applied', 'Applied'),
]

TERMINATION_TYPE_CHOICES = [
    ('mutual', 'Mutual Agreement'),
    ('default', 'Supplier Default'),
    ('convenience', 'Convenience of the Agency'),
    ('force_majeure', 'Force Majeure'),
]


CONTRACT_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('pending_acceptance', 'Pending Supplier Acceptance'),
    ('active', 'Active'),
    ('completed', 'Completed'),
    ('terminated', 'Terminated'),
    ('cancelled', 'Cancelled'),
    ('closed', 'Closed'),
    ('archived', 'Archived'),
]

APPEAL_STATUS_CHOICES = [
    ('filed', 'Filed'),
    ('under_review', 'Under Review'),
    ('upheld', 'Upheld'),
    ('dismissed', 'Dismissed'),
]

CLOSURE_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('completed', 'Completed'),
]


class Contract(models.Model):
    contract_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract_number = models.CharField(max_length=50, unique=True)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.PROTECT, related_name='contracts')
    winning_bid = models.ForeignKey(BidSubmission, on_delete=models.PROTECT, related_name='contract')
    ber = models.ForeignKey(BidEvaluationReport, on_delete=models.SET_NULL, null=True, blank=True, related_name='contracts')
    supplier = models.ForeignKey('suppliers.Supplier', on_delete=models.PROTECT, related_name='contracts')
    title = models.CharField(max_length=255, blank=True, default='')
    contract_type = models.CharField(max_length=20, choices=CONTRACT_TYPE_CHOICES)
    value = models.DecimalField(max_digits=20, decimal_places=2)
    currency = models.CharField(max_length=10, default='ZMW')
    start_date = models.DateField()
    end_date = models.DateField()
    status = models.CharField(max_length=50, choices=CONTRACT_STATUS_CHOICES, default='draft')
    signed_by_vendor = models.BooleanField(default=False)
    signed_by_authority = models.BooleanField(default=False)
    signed_vendor_date = models.DateField(null=True, blank=True)
    signed_authority_date = models.DateField(null=True, blank=True)
    contract_document = models.CharField(max_length=500, blank=True, default='')
    contract_manager = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='managed_contracts')
    award_date = models.DateField(null=True, blank=True)
    acceptance_date = models.DateField(null=True, blank=True)
    completed_at = models.DateField(null=True, blank=True)
    award_notice_published = models.BooleanField(default=False)
    award_notice_published_at = models.DateTimeField(null=True, blank=True)
    waiting_period_days = models.IntegerField(default=10)
    waiting_period_start = models.DateField(null=True, blank=True)
    waiting_period_end = models.DateField(null=True, blank=True)
    appeal_pending = models.BooleanField(default=False)
    appeal_resolved_at = models.DateTimeField(null=True, blank=True)
    performance_security_required = models.BooleanField(default=False)
    performance_security_uploaded = models.BooleanField(default=False)
    performance_security_validated = models.BooleanField(default=False)
    archived_at = models.DateTimeField(null=True, blank=True)
    retention_expiry = models.DateField(null=True, blank=True)
    legal_hold = models.BooleanField(default=False)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'cnt_contract'
        verbose_name = 'Contract'
        verbose_name_plural = 'Contracts'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.contract_number} - {self.supplier.name}'

    def requires_performance_bond(self):
        return self.value > Decimal('1000000')


class Appeal(models.Model):
    appeal_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='appeals')
    bidder = models.ForeignKey(User, on_delete=models.CASCADE, related_name='appeals')
    grounds = models.TextField()
    supporting_docs = models.JSONField(default=list, blank=True)
    status = models.CharField(max_length=20, choices=APPEAL_STATUS_CHOICES, default='filed')
    filed_at = models.DateTimeField(auto_now_add=True)
    resolved_at = models.DateTimeField(null=True, blank=True)
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='appeal_resolutions')
    resolution_notes = models.TextField(blank=True)

    class Meta:
        db_table = 'cnt_appeal'
        verbose_name = 'Appeal'
        verbose_name_plural = 'Appeals'
        ordering = ['-filed_at']

    def __str__(self):
        return f'Appeal {self.appeal_id}'[:30]


class ClosureChecklist(models.Model):
    checklist_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='closure_checklists')
    all_deliverables_received = models.BooleanField(default=False)
    final_inspection_passed = models.BooleanField(default=False)
    all_payments_processed = models.BooleanField(default=False)
    performance_security_released = models.BooleanField(default=False)
    snagging_items_resolved = models.BooleanField(default=False)
    staff_warranty_training_done = models.BooleanField(default=False)
    as_built_docs_received = models.BooleanField(default=False)
    # Extended checklist fields to match frontend ContractClosureChecklist component
    acceptance_certificate_issued = models.BooleanField(default=False)
    liquidated_damages_deducted = models.BooleanField(default=False)
    retention_released = models.BooleanField(default=False)
    no_outstanding_disputes = models.BooleanField(default=False)
    no_pending_amendments = models.BooleanField(default=False)
    supplier_evaluation_completed = models.BooleanField(default=False)
    all_docs_saved = models.BooleanField(default=False)
    notes = models.TextField(blank=True)
    completed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='closure_checklists')
    completed_at = models.DateTimeField(null=True, blank=True)
    status = models.CharField(max_length=20, choices=CLOSURE_STATUS_CHOICES, default='pending')

    class Meta:
        db_table = 'cnt_closure_checklist'
        verbose_name = 'Closure Checklist'
        verbose_name_plural = 'Closure Checklists'

    def __str__(self):
        return f'Closure {self.contract.contract_number}'

    def is_complete(self):
        common_complete = all([
            self.all_deliverables_received,
            self.final_inspection_passed,
            self.all_payments_processed,
            self.performance_security_released,
            self.acceptance_certificate_issued,
            self.liquidated_damages_deducted,
            self.retention_released,
            self.no_outstanding_disputes,
            self.no_pending_amendments,
            self.supplier_evaluation_completed,
            self.all_docs_saved,
        ])
        works_fields_required = any([
            self.snagging_items_resolved,
            self.staff_warranty_training_done,
            self.as_built_docs_received,
        ]) or self.contract.contract_type == 'exc'
        if not works_fields_required:
            return common_complete
        return common_complete and all([
            self.snagging_items_resolved,
            self.staff_warranty_training_done,
            self.as_built_docs_received,
        ])


class ContractSecurity(models.Model):
    security_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='securities')
    security_type = models.CharField(max_length=20, choices=SECURITY_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    issuing_bank = models.CharField(max_length=255)
    reference_number = models.CharField(max_length=100)
    expiry_date = models.DateField()
    status = models.CharField(max_length=20, choices=SECURITY_STATUS_CHOICES, default='active')

    class Meta:
        db_table = 'cnt_security'
        verbose_name = 'Contract Security'
        verbose_name_plural = 'Contract Securities'

    def __str__(self):
        return f'{self.contract.contract_number} - {self.security_type}'


class ContractAmendment(models.Model):
    amendment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='amendments')
    amendment_number = models.IntegerField()
    reason = models.TextField()
    description = models.TextField()
    financial_impact = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    variation_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    legal_review_required = models.BooleanField(default=False)
    legal_opinion_ref = models.CharField(max_length=100, blank=True)
    signed_by_supplier = models.BooleanField(default=False)
    signed_by_authority = models.BooleanField(default=False)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cnt_amendment'
        verbose_name = 'Contract Amendment'
        verbose_name_plural = 'Contract Amendments'
        unique_together = ('contract', 'amendment_number')
        ordering = ['-amendment_number']

    def __str__(self):
        return f'{self.contract.contract_number} - Amd {self.amendment_number}'


class ContractMilestone(models.Model):
    milestone_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='milestones')
    milestone_name = models.CharField(max_length=255)
    due_date = models.DateField()
    status = models.CharField(max_length=20, default='pending')
    completed_at = models.DateTimeField(null=True, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'cnt_milestone'
        verbose_name = 'Contract Milestone'
        verbose_name_plural = 'Contract Milestones'
        ordering = ['due_date']

    def __str__(self):
        return f'{self.contract.contract_number} - {self.milestone_name}'


class LiquidatedDamages(models.Model):
    ld_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='liquidated_damages')
    assessment_date = models.DateField()
    days_delayed = models.IntegerField()
    daily_rate = models.DecimalField(max_digits=15, decimal_places=2)
    calculated_amount = models.DecimalField(max_digits=20, decimal_places=2)
    applied_amount = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    status = models.CharField(max_length=20, choices=LD_STATUS_CHOICES, default='assessed')

    class Meta:
        db_table = 'cnt_ld'
        verbose_name = 'Liquidated Damages'
        verbose_name_plural = 'Liquidated Damages'

    def __str__(self):
        return f'{self.contract.contract_number} - {self.calculated_amount}'


class ContractTermination(models.Model):
    termination_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='terminations')
    termination_type = models.CharField(max_length=50, choices=TERMINATION_TYPE_CHOICES)
    effective_date = models.DateField()
    reason = models.TextField()
    legal_review_ref = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'cnt_termination'
        verbose_name = 'Contract Termination'
        verbose_name_plural = 'Contract Terminations'

    def __str__(self):
        return f'{self.contract.contract_number} - {self.termination_type}'
