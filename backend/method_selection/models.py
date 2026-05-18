import uuid
from django.db import models
from accounts.models import User
from requisitions.models import Requisition

METHOD_CHOICES = [
    ('open_tender', 'Open Tendering'),
    ('restricted', 'Restricted Tendering'),
    ('simplified', 'Simplified Bidding'),
    ('direct', 'Direct Procurement'),
    ('rfq', 'Request for Quotations'),
    ('proposal', 'Request for Proposals'),
    ('competitive_dialogue', 'Competitive Dialogue'),
]

NON_OPEN_CHOICES = [
    ('emergency', 'Emergency Procurement'),
    ('proprietary', 'Proprietary Rights'),
    ('sole_supplier', 'Sole Supplier'),
    ('continuity', 'Continuity of Supply'),
    ('below_threshold', 'Below Threshold Limit'),
]

NON_OPEN_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('submitted', 'Submitted for ZPC Approval'),
    ('zpc_approved', 'Approved by ZPC'),
    ('rejected', 'Rejected'),
]


class ProcurementMethodType(models.Model):
    method_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    method_name = models.CharField(max_length=255)
    method_code = models.CharField(max_length=50, unique=True, choices=METHOD_CHOICES)
    applicable_to = models.CharField(max_length=255, blank=True)
    threshold_min = models.DecimalField(max_digits=20, decimal_places=2, default=0)
    threshold_max = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    is_open = models.BooleanField(default=True)

    class Meta:
        db_table = 'method_type'
        verbose_name = 'Procurement Method Type'
        verbose_name_plural = 'Procurement Method Types'
        ordering = ['threshold_min']

    def __str__(self):
        return self.method_name


class MethodRecommendation(models.Model):
    recommendation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='method_recommendations')
    recommended_method = models.CharField(max_length=50, choices=METHOD_CHOICES)
    rationale = models.TextField()
    regulation_reference = models.CharField(max_length=100, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'method_recommendation'
        verbose_name = 'Method Recommendation'
        verbose_name_plural = 'Method Recommendations'

    def __str__(self):
        return f'{self.requisition.req_number} -> {self.recommended_method}'


class MethodOverride(models.Model):
    override_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='method_overrides')
    original_method = models.CharField(max_length=50)
    selected_method = models.CharField(max_length=50)
    reason = models.TextField()
    approved_by = models.ForeignKey(User, on_delete=models.CASCADE)
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'method_override'
        verbose_name = 'Method Override'
        verbose_name_plural = 'Method Overrides'

    def __str__(self):
        return f'{self.requisition.req_number}: {self.original_method} -> {self.selected_method}'


class NonOpenJustification(models.Model):
    justification_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    requisition = models.ForeignKey(Requisition, on_delete=models.CASCADE, related_name='non_open_justifications', null=True, blank=True)
    solicitation = models.ForeignKey('solicitations.Solicitation', on_delete=models.CASCADE, related_name='non_open_justifications', null=True, blank=True)
    method = models.CharField(max_length=50, choices=METHOD_CHOICES)
    reason_code = models.CharField(max_length=50, choices=NON_OPEN_CHOICES)
    reason_text = models.TextField()
    supporting_evidence_url = models.URLField(blank=True)
    status = models.CharField(max_length=50, choices=NON_OPEN_STATUS_CHOICES, default='draft')
    submitted_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='submitted_justifications')
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='approved_justifications')
    zpc_approved_at = models.DateTimeField(null=True, blank=True)
    rejection_reason = models.TextField(blank=True, default='')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'method_non_open_justification'
        verbose_name = 'Non-Open Procurement Justification'
        verbose_name_plural = 'Non-Open Procurement Justifications'

    def __str__(self):
        return f'{self.requisition.req_number} - {self.reason_code}'


class PreferenceScheme(models.Model):
    scheme_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    scheme_name = models.CharField(max_length=255)
    category = models.CharField(max_length=100)
    margin_percentage = models.DecimalField(max_digits=5, decimal_places=2)
    applies_to = models.CharField(max_length=255, blank=True)

    class Meta:
        db_table = 'method_preference_scheme'
        verbose_name = 'Preference Scheme'
        verbose_name_plural = 'Preference Schemes'

    def __str__(self):
        return f'{self.scheme_name} ({self.margin_percentage}%)'
