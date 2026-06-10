import uuid
from django.db import models
from django.utils import timezone
from accounts.models import User

SUPPLIER_STATUS_CHOICES = [
    ('pending', 'Pending Registration'),
    ('active', 'Active'),
    ('suspended', 'Suspended'),
    ('debarred', 'Debarred'),
]

APPLICATION_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('submitted', 'Submitted'),
    ('under_review', 'Under Review'),
    ('pending_pacra', 'Pending PACRA Verification'),
    ('pending_ceec', 'Pending CEEC Verification'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]

DOCUMENT_VERIFICATION_CHOICES = [
    ('pending', 'Pending'),
    ('verified', 'Verified'),
    ('rejected', 'Rejected'),
]

RISK_LEVEL_CHOICES = [
    ('low', 'Low'),
    ('medium', 'Medium'),
    ('high', 'High'),
]

CEEC_CATEGORY_CHOICES = [
    ('citizen_influenced', 'Citizen-Influenced'),
    ('citizen_empowered', 'Citizen-Empowered'),
    ('citizen_owned', 'Citizen-Owned'),
    ('non_citizen', 'Non-Citizen'),
]


class Supplier(models.Model):
    supplier_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    registration_number = models.CharField(max_length=50, unique=True)
    tin = models.CharField(max_length=50, unique=True)
    name = models.CharField(max_length=255)
    ceec_category = models.CharField(max_length=50, choices=CEEC_CATEGORY_CHOICES, default='non_citizen')
    status = models.CharField(max_length=20, choices=SUPPLIER_STATUS_CHOICES, default='pending')
    risk_score = models.DecimalField(max_digits=5, decimal_places=2, null=True, blank=True)
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES, default='low')
    bank_name = models.CharField(max_length=255, blank=True, default='')
    bank_account_number = models.CharField(max_length=100, blank=True, default='')
    bank_account_name = models.CharField(max_length=255, blank=True, default='')
    registered_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sup_supplier'
        verbose_name = 'Supplier'
        verbose_name_plural = 'Suppliers'
        ordering = ['name']

    def __str__(self):
        return f'{self.name} ({self.registration_number})'


class VendorApplication(models.Model):
    application_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    company_name = models.CharField(max_length=255)
    registration_number = models.CharField(max_length=50)
    tin = models.CharField(max_length=50)
    ceec_certificate_number = models.CharField(max_length=100, blank=True)
    ceec_category = models.CharField(max_length=50, choices=CEEC_CATEGORY_CHOICES)
    # Step 1: Account (email, password)
    email = models.EmailField(max_length=255, blank=True, default='')
    password = models.CharField(max_length=255, blank=True, default='')
    # Step 3: Contact
    contact_person = models.CharField(max_length=255, blank=True, default='')
    contact_phone = models.CharField(max_length=50, blank=True, default='')
    contact_email = models.EmailField(max_length=255, blank=True, default='')
    address = models.TextField(blank=True, default='')
    # Step 4: Bank
    bank_name = models.CharField(max_length=255, blank=True, default='')
    bank_account_number = models.CharField(max_length=100, blank=True, default='')
    bank_account_name = models.CharField(max_length=255, blank=True, default='')
    bank_branch = models.CharField(max_length=255, blank=True, default='')
    # Validations
    pacra_validated = models.BooleanField(default=False)
    ceec_validated = models.BooleanField(default=False)
    # Status
    status = models.CharField(max_length=30, choices=APPLICATION_STATUS_CHOICES, default='draft')
    submitted_at = models.DateTimeField(null=True, blank=True)
    reviewed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    rejection_reason = models.TextField(blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'sup_application'
        verbose_name = 'Vendor Application'
        verbose_name_plural = 'Vendor Applications'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.company_name} - {self.status}'


class VendorApplicationDocument(models.Model):
    document_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    application = models.ForeignKey(VendorApplication, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=100)
    file_path = models.CharField(max_length=500)
    uploaded_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sup_application_document'
        verbose_name = 'Vendor Application Document'
        verbose_name_plural = 'Vendor Application Documents'

    def __str__(self):
        return f'{self.application.company_name} - {self.document_type}'


class SupplierDocument(models.Model):
    document_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='documents')
    document_type = models.CharField(max_length=100)
    file_path = models.CharField(max_length=500)
    expiry_date = models.DateField(null=True, blank=True)
    verification_status = models.CharField(max_length=20, choices=DOCUMENT_VERIFICATION_CHOICES, default='pending')

    class Meta:
        db_table = 'sup_document'
        verbose_name = 'Supplier Document'
        verbose_name_plural = 'Supplier Documents'

    def __str__(self):
        return f'{self.supplier.name} - {self.document_type}'


class SupplierPerformance(models.Model):
    performance_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='performances')
    contract = models.ForeignKey('contracts.Contract', on_delete=models.CASCADE, null=True, blank=True, related_name='supplier_performances')
    evaluation_date = models.DateField()
    metrics = models.JSONField(default=dict)
    overall_score = models.DecimalField(max_digits=5, decimal_places=2)
    needs_improvement = models.BooleanField(default=False)
    evaluated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True)
    improvement_notes = models.TextField(blank=True, default='')

    class Meta:
        db_table = 'sup_performance'
        verbose_name = 'Supplier Performance'
        verbose_name_plural = 'Supplier Performances'
        ordering = ['-evaluation_date']

    def __str__(self):
        return f'{self.supplier.name} - {self.overall_score}'


class SupplierRiskScore(models.Model):
    risk_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, related_name='risk_scores')
    risk_score = models.DecimalField(max_digits=5, decimal_places=2)
    risk_level = models.CharField(max_length=20, choices=RISK_LEVEL_CHOICES)
    calculated_at = models.DateTimeField(auto_now_add=True)
    factors = models.JSONField(default=dict)

    class Meta:
        db_table = 'sup_risk_score'
        verbose_name = 'Supplier Risk Score'
        verbose_name_plural = 'Supplier Risk Scores'
        ordering = ['-calculated_at']

    def __str__(self):
        return f'{self.supplier.name} - {self.risk_score}'


class Blacklist(models.Model):
    blacklist_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    supplier = models.ForeignKey(Supplier, on_delete=models.CASCADE, null=True, blank=True, related_name='blacklist_entries')
    tin = models.CharField(max_length=50, blank=True)
    registration_number = models.CharField(max_length=50, blank=True)
    reason = models.TextField()
    debarred_until = models.DateField(null=True, blank=True)
    source = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'sup_blacklist'
        verbose_name = 'Blacklist'
        verbose_name_plural = 'Blacklists'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.supplier.name if self.supplier else self.tin} - Blacklisted'
