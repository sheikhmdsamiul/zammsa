import uuid
from decimal import Decimal
from django.db import models
from django.utils import timezone
from accounts.models import User
from contracts.models import Contract
from suppliers.models import Supplier
from requisitions.models import Requisition

INVOICE_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('submitted', 'Submitted'),
    ('pending_matching', 'Pending 3-Way Match'),
    ('pending_approval', 'Pending Approval'),
    ('approved', 'Approved for Payment'),
    ('paid', 'Paid'),
    ('rejected', 'Rejected'),
]

PAYMENT_METHOD_CHOICES = [
    ('electronic', 'Electronic Funds Transfer'),
    ('cheque', 'Cheque'),
    ('loc', 'Letter of Credit'),
    ('iso20022', 'ISO 20022 Transfer'),
]

PAYMENT_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('processing', 'Processing'),
    ('sent', 'Sent to Bank'),
    ('confirmed', 'Confirmed'),
    ('failed', 'Failed'),
]

MATCH_STATUS_CHOICES = [
    ('complete', 'Complete Match'),
    ('partial', 'Partial Match'),
    ('no_match', 'No Match'),
]

LOC_TYPE_CHOICES = [
    ('sight', 'Sight LC'),
    ('usance', 'Usance LC'),
    ('standby', 'Standby LC'),
]

LOC_STATUS_CHOICES = [
    ('issued', 'Issued'),
    ('confirmed', 'Confirmed'),
    ('utilized', 'Partially Utilized'),
    ('exhausted', 'Exhausted'),
    ('expired', 'Expired'),
]


class BudgetAllocation(models.Model):
    allocation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    entity_level = models.CharField(max_length=50)
    entity_code = models.CharField(max_length=50)
    entity_name = models.CharField(max_length=255, blank=True, default='')
    fiscal_year = models.CharField(max_length=20)
    allocated_amount = models.DecimalField(max_digits=20, decimal_places=2)
    encumbered_amount = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    expended_amount = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    last_synced_at = models.DateTimeField(null=True, blank=True)
    sync_source = models.CharField(max_length=100, blank=True, default='manual')
    raw_data = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fin_budget_allocation'
        verbose_name = 'Budget Allocation'
        verbose_name_plural = 'Budget Allocations'
        unique_together = ('entity_code', 'fiscal_year')

    @property
    def available(self):
        return self.allocated_amount - self.encumbered_amount - self.expended_amount

    def __str__(self):
        return f'{self.entity_code} - FY{self.fiscal_year}'


class BudgetEncumbrance(models.Model):
    encumbrance_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='fin_encumbrances')
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    erp_reference = models.CharField(max_length=100, blank=True)
    status = models.CharField(max_length=20, default='active')
    created_at = models.DateTimeField(auto_now_add=True)
    released_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'fin_encumbrance'
        verbose_name = 'Budget Encumbrance'
        verbose_name_plural = 'Budget Encumbrances'

    def __str__(self):
        return f'{self.requisition.req_number} - {self.amount}'


INVOICE_APPROVAL_ROUTES = [
    ('finance_officer', 'Finance Officer'),
    ('department_head', 'Department Head'),
    ('director_general', 'Director General'),
]


class GoodsReceiptNote(models.Model):
    grn_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True, related_name='goods_receipt_notes')
    po_number = models.CharField(max_length=50, blank=True, default='')
    grn_number = models.CharField(max_length=100, unique=True)
    item_description = models.TextField(blank=True, default='')
    quantity_received = models.DecimalField(max_digits=15, decimal_places=2)
    unit_price = models.DecimalField(max_digits=20, decimal_places=2)
    total_amount = models.DecimalField(max_digits=20, decimal_places=2)
    received_date = models.DateTimeField(auto_now_add=True)
    received_by = models.CharField(max_length=255, blank=True, default='')
    notes = models.TextField(blank=True, default='')
    source = models.CharField(max_length=50, default='webhook',
        help_text='webhook, manual, api')
    raw_webhook = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fin_grn'
        verbose_name = 'Goods Receipt Note'
        verbose_name_plural = 'Goods Receipt Notes'
        ordering = ['-received_date']

    def __str__(self):
        return f'{self.grn_number} - {self.contract.contract_number}'


