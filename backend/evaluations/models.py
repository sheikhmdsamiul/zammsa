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
    ('initiation', 'Initiation'),
    ('desktop_review', 'Desktop Review'),
    ('document_collection', 'Document Collection'),
    ('site_inspection', 'Site Inspection'),
    ('reference_check', 'Reference Check'),
    ('evaluation', 'Evaluation'),
    ('committee_review', 'Committee Review'),
    ('cleared', 'Cleared'),
    ('failed', 'Failed'),
]

PQ_RESULT_CHOICES = [
    ('', 'Not Decided'),
    ('award', 'Award — All Checks Passed'),
    ('award_with_conditions', 'Award with Conditions'),
    ('no_award', 'No Award — Failed'),
]


class EvaluationCommittee(models.Model):
    committee_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey(Solicitation, on_delete=models.CASCADE, related_name='evaluation_committees')
    members = models.JSONField(default=list, help_text='List of user IDs for official committee members')
    non_official_members = models.JSONField(default=list, blank=True,
        help_text='List of {first_name, last_name, email, expertise, valid_from, valid_until} for external/non-official members')
    chairperson = models.ForeignKey(User, on_delete=models.CASCADE, related_name='chaired_committees')
    secretary = models.ForeignKey(User, on_delete=models.CASCADE, related_name='secretary_committees')
    require_coi = models.BooleanField(default=True, help_text='Require COI declarations from all members before evaluation')
    formed_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eval_committee'
        verbose_name = 'Evaluation Committee'
        verbose_name_plural = 'Evaluation Committees'

    def total_members_count(self):
        """Return total number of committee members including chair, secretary, and non-official members."""
        members_set = set()
        for m in self.members or []:
            uid = m.get('user') if isinstance(m, dict) else m
            if uid:
                members_set.add(str(uid))
        if self.chairperson_id:
            members_set.add(str(self.chairperson_id))
        if self.secretary_id:
            members_set.add(str(self.secretary_id))
        non_official_count = len(self.non_official_members or [])
        return len(members_set) + non_official_count

    def quorum_required(self):
        """Return the minimum number of members needed for quorum (ceil(2/3))."""
        total = self.total_members_count()
        return (total * 2 + 2) // 3  # ceil(2/3 * total)

    def quorum_met(self):
        """Check if enough members have signed COI to proceed with evaluation."""
        signed_coi = self.conflict_declarations.filter(confidentiality_agreed=True).count()
        return signed_coi >= self.quorum_required()

    def __str__(self):
        return f'Committee for {self.solicitation.sol_number}'


class PreliminaryExam(models.Model):
    exam_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    bid = models.ForeignKey(BidSubmission, on_delete=models.CASCADE, related_name='preliminary_exams')
    criterion = models.CharField(max_length=255)
    is_compliant = models.BooleanField(default=False)
    comment = models.TextField(blank=True)
    evaluated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='preliminary_exams')

    class Meta:
        db_table = 'eval_preliminary_exam'
        verbose_name = 'Preliminary Examination'
        verbose_name_plural = 'Preliminary Examinations'

    def __str__(self):
        status = 'Compliant' if self.is_compliant else 'Non-Compliant'
        evaluator = self.evaluated_by.full_name if self.evaluated_by else 'Unknown'
        return f'{self.bid.submission_id} - {self.criterion}: {status} ({evaluator})'


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


PREFERENCE_CATEGORY_CHOICES = [
    ('non_citizen', 'Non-Citizen'),
    ('citizen_owned', 'Citizen-Owned'),
    ('citizen_empowered', 'Citizen-Empowered'),
    ('citizen_influenced', 'Citizen-Influenced'),
]

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
    preference_category = models.CharField(max_length=20, choices=PREFERENCE_CATEGORY_CHOICES, default='non_citizen')
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
    consolidated_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True,
        related_name='consolidated_scores', help_text='Chairperson who consolidated the scores')
    consolidated_at = models.DateTimeField(null=True, blank=True,
        help_text='When the scores were consolidated by the chairperson')

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
        required = set()
        for c in committees:
            for m in c.members:
                uid = m.get('user') if isinstance(m, dict) else m
                if uid:
                    required.add(str(uid))
            if c.chairperson_id:
                required.add(str(c.chairperson_id))
            if c.secretary_id:
                required.add(str(c.secretary_id))
            # Non-official members with a user_id are also required signatories
            for nom in (c.non_official_members or []):
                uid = nom.get('user_id')
                if uid:
                    required.add(str(uid))
        if not required:
            return False
        signed_ids = {s['member_id'] for s in self.signatures}
        return all(uid in signed_ids for uid in required)


