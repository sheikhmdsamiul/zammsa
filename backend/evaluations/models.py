import uuid
from django.db import models
from django.utils import timezone
from accounts.models import User
from solicitations.models import Solicitation, EvaluationCriterion
from bids.models import BidSubmission

BER_STATUS_CHOICES = [
    ('draft', 'Draft'),
    ('submitted', 'Submitted'),
    ('approved', 'Approved'),
    ('rejected', 'Rejected'),
]

PQ_STATUS_CHOICES = [
    ('pending', 'Pending'),
    ('cleared', 'Cleared'),
    ('failed', 'Failed'),
]


class EvaluationCommittee(models.Model):
    committee_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='evaluation_committees')
    members = models.JSONField(default=list)
    chairperson = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chaired_committees')
    secretary = models.ForeignKey(User, on_delete=models.CASCADE, related_name='secretary_committees')
    require_coi = models.BooleanField(default=True, help_text='Require COI declarations from all members before evaluation')
    formed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eval_committee'
        verbose_name = 'Evaluation Committee'
        verbose_name_plural = 'Evaluation Committees'

    def __str__(self):
        return f'Committee for {self.solicitation.sol_number}'


class PreliminaryExam(models.Model):
    exam_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='preliminary_exams')
    criterion = models.CharField(max_length=255)
    is_compliant = models.BooleanField(default=False)
    comment = models.TextField(blank=True)

    class Meta:
        db_table = 'eval_preliminary_exam'
        verbose_name = 'Preliminary Examination'
        verbose_name_plural = 'Preliminary Examinations'

    def __str__(self):
        status = 'Compliant' if self.is_compliant else 'Non-Compliant'
        return f'{self.bid.submission_id} - {self.criterion}: {status}'


DECLARATION_TYPE_CHOICES = [
    ('no_conflict', 'No Conflict'),
    ('general_conflict', 'General Conflict'),
    ('specific_conflict', 'Conflict with Specific Bidder(s)'),
]


class ConflictOfInterest(models.Model):
    coi_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    committee = models.ForeignKey('EvaluationCommittee', on_delete=models.CASCADE, related_name='conflict_declarations')
    member = models.ForeignKey(User, on_delete=models.CASCADE, related_name='coi_declarations')
    declaration = models.TextField(blank=True, help_text='Details of the conflict or reason for declaration')
    has_conflict = models.BooleanField(default=False)
    declaration_type = models.CharField(max_length=30, choices=DECLARATION_TYPE_CHOICES, default='no_conflict')
    conflicted_bidders = models.JSONField(default=list, blank=True, help_text='List of bidder IDs or names for specific conflicts')
    explanation = models.TextField(blank=True, default='', help_text='Explanation required when conflict is declared')
    confidentiality_agreed = models.BooleanField(default=False, help_text='Member agreed to maintain confidentiality')
    recused = models.BooleanField(default=False, help_text='Auto-set to True when has_conflict=True')
    declared_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eval_coi'
        verbose_name = 'Conflict of Interest'
        verbose_name_plural = 'Conflicts of Interest'
        unique_together = ('committee', 'member')

    def save(self, *args, **kwargs):
        if self.has_conflict:
            self.recused = True
        super().save(*args, **kwargs)

    def __str__(self):
        status = f"Conflict" if self.has_conflict else "No Conflict"
        return f'{self.member.full_name} - {status}'


class TechnicalScore(models.Model):
    score_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='technical_scores')
    evaluator = models.ForeignKey(User, on_delete=models.CASCADE)
    criterion = models.ForeignKey(EvaluationCriterion, on_delete=models.CASCADE)
    raw_score = models.DecimalField(max_digits=5, decimal_places=2)
    weighted_score = models.DecimalField(max_digits=5, decimal_places=2)
    comment = models.TextField(blank=True)
    is_final = models.BooleanField(default=False, help_text='True once all evaluators have scored this bid')
    submitted_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eval_technical_score'
        verbose_name = 'Technical Score'
        verbose_name_plural = 'Technical Scores'
        unique_together = ('bid', 'evaluator', 'criterion')

    def __str__(self):
        return f'{self.bid.submission_id} - {self.criterion.criterion_name}: {self.raw_score}'


PREFERENCE_MARGIN_CHOICES = [
    ('0', '0% (No Preference)'),
    ('4', '4%'),
    ('8', '8%'),
    ('12', '12%'),
    ('15', '15%'),
]