class Invoice(models.Model):
    invoice_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='invoices')
    po_number = models.CharField(max_length=50, blank=True)
    grn = models.ForeignKey(GoodsReceiptNote, on_delete=models.SET_NULL, null=True, blank=True, related_name='invoices')
    supplier = models.ForeignKey(Supplier, on_delete=models.PROTECT, related_name='invoices')
    invoice_number = models.CharField(max_length=100)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    due_date = models.DateField(null=True, blank=True)
    document = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=50, choices=INVOICE_STATUS_CHOICES, default='draft')
    approval_route = models.CharField(max_length=50, choices=INVOICE_APPROVAL_ROUTES, null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)
    paid_at = models.DateTimeField(null=True, blank=True)
    erp_posted = models.BooleanField(default=False)
    erp_posted_at = models.DateTimeField(null=True, blank=True)
    payment_advice_sent = models.BooleanField(default=False)
    payment_advice_sent_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'fin_invoice'
        verbose_name = 'Invoice'
        verbose_name_plural = 'Invoices'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.contract.contract_number} - {self.invoice_number}'

    def determine_approval_route(self):
        if self.amount <= Decimal('100000'):
            return 'finance_officer'
        elif self.amount <= Decimal('500000'):
            return 'department_head'
        else:
            return 'director_general'


class ThreeWayMatch(models.Model):
    match_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='three_way_matches')
    po_quantity = models.DecimalField(max_digits=15, decimal_places=2)
    grn_quantity = models.DecimalField(max_digits=15, decimal_places=2)
    invoice_quantity = models.DecimalField(max_digits=15, decimal_places=2)
    po_price = models.DecimalField(max_digits=20, decimal_places=2)
    invoice_price = models.DecimalField(max_digits=20, decimal_places=2)
    match_status = models.CharField(max_length=20, choices=MATCH_STATUS_CHOICES)
    discrepancies = models.JSONField(default=dict, blank=True)

    class Meta:
        db_table = 'fin_3way_match'
        verbose_name = '3-Way Match'
        verbose_name_plural = '3-Way Matches'

    def __str__(self):
        return f'{self.invoice.invoice_number} - {self.match_status}'


class Payment(models.Model):
    payment_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    invoice = models.ForeignKey(Invoice, on_delete=models.CASCADE, related_name='payments')
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, null=True, blank=True, related_name='payments')
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    retained_amount = models.DecimalField(max_digits=20, decimal_places=2, default=0,
        help_text='Retention withheld (5-10% per BR-FIN-02)')
    retention_released = models.BooleanField(default=False)
    payment_method = models.CharField(max_length=20, choices=PAYMENT_METHOD_CHOICES)
    reference = models.CharField(max_length=200, blank=True, default='')
    iso20022_file_ref = models.CharField(max_length=200, blank=True)
    vendor = models.CharField(max_length=255, blank=True, default='')
    status = models.CharField(max_length=20, choices=PAYMENT_STATUS_CHOICES, default='pending')
    processed_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'fin_payment'
        verbose_name = 'Payment'
        verbose_name_plural = 'Payments'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.invoice.invoice_number} - {self.amount}'


class RetentionRelease(models.Model):
    release_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='retention_releases')
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    released_at = models.DateTimeField(auto_now_add=True)
    released_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    acceptance_certificate_ref = models.CharField(max_length=100, blank=True)
    notes = models.TextField(blank=True)

    class Meta:
        db_table = 'fin_retention_release'
        verbose_name = 'Retention Release'
        verbose_name_plural = 'Retention Releases'
        ordering = ['-released_at']

    def __str__(self):
        return f'{self.contract.contract_number} - {self.amount}'


class LetterOfCredit(models.Model):
    loc_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    contract = models.ForeignKey(Contract, on_delete=models.CASCADE, related_name='letters_of_credit')
    lc_number = models.CharField(max_length=100, blank=True, default='')
    loc_type = models.CharField(max_length=20, choices=LOC_TYPE_CHOICES)
    amount = models.DecimalField(max_digits=20, decimal_places=2)
    issuing_bank = models.CharField(max_length=255)
    beneficiary = models.CharField(max_length=255)
    document = models.CharField(max_length=500, blank=True, default='')
    status = models.CharField(max_length=20, choices=LOC_STATUS_CHOICES, default='issued')
    issued_at = models.DateTimeField(auto_now_add=True)
    expiry_date = models.DateField()

    class Meta:
        db_table = 'fin_loc'
        verbose_name = 'Letter of Credit'
        verbose_name_plural = 'Letters of Credit'

    def __str__(self):
        return f'{self.contract.contract_number} - LC {self.amount}'