class PostQualification(models.Model):
    pq_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    ber = models.ForeignKey(BidEvaluationReport, on_delete=models.CASCADE, related_name='post_qualifications', null=True, blank=True)
    bidder = models.ForeignKey(BidSubmission, on_delete=models.CASCADE)
    solicitation = models.ForeignKey('solicitations.Solicitation', on_delete=models.CASCADE, related_name='post_qualifications', null=True, blank=True,
        help_text='Direct reference to the solicitation (denormalized for ease of querying)')
    rank = models.IntegerField(null=True, blank=True, help_text='Rank from CombinedScore at time of PQ creation')

    verification_items = models.JSONField(default=list, blank=True,
        help_text='List of {id, label, category, status, notes, verified_by, verified_at, verification_method, auto_data}')

    workflow_stage = models.CharField(max_length=30, blank=True, default='initiation',
        choices=[
            ('initiation', 'Initiation'),
            ('desktop_review', 'Desktop Review'),
            ('document_collection', 'Document Collection'),
            ('site_inspection', 'Site Inspection'),
            ('reference_check', 'Reference Check'),
            ('evaluation', 'Evaluation & Recommendation'),
            ('committee_review', 'Committee Review'),
            ('closed', 'Closed'),
        ],
        help_text='Current active workflow stage')
    status = models.CharField(max_length=20, choices=PQ_STATUS_CHOICES, default='pending')
    assigned_to = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pq_assignments',
        help_text='Procurement Officer responsible for verification')
    notes = models.TextField(blank=True, default='')

    result = models.CharField(max_length=30, blank=True, default='', choices=PQ_RESULT_CHOICES,
        help_text='Final PQ result after committee decision')
    conditions = models.JSONField(default=list, blank=True,
        help_text='Structured list of conditions when result is award_with_conditions: {condition, deadline, status, verified_at}')
    recommendation = models.TextField(blank=True, default='',
        help_text='PQ Officer recommendation to the committee')
    recommended_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pq_recommendations',
        help_text='PQ Officer who made the recommendation')

    chair_decision = models.CharField(max_length=20, blank=True, default='',
        choices=[('', 'Pending'), ('passed', 'Post-Qualification Passed'), ('failed', 'Post-Qualification Failed')],
        help_text='Chair overall decision after reviewing all checks')
    chair_decision_notes = models.TextField(blank=True, default='',
        help_text='Chair narrative explaining the overall assessment')
    chair_decided_at = models.DateTimeField(null=True, blank=True)

    committee_review = models.JSONField(default=list, blank=True,
        help_text='List of {member_id, member_name, decision, comments, decided_at} for committee review')

    pq_document_requests = models.JSONField(default=list, blank=True,
        help_text='List of {request_id, document_type, description, requested_at, requested_by, due_date, submitted_at, file_url, status}')

    deadline = models.DateTimeField(null=True, blank=True,
        help_text='SLA deadline for completing post-qualification verification')
    initiation_date = models.DateTimeField(null=True, blank=True,
        help_text='When the PQ process was formally initiated')
    verified_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'eval_post_qualification'
        verbose_name = 'Post Qualification'
        verbose_name_plural = 'Post Qualifications'
        indexes = [
            models.Index(fields=['status'], name='idx_pq_status'),
            models.Index(fields=['workflow_stage'], name='idx_pq_workflow_stage'),
            models.Index(fields=['deadline'], name='idx_pq_deadline'),
            models.Index(fields=['assigned_to'], name='idx_pq_assigned_to'),
            models.Index(fields=['created_at'], name='idx_pq_created_at'),
            models.Index(fields=['rank'], name='idx_pq_rank'),
            models.Index(fields=['solicitation', 'status'], name='idx_pq_sol_stat'),
        ]

    def save(self, *args, **kwargs):
        items = self.verification_items or []
        old_status = None
        if self.pk:
            try:
                old = PostQualification.objects.get(pk=self.pk)
                old_status = old.status
            except PostQualification.DoesNotExist:
                pass

        if self.chair_decision == 'passed':
            self.status = 'cleared'
            self.result = 'award'
            self.workflow_stage = 'closed'
            if not self.verified_at:
                self.verified_at = timezone.now()
        elif self.chair_decision == 'failed':
            self.status = 'failed'
            self.result = 'no_award'
            self.workflow_stage = 'closed'

        if not self.initiation_date and self.status not in ('pending', 'initiation'):
            self.initiation_date = timezone.now()

        super().save(*args, **kwargs)

    def __str__(self):
        return f'{self.bidder.submission_id} - {self.status}'