class FinancialEvaluation(models.Model):
    evaluation_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='financial_evaluations')
    original_price = models.DecimalField(max_digits=20, decimal_places=2)
    corrected_price = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    currency_converted_price = models.DecimalField(max_digits=20, decimal_places=2, null=True, blank=True)
    source_currency = models.CharField(max_length=10, default='ZMW')
    conversion_rate = models.DecimalField(max_digits=10, decimal_places=4, null=True, blank=True)
    preference_applied = models.DecimalField(max_digits=5, decimal_places=2, default=0)
    preference_category = models.CharField(max_length=5, choices=PREFERENCE_MARGIN_CHOICES, default='0')
    arithmetic_corrections = models.JSONField(default=list, blank=True,
        help_text='List of {line_item, unit_price, quantity, stated_total, corrected_total}')
    evaluated_price = models.DecimalField(max_digits=20, decimal_places=2)
    financial_score = models.DecimalField(max_digits=5, decimal_places=2)

    class Meta:
        db_table = 'eval_financial'
        verbose_name = 'Financial Evaluation'
        verbose_name_plural = 'Financial Evaluations'

    def __str__(self):
        return f'{self.bid.submission_id} - Score: {self.financial_score}'


class CombinedScore(models.Model):
    combined_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='combined_scores')
    technical_score = models.DecimalField(max_digits=5, decimal_places=2)
    financial_score = models.DecimalField(max_digits=5, decimal_places=2)
    total_score = models.DecimalField(max_digits=5, decimal_places=2)
    rank = models.IntegerField()

    class Meta:
        db_table = 'eval_combined_score'
        verbose_name = 'Combined Score'
        verbose_name_plural = 'Combined Scores'
        ordering = ['rank']

    def __str__(self):
        return f'{self.bid.submission_id} - Rank {self.rank}: {self.total_score}'


class BidEvaluationReport(models.Model):
    ber_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ber_number = models.CharField(max_length=50, unique=True, null=True, blank=True)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='evaluation_reports')
    report_content = models.JSONField(default=dict)
    signatures = models.JSONField(default=list, blank=True,
        help_text='List of {member_id, member_name, signed_at, role}')
    status = models.CharField(max_length=20, choices=BER_STATUS_CHOICES, default='draft')
    rejection_reason = models.TextField(blank=True, default='')
    approved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='ber_approvals')
    created_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='ber_creators')
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)
    submitted_at = models.DateTimeField(null=True, blank=True)
    approved_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'eval_ber'
        verbose_name = 'Bid Evaluation Report'
        verbose_name_plural = 'Bid Evaluation Reports'

    def save(self, *args, **kwargs):
        if not self.ber_number:
            from zammsa_backend.utils import generate_traceable_id, resolve_solicitation_context

            dept, fiscal_year = resolve_solicitation_context(self.solicitation)
            self.ber_number = generate_traceable_id('BER', dept, BidEvaluationReport, 'ber_number', fiscal_year)
        super().save(*args, **kwargs)

    def __str__(self):
        return self.ber_number or f'BER {self.ber_id}'[:30]

    def has_all_signed(self):
        committees = EvaluationCommittee.objects.filter(solicitation=self.solicitation)
        required = []
        for c in committees:
            for m in c.members:
                uid = m.get('user') if isinstance(m, dict) else m
                if uid:
                    required.append(str(uid))
            if c.chairperson_id:
                required.append(str(c.chairperson_id))
            if c.secretary_id:
                required.append(str(c.secretary_id))
        if not required:
            return False
        signed_ids = {s['member_id'] for s in self.signatures}
        return all(uid in signed_ids for uid in required)


class PostQualification(models.Model):
    pq_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ber = models.ForeignKey(BidEvaluationReport, on_delete=models.CASCADE, related_name='post_qualifications')
    bidder = models.ForeignKey(BidSubmission, on_delete=models.CASCADE)
    verification_items = models.JSONField(default=dict)
    status = models.CharField(max_length=20, choices=PQ_STATUS_CHOICES, default='pending')
    verified_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = 'eval_post_qualification'
        verbose_name = 'Post Qualification'
        verbose_name_plural = 'Post Qualifications'

    def __str__(self):
        return f'{self.bidder.submission_id} - {self.status}'
