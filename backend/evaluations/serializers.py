from rest_framework import serializers
from .models import (
    EvaluationCommittee, ConflictOfInterest, PreliminaryExam, TechnicalScore,
    FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification,
    PQActionLog, AwardAppeal, AppealActionLog,
)
from bids.models import BidSubmission


class ConflictOfInterestSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='coi_id', read_only=True)
    member_name = serializers.CharField(source='member.full_name', read_only=True)
    member_email = serializers.EmailField(source='member.email', read_only=True)

    class Meta:
        model = ConflictOfInterest
        fields = '__all__'
        read_only_fields = ('coi_id', 'declared_at', 'recused')


class EvaluationCommitteeSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='committee_id', read_only=True)
    chairperson_name = serializers.CharField(source='chairperson.full_name', read_only=True)
    secretary_name = serializers.CharField(source='secretary.full_name', read_only=True)
    formed_date = serializers.DateTimeField(source='formed_at', read_only=True)
    status = serializers.SerializerMethodField()
    coi_declarations = ConflictOfInterestSerializer(many=True, read_only=True, source='conflict_declarations')
    member_count = serializers.SerializerMethodField()
    total_members = serializers.SerializerMethodField()
    quorum_required = serializers.SerializerMethodField()
    quorum_met = serializers.SerializerMethodField()
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True, default='')
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True, default='')
    solicitation_status = serializers.CharField(source='solicitation.status', read_only=True, default='')
    current_phase = serializers.SerializerMethodField()
    phase_progress = serializers.SerializerMethodField()
    re_evaluation_required = serializers.SerializerMethodField()
    re_evaluation_reason = serializers.SerializerMethodField()
    re_evaluation_date = serializers.SerializerMethodField()

    PHASE_ORDER = ['coi', 'preliminary', 'technical', 'consolidation', 'financial', 'post-qual', 'ber']
    PHASE_LABELS = {
        'coi': 'COI Declaration',
        'preliminary': 'Preliminary Examination',
        'technical': 'Technical Scoring',
        'financial': 'Financial Evaluation',
        'consolidation': 'Score Consolidation',
        'ber': 'BER Workflow',
        'post-qual': 'Post-Qualification',
    }

    class Meta:
        model = EvaluationCommittee
        fields = '__all__'
        read_only_fields = ('committee_id', 'formed_at')

    def get_status(self, obj):
        return 'active'

    def get_member_count(self, obj):
        official = len(obj.members) if isinstance(obj.members, list) else 0
        non_official = len(obj.non_official_members or [])
        return official + non_official

    def get_total_members(self, obj):
        return obj.total_members_count()

    def get_quorum_required(self, obj):
        return obj.quorum_required()

    def get_quorum_met(self, obj):
        return obj.quorum_met()

    def _check_phase_completion(self, sol):
        from .models import PreliminaryExam, TechnicalScore, FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification, EvaluationCommittee, ConflictOfInterest
        from bids.models import BidSubmission

        total_bids = BidSubmission.objects.filter(solicitation=sol).count()

        # COI: check if all committee members have declared
        coi_done = False
        committees = EvaluationCommittee.objects.filter(solicitation=sol)
        if committees.exists():
            all_member_ids = set()
            for c in committees:
                if c.chairperson_id:
                    all_member_ids.add(str(c.chairperson_id))
                if c.secretary_id:
                    all_member_ids.add(str(c.secretary_id))
                for m in (c.members or []):
                    uid = m.get('user') if isinstance(m, dict) else m
                    if uid:
                        all_member_ids.add(str(uid))
            if all_member_ids:
                declared_count = ConflictOfInterest.objects.filter(
                    committee__solicitation=sol,
                    member_id__in=all_member_ids,
                ).values('member').distinct().count()
                coi_done = declared_count >= len(all_member_ids)

        prelim_done = False
        if total_bids > 0:
            required_member_ids = set()
            for c in committees:
                for m in (c.members or []):
                    uid = m.get('user') if isinstance(m, dict) else m
                    if uid:
                        required_member_ids.add(str(uid))
                if c.chairperson_id:
                    required_member_ids.add(str(c.chairperson_id))
                if c.secretary_id:
                    required_member_ids.add(str(c.secretary_id))
            for nom_m in committees.values_list('non_official_members', flat=True):
                for nom in (nom_m or []):
                    uid = nom.get('user_id') if isinstance(nom, dict) else None
                    if uid:
                        required_member_ids.add(str(uid))
            recused_ids = set(ConflictOfInterest.objects.filter(
                committee__solicitation=sol, recused=True
            ).values_list('member_id', flat=True))
            required_member_ids -= {str(uid) for uid in recused_ids}

            if required_member_ids:
                from django.db.models import Count
                member_exam_counts = (
                    PreliminaryExam.objects.filter(
                        bid__solicitation=sol,
                        evaluated_by__isnull=False,
                    )
                    .values('evaluated_by')
                    .annotate(bid_count=Count('bid', distinct=True))
                )
                member_bid_map = {str(e['evaluated_by']): e['bid_count'] for e in member_exam_counts}
                prelim_done = all(
                    member_bid_map.get(mid, 0) >= total_bids
                    for mid in required_member_ids
                )
            else:
                prelim_done = False

        tech_scores = TechnicalScore.objects.filter(bid__solicitation=sol)
        tech_unique_pairs = tech_scores.values('bid', 'evaluator').distinct().count()
        total_members = 0
        for c in committees:
            total_members = max(total_members, len(c.members or []))
        expected_pairs = total_bids * total_members if total_members > 0 else 0
        tech_done = tech_unique_pairs >= expected_pairs and expected_pairs > 0

        fin_bids = FinancialEvaluation.objects.filter(bid__solicitation=sol).values('bid').distinct().count()
        fin_done = fin_bids >= total_bids and total_bids > 0

        cons_done = CombinedScore.objects.filter(bid__solicitation=sol).exists()

        ber_done = BidEvaluationReport.objects.filter(solicitation=sol, status__in=['submitted', 'approved']).exists()

        pq_done = False
        winner = BidSubmission.objects.filter(solicitation=sol, status='awarded').first()
        if winner:
            pq_done = PostQualification.objects.filter(
                bidder=winner, status='cleared'
            ).exists()

        return {
            'coi': coi_done,
            'preliminary': prelim_done,
            'technical': tech_done,
            'financial': fin_done,
            'consolidation': cons_done,
            'ber': ber_done,
            'post-qual': pq_done,
        }

    def get_current_phase(self, obj):
        sol = obj.solicitation
        if not hasattr(self, '_phase_cache') or self._phase_cache.get('sol_id') != sol.pk:
            self._phase_cache = {'sol_id': sol.pk, 'result': self._check_phase_completion(sol)}
        phase_done = self._phase_cache['result']
        for phase_id in self.PHASE_ORDER:
            if not phase_done.get(phase_id, False):
                return {'id': phase_id, 'label': self.PHASE_LABELS[phase_id]}
        return {'id': 'ber', 'label': 'BER Workflow'}

    def get_phase_progress(self, obj):
        sol = obj.solicitation
        if not hasattr(self, '_phase_cache') or self._phase_cache.get('sol_id') != sol.pk:
            self._phase_cache = {'sol_id': sol.pk, 'result': self._check_phase_completion(sol)}
        phase_done = self._phase_cache['result']
        completed = sum(1 for pid in self.PHASE_ORDER if phase_done.get(pid, False))
        total = len(self.PHASE_ORDER)
        return {'completed': completed, 'total': total, 'percent': round((completed / total) * 100) if total else 0}

    def _get_re_evaluation_context(self, obj):
        """Get the re-evaluation log and appeal for this solicitation."""
        if not hasattr(self, '_reeval_cache') or self._reeval_cache.get('sol_id') != obj.solicitation_id:
            self._reeval_cache = {'sol_id': obj.solicitation_id, 'log': None, 'appeal': None}
            if obj.solicitation_id:
                log = AppealActionLog.objects.filter(
                    action='re_evaluation_initiated',
                    appeal__solicitation=obj.solicitation,
                ).order_by('-created_at').first()
                if log:
                    self._reeval_cache['log'] = log
                    self._reeval_cache['appeal'] = log.appeal
                else:
                    appeal = AwardAppeal.objects.filter(
                        solicitation=obj.solicitation,
                        status='upheld',
                    ).order_by('-resolved_at').first()
                    if appeal and obj.solicitation.status == 'evaluation':
                        self._reeval_cache['appeal'] = appeal
        return self._reeval_cache['log'], self._reeval_cache['appeal']

    def get_re_evaluation_required(self, obj):
        """Check if there's a pending re-evaluation for this solicitation."""
        log, appeal = self._get_re_evaluation_context(obj)
        if not appeal:
            return False
        sol = obj.solicitation
        prelim_done = PreliminaryExam.objects.filter(bid__solicitation=sol).values('bid').distinct().count()
        total_bids = BidSubmission.objects.filter(solicitation=sol).count()
        return prelim_done == 0 and total_bids > 0

    def get_re_evaluation_reason(self, obj):
        """Get the reason for the re-evaluation."""
        log, appeal = self._get_re_evaluation_context(obj)
        if not appeal:
            return None
        resolution = appeal.resolution or ''
        grounds = appeal.get_grounds_display() if hasattr(appeal, 'get_grounds_display') else appeal.grounds
        return {
            'grounds': grounds,
            'resolution': resolution,
            'initiated_by': log.performed_by.full_name if log and log.performed_by else (appeal.resolved_by.full_name if appeal.resolved_by else None),
            'details': log.details if log else '',
        }

    def get_re_evaluation_date(self, obj):
        """Get when the re-evaluation was initiated."""
        log, appeal = self._get_re_evaluation_context(obj)
        if log:
            return log.created_at.isoformat() if log.created_at else None
        if appeal and appeal.resolved_at:
            return appeal.resolved_at.isoformat()
        return None

    def validate_members(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Members must be a list.')
        return value

    def validate_non_official_members(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Non-official members must be a list.')
        for m in value:
            if not isinstance(m, dict):
                raise serializers.ValidationError('Each non-official member must be an object.')
            if not m.get('first_name') or not m.get('last_name'):
                raise serializers.ValidationError('Each non-official member must have a first and last name.')
            if not m.get('expertise'):
                raise serializers.ValidationError('Each non-official member must have defined expertise.')
        return value

    def validate(self, attrs):
        members = attrs.get('members', [])
        non_official = attrs.get('non_official_members', [])
        def _to_id(val):
            if val is None:
                return ''
            if hasattr(val, 'pk'):
                return str(val.pk)
            return str(val)
        chairperson_id = _to_id(attrs.get('chairperson'))
        secretary_id = _to_id(attrs.get('secretary'))
        if not chairperson_id:
            raise serializers.ValidationError({'chairperson': 'Chairperson is required.'})
        if not secretary_id:
            raise serializers.ValidationError({'secretary': 'Secretary is required.'})
        if chairperson_id == secretary_id:
            raise serializers.ValidationError('Chairperson and secretary must be different users.')
        if chairperson_id in [_to_id(m) for m in members if _to_id(m)]:
            pass  # chairperson can also be a member
        all_members = list({_to_id(m) for m in members if _to_id(m)} | {chairperson_id, secretary_id})
        if len(all_members) + len(non_official) < 3:
            raise serializers.ValidationError(
                'Committee must have at least 3 unique members (including chairperson, secretary, and non-official members).'
            )
        attrs['members'] = all_members
        return attrs


class PreliminaryExamSerializer(serializers.ModelSerializer):
    evaluated_by_name = serializers.CharField(source='evaluated_by.full_name', read_only=True)

    class Meta:
        model = PreliminaryExam
        fields = '__all__'
        read_only_fields = ('exam_id', 'evaluated_by')


class TechnicalScoreSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='score_id', read_only=True)
    evaluator_name = serializers.CharField(source='evaluator.full_name', read_only=True)
    criterion_name = serializers.CharField(source='criterion.criterion_name', read_only=True)

    class Meta:
        model = TechnicalScore
        fields = '__all__'
        read_only_fields = ('score_id', 'submitted_at', 'weighted_score')


class FinancialEvaluationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='evaluation_id', read_only=True)
    bidder_name = serializers.CharField(source='bid.supplier.full_name', read_only=True)
    submission_id = serializers.CharField(source='bid.submission_id', read_only=True)

    class Meta:
        model = FinancialEvaluation
        fields = '__all__'
        read_only_fields = ('evaluation_id', 'financial_score', 'evaluated_price')


class CombinedScoreSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='combined_id', read_only=True)
    bidder_name = serializers.CharField(source='bid.supplier.full_name', read_only=True)
    submission_id = serializers.CharField(source='bid.submission_id', read_only=True)

    class Meta:
        model = CombinedScore
        fields = '__all__'
        read_only_fields = ('combined_id', 'total_score', 'rank')


class BidEvaluationReportSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='ber_id', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True, allow_null=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True, allow_null=True)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True, default='')
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True, default='')
    all_signed = serializers.SerializerMethodField()
    signed_count = serializers.SerializerMethodField()
    required_count = serializers.SerializerMethodField()

    class Meta:
        model = BidEvaluationReport
        fields = '__all__'
        read_only_fields = ('ber_id', 'ber_number', 'created_at', 'updated_at', 'approved_at', 'submitted_at')

    def get_all_signed(self, obj):
        return obj.has_all_signed()

    def get_signed_count(self, obj):
        return len(obj.signatures)

    def get_required_count(self, obj):
        committees = EvaluationCommittee.objects.filter(solicitation=obj.solicitation)
        member_ids = set()
        for c in committees:
            if c.chairperson_id:
                member_ids.add(str(c.chairperson_id))
            if c.secretary_id:
                member_ids.add(str(c.secretary_id))
            for member in c.members or []:
                if isinstance(member, dict):
                    uid = member.get('user')
                else:
                    uid = member
                if uid:
                    member_ids.add(str(uid))
            for nom in (c.non_official_members or []):
                uid = nom.get('user_id')
                if uid:
                    member_ids.add(str(uid))
                # Non-official members without a user_id cannot log in and therefore
                # cannot sign the BER — they must NOT be counted in required_count,
                # consistent with has_all_signed() which also skips them.
        return len(member_ids) if member_ids else 0


class PQActionLogSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='log_id', read_only=True)
    performed_by_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = PQActionLog
        fields = '__all__'
        read_only_fields = ('log_id', 'created_at')

    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else None


class PostQualificationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='pq_id', read_only=True)
    bidder_name = serializers.CharField(source='bidder.supplier.full_name', read_only=True)
    submission_id = serializers.CharField(source='bidder.submission_id', read_only=True)
    assigned_to_name = serializers.SerializerMethodField()
    recommended_by_name = serializers.SerializerMethodField()
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True, default=None)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True, default=None)
    total_items = serializers.SerializerMethodField()
    completed_items = serializers.SerializerMethodField()
    progress_percent = serializers.SerializerMethodField()
    action_logs = PQActionLogSerializer(many=True, read_only=True)
    days_until_deadline = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    auto_verified_count = serializers.SerializerMethodField()
    manual_check_count = serializers.SerializerMethodField()
    failed_count = serializers.SerializerMethodField()
    category_summary = serializers.SerializerMethodField()
    stage_display = serializers.SerializerMethodField()
    result_display = serializers.SerializerMethodField()
    open_conditions_count = serializers.SerializerMethodField()
    pending_doc_requests = serializers.SerializerMethodField()

    class Meta:
        model = PostQualification
        fields = '__all__'
        read_only_fields = ('pq_id', 'created_at', 'updated_at')

    def get_assigned_to_name(self, obj):
        return obj.assigned_to.full_name if obj.assigned_to else None

    def get_recommended_by_name(self, obj):
        return obj.recommended_by.full_name if obj.recommended_by else None

    def get_total_items(self, obj):
        items = obj.verification_items or []
        return len(items)

    def get_completed_items(self, obj):
        items = obj.verification_items or []
        return len([i for i in items if i.get('status') in ('cleared', 'failed')])

    def get_progress_percent(self, obj):
        items = obj.verification_items or []
        if not items:
            return 0
        done = len([i for i in items if i.get('status') in ('cleared', 'failed')])
        return round((done / len(items)) * 100) if items else 0

    def get_days_until_deadline(self, obj):
        if not obj.deadline:
            return None
        from django.utils import timezone
        delta = obj.deadline - timezone.now()
        return delta.days

    def get_is_overdue(self, obj):
        if not obj.deadline:
            return False
        from django.utils import timezone
        return timezone.now() > obj.deadline and obj.status not in ('cleared', 'failed')

    def get_auto_verified_count(self, obj):
        items = obj.verification_items or []
        return len([i for i in items if i.get('verification_method') == 'auto'])

    def get_manual_check_count(self, obj):
        items = obj.verification_items or []
        return len([i for i in items if i.get('verification_method') != 'auto'])

    def get_failed_count(self, obj):
        items = obj.verification_items or []
        return len([i for i in items if i.get('status') == 'failed'])

    def get_category_summary(self, obj):
        items = obj.verification_items or []
        summary = {}
        for item in items:
            cat = item.get('category', 'other')
            if cat not in summary:
                summary[cat] = {'total': 0, 'cleared': 0, 'failed': 0, 'pending': 0}
            summary[cat]['total'] += 1
            status = item.get('status', 'pending')
            if status in summary[cat]:
                summary[cat][status] += 1
        return summary

    def get_stage_display(self, obj):
        stage = obj.workflow_stage or 'initiation'
        stage_labels = dict([
            ('initiation', 'Initiation'),
            ('desktop_review', 'Desktop Review'),
            ('document_collection', 'Document Collection'),
            ('site_inspection', 'Site Inspection'),
            ('reference_check', 'Reference Check'),
            ('evaluation', 'Evaluation & Recommendation'),
            ('committee_review', 'Committee Review'),
            ('closed', 'Closed'),
        ])
        return stage_labels.get(stage, stage.replace('_', ' ').title())

    def get_result_display(self, obj):
        if not obj.result:
            return 'Not Yet Decided'
        labels = dict(PQ_RESULT_CHOICES)
        return labels.get(obj.result, obj.result.replace('_', ' ').title())

    def get_open_conditions_count(self, obj):
        if not obj.conditions:
            return 0
        return len([c for c in obj.conditions if c.get('status') != 'verified'])

    def get_pending_doc_requests(self, obj):
        if not obj.pq_document_requests:
            return 0
        return len([d for d in obj.pq_document_requests if d.get('status') in ('requested', 'overdue')])


class AwardAppealSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='appeal_id', read_only=True)
    bidder_name = serializers.CharField(source='bidder.supplier.full_name', read_only=True)
    submission_id = serializers.CharField(source='bidder.submission_id', read_only=True)
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True)
    filed_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    ground_label = serializers.CharField(source='get_grounds_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    days_since_filed = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    hearing_date_display = serializers.SerializerMethodField()

    class Meta:
        model = AwardAppeal
        fields = '__all__'
        read_only_fields = ('appeal_id', 'filed_at', 'resolved_at', 'created_at', 'updated_at')

    def get_filed_by_name(self, obj):
        return obj.filed_by.full_name if obj.filed_by else None

    def get_resolved_by_name(self, obj):
        return obj.resolved_by.full_name if obj.resolved_by else None

    def get_is_active(self, obj):
        return obj.status in ('filed', 'under_review')

    def get_days_remaining(self, obj):
        return obj.days_remaining()

    def get_days_since_filed(self, obj):
        from django.utils import timezone
        return (timezone.now() - obj.filed_at).days if obj.filed_at else None

    def get_is_overdue(self, obj):
        return obj.is_overdue()

    def get_hearing_date_display(self, obj):
        if obj.hearing_date:
            return obj.hearing_date.strftime('%d %b %Y, %H:%M')
        return None


class AppealActionLogSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='log_id', read_only=True)
    performed_by_name = serializers.SerializerMethodField()
    action_display = serializers.CharField(source='get_action_display', read_only=True)

    class Meta:
        model = AppealActionLog
        fields = '__all__'
        read_only_fields = ('log_id', 'created_at')

    def get_performed_by_name(self, obj):
        return obj.performed_by.full_name if obj.performed_by else None


class AwardAppealDetailSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='appeal_id', read_only=True)
    bidder_name = serializers.CharField(source='bidder.supplier.full_name', read_only=True)
    submission_id = serializers.CharField(source='bidder.submission_id', read_only=True)
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True)
    solicitation_title = serializers.CharField(source='solicitation.title', read_only=True)
    filed_by_name = serializers.SerializerMethodField()
    resolved_by_name = serializers.SerializerMethodField()
    ground_label = serializers.CharField(source='get_grounds_display', read_only=True)
    status_label = serializers.CharField(source='get_status_display', read_only=True)
    is_active = serializers.SerializerMethodField()
    days_remaining = serializers.SerializerMethodField()
    days_since_filed = serializers.SerializerMethodField()
    is_overdue = serializers.SerializerMethodField()
    hearing_date_display = serializers.SerializerMethodField()
    action_logs = AppealActionLogSerializer(many=True, read_only=True)

    class Meta:
        model = AwardAppeal
        fields = '__all__'
        read_only_fields = ('appeal_id', 'filed_at', 'resolved_at', 'created_at', 'updated_at')

    def get_filed_by_name(self, obj):
        return obj.filed_by.full_name if obj.filed_by else None

    def get_resolved_by_name(self, obj):
        return obj.resolved_by.full_name if obj.resolved_by else None

    def get_is_active(self, obj):
        return obj.status in ('filed', 'under_review')

    def get_days_remaining(self, obj):
        return obj.days_remaining()

    def get_days_since_filed(self, obj):
        from django.utils import timezone
        return (timezone.now() - obj.filed_at).days if obj.filed_at else None

    def get_is_overdue(self, obj):
        return obj.is_overdue()

    def get_hearing_date_display(self, obj):
        if obj.hearing_date:
            return obj.hearing_date.strftime('%d %b %Y, %H:%M')
        return None