PQ_ACTION_CHOICES = [
    ('item_updated', 'Verification Item Updated'),
    ('checklist_generated', 'Checklist Generated'),
    ('pq_assigned', 'Post-Qualification Assigned'),
    ('pq_reassigned', 'Post-Qualification Reassigned'),
    ('pq_cleared', 'Post-Qualification Cleared'),
    ('pq_failed', 'Post-Qualification Failed'),
    ('notes_added', 'Overall Notes Added'),
    ('chair_decision', 'Chair Decision Recorded'),
    ('auto_verified', 'Auto-Verification Completed'),
    ('reference_contacted', 'Reference Contacted'),
    ('stage_changed', 'Workflow Stage Changed'),
    ('document_requested', 'Document Requested'),
    ('document_submitted', 'Document Submitted'),
    ('condition_added', 'Condition Added'),
    ('condition_verified', 'Condition Verified'),
    ('recommendation_submitted', 'Recommendation Submitted'),
    ('committee_reviewed', 'Committee Member Reviewed'),
    ('pq_initiated', 'Post-Qualification Initiated'),
]


class PQActionLog(models.Model):
    log_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    pq = models.ForeignKey(PostQualification, on_delete=models.CASCADE, related_name='action_logs')
    action = models.CharField(max_length=30, choices=PQ_ACTION_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='pq_actions')
    details = models.TextField(blank=True, default='')
    metadata = models.JSONField(default=dict, blank=True,
        help_text='Structured data about the action (e.g. item_id, old_status, new_status)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eval_pq_action_log'
        verbose_name = 'PQ Action Log'
        verbose_name_plural = 'PQ Action Logs'
        ordering = ['-created_at']
        indexes = [
            models.Index(fields=['pq', 'created_at'], name='idx_pqlog_pq_created'),
            models.Index(fields=['action'], name='idx_pqlog_action'),
        ]

    def __str__(self):
        return f'{self.pq.bidder.submission_id} - {self.action} - {self.created_at}'


APPEAL_STATUS_CHOICES = [
    ('filed', 'Filed'),
    ('under_review', 'Under Review'),
    ('upheld', 'Upheld (Award Overturned)'),
    ('dismissed', 'Dismissed'),
    ('withdrawn', 'Withdrawn'),
]

APPEAL_GROUNDS_CHOICES = [
    ('scoring_error', 'Scoring or Evaluation Error'),
    ('procedural', 'Procedural Irregularity'),
    ('conflict_of_interest', 'Conflict of Interest'),
    ('eligibility', 'Eligibility / Qualification Error'),
    ('specification', 'Specification Deviation'),
    ('bias', 'Bias or Discrimination'),
    ('other', 'Other'),
]


class AwardAppeal(models.Model):
    appeal_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    solicitation = models.ForeignKey('solicitations.Solicitation', on_delete=models.CASCADE, related_name='award_appeals')
    bidder = models.ForeignKey('bids.BidSubmission', on_delete=models.CASCADE, related_name='appeals')
    filed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, related_name='filed_appeals')
    status = models.CharField(max_length=20, choices=APPEAL_STATUS_CHOICES, default='filed')
    grounds = models.CharField(max_length=30, choices=APPEAL_GROUNDS_CHOICES)
    grounds_detail = models.TextField(blank=True, default='',
        help_text='Detailed description of the grounds for appeal')
    supporting_documents = models.JSONField(default=list, blank=True,
        help_text='List of {name, description, file_url} for supporting evidence')
    # Internal review fields
    review_notes = models.TextField(blank=True, default='',
        help_text='Internal procurement officer review notes (not visible to bidder)')
    hearing_date = models.DateTimeField(null=True, blank=True,
        help_text='Scheduled hearing or meeting date for reviewing the appeal')
    clarification_requested = models.BooleanField(default=False,
        help_text='Whether a clarification has been requested from the bidder')
    clarification_request = models.TextField(blank=True, default='',
        help_text='Clarification question sent to the bidder')
    clarification_response = models.TextField(blank=True, default='',
        help_text='Bidder response to the clarification request')
    decision_letter = models.FileField(upload_to='appeals/decision_letters/', blank=True, default='',
        help_text='Uploaded appeal decision letter PDF')
    # Resolution fields
    resolution = models.TextField(blank=True, default='',
        help_text='Resolution outcome and reasoning')
    resolved_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='resolved_appeals')
    filed_at = models.DateTimeField(auto_now_add=True)
    resolution_deadline = models.DateTimeField(null=True, blank=True,
        help_text='Deadline for resolving the appeal (typically 14 days from filing)')
    resolved_at = models.DateTimeField(null=True, blank=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    class Meta:
        db_table = 'eval_award_appeal'
        verbose_name = 'Award Appeal'
        verbose_name_plural = 'Award Appeals'

    def days_remaining(self):
        """Days remaining until resolution deadline (negative = overdue)."""
        if not self.resolution_deadline:
            return None
        from django.utils import timezone
        delta = self.resolution_deadline - timezone.now()
        return delta.days

    def is_overdue(self):
        remaining = self.days_remaining()
        return remaining is not None and remaining < 0 and self.status in ('filed', 'under_review')

    def __str__(self):
        return f'Appeal {self.appeal_id} - {self.bidder.submission_id} - {self.status}'


APPEAL_ACTION_CHOICES = [
    ('filed', 'Appeal Filed'),
    ('acknowledged', 'Appeal Acknowledged'),
    ('under_review', 'Taken Under Review'),
    ('review_notes_added', 'Review Notes Added'),
    ('hearing_scheduled', 'Hearing Scheduled'),
    ('clarification_requested', 'Clarification Requested'),
    ('clarification_received', 'Clarification Response Received'),
    ('upheld', 'Appeal Upheld'),
    ('dismissed', 'Appeal Dismissed'),
    ('withdrawn', 'Appeal Withdrawn'),
    ('re_evaluation_initiated', 'Re-Evaluation Initiated'),
]


class AppealActionLog(models.Model):
    log_id = models.UUIDField(primary_key=True, default=uuid.uuid4, editable=False)
    appeal = models.ForeignKey(AwardAppeal, on_delete=models.CASCADE, related_name='action_logs')
    action = models.CharField(max_length=30, choices=APPEAL_ACTION_CHOICES)
    performed_by = models.ForeignKey(User, on_delete=models.SET_NULL, null=True, blank=True, related_name='appeal_actions')
    details = models.TextField(blank=True, default='',
        help_text='Additional details about the action taken')
    metadata = models.JSONField(default=dict, blank=True,
        help_text='Structured data about the action (e.g. old_status, new_status)')
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        db_table = 'eval_appeal_action_log'
        verbose_name = 'Appeal Action Log'
        verbose_name_plural = 'Appeal Action Logs'
        ordering = ['-created_at']

    def __str__(self):
        return f'{self.appeal.appeal_id} - {self.action} - {self.created_at}'
