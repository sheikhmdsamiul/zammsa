import uuid
from decimal import Decimal
from django.db import transaction
from django.db.models import Q, Avg, Sum, Prefetch
from django.template.loader import render_to_string
from django.http import HttpResponse
from django.utils import timezone
from rest_framework import generics, filters, status
from rest_framework.decorators import api_view, permission_classes
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.pagination import PageNumberPagination
from django_filters.rest_framework import DjangoFilterBackend
import django_filters
import pdfkit
from accounts.permissions import CanManageEvaluationCommittees, CanManagePostQualifications
from accounts.models import User
from accounts.serializers import UserCreateSerializer
from system_config.notifications import notify_role, notify_users, send_external_email

from .crypto_sign import sign_ber_payload, verify_signature
from .models import (
    EvaluationCommittee, ConflictOfInterest, PreliminaryExam, TechnicalScore,
    FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification,
    PQActionLog, AwardAppeal, AppealActionLog, PREFERENCE_MARGIN_CHOICES,
)
from .serializers import (
    EvaluationCommitteeSerializer, ConflictOfInterestSerializer, PreliminaryExamSerializer, TechnicalScoreSerializer,
    FinancialEvaluationSerializer, CombinedScoreSerializer, BidEvaluationReportSerializer,
    PostQualificationSerializer, AwardAppealSerializer, AwardAppealDetailSerializer, AppealActionLogSerializer,
)
from solicitations.models import Solicitation, EvaluationCriterion
from bids.models import BidSubmission, BidOpening, BidOpeningDetail, BidDocument, BidSecurity
from suppliers.models import Supplier as SupplierModel, VendorApplication, SupplierDocument, Blacklist


def _require_bid_opening_completed(solicitation):
    """Return an error Response if bid opening is not completed for this solicitation, else None."""
    if not BidOpening.objects.filter(solicitation=solicitation, status='completed').exists():
        return Response(
            {'error': 'Bid opening must be completed before proceeding to evaluation activities.'},
            status=400,
        )
    return None


def _committee_membership_ids(committee):
    member_ids = set()
    for member in committee.members or []:
        uid = member.get('user') if isinstance(member, dict) else member
        if uid:
            member_ids.add(str(uid))
    if committee.chairperson_id:
        member_ids.add(str(committee.chairperson_id))
    if committee.secretary_id:
        member_ids.add(str(committee.secretary_id))
    for nom in committee.non_official_members or []:
        uid = nom.get('user_id')
        if uid:
            member_ids.add(str(uid))
    return member_ids


def _create_temp_accounts_for_non_official_members(committee):
    non_official = committee.non_official_members or []
    if not non_official:
        return

    updated_non_official = []
    for member in non_official:
        first = member.get('first_name', '')
        last = member.get('last_name', '')
        email = member.get('email', '')
        expertise = member.get('expertise', '')
        if not email:
            updated_non_official.append(member)
            continue

        full_name = f'{first} {last}'.strip()
        if not full_name:
            updated_non_official.append(member)
            continue

        # Check if a user with this email already exists (e.g. from a previous create without user_id storage)
        existing_user = User.objects.filter(email=email).first()
        if existing_user:
            needs_email = not member.get('user_id')
            member['user_id'] = str(existing_user.id)
            updated_non_official.append(member)
            if needs_email:
                temp_pw = existing_user.temp_password or 'Contact the procurement team for new credentials.'
                subject = f'Evaluation Committee Access - {committee.solicitation.sol_number}'
                message = (
                    f'Dear {full_name},\n\n'
                    f'You have been assigned as a non-official evaluation committee member for '
                    f'{committee.solicitation.sol_number} — {committee.solicitation.title}.\n\n'
                    f'Your expertise area: {expertise}\n\n'
                    f'You can log in to the ZAMMSA Procurement System using the following credentials:\n\n'
                    f'Email: {email}\n'
                    f'Temporary Password: {temp_pw}\n\n'
                    f'You will be required to change your password on first login.\n'
                    f'This account is temporary and will be deactivated once the solicitation is awarded.\n\n'
                    f'Please log in and complete your Conflict of Interest declaration.\n\n'
                    f'Regards,\nZAMMSA Procurement Team'
                )
                send_external_email(subject, message, email)
            continue

        temp_password = str(uuid.uuid4())[:12]
        employee_id = f'TMP-EC-{uuid.uuid4().hex[:8].upper()}'

        user = User.objects.create_user(
            email=email,
            password=temp_password,
            employee_id=employee_id,
            full_name=full_name,
            role='evaluation_committee_member',
            is_active=True,
            must_change_password=True,
            temp_password=temp_password,
        )

        member['user_id'] = str(user.id)
        updated_non_official.append(member)

        subject = f'Evaluation Committee Access - {committee.solicitation.sol_number}'
        message = (
            f'Dear {full_name},\n\n'
            f'You have been assigned as a non-official evaluation committee member for '
            f'{committee.solicitation.sol_number} — {committee.solicitation.title}.\n\n'
            f'Your expertise area: {expertise}\n\n'
            f'You can log in to the ZAMMSA Procurement System using the following credentials:\n\n'
            f'Email: {email}\n'
            f'Temporary Password: {temp_password}\n\n'
            f'You will be required to change your password on first login.\n'
            f'This account is temporary and will be deactivated once the solicitation is awarded.\n\n'
            f'Please log in and complete your Conflict of Interest declaration.\n\n'
            f'Regards,\nZAMMSA Procurement Team'
        )
        send_external_email(subject, message, email)

    if updated_non_official:
        committee.non_official_members = updated_non_official
        committee.save(update_fields=['non_official_members'])


def _require_coi_clearance(solicitation):
    committees = EvaluationCommittee.objects.filter(solicitation=solicitation, require_coi=True)
    for committee in committees:
        expected_ids = _committee_membership_ids(committee)
        declarations = ConflictOfInterest.objects.filter(committee=committee)
        recused_ids = {str(uid) for uid in declarations.filter(recused=True).values_list('member_id', flat=True)}
        expected_ids -= recused_ids
        cleared = declarations.filter(
            has_conflict=False,
            recused=False,
            confidentiality_agreed=True,
        )
        declared_ids = {str(uid) for uid in cleared.values_list('member_id', flat=True)}
        missing = expected_ids - declared_ids
        if missing:
            return Response({
                'error': 'All active evaluation committee members must submit no-conflict/confidentiality declarations before evaluation can proceed.',
                'missing_member_ids': sorted(missing),
            }, status=400)
    return None


def _require_preliminary_exam_completion(solicitation):
    committees = EvaluationCommittee.objects.filter(solicitation=solicitation)
    if not committees.exists():
        return None

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
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if uid:
                required_member_ids.add(str(uid))

    recused_ids = set(ConflictOfInterest.objects.filter(
        committee__solicitation=solicitation, recused=True
    ).values_list('member_id', flat=True))
    required_member_ids -= {str(uid) for uid in recused_ids}

    if not required_member_ids:
        return None

    bid_ids = list(BidSubmission.objects.filter(
        solicitation=solicitation
    ).values_list('bid_id', flat=True))
    if not bid_ids:
        return None

    from django.db.models import Count
    member_exam_counts = (
        PreliminaryExam.objects.filter(
            bid__solicitation=solicitation,
            evaluated_by__isnull=False,
        )
        .values('evaluated_by')
        .annotate(bid_count=Count('bid', distinct=True))
        .filter(evaluated_by__isnull=False)
    )
    member_bid_map = {str(entry['evaluated_by']): entry['bid_count'] for entry in member_exam_counts}

    total_bids = len(bid_ids)
    incomplete_members = []
    for mid in required_member_ids:
        count = member_bid_map.get(mid, 0)
        if count < total_bids:
            incomplete_members.append(mid)

    if incomplete_members:
        return Response({
            'error': 'Every evaluation committee member must individually examine all bids before proceeding to technical scoring.',
            'incomplete_member_count': len(incomplete_members),
            'required_member_count': len(required_member_ids),
            'total_bids': total_bids,
        }, status=400)
    return None


def _bid_failed_preliminary(bid):
    return PreliminaryExam.objects.filter(bid=bid, is_compliant=False).exists()


def _resolve_supplier_profile(user):
    """Resolve the Supplier profile for a bid submission user."""
    from suppliers.models import Supplier as SupplierModel, VendorApplication
    sup = None
    emp_id = getattr(user, 'employee_id', None)
    if emp_id and str(emp_id).startswith('SUP-'):
        sup = SupplierModel.objects.filter(
            registration_number=str(emp_id).replace('SUP-', '', 1)
        ).first()
    if not sup:
        sup = SupplierModel.objects.filter(name=user.full_name).first()
    if not sup:
        va = VendorApplication.objects.filter(email=user.email, status='approved').order_by('-created_at').first()
        if va:
            sup = SupplierModel.objects.filter(
                Q(registration_number=va.registration_number) | Q(tin=va.tin)
            ).first()
    return sup


PHASE_LABELS = {
    'coi': 'COI Declaration',
    'preliminary': 'Preliminary Examination',
    'technical': 'Technical Scoring',
    'consolidation': 'Score Consolidation',
    'financial': 'Financial Evaluation',
    'post-qual': 'Post-Qualification',
    'ber': 'BER Workflow',
}


def _resolve_ec_members(solicitation):
    """Return all active EC members (User objects) for a solicitation, excluding recused members."""
    committees = EvaluationCommittee.objects.filter(solicitation=solicitation)
    member_ids = set()
    for c in committees:
        for m in (c.members or []):
            uid = m.get('user') if isinstance(m, dict) else m
            if uid:
                member_ids.add(str(uid))
        if c.chairperson_id:
            member_ids.add(str(c.chairperson_id))
        if c.secretary_id:
            member_ids.add(str(c.secretary_id))
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if uid:
                member_ids.add(str(uid))
    recused_ids = set(ConflictOfInterest.objects.filter(
        committee__solicitation=solicitation, recused=True
    ).values_list('member_id', flat=True))
    member_ids -= {str(uid) for uid in recused_ids}
    return User.objects.filter(id__in=member_ids, is_active=True)


def _check_phase_completion(solicitation, phase):
    """Check if a specific phase is complete for the given solicitation."""
    from django.db.models import Count
    committees = EvaluationCommittee.objects.filter(solicitation=solicitation)

    if phase == 'coi':
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
        if not all_member_ids:
            return False
        declared = ConflictOfInterest.objects.filter(
            committee__solicitation=solicitation,
            member_id__in=all_member_ids,
        ).values('member').distinct().count()
        return declared >= len(all_member_ids)

    elif phase == 'preliminary':
        total_bids = BidSubmission.objects.filter(solicitation=solicitation).count()
        if total_bids == 0:
            return False
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
            for nom in (c.non_official_members or []):
                uid = nom.get('user_id')
                if uid:
                    required_member_ids.add(str(uid))
        recused_ids = set(ConflictOfInterest.objects.filter(
            committee__solicitation=solicitation, recused=True
        ).values_list('member_id', flat=True))
        required_member_ids -= {str(uid) for uid in recused_ids}
        if not required_member_ids:
            return False
        member_exam_counts = (
            PreliminaryExam.objects.filter(
                bid__solicitation=solicitation, evaluated_by__isnull=False,
            )
            .values('evaluated_by')
            .annotate(bid_count=Count('bid', distinct=True))
        )
        member_bid_map = {str(e['evaluated_by']): e['bid_count'] for e in member_exam_counts}
        return all(member_bid_map.get(mid, 0) >= total_bids for mid in required_member_ids)

    elif phase == 'technical':
        total_bids = BidSubmission.objects.filter(solicitation=solicitation).count()
        if total_bids == 0:
            return False
        total_members = 0
        for c in committees:
            official = len(c.members or [])
            non_official = sum(1 for nom in (c.non_official_members or []) if nom.get('user_id'))
            total_members = max(total_members, official + non_official)
        if total_members == 0:
            return False
        tech_pairs = TechnicalScore.objects.filter(
            bid__solicitation=solicitation
        ).values('bid', 'evaluator').distinct().count()
        return tech_pairs >= total_bids * total_members

    elif phase == 'consolidation':
        return CombinedScore.objects.filter(bid__solicitation=solicitation).exists()

    elif phase == 'financial':
        fin_bids = FinancialEvaluation.objects.filter(
            bid__solicitation=solicitation
        ).values('bid').distinct().count()
        total_bids = BidSubmission.objects.filter(solicitation=solicitation).count()
        winner = BidSubmission.objects.filter(solicitation=solicitation, status='awarded').exists()
        return fin_bids >= total_bids and total_bids > 0 and winner

    elif phase == 'post-qual':
        winner = BidSubmission.objects.filter(solicitation=solicitation, status='awarded').first()
        if winner:
            return PostQualification.objects.filter(
                bidder=winner, status='cleared'
            ).exists()
        return False

    return False


def _notify_ec_phase_completion(solicitation, completed_phase):
    """Notify all active EC members that a phase is complete and they can proceed to the next phase."""
    phase_order = ['coi', 'preliminary', 'technical', 'consolidation', 'financial', 'post-qual', 'ber']
    try:
        idx = phase_order.index(completed_phase)
    except ValueError:
        return
    if idx >= len(phase_order) - 1:
        return
    next_phase = phase_order[idx + 1]
    next_label = PHASE_LABELS.get(next_phase, next_phase)
    completed_label = PHASE_LABELS.get(completed_phase, completed_phase)

    members = _resolve_ec_members(solicitation)
    if not members.exists():
        return

    action_url = f'/evaluations/preliminary/{solicitation.solicitation_id}' if next_phase == 'preliminary' else f'/evaluations'

    notify_users(
        list(members),
        title=f'Evaluation Phase Complete: {completed_label} — {solicitation.sol_number}',
        message=(
            f'The {completed_label} phase for {solicitation.sol_number} ({solicitation.title}) '
            f'has been completed. You can now proceed to the {next_label} phase.\n\n'
            f'Please log in to the ZAMMSA Procurement System to continue.'
        ),
        notification_type='workflow',
        priority='high',
        source_module='evaluations',
        object_id=str(solicitation.pk),
        action_url=action_url,
        metadata={
            'alert_key': 'evaluation_phase_completed',
            'solicitation_id': str(solicitation.solicitation_id),
            'sol_number': solicitation.sol_number,
            'completed_phase': completed_phase,
            'next_phase': next_phase,
        },
        email_required=True,
    )


def _technical_score_for_bid(bid):
    criteria = EvaluationCriterion.objects.filter(solicitation=bid.solicitation, criterion_type='technical')
    total_tech_weight = criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')
    total_weighted = Decimal('0')
    for criterion in criteria:
        avg = TechnicalScore.objects.filter(bid=bid, criterion=criterion, is_final=True).aggregate(avg=Avg('raw_score'))['avg']
        if avg is None:
            return None
        total_weighted += avg * criterion.weight / Decimal('100')
    return (total_weighted / total_tech_weight * Decimal('100')) if total_tech_weight > 0 else Decimal('0')


class StandardPagination(PageNumberPagination):
    page_size = 25
    page_size_query_param = 'page_size'
    max_page_size = 100


class BaseView:
    pagination_class = StandardPagination
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    permission_classes = [IsAuthenticated]


class EvaluationCommitteeFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(field_name='solicitation')

    class Meta:
        model = EvaluationCommittee
        fields = ['solicitation']


class TechnicalScoreFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(field_name='bid__solicitation')
    bid = django_filters.UUIDFilter(field_name='bid')
    evaluator = django_filters.UUIDFilter(field_name='evaluator')
    is_final = django_filters.BooleanFilter(field_name='is_final')

    class Meta:
        model = TechnicalScore
        fields = ['solicitation', 'bid', 'evaluator', 'is_final']


class FinancialEvaluationFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(field_name='bid__solicitation')
    bid = django_filters.UUIDFilter(field_name='bid')
    preference_category = django_filters.CharFilter(field_name='preference_category', lookup_expr='iexact')

    class Meta:
        model = FinancialEvaluation
        fields = ['solicitation', 'bid', 'preference_category']


class BidEvaluationReportFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(field_name='solicitation')
    status = django_filters.CharFilter(field_name='status', lookup_expr='iexact')

    class Meta:
        model = BidEvaluationReport
        fields = ['solicitation', 'status']


class PreliminaryExamFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(field_name='bid__solicitation')
    bid = django_filters.UUIDFilter(field_name='bid')

    class Meta:
        model = PreliminaryExam
        fields = ['solicitation', 'bid', 'is_compliant']


class PostQualificationFilter(django_filters.FilterSet):
    solicitation = django_filters.UUIDFilter(method='filter_solicitation')
    status = django_filters.CharFilter(field_name='status', lookup_expr='iexact')
    workflow_stage = django_filters.CharFilter(field_name='workflow_stage', lookup_expr='iexact')
    result = django_filters.CharFilter(field_name='result', lookup_expr='iexact')

    class Meta:
        model = PostQualification
        fields = ['solicitation', 'status', 'workflow_stage', 'result', 'bidder', 'assigned_to']

    def filter_solicitation(self, queryset, name, value):
        return queryset.filter(
            Q(solicitation=value) | Q(ber__solicitation=value) | Q(bidder__solicitation=value)
        )


class EvaluationCommitteeListView(BaseView, generics.ListCreateAPIView):
    queryset = EvaluationCommittee.objects.select_related('solicitation', 'chairperson', 'secretary').prefetch_related('conflict_declarations').all()
    serializer_class = EvaluationCommitteeSerializer
    filterset_class = EvaluationCommitteeFilter
    ordering = ['-formed_at']
    permission_classes = [CanManageEvaluationCommittees]

    def get_queryset(self):
        qs = super().get_queryset()
        mine = str(self.request.query_params.get('mine', '')).lower() in ('1', 'true', 'yes', 'on')
        if not mine:
            return qs

        user_id = str(self.request.user.id)
        my_committee_ids = []

        for committee in qs:
            member_ids = []
            for member in committee.members or []:
                if isinstance(member, dict):
                    member_ids.append(str(member.get('user') or ''))
                else:
                    member_ids.append(str(member))

            non_official_ids = [str(nom.get('user_id')) for nom in (committee.non_official_members or []) if nom.get('user_id')]

            if str(committee.chairperson_id) == user_id or str(committee.secretary_id) == user_id or user_id in member_ids or user_id in non_official_ids:
                my_committee_ids.append(committee.committee_id)

        return qs.filter(committee_id__in=my_committee_ids)

    def perform_create(self, serializer):
        committee = serializer.save()
        user_ids = _committee_membership_ids(committee)
        users = User.objects.filter(id__in=user_ids, is_active=True)
        notify_users(
            users,
            title=f'Evaluation committee assignment: {committee.solicitation.sol_number}',
            message=(
                f'You have been assigned to the evaluation committee for '
                f'{committee.solicitation.sol_number} — {committee.solicitation.title}. '
                f'Please review the assignment and complete your conflict declaration.'
            ),
            notification_type='approval',
            priority='high',
            source_module='evaluations',
            object_id=committee.pk,
            action_url='/evaluations',
            metadata={
                'committee_id': str(committee.pk),
                'solicitation_id': str(committee.solicitation_id),
                'sol_number': committee.solicitation.sol_number,
            },
            email_required=True,
        )

        _create_temp_accounts_for_non_official_members(committee)


class EvaluationCommitteeDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = EvaluationCommittee.objects.select_related(
        'chairperson', 'secretary', 'solicitation'
    ).prefetch_related('conflict_declarations__member')
    serializer_class = EvaluationCommitteeSerializer
    permission_classes = [CanManageEvaluationCommittees]

    def perform_update(self, serializer):
        committee = serializer.save()
        _create_temp_accounts_for_non_official_members(committee)


class PreliminaryExamListView(BaseView, generics.ListCreateAPIView):
    queryset = PreliminaryExam.objects.select_related('bid').all()
    serializer_class = PreliminaryExamSerializer
    filterset_class = PreliminaryExamFilter
    ordering = ['-exam_id']

    def create(self, request, *args, **kwargs):
        bid_id = request.data.get('bid')
        if bid_id:
            try:
                bid = BidSubmission.objects.get(pk=bid_id)
                err = _require_bid_opening_completed(bid.solicitation)
                if err:
                    return err
            except BidSubmission.DoesNotExist:
                pass

        bid = None
        if bid_id:
            try:
                bid = BidSubmission.objects.get(pk=bid_id)
            except BidSubmission.DoesNotExist:
                pass
        if bid:
            committee_ids = _get_committee_member_ids_for_bid(bid)
            if str(request.user.id) not in committee_ids:
                return Response({'error': 'Only evaluation committee members can submit preliminary examination results'}, status=403)

        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        exam = serializer.save(evaluated_by=self.request.user)
        if not exam.is_compliant and exam.bid.status != 'non_responsive':
            exam.bid.status = 'non_responsive'
            exam.bid.save(update_fields=['status'])
        if _check_phase_completion(exam.bid.solicitation, 'preliminary'):
            _notify_ec_phase_completion(exam.bid.solicitation, 'preliminary')


class PreliminaryExamDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PreliminaryExam.objects.all()
    serializer_class = PreliminaryExamSerializer
    permission_classes = [IsAuthenticated]


class TechnicalScoreListView(BaseView, generics.ListCreateAPIView):
    queryset = TechnicalScore.objects.select_related('bid', 'evaluator', 'criterion').all()
    serializer_class = TechnicalScoreSerializer
    filterset_class = TechnicalScoreFilter
    ordering = ['-submitted_at']

    def create(self, request, *args, **kwargs):
        bid_id = request.data.get('bid')
        if bid_id:
            try:
                bid = BidSubmission.objects.get(pk=bid_id)
                err = _require_bid_opening_completed(bid.solicitation)
                if err:
                    return err
                err = _require_coi_clearance(bid.solicitation)
                if err:
                    return err
                err = _require_preliminary_exam_completion(bid.solicitation)
                if err:
                    return err
            except BidSubmission.DoesNotExist:
                pass
        return super().create(request, *args, **kwargs)


class TechnicalScoreDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = TechnicalScore.objects.all()
    serializer_class = TechnicalScoreSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def coi_declare_view(request, committee_pk):
    try:
        committee = EvaluationCommittee.objects.get(pk=committee_pk)
    except EvaluationCommittee.DoesNotExist:
        return Response({'error': 'Committee not found'}, status=404)

    member_ids = [m.get('user') if isinstance(m, dict) else m for m in committee.members]
    non_official_ids = [str(nom.get('user_id')) for nom in (committee.non_official_members or []) if nom.get('user_id')]
    if str(request.user.id) not in member_ids and str(request.user.id) not in non_official_ids and request.user != committee.chairperson and request.user != committee.secretary:
        return Response({'error': 'You are not a member of this committee'}, status=403)

    has_conflict = request.data.get('has_conflict', False)
    declaration_type = request.data.get('declaration_type', 'no_conflict' if not has_conflict else 'general_conflict')
    conflicted_bidders = request.data.get('conflicted_bidders', [])
    explanation = request.data.get('explanation', request.data.get('declaration', ''))
    confidentiality_agreed = request.data.get('confidentiality_agreed', False)

    coi, created = ConflictOfInterest.objects.get_or_create(
        committee=committee,
        member=request.user,
        defaults={
            'declaration': explanation,
            'has_conflict': has_conflict,
            'declaration_type': declaration_type,
            'conflicted_bidders': conflicted_bidders,
            'explanation': explanation,
            'confidentiality_agreed': confidentiality_agreed,
        }
    )
    if not created:
        coi.declaration = explanation
        coi.has_conflict = has_conflict
        coi.declaration_type = declaration_type
        coi.conflicted_bidders = conflicted_bidders
        coi.explanation = explanation
        coi.confidentiality_agreed = confidentiality_agreed
        coi.save()

    if _check_phase_completion(committee.solicitation, 'coi'):
        _notify_ec_phase_completion(committee.solicitation, 'coi')

    return Response({
        'message': 'Conflict of interest declared',
        'coi': ConflictOfInterestSerializer(coi).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coi_committee_view(request, committee_pk):
    try:
        committee = EvaluationCommittee.objects.select_related('solicitation').get(pk=committee_pk)
    except EvaluationCommittee.DoesNotExist:
        return Response({'error': 'Committee not found'}, status=404)

    declarations = ConflictOfInterest.objects.filter(committee=committee).select_related('member')
    response_data = {
        'declarations': ConflictOfInterestSerializer(declarations, many=True).data,
        'recused_members': [str(d.member.id) for d in declarations if d.recused],
    }

    return Response(response_data)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def technical_scores_my_view(request, bid_pk):
    try:
        bid = BidSubmission.objects.get(pk=bid_pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)

    my_scores = TechnicalScore.objects.filter(bid=bid, evaluator=request.user).select_related('criterion')

    all_members_submitted = all(
        TechnicalScore.objects.filter(bid=bid, evaluator__id=member_id).count() ==
        EvaluationCriterion.objects.filter(solicitation=bid.solicitation).count()
        for member_id in _get_committee_member_ids_for_bid(bid)
    )

    if all_members_submitted:
        other_scores = TechnicalScore.objects.filter(bid=bid).exclude(evaluator=request.user).select_related('evaluator', 'criterion')
        TechnicalScore.objects.filter(bid=bid).update(is_final=True)
        return Response({
            'my_scores': TechnicalScoreSerializer(my_scores, many=True).data,
            'all_scores': TechnicalScoreSerializer(other_scores, many=True).data,
            'is_final': True,
        })

    return Response({
        'my_scores': TechnicalScoreSerializer(my_scores, many=True).data,
        'all_scores': [],
        'is_final': False,
    })


def _get_committee_member_ids_for_bid(bid):
    committees = EvaluationCommittee.objects.filter(solicitation=bid.solicitation)
    member_ids = set()
    for c in committees:
        for m in c.members:
            if isinstance(m, dict):
                uid = m.get('user')
            else:
                uid = str(m)
            member_ids.add(uid)
        member_ids.add(str(c.chairperson.id))
        member_ids.add(str(c.secretary.id))
        for nom in c.non_official_members or []:
            uid = nom.get('user_id')
            if uid:
                member_ids.add(str(uid))

    # remove recused members
    recused = ConflictOfInterest.objects.filter(committee__solicitation=bid.solicitation, recused=True).values_list('member_id', flat=True)
    member_ids -= set(str(uid) for uid in recused)
    return list(member_ids)


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def technical_score_calculate_averages_view(request, bid_pk):
    try:
        bid = BidSubmission.objects.get(pk=bid_pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)

    err = _require_bid_opening_completed(bid.solicitation)
    if err:
        return err
    err = _require_coi_clearance(bid.solicitation)
    if err:
        return err
    err = _require_preliminary_exam_completion(bid.solicitation)
    if err:
        return err

    criteria = EvaluationCriterion.objects.filter(solicitation=bid.solicitation, criterion_type='technical')
    committee_ids = _get_committee_member_ids_for_bid(bid)

    for criterion in criteria:
        scores = TechnicalScore.objects.filter(bid=bid, criterion=criterion)
        if scores.count() < len(committee_ids):
            return Response({'error': f'Not all evaluators have scored criterion: {criterion.criterion_name}'}, status=400)

    results = []
    for criterion in criteria:
        criterion_scores = TechnicalScore.objects.filter(bid=bid, criterion=criterion)
        avg = criterion_scores.aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
        results.append({
            'criterion_id': str(criterion.criterion_id),
            'criterion_name': criterion.criterion_name,
            'average_raw_score': float(avg),
            'weighted_score': float(avg * criterion.weight / Decimal('100')),
            'weight': float(criterion.weight),
        })

    TechnicalScore.objects.filter(bid=bid).update(is_final=True)

    return Response({
        'message': 'Averages calculated',
        'bid_id': str(bid.bid_id),
        'results': results,
    })


TECHNICAL_THRESHOLD_DEFAULT = Decimal('70')


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def technical_score_threshold_check_view(request, bid_pk):
    try:
        bid = BidSubmission.objects.get(pk=bid_pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)

    threshold = Decimal(str(request.data.get('threshold') or bid.solicitation.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT))
    criteria = EvaluationCriterion.objects.filter(solicitation=bid.solicitation, criterion_type='technical')

    total_weighted = Decimal('0')
    total_weight = Decimal('0')
    details = []

    for criterion in criteria:
        avg = TechnicalScore.objects.filter(bid=bid, criterion=criterion).aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
        weighted = avg * criterion.weight / Decimal('100')
        total_weighted += weighted
        total_weight += criterion.weight
        details.append({
            'criterion_id': str(criterion.criterion_id),
            'criterion_name': criterion.criterion_name,
            'average_raw_score': float(avg),
            'weighted_score': float(weighted),
            'weight': float(criterion.weight),
        })

    overall_pct = (total_weighted / total_weight * Decimal('100')) if total_weight > 0 else Decimal('0')
    passed = overall_pct >= threshold

    return Response({
        'bid_id': str(bid.bid_id),
        'overall_technical_score': float(overall_pct),
        'threshold': float(threshold),
        'passed': passed,
        'details': details,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def technical_score_submit_view(request):
    bid_id = request.data.get('bid_id')
    criterion_id = request.data.get('criterion_id')
    raw_score = request.data.get('raw_score')
    comment = request.data.get('comment', '')

    try:
        bid = BidSubmission.objects.get(pk=bid_id)
        criterion = EvaluationCriterion.objects.get(pk=criterion_id)
    except (BidSubmission.DoesNotExist, EvaluationCriterion.DoesNotExist):
        return Response({'error': 'Bid or criterion not found'}, status=404)

    err = _require_bid_opening_completed(bid.solicitation)
    if err:
        return err
    err = _require_coi_clearance(bid.solicitation)
    if err:
        return err
    err = _require_preliminary_exam_completion(bid.solicitation)
    if err:
        return err

    committee_ids = _get_committee_member_ids_for_bid(bid)
    if str(request.user.id) not in committee_ids:
        return Response({'error': 'You are not an active member of the evaluation committee for this solicitation'}, status=403)

    if TechnicalScore.objects.filter(bid=bid, evaluator=request.user, criterion=criterion).exists():
        return Response({'error': 'You have already scored this criterion for this bid'}, status=400)
    if criterion.solicitation_id != bid.solicitation_id:
        return Response({'error': 'Criterion does not belong to this bid solicitation'}, status=400)
    if criterion.criterion_type != 'technical':
        return Response({'error': 'Only technical criteria can be scored in technical evaluation'}, status=400)
    if _bid_failed_preliminary(bid):
        return Response({'error': 'This bid failed preliminary examination and cannot proceed to technical scoring'}, status=400)
    raw_score_decimal = Decimal(str(raw_score))
    if raw_score_decimal < 0 or raw_score_decimal > criterion.max_score:
        return Response({'error': f'Raw score must be between 0 and {criterion.max_score}'}, status=400)

    weighted_score = raw_score_decimal * (criterion.weight / Decimal('100'))
    score = TechnicalScore.objects.create(
        bid=bid,
        evaluator=request.user,
        criterion=criterion,
        raw_score=raw_score_decimal,
        weighted_score=weighted_score,
        comment=comment,
    )

    criteria_count = EvaluationCriterion.objects.filter(solicitation=bid.solicitation, criterion_type='technical').count()
    scored_count = TechnicalScore.objects.filter(bid=bid, evaluator=request.user).values('criterion').distinct().count()

    all_members_done = all(
        TechnicalScore.objects.filter(bid=bid, evaluator__id=mid).values('criterion').distinct().count() >= criteria_count
        for mid in committee_ids
    )

    if all_members_done:
        TechnicalScore.objects.filter(bid=bid).update(is_final=True)

    if _check_phase_completion(bid.solicitation, 'technical'):
        _notify_ec_phase_completion(bid.solicitation, 'technical')

    return Response({
        'message': 'Technical score submitted',
        'score': TechnicalScoreSerializer(score).data,
        'all_criteria_scored': scored_count >= criteria_count,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def list_passed_tech_bids_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    err = _require_bid_opening_completed(sol)
    if err:
        return err
    err = _require_coi_clearance(sol)
    if err:
        return err
    err = _require_preliminary_exam_completion(sol)
    if err:
        return err

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_procurement = request.user.role in ('director_procurement', 'procurement_manager', 'procurement_officer')
    if not is_chair and not is_procurement:
        return Response({'error': 'Only the committee chair or procurement staff can view passed bids'}, status=403)

    threshold = Decimal(str(request.query_params.get('threshold', sol.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT)))
    criteria = EvaluationCriterion.objects.filter(solicitation=sol, criterion_type='technical')
    total_tech_weight = criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')

    # Financial envelopes are opened when BidOpeningDetail.financial_sealed is False
    # (set by authorize_financial_opening_view)
    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'non_responsive', 'unsuccessful', 'awarded'])
    results = []

    for bid in bids:
        tech_scores = TechnicalScore.objects.filter(bid=bid)
        if not tech_scores.exists() or not tech_scores.filter(is_final=True).exists():
            continue

        total_weighted = Decimal('0')
        details = []
        for criterion in criteria:
            avg = tech_scores.filter(criterion=criterion).aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
            weighted = avg * criterion.weight / Decimal('100')
            total_weighted += weighted
            details.append({
                'criterion_id': str(criterion.criterion_id),
                'criterion_name': criterion.criterion_name,
                'average_raw_score': float(avg),
                'weighted_score': float(weighted),
                'weight': float(criterion.weight),
            })

        overall_pct = (total_weighted / total_tech_weight * Decimal('100')) if total_tech_weight > 0 else Decimal('0')
        passed = overall_pct >= threshold

        financial_eval = FinancialEvaluation.objects.filter(bid=bid).first()
        opening_detail = BidOpeningDetail.objects.filter(bid=bid).first()

        from suppliers.models import Supplier as SupplierModel
        sup = None
        emp_id = getattr(bid.supplier, 'employee_id', None)
        if emp_id and str(emp_id).startswith('SUP-'):
            sup = SupplierModel.objects.filter(registration_number=str(emp_id).replace('SUP-', '', 1)).first()
        if not sup:
            sup = SupplierModel.objects.filter(name=bid.supplier.full_name).first()
        if not sup:
            sup = SupplierModel.objects.filter(
                Q(registration_number=bid.supplier.id.hex[:8].upper()) |
                Q(name=bid.supplier.full_name)
            ).first()
        supplier_id = str(sup.supplier_id) if sup else str(bid.supplier.id)

        results.append({
            'bid_id': str(bid.bid_id),
            'submission_id': bid.submission_id,
            'bidder_name': bid.supplier.full_name,
            'supplier_id': supplier_id,
            'original_price': float(bid.bid_price or 0),
            'preference_category': financial_eval.preference_category if financial_eval else 'non_citizen',
            'preference_margin': float(financial_eval.preference_applied or 0) if financial_eval else 0,
            'overall_technical_score': float(overall_pct),
            'passed': passed,
            'financial_evaluation_id': str(financial_eval.evaluation_id) if financial_eval else None,
            'evaluated_price': float(financial_eval.evaluated_price) if financial_eval else None,
            'financial_score': float(financial_eval.financial_score) if financial_eval else None,
            'financial_sealed': opening_detail.financial_sealed if opening_detail else True,
            'details': details,
            'is_winner': bid.status == 'awarded',
        })

    winner_name = None
    if sol.status == 'awarded':
        awarded_bid = BidSubmission.objects.filter(solicitation=sol, status='awarded').select_related('supplier').first()
        if awarded_bid and awarded_bid.supplier:
            winner_name = awarded_bid.supplier.full_name

    return Response({
        'solicitation_id': str(sol.solicitation_id),
        'threshold': float(threshold),
        'bids': results,
        'winner_name': winner_name,
    })


@api_view(['GET', 'POST'])
@permission_classes([IsAuthenticated])
def calculate_qcbs_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation found'}, status=404)

    err = _require_bid_opening_completed(sol)
    if err:
        return err
    err = _require_coi_clearance(sol)
    if err:
        return err
    err = _require_preliminary_exam_completion(sol)
    if err:
        return err

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can calculate combined scores'}, status=403)

    criteria = EvaluationCriterion.objects.filter(solicitation=sol)

    eval_method = sol.evaluation_method or ('qcbs' if sol.method == 'rfp' else 'lowest_price')

    if eval_method == 'qcbs' and sol.financial_weight is not None:
        fin_weight = Decimal(str(sol.financial_weight))
        tech_weight = Decimal('100') - fin_weight
    elif eval_method == 'qbs':
        tech_weight = Decimal('100')
        fin_weight = Decimal('0')
    else:
        tech_weight = None
        fin_weight = None

    threshold = Decimal(str(sol.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT))
    tech_criteria = criteria.filter(criterion_type='technical')
    total_tech_weight = tech_criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'non_responsive', 'unsuccessful', 'awarded'])
    results = []

    eligible_bids = []
    evaluated_prices = {}
    for bid in bids:
        tech_scores = TechnicalScore.objects.filter(bid=bid, is_final=True)
        if not tech_scores.exists():
            continue
        total_weighted = Decimal('0')
        for criterion in tech_criteria:
            avg = tech_scores.filter(criterion=criterion).aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
            total_weighted += avg * criterion.weight / Decimal('100')
        overall_pct = (total_weighted / total_tech_weight * Decimal('100')) if total_tech_weight > 0 else Decimal('0')
        if overall_pct < threshold:
            continue
        eligible_bids.append(bid)
        fin_eval = FinancialEvaluation.objects.filter(bid=bid).first()
        if fin_eval:
            evaluated_prices[bid.bid_id] = fin_eval.evaluated_price
        else:
            evaluated_prices[bid.bid_id] = Decimal(str(bid.bid_price or 0))

    min_evaluated_price = min(evaluated_prices.values()) if evaluated_prices else Decimal('0')

    for bid in eligible_bids:
        opening_detail = BidOpeningDetail.objects.filter(bid=bid).first()
        opening_sealed = opening_detail and opening_detail.financial_sealed

        tech_scores = TechnicalScore.objects.filter(bid=bid, is_final=True)
        total_weighted = Decimal('0')
        details = []
        for criterion in tech_criteria:
            avg = tech_scores.filter(criterion=criterion).aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
            weighted = avg * criterion.weight / Decimal('100')
            total_weighted += weighted
            details.append({
                'criterion_id': str(criterion.criterion_id),
                'criterion_name': criterion.criterion_name,
                'average_raw_score': float(avg),
                'weighted_score': float(weighted),
                'weight': float(criterion.weight),
            })
        overall_pct = (total_weighted / total_tech_weight * Decimal('100')) if total_tech_weight > 0 else Decimal('0')

        fin_eval = FinancialEvaluation.objects.filter(bid=bid).first()
        evaluated_price = evaluated_prices[bid.bid_id]

        if fin_eval:
            fin_score = fin_eval.financial_score
        elif not opening_sealed:
            fin_score = (min_evaluated_price / evaluated_price) * Decimal('100') if evaluated_price > 0 else Decimal('100')
        else:
            fin_score = Decimal('0')

        if eval_method in ('qcbs', 'qbs') and not opening_sealed:
            total_score = (overall_pct * tech_weight / Decimal('100')) + (Decimal(str(fin_score)) * fin_weight / Decimal('100'))
        elif eval_method in ('qcbs', 'qbs'):
            total_score = overall_pct
        else:
            total_score = overall_pct

        from suppliers.models import Supplier as SupplierModel
        emp_id = getattr(bid.supplier, 'employee_id', '') or ''
        sup = SupplierModel.objects.filter(registration_number=emp_id.replace('SUP-', '', 1)).first() if emp_id else None
        ceec_category = str(sup.ceec_category) if sup else 'non_citizen'
        ceec_priority = {'citizen_owned': 4, 'citizen_empowered': 3, 'citizen_influenced': 2, 'non_citizen': 1}.get(ceec_category, 0)

        results.append({
            'bid_id': str(bid.bid_id),
            'submission_id': bid.submission_id,
            'bidder_name': bid.supplier.full_name,
            'supplier_id': str(sup.supplier_id) if sup else str(bid.supplier.id),
            'original_price': float(bid.bid_price or 0),
            'preference_category': fin_eval.preference_category if fin_eval else 'non_citizen',
            'preference_margin': float(fin_eval.preference_applied or 0) if fin_eval else 0,
            'technical_score': float(overall_pct),
            'financial_score': float(fin_score) if not opening_sealed else 0,
            'total_score': float(total_score),
            'passed': True,
            'financial_evaluation_id': str(fin_eval.evaluation_id) if fin_eval else None,
            'evaluated_price': float(fin_eval.evaluated_price) if fin_eval else None,
            'financial_sealed': opening_sealed,
            'ceec_category': ceec_category,
            'ceec_priority': ceec_priority,
            'details': details,
        })

    # Ranking: QCBS/QBS sort by total_score; lowest_price/LCS/FBS sort by evaluated price
    if eval_method in ('qcbs', 'qbs'):
        results.sort(key=lambda x: (x.get('total_score', 0), x.get('technical_score', 0), x.get('ceec_priority', 0)), reverse=True)
    else:
        results.sort(key=lambda x: x.get('evaluated_price') or float('inf'))

    with transaction.atomic():
        for i, bid_data in enumerate(results):
            bid_data['rank'] = i + 1
            bid_id_for_update = bid_data['bid_id']
            CombinedScore.objects.update_or_create(
                bid_id=bid_id_for_update,
                defaults={
                    'technical_score': Decimal(str(bid_data['technical_score'])),
                    'financial_score': Decimal(str(bid_data['financial_score'])),
                    'total_score': Decimal(str(bid_data['total_score'])),
                    'rank': i + 1,
                    'consolidated_by': request.user,
                    'consolidated_at': timezone.now(),
                }
            )

    winner_name = None
    if sol.status == 'awarded':
        awarded_bid = BidSubmission.objects.filter(solicitation=sol, status='awarded').first()
        if awarded_bid and awarded_bid.supplier:
            winner_name = awarded_bid.supplier.full_name

    return Response({
        'message': 'Combined scores calculated successfully',
        'solicitation_id': str(sol.solicitation_id),
        'eval_method': eval_method,
        'threshold': float(threshold),
        'tech_weight': float(tech_weight) if tech_weight is not None else None,
        'fin_weight': float(fin_weight) if fin_weight is not None else None,
        'results': results,
        'winner_name': winner_name,
        'consolidated_by': request.user.full_name,
        'consolidated_at': timezone.now().isoformat(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def authorize_financial_opening_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    err = _require_bid_opening_completed(sol)
    if err:
        return err
    err = _require_coi_clearance(sol)
    if err:
        return err
    err = _require_preliminary_exam_completion(sol)
    if err:
        return err

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can authorize financial opening'}, status=403)

    # Verify all committee members have submitted technical scores for all bids
    criteria = EvaluationCriterion.objects.filter(solicitation=sol, criterion_type='technical')
    criteria_count = criteria.count()
    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'non_responsive'])
    committee_member_ids = set()
    for c in committees:
        committee_member_ids.update(_committee_membership_ids(c))

    for bid in bids:
        scored_evaluators = TechnicalScore.objects.filter(
            bid=bid, criterion__in=criteria
        ).values('evaluator').distinct().count()
        if scored_evaluators < len(committee_member_ids):
            return Response({
                'error': 'All committee members must complete technical scoring for all bids before financial envelopes can be opened.',
            }, status=400)

    threshold = Decimal(str(sol.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT))
    criteria = EvaluationCriterion.objects.filter(solicitation=sol, criterion_type='technical')
    total_tech_weight = criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'non_responsive'])
    opened_count = 0
    eligible_bids = []

    with transaction.atomic():
        for bid in bids:
            tech_scores = TechnicalScore.objects.filter(bid=bid, is_final=True)
            if not tech_scores.exists():
                continue

            total_weighted = Decimal('0')
            for criterion in criteria:
                avg = tech_scores.filter(criterion=criterion).aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
                total_weighted += avg * criterion.weight / Decimal('100')
            overall_pct = (total_weighted / total_tech_weight * Decimal('100')) if total_tech_weight > 0 else Decimal('0')

            if overall_pct < threshold:
                continue

            eligible_bids.append((bid, overall_pct))

            opening_detail = BidOpeningDetail.objects.filter(bid=bid).first()
            if opening_detail:
                if opening_detail.financial_sealed:
                    opening_detail.financial_sealed = False
                    opening_detail.save(update_fields=['financial_sealed'])
                opened_count += 1

    if _check_phase_completion(sol, 'consolidation'):
        _notify_ec_phase_completion(sol, 'consolidation')

    return Response({
        'message': f'Financial envelopes opened for {opened_count} bids',
        'opened_count': opened_count,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def financial_evaluation_calculate_view(request, bid_pk):
    try:
        bid = BidSubmission.objects.get(pk=bid_pk)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found'}, status=404)

    committees = EvaluationCommittee.objects.filter(solicitation=bid.solicitation)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can calculate financial evaluations'}, status=403)

    err = _require_bid_opening_completed(bid.solicitation)
    if err:
        return err
    err = _require_coi_clearance(bid.solicitation)
    if err:
        return err
    err = _require_preliminary_exam_completion(bid.solicitation)
    if err:
        return err

    opening_detail = BidOpeningDetail.objects.filter(bid=bid).first()
    if opening_detail and opening_detail.financial_sealed:
        return Response({'error': 'Financial envelope must be authorized/opened before financial evaluation.'}, status=400)

    threshold = Decimal(str(bid.solicitation.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT))
    technical_score = _technical_score_for_bid(bid)
    if technical_score is None:
        return Response({'error': 'Final technical scores are required before financial evaluation.'}, status=400)
    if technical_score < threshold:
        return Response({'error': 'Bid did not meet the minimum technical threshold; financial envelope remains sealed.'}, status=400)

    original_price = Decimal(str(request.data.get('original_price', bid.bid_price or 0)))
    corrected_price = Decimal(str(request.data.get('corrected_price', original_price)))
    source_currency = request.data.get('source_currency', bid.currency or 'ZMW')
    conversion_rate = request.data.get('conversion_rate')
    preference_margin = Decimal(str(request.data.get('preference_margin', 0)))
    preference_category = request.data.get('preference_category', '0')
    arithmetic_corrections = request.data.get('arithmetic_corrections', [])

    if preference_margin not in (Decimal('0'), Decimal('4'), Decimal('8'), Decimal('12'), Decimal('15')):
        return Response({'error': 'Invalid preference margin. Allowed values: 0, 4, 8, 12, 15'}, status=400)

    valid_categories = {'non_citizen', 'citizen_owned', 'citizen_empowered', 'citizen_influenced'}
    if preference_category not in valid_categories:
        return Response({'error': f'Invalid preference category. Allowed: {", ".join(sorted(valid_categories))}'}, status=400)

    currency_converted_price = None
    if conversion_rate and source_currency != 'ZMW':
        currency_converted_price = corrected_price * Decimal(str(conversion_rate))

    price_for_eval = currency_converted_price if currency_converted_price else corrected_price
    evaluated_price = price_for_eval * (Decimal('1') - preference_margin / Decimal('100'))

    # Use the minimum evaluated price among OTHER bids (exclude current bid) to avoid self-referencing
    other_min = FinancialEvaluation.objects.filter(
        bid__solicitation=bid.solicitation
    ).exclude(bid=bid).order_by('evaluated_price').values_list('evaluated_price', flat=True).first()
    min_evaluated = other_min if other_min is not None else evaluated_price
    financial_score = (min_evaluated / evaluated_price) * Decimal('100') if evaluated_price > 0 else Decimal('100')

    with transaction.atomic():
        evaluation, _ = FinancialEvaluation.objects.update_or_create(
            bid=bid,
            defaults={
                'original_price': original_price,
                'corrected_price': corrected_price,
                'currency_converted_price': currency_converted_price,
                'source_currency': source_currency,
                'conversion_rate': conversion_rate,
                'preference_applied': preference_margin,
                'preference_category': preference_category,
                'arithmetic_corrections': arithmetic_corrections,
                'evaluated_price': evaluated_price,
                'financial_score': financial_score,
            }
        )

    return Response({
        'message': 'Financial evaluation complete',
        'evaluation': FinancialEvaluationSerializer(evaluation).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def select_winner_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    err = _require_bid_opening_completed(sol)
    if err:
        return err
    err = _require_coi_clearance(sol)
    if err:
        return err
    err = _require_preliminary_exam_completion(sol)
    if err:
        return err

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can select a winner'}, status=403)

    if sol.status == 'awarded':
        return Response({'error': 'This solicitation has already been awarded.'}, status=400)

    bid_id = request.data.get('bid_id')
    if not bid_id:
        return Response({'error': 'bid_id is required'}, status=400)

    eval_method = sol.evaluation_method or ('qcbs' if sol.method == 'rfp' else 'lowest_price')

    # Verify that evaluation has produced a defensible top-ranked bid.
    if eval_method in ('qcbs', 'qbs'):
        top_ranked = CombinedScore.objects.filter(
            bid__solicitation=sol
        ).order_by('rank').first()
        if not top_ranked:
            return Response({'error': f'{eval_method.upper()} combined scores must be calculated before selecting a winner.'}, status=400)
        if str(top_ranked.bid_id) != str(bid_id):
            return Response({
                'error': f'Only the top-ranked bid can be selected as winner. The current top-ranked bid is "{top_ranked.bid.supplier.full_name}".'
            }, status=400)
    elif eval_method == 'fbs':
        budget = sol.estimated_value or 0
        within_budget = FinancialEvaluation.objects.filter(
            bid__solicitation=sol, evaluated_price__lte=budget
        ).select_related('bid__supplier')
        if not within_budget.exists():
            return Response({'error': f'No responsive bids are within the fixed budget of K{budget}.'}, status=400)
        # Among bids within budget, pick the one with the highest technical score
        best_bid = max(within_budget, key=lambda f: TechnicalScore.objects.filter(bid=f.bid).aggregate(avg=Avg('raw_score'))['avg'] or 0)
        if str(best_bid.bid_id) != str(bid_id):
            return Response({
                'error': f'Only the highest technically-scored bid within budget can be selected as winner. The current highest-scored bid within budget is "{best_bid.bid.supplier.full_name}".'
            }, status=400)
    else:
        lowest_financial = FinancialEvaluation.objects.filter(
            bid__solicitation=sol
        ).select_related('bid__supplier').order_by('evaluated_price').first()
        if not lowest_financial:
            return Response({'error': 'Financial evaluation has not been calculated yet.'}, status=400)
        if str(lowest_financial.bid_id) != str(bid_id):
            return Response({
                'error': f'Only the lowest evaluated responsive bid can be selected as winner. The current lowest evaluated bid is "{lowest_financial.bid.supplier.full_name}".'
            }, status=400)

    try:
        winner = BidSubmission.objects.get(pk=bid_id, solicitation=sol)
    except BidSubmission.DoesNotExist:
        return Response({'error': 'Bid not found for this solicitation'}, status=404)

    with transaction.atomic():
        winner.status = 'awarded'
        winner.save(update_fields=['status'])

        sol.status = 'awarded'
        sol.save(update_fields=['status'])

        other_bids = BidSubmission.objects.filter(solicitation=sol).exclude(pk=bid_id)
        other_bids.update(status='unsuccessful')

        if not PostQualification.objects.filter(bidder=winner).exists():
            winner_rank = CombinedScore.objects.filter(bid=winner).values_list('rank', flat=True).first()
            PostQualification.objects.create(
                bidder=winner,
                solicitation=sol,
                status='initiation',
                workflow_stage='initiation',
                verification_items=[],
                rank=winner_rank,
                initiation_date=timezone.now(),
            )

    # Notify the successful bidder (winner)
    if winner.supplier:
        try:
            notify_users(
                [winner.supplier],
                f'Award Confirmation — {sol.sol_number}',
                (
                    f'Dear {winner.supplier.full_name},\n\n'
                    f'Congratulations! We are pleased to inform you that your bid has been '
                    f'selected as the winning bid for solicitation {sol.sol_number} ({sol.title}).\n\n'
                    f'Your bid reference: {winner.submission_id}\n'
                    f'Bid amount: {winner.currency or "ZMW"} {winner.bid_price:,.2f}\n\n'
                    f'A Bid Evaluation Report (BER) has been generated and will be submitted '
                    f'to the Zambia Public Procurement Agency (ZPPA) for final approval.\n\n'
                    f'Post-qualification verification is currently in progress. Once completed '
                    f'and the BER is approved, you will be notified to proceed with contract signing.\n\n'
                    f'Please ensure all your company documents (registration, tax clearance, '
                    f'financial statements, etc.) are up to date for the post-qualification process.\n\n'
                    f'Regards,\nZAMMSA Procurement Team'
                ),
                notification_type='approval',
                priority='high',
                source_module='evaluations',
                object_id=str(winner.pk),
                action_url=f'/vendor/appeals?solicitation={sol.solicitation_id}',
                metadata={
                    'alert_key': 'bid_awarded_success',
                    'solicitation_id': str(sol.solicitation_id),
                    'sol_number': sol.sol_number,
                    'submission_id': winner.submission_id,
                },
                email_required=True,
            )
        except Exception:
            pass

    # Notify unsuccessful bidders of their appeal rights (ZPPA standard practice)
    unsuccessful_bids = BidSubmission.objects.filter(solicitation=sol).exclude(pk=bid_id).select_related('supplier')
    for unsuccessful_bid in unsuccessful_bids:
        if unsuccessful_bid.supplier:
            try:
                from datetime import timedelta
                appeal_deadline = timezone.now() + timedelta(days=14)
                notify_users(
                    [unsuccessful_bid.supplier],
                    f'Award Notification — {sol.sol_number}',
                    (
                        f'Dear {unsuccessful_bid.supplier.full_name},\n\n'
                        f'We wish to inform you that the evaluation for solicitation {sol.sol_number} '
                        f'({sol.title}) has been completed and an award has been made to another bidder.\n\n'
                        f'Your bid reference: {unsuccessful_bid.submission_id}\n'
                        f'Bid amount: {unsuccessful_bid.currency or "ZMW"} {unsuccessful_bid.bid_price:,.2f}\n\n'
                        f'In accordance with the Zambia Public Procurement Act (ZPPA) and standard procurement '
                        f'practice, you have the right to file an appeal within 14 days of this notification.\n\n'
                        f'Appeal Deadline: {appeal_deadline.strftime("%d %B %Y")}\n\n'
                        f'To file an appeal, please:\n'
                        f'1. Log in to the ZAMMSA Procurement System\n'
                        f'2. Navigate to Vendor Portal > Award Appeals\n'
                        f'3. Click "File Appeal" and select this solicitation\n'
                        f'4. Provide the grounds for your appeal with supporting evidence\n\n'
                        f'Valid grounds for appeal include:\n'
                        f'- Scoring or evaluation error\n'
                        f'- Procedural irregularity\n'
                        f'- Conflict of interest\n'
                        f'- Eligibility or qualification error\n'
                        f'- Specification deviation\n'
                        f'- Bias or discrimination\n\n'
                        f'Please note that appeals must be filed within the stipulated timeframe. '
                        f'Late submissions may not be considered.\n\n'
                        f'Regards,\nZAMMSA Procurement Team'
                    ),
                    notification_type='info',
                    priority='high',
                    source_module='evaluations',
                    object_id=sol.pk,
                    action_url=f'/vendor/appeals?solicitation={sol.solicitation_id}&bidder={unsuccessful_bid.bid_id}',
                    metadata={
                        'alert_key': 'award_notification_appeal_rights',
                        'solicitation_id': str(sol.solicitation_id),
                        'sol_number': sol.sol_number,
                        'appeal_deadline': appeal_deadline.isoformat(),
                        'submission_id': unsuccessful_bid.submission_id,
                    },
                    email_required=True,
                )
            except Exception:
                pass

    # NOTE: Temporary non-official member accounts are deactivated only after the
    # BER is submitted to ZPC (ber_submit_view), so they can still sign the BER.

    try:
        if _check_phase_completion(sol, 'financial'):
            _notify_ec_phase_completion(sol, 'financial')
    except Exception:
        pass

    return Response({
        'message': f'Winner selected: {winner.submission_id}',
        'winner_id': str(winner.bid_id),
        'winner_name': winner.supplier.full_name,
        'solicitation_status': sol.status,
    })


class BidEvaluationReportListView(BaseView, generics.ListCreateAPIView):
    queryset = BidEvaluationReport.objects.select_related('solicitation', 'approved_by', 'created_by').prefetch_related(
        Prefetch('solicitation__evaluation_committees', queryset=EvaluationCommittee.objects.all())
    ).all()
    serializer_class = BidEvaluationReportSerializer
    filterset_class = BidEvaluationReportFilter
    ordering = ['-created_at']


class BidEvaluationReportDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = BidEvaluationReport.objects.all()
    serializer_class = BidEvaluationReportSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ber_generate_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    err = _require_bid_opening_completed(sol)
    if err:
        return err
    err = _require_coi_clearance(sol)
    if err:
        return err

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    if not is_chair:
        return Response({'error': 'Only the committee chair can generate the BER'}, status=403)

    eval_method = sol.evaluation_method or ('qcbs' if sol.method == 'rfp' else 'lowest_price')
    if eval_method in ('qcbs', 'qbs'):
        if not CombinedScore.objects.filter(bid__solicitation=sol).exists():
            return Response({'error': f'{eval_method.upper()} combined scores must be calculated before generating the BER. Calculate scores from the Score Consolidation page first.'}, status=400)
    else:
        if not FinancialEvaluation.objects.filter(bid__solicitation=sol).exists():
            return Response({'error': 'Rankings must be calculated before generating the BER. Compute Rankings from the Score Consolidation page first.'}, status=400)

    winner_bid = BidSubmission.objects.filter(solicitation=sol, status='awarded').first()
    if not winner_bid:
        return Response({'error': 'A winning bidder must be selected before generating the BER.'}, status=400)

    if BidEvaluationReport.objects.filter(solicitation=sol).exclude(status='rejected').exists():
        return Response({'error': 'A BER already exists for this solicitation'}, status=400)

    criteria = EvaluationCriterion.objects.filter(solicitation=sol)
    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['opened', 'responsive', 'awarded'])
    tech_criteria = criteria.filter(criterion_type='technical')

    tech_eval_data = []
    for bid in bids:
        tech_scores = TechnicalScore.objects.filter(bid=bid)
        if not tech_scores.exists():
            continue
        criterion_details = []
        total_weighted = Decimal('0')
        for c in tech_criteria:
            avg = tech_scores.filter(criterion=c).aggregate(avg=Avg('raw_score'))['avg'] or Decimal('0')
            weighted = avg * c.weight / Decimal('100')
            total_weighted += weighted
            criterion_details.append({
                'criterion_name': c.criterion_name,
                'weight': float(c.weight),
                'average_raw_score': float(avg),
                'weighted_score': float(weighted),
            })
        tech_weight = tech_criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')
        overall_pct = float(total_weighted / tech_weight * Decimal('100')) if tech_weight > 0 else 0

        fin_eval = FinancialEvaluation.objects.filter(bid=bid).first()
        combined = CombinedScore.objects.filter(bid=bid).first()

        tech_eval_data.append({
            'submission_id': bid.submission_id,
            'bidder_name': bid.supplier.full_name,
            'overall_technical_score': overall_pct,
            'criterion_details': criterion_details,
            'financial_score': float(fin_eval.financial_score) if fin_eval else None,
            'evaluated_price': float(fin_eval.evaluated_price) if fin_eval else None,
            'preference_applied': float(fin_eval.preference_applied) if fin_eval else None,
            'combined_technical_score': float(combined.technical_score) if combined else None,
            'combined_total_score': float(combined.total_score) if combined else None,
            'rank': combined.rank if combined else None,
        })

    tech_eval_data.sort(key=lambda x: x['rank'] if x['rank'] else 999)

    committee_data = []
    for c in committees:
        member_list = []
        for m in c.members:
            uid = m.get('user') if isinstance(m, dict) else m
            member_list.append({'id': str(uid), 'role': 'member'})
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if not uid:
                continue
            member_list.append({'id': str(uid), 'role': 'external_member'})
        cois = ConflictOfInterest.objects.filter(committee=c)
        committee_data.append({
            'chairperson_name': c.chairperson.full_name,
            'secretary_name': c.secretary.full_name,
            'member_ids': member_list,
            'coi_declarations': [
                {'member_name': co.member.full_name, 'has_conflict': co.has_conflict, 'recused': co.recused}
                for co in cois
            ],
        })

    winner = bids.filter(status='awarded').first()
    if not PostQualification.objects.filter(bidder=winner_bid, status='cleared').exists():
        PostQualification.objects.get_or_create(
            ber=None,
            bidder=winner_bid,
            defaults={
                'verification_items': [],
            },
        )
        return Response({
            'error': 'Post-qualification must be cleared for the winning bidder before BER generation.',
            'winner_id': str(winner_bid.pk),
        }, status=400)

    report_content = {
        'solicitation': {
            'sol_number': sol.sol_number,
            'title': sol.title,
            'description': sol.description,
            'method': sol.method,
            'estimated_value': float(sol.estimated_value) if sol.estimated_value else None,
            'closing_date': sol.closing_date.isoformat() if sol.closing_date else None,
        },
        'evaluation_committees': committee_data,
        'technical_evaluation': tech_eval_data,
        'winner': {
            'submission_id': winner.submission_id if winner else None,
            'bidder_name': winner.supplier.full_name if winner else None,
        } if winner else None,
        'generated_at': timezone.now().isoformat(),
    }

    ber = BidEvaluationReport.objects.create(
        solicitation=sol,
        report_content=report_content,
        status='draft',
        created_by=request.user,
    )
    PostQualification.objects.filter(ber__isnull=True, bidder__solicitation=sol).update(ber=ber)

    return Response({
        'message': 'BER generated successfully',
        'ber': BidEvaluationReportSerializer(ber).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ber_sign_view(request, pk):
    try:
        ber = BidEvaluationReport.objects.get(pk=pk)
    except BidEvaluationReport.DoesNotExist:
        return Response({'error': 'BER not found'}, status=404)

    committees = EvaluationCommittee.objects.filter(solicitation=ber.solicitation)
    is_member = False
    member_role = ''
    for c in committees:
        if str(c.chairperson.id) == str(request.user.id):
            is_member = True
            member_role = 'chairperson'
            break
        if str(c.secretary.id) == str(request.user.id):
            is_member = True
            member_role = 'secretary'
            break
        for m in c.members:
            uid = m.get('user') if isinstance(m, dict) else m
            if str(uid) == str(request.user.id):
                is_member = True
                member_role = 'member'
                break
        if not is_member:
            for nom in (c.non_official_members or []):
                if str(nom.get('user_id', '')) == str(request.user.id):
                    is_member = True
                    member_role = 'external_member'
                    break
        if is_member:
            break

    if not is_member:
        return Response({'error': 'Only committee members can sign the BER'}, status=403)

    # BR-EVAL-01: Quorum check — at least 2/3 of members must have completed COI
    for c in committees:
        if not c.quorum_met():
            total = c.total_members_count()
            required = c.quorum_required()
            signed_coi = c.conflict_declarations.filter(confidentiality_agreed=True).count()
            return Response({
                'error': f'Quorum not met. Need at least {required} of {total} committee members '
                         f'with signed conflict declarations (currently {signed_coi}).'
            }, status=400)

    with transaction.atomic():
        ber = BidEvaluationReport.objects.select_for_update().get(pk=pk)
        already_signed = any(s['member_id'] == str(request.user.id) for s in ber.signatures)
        if already_signed:
            return Response({'error': 'You have already signed this BER'}, status=400)

        signed_at = timezone.now()
        new_sig = sign_ber_payload(
            member_id=str(request.user.id),
            member_name=request.user.full_name,
            role=member_role,
            ber_id=str(ber.ber_id),
            solicitation_id=str(ber.solicitation.solicitation_id),
        )
        new_sig['signed_at'] = signed_at.isoformat()
        ber.signatures = ber.signatures + [new_sig]
        ber.save(update_fields=['signatures'])

    return Response({
        'message': 'BER signed successfully',
        'signature': new_sig,
        'total_signatures': len(ber.signatures),
        'all_signed': ber.has_all_signed(),
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def ber_committee_status_view(request, pk):
    try:
        ber = BidEvaluationReport.objects.get(pk=pk)
    except BidEvaluationReport.DoesNotExist:
        return Response({'error': 'BER not found'}, status=404)

    committees = EvaluationCommittee.objects.filter(solicitation=ber.solicitation)
    members = []
    seen_ids = set()
    for c in committees:
        if c.chairperson_id and str(c.chairperson.id) not in seen_ids:
            seen_ids.add(str(c.chairperson.id))
            members.append({
                'id': str(c.chairperson.id),
                'full_name': c.chairperson.full_name,
                'role': 'chairperson',
                'signed': any(s['member_id'] == str(c.chairperson.id) for s in ber.signatures),
            })
        if c.secretary_id and str(c.secretary.id) not in seen_ids:
            seen_ids.add(str(c.secretary.id))
            members.append({
                'id': str(c.secretary.id),
                'full_name': c.secretary.full_name,
                'role': 'secretary',
                'signed': any(s['member_id'] == str(c.secretary.id) for s in ber.signatures),
            })
        for m in c.members:
            uid = m.get('user') if isinstance(m, dict) else m
            if uid and str(uid) not in seen_ids:
                seen_ids.add(str(uid))
                members.append({
                    'id': str(uid),
                    'full_name': m.get('full_name', str(uid)[:8]) if isinstance(m, dict) else str(uid)[:8],
                    'role': 'member',
                    'signed': any(s['member_id'] == str(uid) for s in ber.signatures),
                })
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if not uid or str(uid) in seen_ids:
                continue
            seen_ids.add(str(uid))
            full_name = ' '.join(filter(None, [nom.get('first_name', ''), nom.get('last_name', '')])) or nom.get('email', str(uid)[:8])
            members.append({
                'id': str(uid),
                'full_name': full_name,
                'role': f"external_member ({nom.get('expertise', '')})" if nom.get('expertise') else 'external_member',
                'signed': any(s['member_id'] == str(uid) for s in ber.signatures),
            })

    return Response({
        'ber_id': str(ber.ber_id),
        'status': ber.status,
        'signatures': ber.signatures,
        'members': members,
        'signed_count': len(ber.signatures),
        'total_required': len(members),
        'all_signed': ber.has_all_signed(),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ber_submit_view(request, pk):
    try:
        ber = BidEvaluationReport.objects.get(pk=pk)
    except BidEvaluationReport.DoesNotExist:
        return Response({'error': 'BER not found'}, status=404)

    committees = EvaluationCommittee.objects.filter(solicitation=ber.solicitation)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    if not is_chair:
        return Response({'error': 'Only the committee chair can submit the BER to ZPC'}, status=403)

    for c in committees:
        if not c.quorum_met():
            total = c.total_members_count()
            required = c.quorum_required()
            signed_coi = c.conflict_declarations.filter(confidentiality_agreed=True).count()
            return Response({
                'error': f'Quorum not met. Need at least {required} of {total} committee members '
                         f'with signed conflict declarations (currently {signed_coi}).'
            }, status=400)

    if not ber.has_all_signed():
        return Response({'error': 'All committee members must sign before submitting'}, status=400)

    ber.status = 'submitted'
    ber.submitted_at = timezone.now()
    ber.save()

    # Now that all signatures are collected and BER is submitted, deactivate
    # temporary accounts created for non-official committee members.
    # BUT: Keep them active if there's an active appeal that could trigger re-evaluation
    from evaluations.models import AwardAppeal
    has_active_appeal = AwardAppeal.objects.filter(
        solicitation=ber.solicitation,
        status__in=['filed', 'under_review']
    ).exists()
    
    temp_user_ids = []
    for c in committees:
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if uid:
                temp_user_ids.append(uid)
    if temp_user_ids and not has_active_appeal:
        User.objects.filter(id__in=temp_user_ids, role='evaluation_committee_member').update(is_active=False)

    return Response({'message': 'BER submitted for ZPC approval', 'status': ber.status, 'submitted_at': ber.submitted_at.isoformat()})


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ber_approve_view(request, pk):
    try:
        ber = BidEvaluationReport.objects.get(pk=pk)
    except BidEvaluationReport.DoesNotExist:
        return Response({'error': 'BER not found'}, status=404)

    if request.user.role != 'zpc_member':
        return Response({'error': 'Only ZPC members can approve BER'}, status=403)

    if ber.status != 'submitted':
        return Response({'error': 'BER must be submitted before approval'}, status=400)

    ber.status = 'approved'
    ber.approved_by = request.user
    ber.approved_at = timezone.now()
    ber.save()

    ber.solicitation.status = 'awarded'
    ber.solicitation.save()
    notify_role(
        'procurement_officer',
        title=f'BER approved: {ber.solicitation.sol_number}',
        message=f'ZPC approved the BER for {ber.solicitation.sol_number}. Proceed with contract award notice.',
        notification_type='approval',
        priority='high',
        source_module='evaluations',
        object_id=ber.pk,
        action_url=f'/evaluations/ber/{ber.pk}',
        metadata={
            'alert_key': 'ber_approved_award_ready',
            'ber_id': str(ber.pk),
            'solicitation_id': str(ber.solicitation_id),
        },
        email_required=True,
    )

    ec_members = _resolve_ec_members(ber.solicitation)
    if ec_members.exists():
        notify_users(
            list(ec_members),
            title=f'Evaluation Complete: {ber.solicitation.sol_number}',
            message=(
                f'The Bid Evaluation Report for {ber.solicitation.sol_number} ({ber.solicitation.title}) '
                f'has been approved by ZPC. The solicitation has been awarded.\n\n'
                f'Thank you for your participation in the evaluation committee.'
            ),
            notification_type='approval',
            priority='high',
            source_module='evaluations',
            object_id=str(ber.pk),
            action_url=f'/evaluations',
            metadata={
                'alert_key': 'evaluation_complete_awarded',
                'ber_id': str(ber.pk),
                'solicitation_id': str(ber.solicitation_id),
                'sol_number': ber.solicitation.sol_number,
            },
            email_required=True,
        )

    return Response({
        'message': 'BER approved. Solicitation awarded.',
        'status': ber.status,
        'ber_id': str(ber.ber_id),
        'solicitation_id': str(ber.solicitation.solicitation_id),
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def ber_reject_view(request, pk):
    try:
        ber = BidEvaluationReport.objects.get(pk=pk)
    except BidEvaluationReport.DoesNotExist:
        return Response({'error': 'BER not found'}, status=404)

    if request.user.role != 'zpc_member':
        return Response({'error': 'Only ZPC members can reject BER'}, status=403)

    reason = request.data.get('reason', '')
    ber.status = 'rejected'
    ber.rejection_reason = reason
    ber.save()

    return Response({
        'message': 'BER rejected',
        'status': ber.status,
        'rejection_reason': ber.rejection_reason,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def consolidated_scores_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can view consolidated scores'}, status=403)

    criteria = EvaluationCriterion.objects.filter(solicitation=sol, criterion_type='technical')
    total_tech_weight = criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')
    threshold = Decimal(str(sol.minimum_technical_threshold or 70))

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'non_responsive', 'unsuccessful', 'awarded'])

    all_member_list = []
    member_ids_set = set()
    committees_list = []
    user_cache: dict[str, User] = {}
    raw_member_ids: list[str] = []
    for c in committees:
        for m in c.members:
            uid = m.get('user') if isinstance(m, dict) else m
            if uid and str(uid) not in member_ids_set:
                member_ids_set.add(str(uid))
                raw_member_ids.append(str(uid))
        for nm in (c.non_official_members or []):
            uid = nm.get('user_id')
            if uid and str(uid) not in member_ids_set:
                member_ids_set.add(str(uid))
                raw_member_ids.append(str(uid))
        if c.chairperson_id and str(c.chairperson.id) not in member_ids_set:
            member_ids_set.add(str(c.chairperson.id))
        if c.secretary_id and str(c.secretary.id) not in member_ids_set:
            member_ids_set.add(str(c.secretary.id))

    if raw_member_ids:
        for u in User.objects.filter(pk__in=raw_member_ids):
            user_cache[str(u.pk)] = u

    member_ids_set.clear()

    for c in committees:
        member_list = []
        for m in c.members:
            uid = m.get('user') if isinstance(m, dict) else m
            if uid and str(uid) not in member_ids_set:
                member_ids_set.add(str(uid))
                user_obj = user_cache.get(str(uid))
                member_name = user_obj.full_name if user_obj else str(uid)[:8]
                member_role = m.get('role', 'member') if isinstance(m, dict) else 'member'
                member_list.append({
                    'id': str(uid),
                    'name': member_name,
                    'role': member_role,
                })
        for nm in (c.non_official_members or []):
            uid = nm.get('user_id')
            if uid and str(uid) not in member_ids_set:
                member_ids_set.add(str(uid))
                user_obj = user_cache.get(str(uid))
                member_name = user_obj.full_name if user_obj else f"{nm.get('first_name', '')} {nm.get('last_name', '')}".strip() or str(uid)[:8]
                member_list.append({
                    'id': str(uid),
                    'name': member_name,
                    'role': nm.get('expertise', 'member'),
                })
        if c.chairperson_id and str(c.chairperson.id) not in member_ids_set:
            member_ids_set.add(str(c.chairperson.id))
            member_list.append({'id': str(c.chairperson.id), 'name': c.chairperson.full_name, 'role': 'chairperson'})
        if c.secretary_id and str(c.secretary.id) not in member_ids_set:
            member_ids_set.add(str(c.secretary.id))
            member_list.append({'id': str(c.secretary.id), 'name': c.secretary.full_name, 'role': 'secretary'})
        committees_list.append({
            'committee_id': str(c.committee_id),
            'chairperson_name': c.chairperson.full_name,
            'secretary_name': c.secretary.full_name,
            'members': member_list,
            'formed_at': c.formed_at.isoformat() if c.formed_at else None,
        })
        all_member_list.extend(member_list)

    results = []
    for bid in bids:
        tech_scores = TechnicalScore.objects.filter(bid=bid).select_related('evaluator', 'criterion')
        if not tech_scores.exists():
            continue

        total_weighted = Decimal('0')
        details = []
        members_data = []
        scores_by_member = {}
        members_submitted = set()

        for criterion in criteria:
            criterion_scores = tech_scores.filter(criterion=criterion)
            if not criterion_scores.exists():
                continue

            criterion_avg = Decimal('0')
            criterion_scores_list = []

            for cs in criterion_scores:
                evaluator_id = str(cs.evaluator.id)
                if evaluator_id not in scores_by_member:
                    scores_by_member[evaluator_id] = {'name': cs.evaluator.full_name, 'scores': []}
                scores_by_member[evaluator_id]['scores'].append({
                    'criterion_id': str(criterion.criterion_id),
                    'criterion_name': criterion.criterion_name,
                    'raw_score': float(cs.raw_score),
                    'weighted_score': float(cs.weighted_score),
                    'evaluator_id': evaluator_id,
                })
                members_submitted.add(evaluator_id)

                criterion_avg += cs.raw_score
                criterion_scores_list.append({
                    'evaluator_id': evaluator_id,
                    'evaluator_name': cs.evaluator.full_name,
                    'raw_score': float(cs.raw_score),
                    'weighted_score': float(cs.weighted_score),
                })

            criterion_avg = criterion_avg / criterion_scores.count() if criterion_scores.count() > 0 else Decimal('0')
            criterion_weighted = criterion_avg * criterion.weight / Decimal('100')
            total_weighted += criterion_weighted

            details.append({
                'criterion_id': str(criterion.criterion_id),
                'criterion_name': criterion.criterion_name,
                'average_raw_score': float(criterion_avg),
                'weighted_score': float(criterion_weighted),
                'weight': float(criterion.weight),
                'scores_by_evaluator': criterion_scores_list,
            })

        overall_pct = (total_weighted / total_tech_weight * Decimal('100')) if total_tech_weight > 0 else Decimal('0')

        financial_eval = FinancialEvaluation.objects.filter(bid=bid).first()
        opening_detail = BidOpeningDetail.objects.filter(bid=bid).first()

        members_data = [
            {
                'id': m['id'],
                'name': m['name'],
                'role': m['role'],
                'submitted': m['id'] in members_submitted,
                'scores': scores_by_member.get(m['id'], {}).get('scores', []),
            }
            for m in all_member_list
        ]

        results.append({
            'bid_id': str(bid.bid_id),
            'submission_id': bid.submission_id,
            'bidder_name': bid.supplier.full_name,
            'original_price': float(bid.bid_price or 0),
            'preference_category': financial_eval.preference_category if financial_eval else 'non_citizen',
            'preference_margin': float(financial_eval.preference_applied or 0) if financial_eval else 0,
            'overall_technical_score': float(overall_pct),
            'passed': overall_pct >= threshold,
            'financial_evaluation_id': str(financial_eval.evaluation_id) if financial_eval else None,
            'evaluated_price': float(financial_eval.evaluated_price) if financial_eval else None,
            'financial_score': float(financial_eval.financial_score) if financial_eval else None,
            'financial_sealed': opening_detail.financial_sealed if opening_detail else True,
            'details': details,
            'members': members_data,
            'all_members_submitted': len(members_submitted) >= len([m for m in all_member_list if m['id']]),
            'members_submitted_count': len(members_submitted),
            'total_members': len([m for m in all_member_list if m['id']]),
        })

    results.sort(key=lambda x: x['overall_technical_score'], reverse=True)

    return Response({
        'solicitation_id': str(sol.solicitation_id),
        'solicitation_number': sol.sol_number,
        'solicitation_title': sol.title,
        'minimum_technical_threshold': float(threshold),
        'total_bids': len(results),
        'passed_bids': len([r for r in results if r['passed']]),
        'committees': committees_list,
        'criteria': [
            {
                'criterion_id': str(c.criterion_id),
                'criterion_name': c.criterion_name,
                'weight': float(c.weight),
            }
            for c in criteria
        ],
        'bids': results,
    })


class CombinedScoreListView(BaseView, generics.ListAPIView):
    queryset = CombinedScore.objects.select_related('bid').all()
    serializer_class = CombinedScoreSerializer
    ordering = ['rank']


class PostQualificationListView(BaseView, generics.ListCreateAPIView):
    queryset = PostQualification.objects.select_related('ber', 'bidder', 'bidder__supplier', 'assigned_to', 'recommended_by', 'solicitation').all()
    serializer_class = PostQualificationSerializer
    filterset_class = PostQualificationFilter
    search_fields = ['bidder__submission_id', 'bidder__supplier__full_name', 'status', 'notes', 'workflow_stage']
    ordering = ['-pq_id']
    permission_classes = [CanManagePostQualifications]

    def get_queryset(self):
        qs = super().get_queryset()
        solicitation = self.request.query_params.get('solicitation')
        if solicitation:
            qs = qs.filter(
                Q(solicitation_id=solicitation) |
                Q(ber__solicitation_id=solicitation) |
                Q(bidder__solicitation_id=solicitation)
            )
        stage = self.request.query_params.get('stage')
        if stage:
            qs = qs.filter(workflow_stage=stage)
        result = self.request.query_params.get('result')
        if result:
            qs = qs.filter(result=result)
        assigned_to_me = self.request.query_params.get('assigned_to_me')
        if assigned_to_me and assigned_to_me.lower() in ('true', '1'):
            qs = qs.filter(assigned_to=self.request.user)
        return qs

    def create(self, request, *args, **kwargs):
        solicitation_id = request.data.get('solicitation_id')
        bidder_id = request.data.get('bidder_id')
        if not solicitation_id or not bidder_id:
            return Response({'error': 'solicitation_id and bidder_id are required'}, status=400)

        sol = Solicitation.objects.filter(pk=solicitation_id).first()
        if not sol:
            return Response({'error': 'Solicitation not found'}, status=404)

        if sol.status != 'awarded':
            return Response({'error': 'Post-qualification can only begin after a winning bidder has been selected.'}, status=400)

        winner = BidSubmission.objects.filter(pk=bidder_id, solicitation=sol, status='awarded').first()
        if not winner:
            return Response({'error': 'The specified bid is not the awarded winner for this solicitation.'}, status=400)

        if PostQualification.objects.filter(bidder=winner).exists():
            return Response({'error': 'Post-qualification already exists for this bid.'}, status=400)

        pq = PostQualification.objects.create(
            bidder=winner,
            solicitation=sol,
            status='initiation',
            workflow_stage='initiation',
            verification_items=[],
            assigned_to=request.user,
            deadline=timezone.now() + timezone.timedelta(days=14),
        )

        PQActionLog.objects.create(
            pq=pq,
            action='pq_initiated',
            performed_by=request.user,
            details=f'Post-qualification initiated and assigned to {request.user.full_name}. Deadline: {pq.deadline.isoformat() if pq.deadline else "N/A"}',
            metadata={'assigned_to': str(request.user.id), 'deadline': pq.deadline.isoformat() if pq.deadline else None},
        )

        return Response(PostQualificationSerializer(pq).data, status=201)


class PostQualificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PostQualification.objects.select_related('ber', 'bidder', 'bidder__supplier', 'assigned_to', 'recommended_by', 'solicitation').all()
    serializer_class = PostQualificationSerializer
    permission_classes = [CanManagePostQualifications]


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_update_verification_item_view(request, pq_pk):
    with transaction.atomic():
        try:
            pq = PostQualification.objects.select_for_update().get(pk=pq_pk)
        except PostQualification.DoesNotExist:
            return Response({'error': 'Post-qualification record not found'}, status=404)

        item_id = request.data.get('item_id')
        status_val = request.data.get('status')
        notes = request.data.get('notes', '')
        contact_result = request.data.get('contact_result', '')

        if not item_id:
            return Response({'error': 'item_id is required'}, status=400)

        if not status_val:
            return Response({'error': 'status is required'}, status=400)

        VALID_ITEM_STATUSES = {'pending', 'in_progress', 'cleared', 'failed'}
        if status_val not in VALID_ITEM_STATUSES:
            return Response({'error': f'Invalid status. Must be one of: {", ".join(sorted(VALID_ITEM_STATUSES))}'}, status=400)

        if len(notes) > 2000:
            return Response({'error': 'Notes must be 2000 characters or fewer'}, status=400)

        if len(contact_result) > 500:
            return Response({'error': 'Contact result must be 500 characters or fewer'}, status=400)

        items = list(pq.verification_items or [])
        updated = False
        old_status = None
        for item in items:
            if item.get('id') == item_id:
                old_status = item.get('status')
                item['status'] = status_val
                if notes:
                    item['notes'] = notes
                if contact_result:
                    item['contact_result'] = contact_result
                item['verified_by'] = str(request.user.full_name)
                item['verified_at'] = timezone.now().isoformat()
                updated = True
                break

        if not updated:
            return Response({'error': 'Verification item not found'}, status=404)

        # Auto-advance workflow stage based on item category completion
        pq.verification_items = items
        pq.status = 'in_progress'
        if pq.workflow_stage == 'initiation':
            pq.workflow_stage = 'desktop_review'
        pq.save()

    PQActionLog.objects.create(
        pq=pq,
        action='item_updated',
        performed_by=request.user,
        details=f'Item "{item_id}" status changed from "{old_status}" to "{status_val}"',
        metadata={'item_id': item_id, 'old_status': old_status, 'new_status': status_val},
    )

    if pq.status == 'cleared':
        _notify_ec_phase_completion(pq.bidder.solicitation, 'post-qual')
        try:
            if pq.bidder.supplier:
                notify_users(
                    [pq.bidder.supplier],
                    f'Post-Qualification Cleared — {pq.bidder.solicitation.sol_number}',
                    (
                        f'Dear {pq.bidder.supplier.full_name},\n\n'
                        f'Your post-qualification verification for solicitation '
                        f'{pq.bidder.solicitation.sol_number} ({pq.bidder.solicitation.title}) '
                        f'has been completed successfully.\n\n'
                        f'Your bid reference: {pq.bidder.submission_id}\n\n'
                        f'You may now proceed with contract signing. Please check the system for further instructions.\n\n'
                        f'Regards,\nZAMMSA Procurement Team'
                    ),
                    notification_type='approval',
                    priority='high',
                    source_module='evaluations',
                    object_id=str(pq.pk),
                    action_url=f'/vendor/contracts?solicitation={pq.bidder.solicitation_id}',
                    metadata={
                        'alert_key': 'post_qualification_cleared',
                        'solicitation_id': str(pq.bidder.solicitation_id),
                        'sol_number': pq.bidder.solicitation.sol_number,
                        'submission_id': pq.bidder.submission_id,
                    },
                    email_required=True,
                )
        except Exception as e:
            import logging
            logging.getLogger('evaluations').warning(f'Failed to send PQ cleared notification: {e}')

    elif pq.status == 'failed':
        try:
            if pq.bidder.supplier:
                notify_users(
                    [pq.bidder.supplier],
                    f'Post-Qualification Failed — {pq.bidder.solicitation.sol_number}',
                    (
                        f'Dear {pq.bidder.supplier.full_name},\n\n'
                        f'We regret to inform you that your post-qualification verification for '
                        f'solicitation {pq.bidder.solicitation.sol_number} ({pq.bidder.solicitation.title}) '
                        f'has not been passed.\n\n'
                        f'Your bid reference: {pq.bidder.submission_id}\n\n'
                        f'Please contact the procurement office for further details.\n\n'
                        f'Regards,\nZAMMSA Procurement Team'
                    ),
                    notification_type='rejection',
                    priority='high',
                    source_module='evaluations',
                    object_id=str(pq.pk),
                    action_url=f'/vendor/dashboard',
                    metadata={
                        'alert_key': 'post_qualification_failed',
                        'solicitation_id': str(pq.bidder.solicitation_id),
                        'sol_number': pq.bidder.solicitation.sol_number,
                        'submission_id': pq.bidder.submission_id,
                    },
                    email_required=True,
                )
        except Exception as e:
            import logging
            logging.getLogger('evaluations').warning(f'Failed to send PQ failed notification to supplier: {e}')

        try:
            pq.bidder.status = 'unsuccessful'
            pq.bidder.save(update_fields=['status'])

            PQActionLog.objects.create(
                pq=pq,
                action='pq_failed',
                performed_by=request.user,
                details=f'Bid {pq.bidder.submission_id} marked unsuccessful due to PQ failure',
                metadata={'submission_id': str(pq.bidder.submission_id)},
            )

            solicitation = pq.bidder.solicitation
            current_rank = CombinedScore.objects.filter(
                bid=pq.bidder
            ).values_list('rank', flat=True).first()

            next_ranked = None
            if current_rank is not None:
                next_ranked = (
                    CombinedScore.objects
                    .filter(bid__solicitation=solicitation, rank__gt=current_rank)
                    .select_related('bid', 'bid__supplier')
                    .order_by('rank')
                    .first()
                )

            if next_ranked and next_ranked.bid.status not in ('unsuccessful', 'withdrawn', 'non_responsive'):
                next_bid = next_ranked.bid

                next_pq, created = PostQualification.objects.get_or_create(
                    bidder=next_bid,
                    defaults={
                        'solicitation': solicitation,
                        'status': 'initiation',
                        'workflow_stage': 'initiation',
                        'verification_items': [],
                    },
                )

                if created:
                    PQActionLog.objects.create(
                        pq=next_pq,
                        action='pq_failed',
                        performed_by=request.user,
                        details=(
                            f'Auto-created PQ for next-ranked bidder (Rank {next_ranked.rank}): '
                            f'{next_bid.supplier.full_name if next_bid.supplier else next_bid.submission_id}'
                        ),
                        metadata={
                            'previous_bidder': str(pq.bidder.submission_id),
                            'next_bidder': str(next_bid.submission_id),
                            'next_rank': next_ranked.rank,
                        },
                    )

                    ec_members = _resolve_ec_members(solicitation)
                    if ec_members.exists():
                        notify_users(
                            list(ec_members),
                            f'Winner PQ Failed — Next Bidder Considered — {solicitation.sol_number}',
                            (
                                f'The post-qualification verification for the selected winner '
                                f'({pq.bidder.supplier.full_name if pq.bidder.supplier else pq.bidder.submission_id}) '
                                f'has failed for solicitation {solicitation.sol_number} ({solicitation.title}).\n\n'
                                f'The next-ranked bidder, {next_bid.supplier.full_name if next_bid.supplier else next_bid.submission_id} '
                                f'(Rank {next_ranked.rank}), is now being considered for post-qualification.\n\n'
                                f'Please log in to the ZAMMSA Procurement System to review and proceed.'
                            ),
                            notification_type='workflow',
                            priority='high',
                            source_module='evaluations',
                            object_id=str(solicitation.solicitation_id),
                            action_url=f'/evaluations',
                            metadata={
                                'alert_key': 'pq_failed_next_bidder',
                                'solicitation_id': str(solicitation.solicitation_id),
                                'sol_number': solicitation.sol_number,
                                'failed_bidder': str(pq.bidder.submission_id),
                                'next_bidder': str(next_bid.submission_id),
                                'next_rank': next_ranked.rank,
                            },
                            email_required=True,
                        )
        except Exception as e:
            import logging
            logging.getLogger('evaluations').warning(f'Failed to process PQ failure fallback: {e}')

    return Response({
        'message': 'Verification item updated',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_generate_checklist_view(request, pq_pk):
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    if pq.verification_items and len(pq.verification_items) > 0:
        return Response({'error': 'Checklist already generated. Update existing items or reset first.'}, status=400)

    if not pq.assigned_to:
        pq.assigned_to = request.user

    pq.deadline = timezone.now() + timezone.timedelta(days=14)

    bid = pq.bidder
    supplier_profile = _resolve_supplier_profile(bid.supplier)

    auto_data_pacra = {}
    auto_data_zppa = {}
    auto_data_zra = {}
    if supplier_profile:
        try:
            from integrations.clients import pacra_client
            pacra_result = pacra_client.verify_company(
                supplier_profile.registration_number,
                supplier_profile.name,
            )
            auto_data_pacra = {
                'company_name': pacra_result.company_name,
                'registration_number': pacra_result.registration_number,
                'status': pacra_result.status,
                'directors': pacra_result.directors,
                'verified': pacra_result.verified,
                'verification_time': pacra_result.verification_time,
                'source': pacra_result.source,
            }
            PQActionLog.objects.create(
                pq=pq, action='auto_verified', performed_by=request.user,
                details=f'PACRA check completed for {supplier_profile.registration_number} — source: {pacra_result.source}',
                metadata={'check': 'pacra', 'registration_number': supplier_profile.registration_number, 'source': pacra_result.source},
            )
        except Exception as e:
            auto_data_pacra = {'error': str(e), 'source': 'error'}

        try:
            from integrations.clients import zppa_debarment_client
            zppa_result = zppa_debarment_client.check_debarment(
                supplier_profile.name,
                supplier_profile.registration_number,
                supplier_profile.tin,
            )
            auto_data_zppa = {
                'is_debarred': zppa_result.is_debarred,
                'company_name': zppa_result.company_name,
                'verified': zppa_result.verified,
                'verification_time': zppa_result.verification_time,
                'source': zppa_result.source,
            }
            PQActionLog.objects.create(
                pq=pq, action='auto_verified', performed_by=request.user,
                details=f'ZPPA debarment check — {"DEBARRED" if zppa_result.is_debarred else "NOT LISTED"} — source: {zppa_result.source}',
                metadata={'check': 'zppa', 'is_debarred': zppa_result.is_debarred, 'source': zppa_result.source},
            )
        except Exception as e:
            auto_data_zppa = {'error': str(e), 'source': 'error'}

        try:
            from integrations.clients import zra_client
            zra_result = zra_client.verify_tax_clearance(supplier_profile.tin, supplier_profile.name)
            auto_data_zra = {
                'tax_clearance_valid': zra_result.tax_clearance_valid,
                'expiry_date': zra_result.expiry_date,
                'tin': zra_result.tin,
                'verified': zra_result.verified,
                'verification_time': zra_result.verification_time,
                'source': zra_result.source,
            }
            PQActionLog.objects.create(
                pq=pq, action='auto_verified', performed_by=request.user,
                details=f'ZRA tax clearance check for TIN {supplier_profile.tin} — source: {zra_result.source}',
                metadata={'check': 'zra', 'tin': supplier_profile.tin, 'source': zra_result.source},
            )
        except Exception as e:
            auto_data_zra = {'error': str(e), 'source': 'error'}

    DEFAULT_CHECKLIST = [
        {
            'id': 'pacra-registration',
            'label': 'PACRA Company Registration',
            'category': 'legal',
            'status': 'cleared' if auto_data_pacra.get('verified') and not auto_data_pacra.get('error') else 'pending',
            'notes': '',
            'verification_method': 'auto',
            'auto_data': auto_data_pacra,
        },
        {
            'id': 'zppa-debarment',
            'label': 'ZPPA Debarment List Check',
            'category': 'legal',
            'status': 'failed' if auto_data_zppa.get('is_debarred') else ('cleared' if auto_data_zppa.get('verified') and not auto_data_zppa.get('error') else 'pending'),
            'notes': '',
            'verification_method': 'auto',
            'auto_data': auto_data_zppa,
        },
        {
            'id': 'zra-tax-clearance',
            'label': 'ZRA Tax Clearance',
            'category': 'legal',
            'status': 'cleared' if auto_data_zra.get('verified') and auto_data_zra.get('tax_clearance_valid') and not auto_data_zra.get('error') else 'pending',
            'notes': '',
            'verification_method': 'auto',
            'auto_data': auto_data_zra,
        },
        {
            'id': 'zamra-registration',
            'label': 'ZAMRA Product Registration',
            'category': 'legal',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
        },
        {
            'id': 'financial-statements',
            'label': 'Financial Statements Review',
            'category': 'financial',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
        },
        {
            'id': 'bank-reference',
            'label': 'Bank Reference Letter',
            'category': 'financial',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
        },
        {
            'id': 'litigation-insolvency',
            'label': 'Litigation and Insolvency Check',
            'category': 'financial',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
        },
        {
            'id': 'warehouse-storage',
            'label': 'Warehouse / Storage Capacity',
            'category': 'technical',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
            'site_visit': {
                'conducted': False,
                'date': None,
                'visited_by': None,
                'location': None,
                'observations': {},
                'photos': [],
            },
        },
        {
            'id': 'cold-chain',
            'label': 'Cold Chain Capability',
            'category': 'technical',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
            'site_visit': {
                'conducted': False,
                'date': None,
                'visited_by': None,
                'location': None,
                'observations': {},
                'photos': [],
            },
        },
        {
            'id': 'delivery-logistics',
            'label': 'Delivery Capacity and Logistics',
            'category': 'technical',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
            'site_visit': {
                'conducted': False,
                'date': None,
                'visited_by': None,
                'location': None,
                'observations': {},
                'photos': [],
            },
        },
        {
            'id': 'key-personnel',
            'label': 'Key Personnel Verification',
            'category': 'technical',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
            'site_visit': {
                'conducted': False,
                'date': None,
                'visited_by': None,
                'location': None,
                'observations': {},
                'photos': [],
            },
        },
        {
            'id': 'reference-1',
            'label': 'Reference 1',
            'category': 'reference',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
            'reference_data': {
                'organization': '',
                'contact_name': '',
                'contact_phone': '',
                'contract_ref': '',
                'contract_value': None,
                'contract_period': '',
                'contact_method': 'phone',
                'contact_attempts': [],
                'responses': {
                    'delivery_on_time': None,
                    'quality_acceptable': None,
                    'quantities_correct': None,
                    'communication_responsive': None,
                    'would_use_again': None,
                    'complaints': '',
                },
                'summary': '',
            },
        },
        {
            'id': 'reference-2',
            'label': 'Reference 2',
            'category': 'reference',
            'status': 'pending',
            'notes': '',
            'verification_method': 'manual',
            'reference_data': {
                'organization': '',
                'contact_name': '',
                'contact_phone': '',
                'contract_ref': '',
                'contract_value': None,
                'contract_period': '',
                'contact_method': 'phone',
                'contact_attempts': [],
                'responses': {
                    'delivery_on_time': None,
                    'quality_acceptable': None,
                    'quantities_correct': None,
                    'communication_responsive': None,
                    'would_use_again': None,
                    'complaints': '',
                },
                'summary': '',
            },
        },
    ]

    with transaction.atomic():
        pq.verification_items = DEFAULT_CHECKLIST
        pq.status = 'in_progress'
        pq.workflow_stage = 'desktop_review'
        pq.save()

    PQActionLog.objects.create(
        pq=pq,
        action='checklist_generated',
        performed_by=request.user,
        details=f'Verification checklist generated with {len(DEFAULT_CHECKLIST)} items. Auto-verified: PACRA, ZPPA, ZRA. Workflow stage: Desktop Review. Deadline: {pq.deadline.isoformat() if pq.deadline else "N/A"}',
        metadata={'item_count': len(DEFAULT_CHECKLIST), 'deadline': pq.deadline.isoformat() if pq.deadline else None},
    )

    return Response({
        'message': 'Verification checklist generated',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['GET'])
@permission_classes([CanManagePostQualifications])
def pq_verification_context_view(request, pq_pk):
    try:
        pq = PostQualification.objects.select_related(
            'bidder', 'bidder__supplier', 'assigned_to', 'ber'
        ).get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    bid = pq.bidder
    user = bid.supplier

    supplier_profile = None
    if user.employee_id and str(user.employee_id).startswith('SUP-'):
        supplier_profile = SupplierModel.objects.filter(
            registration_number=str(user.employee_id).replace('SUP-', '', 1)
        ).first()
    if not supplier_profile:
        supplier_profile = SupplierModel.objects.filter(name=user.full_name).first()
    if not supplier_profile:
        va = VendorApplication.objects.filter(email=user.email, status='approved').order_by('-created_at').first()
        if va:
            supplier_profile = SupplierModel.objects.filter(
                Q(registration_number=va.registration_number) | Q(tin=va.tin)
            ).first()

    supplier_docs = []
    blacklist_entry = None
    supplier_performances = []
    supplier_risk_scores = []
    if supplier_profile:
        supplier_docs = list(SupplierDocument.objects.filter(supplier=supplier_profile).values(
            'document_id', 'document_type', 'file_path', 'expiry_date', 'verification_status'
        ))
        blacklist_entry = Blacklist.objects.filter(
            Q(registration_number=supplier_profile.registration_number) |
            Q(tin=supplier_profile.tin)
        ).order_by('-created_at').first()

        from suppliers.models import SupplierPerformance, SupplierRiskScore
        supplier_performances = list(
            SupplierPerformance.objects.filter(supplier=supplier_profile)
            .select_related('contract', 'evaluated_by')
            .values(
                'performance_id', 'evaluation_date', 'metrics', 'overall_score',
                'needs_improvement', 'improvement_notes',
            )[:10]
        )
        for perf in supplier_performances:
            perf['evaluation_date'] = perf['evaluation_date'].isoformat() if perf['evaluation_date'] else None
            perf['overall_score'] = float(perf['overall_score']) if perf['overall_score'] else 0

        supplier_risk_scores = list(
            SupplierRiskScore.objects.filter(supplier=supplier_profile)
            .values('risk_id', 'risk_score', 'risk_level', 'calculated_at', 'factors')[:5]
        )
        for risk in supplier_risk_scores:
            risk['risk_score'] = float(risk['risk_score']) if risk['risk_score'] else 0
            risk['calculated_at'] = risk['calculated_at'].isoformat() if risk['calculated_at'] else None

    bid_docs = list(BidDocument.objects.filter(bid=bid).values(
        'document_id', 'document_type', 'file_path', 'uploaded_at'
    ))
    bid_securities = list(BidSecurity.objects.filter(bid=bid).values(
        'security_id', 'security_type', 'amount', 'issuing_institution',
        'reference_number', 'validity_date', 'verification_status'
    ))

    tech_scores = TechnicalScore.objects.filter(
        bid=bid, is_final=True
    ).select_related('criterion', 'evaluator')
    tech_data = [
        {
            'criterion': ts.criterion.criterion_name if ts.criterion else '',
            'evaluator': ts.evaluator.full_name if ts.evaluator else '',
            'raw_score': float(ts.raw_score),
            'weighted_score': float(ts.weighted_score),
        }
        for ts in tech_scores
    ]

    fin_eval = FinancialEvaluation.objects.filter(bid=bid).first()
    fin_data = None
    if fin_eval:
        fin_data = {
            'original_price': float(fin_eval.original_price or 0),
            'corrected_price': float(fin_eval.corrected_price or 0),
            'evaluated_price': float(fin_eval.evaluated_price or 0),
            'financial_score': float(fin_eval.financial_score or 0),
            'preference_category': fin_eval.preference_category or 'non_citizen',
            'preference_margin': float(fin_eval.preference_applied or 0),
        }

    vendor_app = VendorApplication.objects.filter(email=user.email).order_by('-created_at').first()
    va_data = None
    if vendor_app:
        va_data = {
            'company_name': vendor_app.company_name,
            'business_type': vendor_app.business_type,
            'year_established': vendor_app.year_established,
            'employee_count': vendor_app.employee_count,
            'annual_turnover': str(vendor_app.annual_turnover) if vendor_app.annual_turnover else None,
            'contact_person': vendor_app.contact_person,
            'contact_phone': vendor_app.contact_phone,
            'address': vendor_app.address,
            'pacra_validated': vendor_app.pacra_validated,
            'ceec_validated': vendor_app.ceec_validated,
            'status': vendor_app.status,
        }

    return Response({
        'pq_id': str(pq.pq_id),
        'status': pq.status,
        'rank': pq.rank,
        'chair_decision': pq.chair_decision,
        'chair_decision_notes': pq.chair_decision_notes,
        'chair_decided_at': pq.chair_decided_at.isoformat() if pq.chair_decided_at else None,
        'verification_items': pq.verification_items or [],
        'notes': pq.notes,
        'assigned_to_name': pq.assigned_to.full_name if pq.assigned_to else None,
        'deadline': pq.deadline.isoformat() if pq.deadline else None,
        'created_at': pq.created_at.isoformat() if pq.created_at else None,
        'updated_at': pq.updated_at.isoformat() if pq.updated_at else None,
        'bid': {
            'submission_id': bid.submission_id,
            'bid_price': float(bid.bid_price or 0),
            'currency': bid.currency or 'ZMW',
            'validity_period_days': bid.validity_period_days,
            'security_amount': float(bid.security_amount or 0),
            'security_type': bid.security_type or '',
            'status': bid.status,
            'submitted_at': bid.submitted_at.isoformat() if bid.submitted_at else None,
            'line_items': bid.line_items or [],
        },
        'supplier_user': {
            'full_name': user.full_name,
            'email': user.email,
            'employee_id': user.employee_id or '',
        },
        'supplier_profile': {
            'supplier_id': str(supplier_profile.supplier_id) if supplier_profile else None,
            'registration_number': supplier_profile.registration_number if supplier_profile else None,
            'tin': supplier_profile.tin if supplier_profile else None,
            'name': supplier_profile.name if supplier_profile else None,
            'ceec_category': supplier_profile.ceec_category if supplier_profile else None,
            'status': supplier_profile.status if supplier_profile else None,
            'risk_score': float(supplier_profile.risk_score) if supplier_profile and supplier_profile.risk_score else None,
            'risk_level': supplier_profile.risk_level if supplier_profile else None,
            'bank_name': supplier_profile.bank_name if supplier_profile else None,
            'bank_account_number': supplier_profile.bank_account_number if supplier_profile else None,
            'bank_account_name': supplier_profile.bank_account_name if supplier_profile else None,
            'registered_at': supplier_profile.registered_at.isoformat() if supplier_profile and supplier_profile.registered_at else None,
            'updated_at': supplier_profile.updated_at.isoformat() if supplier_profile and supplier_profile.updated_at else None,
            'performances': supplier_performances,
            'risk_scores': supplier_risk_scores,
        } if supplier_profile else None,
        'supplier_documents': supplier_docs,
        'blacklist': {
            'reason': blacklist_entry.reason if blacklist_entry else None,
            'debarred_until': blacklist_entry.debarred_until.isoformat() if blacklist_entry and blacklist_entry.debarred_until else None,
            'source': blacklist_entry.source if blacklist_entry else None,
        } if blacklist_entry else None,
        'bid_documents': bid_docs,
        'bid_securities': bid_securities,
        'technical_scores': tech_data,
        'financial_evaluation': fin_data,
        'vendor_application': va_data,
    })


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_reassign_view(request, pq_pk):
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    new_assignee_id = request.data.get('assigned_to')
    if not new_assignee_id:
        return Response({'error': 'assigned_to user ID is required'}, status=400)

    try:
        new_assignee = User.objects.get(pk=new_assignee_id)
    except User.DoesNotExist:
        return Response({'error': 'User not found'}, status=404)

    old_assignee = pq.assigned_to
    pq.assigned_to = new_assignee
    pq.save(update_fields=['assigned_to'])

    PQActionLog.objects.create(
        pq=pq,
        action='pq_reassigned',
        performed_by=request.user,
        details=f'Post-qualification reassigned from {old_assignee.full_name if old_assignee else "unassigned"} to {new_assignee.full_name}',
        metadata={'old_assignee': str(old_assignee.id) if old_assignee else None, 'new_assignee': str(new_assignee.id)},
    )

    return Response({
        'message': 'Post-qualification reassigned',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_add_notes_view(request, pq_pk):
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    notes = request.data.get('notes', '')
    if not notes:
        return Response({'error': 'notes is required'}, status=400)

    if len(notes) > 5000:
        return Response({'error': 'Notes must be 5000 characters or fewer'}, status=400)

    pq.notes = notes
    pq.save(update_fields=['notes'])

    PQActionLog.objects.create(
        pq=pq,
        action='notes_added',
        performed_by=request.user,
        details='Overall verification notes added/updated',
        metadata={'notes_length': len(notes)},
    )

    return Response({
        'message': 'Notes saved',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])



@api_view(['GET'])
@permission_classes([CanManagePostQualifications])
def pq_ranking_summary_view(request, solicitation_pk):
    try:
        sol = Solicitation.objects.get(pk=solicitation_pk)
    except Solicitation.DoesNotExist:
        return Response({'error': 'Solicitation not found'}, status=404)

    combined_scores = CombinedScore.objects.filter(
        bid__solicitation=sol
    ).select_related('bid', 'bid__supplier').order_by('rank')

    financial_evals = {
        str(fe.bid_id): fe
        for fe in FinancialEvaluation.objects.filter(bid__solicitation=sol)
    }

    pq_records = {
        str(pq.bidder_id): pq
        for pq in PostQualification.objects.filter(bidder__solicitation=sol)
    }

    rankings = []
    for cs in combined_scores:
        fin_eval = financial_evals.get(str(cs.bid_id))
        pq_rec = pq_records.get(str(cs.bid_id))
        rankings.append({
            'rank': cs.rank,
            'bid_id': str(cs.bid_id),
            'submission_id': cs.bid.submission_id,
            'bidder_name': cs.bid.supplier.full_name if cs.bid.supplier else 'Unknown',
            'technical_score': float(cs.technical_score),
            'total_score': float(cs.total_score),
            'evaluated_price': float(fin_eval.evaluated_price) if fin_eval else None,
            'original_price': float(cs.bid.bid_price or 0),
            'bid_status': cs.bid.status,
            'post_qual_status': pq_rec.status if pq_rec else None,
            'post_qual_id': str(pq_rec.pq_id) if pq_rec else None,
            'chair_decision': pq_rec.chair_decision if pq_rec else None,
        })

    current_pq = PostQualification.objects.filter(
        bidder__solicitation=sol
    ).exclude(status__in=['cleared', 'failed']).order_by('rank').first()

    all_pqs = PostQualification.objects.filter(
        bidder__solicitation=sol
    ).order_by('rank')

    pq_tracker = []
    for pq in all_pqs:
        pq_tracker.append({
            'rank': pq.rank,
            'bidder_name': pq.bidder.supplier.full_name if pq.bidder.supplier else 'Unknown',
            'submission_id': pq.bidder.submission_id,
            'status': pq.status,
            'chair_decision': pq.chair_decision,
        })

    return Response({
        'solicitation_id': str(sol.solicitation_id),
        'sol_number': sol.sol_number,
        'title': sol.title,
        'rankings': rankings,
        'current_pq': {
            'pq_id': str(current_pq.pq_id),
            'rank': current_pq.rank,
            'bidder_name': current_pq.bidder.supplier.full_name if current_pq.bidder.supplier else 'Unknown',
            'status': current_pq.status,
        } if current_pq else None,
        'pq_tracker': pq_tracker,
        'all_failed': all(p.status == 'failed' for p in all_pqs) if all_pqs.exists() else False,
    })


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_advance_stage_view(request, pq_pk):
    """Advance the workflow stage to the next logical step."""
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    target_stage = request.data.get('stage')
    valid_stages = {'initiation', 'desktop_review', 'document_collection', 'site_inspection', 'reference_check', 'evaluation', 'committee_review', 'closed'}
    if not target_stage or target_stage not in valid_stages:
        return Response({'error': f'Valid stage required. Options: {", ".join(sorted(valid_stages))}'}, status=400)

    if pq.status in ('cleared', 'failed'):
        return Response({'error': 'Cannot change stage on a closed post-qualification'}, status=400)

    old_stage = pq.workflow_stage
    pq.workflow_stage = target_stage

    stage_ordering = ['initiation', 'desktop_review', 'document_collection', 'site_inspection', 'reference_check', 'evaluation', 'committee_review']
    if target_stage in stage_ordering:
        pq.status = 'in_progress'

    pq.save(update_fields=['workflow_stage', 'status'])

    PQActionLog.objects.create(
        pq=pq,
        action='stage_changed',
        performed_by=request.user,
        details=f'Workflow stage changed from "{old_stage or "initiation"}" to "{target_stage}"',
        metadata={'old_stage': old_stage, 'new_stage': target_stage},
    )

    return Response({
        'message': f'Stage advanced to {target_stage}',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['POST', 'GET'])
@permission_classes([CanManagePostQualifications])
def pq_document_requests_view(request, pq_pk):
    """Manage document requests to the supplier."""
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    if request.method == 'GET':
        return Response({
            'document_requests': pq.pq_document_requests or [],
        })

    action = request.data.get('action', 'request')
    doc_requests = list(pq.pq_document_requests or [])

    if action == 'request':
        doc_type = request.data.get('document_type', '')
        description = request.data.get('description', '')
        due_date = request.data.get('due_date')

        if not doc_type or not description:
            return Response({'error': 'document_type and description are required'}, status=400)

        doc_request = {
            'request_id': str(uuid.uuid4()),
            'document_type': doc_type,
            'description': description,
            'requested_at': timezone.now().isoformat(),
            'requested_by': request.user.full_name,
            'due_date': due_date,
            'submitted_at': None,
            'file_url': None,
            'status': 'requested',
            'notes': request.data.get('notes', ''),
        }
        doc_requests.append(doc_request)
        pq.pq_document_requests = doc_requests
        pq.save(update_fields=['pq_document_requests'])

        PQActionLog.objects.create(
            pq=pq,
            action='document_requested',
            performed_by=request.user,
            details=f'Document requested: {doc_type} - {description}',
            metadata={'document_type': doc_type, 'request_id': doc_request['request_id']},
        )

        return Response({'message': 'Document request created', 'document_request': doc_request})

    elif action == 'submit':
        request_id = request.data.get('request_id')
        file_url = request.data.get('file_url', '')

        if not request_id:
            return Response({'error': 'request_id is required'}, status=400)

        found = False
        for dr in doc_requests:
            if dr.get('request_id') == request_id:
                dr['status'] = 'submitted'
                dr['submitted_at'] = timezone.now().isoformat()
                if file_url:
                    dr['file_url'] = file_url
                found = True
                break

        if not found:
            return Response({'error': 'Document request not found'}, status=404)

        pq.pq_document_requests = doc_requests
        pq.save(update_fields=['pq_document_requests'])

        PQActionLog.objects.create(
            pq=pq,
            action='document_submitted',
            performed_by=request.user,
            details=f'Document submitted for request {request_id}',
            metadata={'request_id': request_id, 'file_url': file_url},
        )

        return Response({'message': 'Document submission recorded'})

    return Response({'error': 'Invalid action'}, status=400)


@api_view(['POST', 'GET'])
@permission_classes([CanManagePostQualifications])
def pq_conditions_view(request, pq_pk):
    """Manage conditions when awarding with conditions."""
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    if request.method == 'GET':
        return Response({
            'conditions': pq.conditions or [],
        })

    action = request.data.get('action', 'add')
    conditions = list(pq.conditions or [])

    if action == 'add':
        condition_desc = request.data.get('condition', '')
        deadline = request.data.get('deadline')

        if not condition_desc:
            return Response({'error': 'condition description is required'}, status=400)

        new_condition = {
            'condition_id': str(uuid.uuid4()),
            'condition': condition_desc,
            'deadline': deadline,
            'status': 'pending',
            'verified_at': None,
            'verified_by': None,
            'notes': request.data.get('notes', ''),
        }
        conditions.append(new_condition)
        pq.conditions = conditions
        pq.save(update_fields=['conditions'])

        PQActionLog.objects.create(
            pq=pq,
            action='condition_added',
            performed_by=request.user,
            details=f'Condition added: {condition_desc[:100]}',
            metadata={'condition_id': new_condition['condition_id']},
        )

        return Response({'message': 'Condition added', 'condition': new_condition})

    elif action == 'verify':
        condition_id = request.data.get('condition_id')
        if not condition_id:
            return Response({'error': 'condition_id is required'}, status=400)

        found = False
        for c in conditions:
            if c.get('condition_id') == condition_id:
                c['status'] = 'verified'
                c['verified_at'] = timezone.now().isoformat()
                c['verified_by'] = request.user.full_name
                c['notes'] = request.data.get('notes', c.get('notes', ''))
                found = True
                break

        if not found:
            return Response({'error': 'Condition not found'}, status=404)

        pq.conditions = conditions
        pq.save(update_fields=['conditions'])

        PQActionLog.objects.create(
            pq=pq,
            action='condition_verified',
            performed_by=request.user,
            details=f'Condition verified: {condition_id}',
            metadata={'condition_id': condition_id},
        )

        return Response({'message': 'Condition verified'})

    return Response({'error': 'Invalid action'}, status=400)


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_submit_recommendation_view(request, pq_pk):
    """Submit PQ officer recommendation before committee review."""
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    recommendation = request.data.get('recommendation', '')
    if not recommendation:
        return Response({'error': 'recommendation text is required'}, status=400)

    pq.recommendation = recommendation
    pq.recommended_by = request.user
    pq.workflow_stage = 'committee_review'
    pq.save(update_fields=['recommendation', 'recommended_by', 'workflow_stage'])

    PQActionLog.objects.create(
        pq=pq,
        action='recommendation_submitted',
        performed_by=request.user,
        details=f'PQ Officer recommendation submitted. Stage advanced to Committee Review',
        metadata={'recommendation_length': len(recommendation)},
    )

    return Response({
        'message': 'Recommendation submitted',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['POST', 'GET'])
@permission_classes([CanManagePostQualifications])
def pq_committee_review_view(request, pq_pk):
    """Committee members submit their review of the PQ findings."""
    try:
        pq = PostQualification.objects.select_related('bidder', 'bidder__solicitation').get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    if request.method == 'GET':
        return Response({
            'committee_review': pq.committee_review or [],
        })

    action = request.data.get('action', 'review')
    reviews = list(pq.committee_review or [])

    if action == 'review':
        decision = request.data.get('decision', '')
        comments = request.data.get('comments', '')

        if decision not in ('approve', 'approve_with_conditions', 'reject'):
            return Response({'error': 'decision must be approve, approve_with_conditions, or reject'}, status=400)

        # Check if user already reviewed
        for r in reviews:
            if r.get('member_id') == str(request.user.id):
                return Response({'error': 'You have already submitted your review'}, status=400)

        review_entry = {
            'member_id': str(request.user.id),
            'member_name': request.user.full_name,
            'decision': decision,
            'comments': comments,
            'decided_at': timezone.now().isoformat(),
        }
        reviews.append(review_entry)
        pq.committee_review = reviews
        pq.save(update_fields=['committee_review'])

        PQActionLog.objects.create(
            pq=pq,
            action='committee_reviewed',
            performed_by=request.user,
            details=f'Committee review submitted: {decision}',
            metadata={'member_id': str(request.user.id), 'decision': decision},
        )

        return Response({'message': 'Review submitted', 'review': review_entry})

    return Response({'error': 'Invalid action'}, status=400)


@api_view(['POST'])
@permission_classes([CanManagePostQualifications])
def pq_chair_decision_view(request, pq_pk):
    try:
        pq = PostQualification.objects.select_related('bidder', 'bidder__supplier', 'bidder__solicitation').get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    committees = EvaluationCommittee.objects.filter(solicitation=pq.bidder.solicitation)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role in ('director_procurement', 'procurement_manager')
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can record the chair decision'}, status=403)

    decision = request.data.get('decision', '')
    if decision not in ('passed', 'failed', 'passed_with_conditions'):
        return Response({'error': 'decision must be "passed", "passed_with_conditions", or "failed"'}, status=400)

    decision_notes = request.data.get('decision_notes', '')
    conditions_data = request.data.get('conditions', [])

    if decision == 'failed':
        failed_items = [i for i in (pq.verification_items or []) if i.get('status') == 'failed']
        if not failed_items and not decision_notes:
            return Response({'error': 'At least one failed check or a reason is required for a failed decision'}, status=400)

    with transaction.atomic():
        if decision == 'passed_with_conditions':
            pq.chair_decision = 'passed'
            pq.result = 'award_with_conditions'
            if conditions_data:
                pq.conditions = conditions_data
        elif decision == 'passed':
            pq.chair_decision = 'passed'
            pq.result = 'award'
            pq.conditions = []
        else:
            pq.chair_decision = 'failed'
            pq.result = 'no_award'

        pq.chair_decision_notes = decision_notes
        pq.chair_decided_at = timezone.now()

        if decision in ('passed', 'passed_with_conditions'):
            pq.status = 'cleared'
            pq.verified_at = timezone.now()
        else:
            pq.status = 'failed'

        pq.workflow_stage = 'closed'
        pq.save()

    PQActionLog.objects.create(
        pq=pq,
        action='chair_decision',
        performed_by=request.user,
        details=f'Chair decision: {decision.upper()}. Result: {pq.result}. {decision_notes[:500] if decision_notes else ""}',
        metadata={'decision': decision, 'result': pq.result, 'notes': decision_notes},
    )

    # Notifications
    if decision in ('passed', 'passed_with_conditions'):
        _notify_ec_phase_completion(pq.bidder.solicitation, 'post-qual')
        try:
            if pq.bidder.supplier:
                notify_users(
                    [pq.bidder.supplier],
                    f'Post-Qualification Cleared — {pq.bidder.solicitation.sol_number}',
                    (
                        f'Dear {pq.bidder.supplier.full_name},\n\n'
                        f'Your post-qualification verification for solicitation '
                        f'{pq.bidder.solicitation.sol_number} ({pq.bidder.solicitation.title}) '
                        f'has been completed successfully.\n\n'
                        f'Your bid reference: {pq.bidder.submission_id}\n\n'
                        f'You may now proceed with contract signing. Please check the system for further instructions.\n\n'
                        f'Regards,\nZAMMSA Procurement Team'
                    ),
                    notification_type='approval',
                    priority='high',
                    source_module='evaluations',
                    object_id=str(pq.pk),
                    action_url=f'/vendor/contracts?solicitation={pq.bidder.solicitation_id}',
                    metadata={
                        'alert_key': 'post_qualification_cleared',
                        'solicitation_id': str(pq.bidder.solicitation_id),
                        'sol_number': pq.bidder.solicitation.sol_number,
                        'submission_id': pq.bidder.submission_id,
                    },
                    email_required=True,
                )
        except Exception:
            pass

    elif decision == 'failed':
        try:
            pq.bidder.status = 'unsuccessful'
            pq.bidder.save(update_fields=['status'])

            solicitation = pq.bidder.solicitation
            current_rank = pq.rank

            next_ranked = None
            if current_rank is not None:
                next_ranked = (
                    CombinedScore.objects
                    .filter(bid__solicitation=solicitation, rank__gt=current_rank)
                    .select_related('bid', 'bid__supplier')
                    .order_by('rank')
                    .first()
                )

            if next_ranked and next_ranked.bid.status not in ('unsuccessful', 'withdrawn', 'non_responsive'):
                next_bid = next_ranked.bid
                next_pq, created = PostQualification.objects.get_or_create(
                    bidder=next_bid,
                    defaults={
                        'solicitation': solicitation,
                        'status': 'initiation',
                        'workflow_stage': 'initiation',
                        'verification_items': [],
                        'rank': next_ranked.rank,
                    },
                )
                if created:
                    PQActionLog.objects.create(
                        pq=next_pq,
                        action='pq_failed',
                        performed_by=request.user,
                        details=(
                            f'Auto-created PQ for next-ranked bidder (Rank {next_ranked.rank}): '
                            f'{next_bid.supplier.full_name if next_bid.supplier else next_bid.submission_id}'
                        ),
                        metadata={
                            'previous_bidder': str(pq.bidder.submission_id),
                            'next_bidder': str(next_bid.submission_id),
                            'next_rank': next_ranked.rank,
                        },
                    )
                    ec_members = _resolve_ec_members(solicitation)
                    if ec_members.exists():
                        notify_users(
                            list(ec_members),
                            f'Winner PQ Failed — Next Bidder Considered — {solicitation.sol_number}',
                            (
                                f'The post-qualification verification for the selected winner '
                                f'({pq.bidder.supplier.full_name if pq.bidder.supplier else pq.bidder.submission_id}) '
                                f'has failed for solicitation {solicitation.sol_number} ({solicitation.title}).\n\n'
                                f'The next-ranked bidder, {next_bid.supplier.full_name if next_bid.supplier else next_bid.submission_id} '
                                f'(Rank {next_ranked.rank}), is now being considered for post-qualification.\n\n'
                                f'Please log in to the ZAMMSA Procurement System to review and proceed.'
                            ),
                            notification_type='workflow',
                            priority='high',
                            source_module='evaluations',
                            object_id=str(solicitation.solicitation_id),
                            action_url=f'/evaluations',
                            metadata={
                                'alert_key': 'pq_failed_next_bidder',
                                'solicitation_id': str(solicitation.solicitation_id),
                                'sol_number': solicitation.sol_number,
                                'failed_bidder': str(pq.bidder.submission_id),
                                'next_bidder': str(next_bid.submission_id),
                                'next_rank': next_ranked.rank,
                            },
                            email_required=True,
                        )
            else:
                try:
                    if pq.bidder.supplier:
                        notify_users(
                            [pq.bidder.supplier],
                            f'Post-Qualification Failed — {pq.bidder.solicitation.sol_number}',
                            (
                                f'Dear {pq.bidder.supplier.full_name},\n\n'
                                f'We regret to inform you that your post-qualification verification for '
                                f'solicitation {pq.bidder.solicitation.sol_number} ({pq.bidder.solicitation.title}) '
                                f'has not been passed.\n\n'
                                f'Your bid reference: {pq.bidder.submission_id}\n\n'
                                f'Please contact the procurement office for further details.\n\n'
                                f'Regards,\nZAMMSA Procurement Team'
                            ),
                            notification_type='rejection',
                            priority='high',
                            source_module='evaluations',
                            object_id=str(pq.pk),
                            action_url=f'/vendor/dashboard',
                            metadata={
                                'alert_key': 'post_qualification_failed',
                                'solicitation_id': str(pq.bidder.solicitation_id),
                                'sol_number': pq.bidder.solicitation.sol_number,
                                'submission_id': pq.bidder.submission_id,
                            },
                            email_required=True,
                        )
                except Exception:
                    pass
        except Exception as e:
            import logging
            logging.getLogger('evaluations').warning(f'Failed to process PQ chair decision failure: {e}')

    return Response({
        'message': f'Chair decision recorded: {decision.upper()}. Result: {pq.result}',
        'pq': PostQualificationSerializer(pq).data,
    })


def ber_pdf_view(request, pk):
    from rest_framework_simplejwt.authentication import JWTAuthentication
    from rest_framework.exceptions import AuthenticationFailed

    try:
        jwt_auth = JWTAuthentication()
        user, _ = jwt_auth.authenticate(request)
        if user is None:
            return HttpResponse('Unauthorized', status=401)
    except (AuthenticationFailed, AttributeError, TypeError):
        return HttpResponse('Unauthorized', status=401)

    try:
        ber = BidEvaluationReport.objects.get(pk=pk)
    except BidEvaluationReport.DoesNotExist:
        return HttpResponse('BER not found', status=404)

    content = ber.report_content
    context = {
        'ber': content,
        'tech_data': content.get('technical_evaluation', []),
        'signatures': ber.signatures or [],
        'ber_status': ber.status,
        'ber_id': str(ber.ber_id),
        'created_at': ber.created_at.isoformat() if ber.created_at else '',
    }

    committees = content.get('evaluation_committees', [])
    for c in committees:
        chair_id = ''
        sec_id = ''
        for m in c.get('member_ids', []):
            uid = m.get('id') if isinstance(m, dict) else m
            u = User.objects.filter(id=uid).first()
            name = u.full_name if u else str(uid)[:8]
            if name == c.get('chairperson_name'):
                chair_id = uid
            elif name == c.get('secretary_name'):
                sec_id = uid
        members = []
        for m in c.get('member_ids', []):
            uid = m.get('id') if isinstance(m, dict) else m
            if uid in (chair_id, sec_id):
                continue
            u = User.objects.filter(id=uid).first()
            members.append({'id': uid, 'name': u.full_name if u else str(uid)[:8]})
        c['member_ids'] = members
    context['committees'] = committees

    winner = content.get('winner')
    if winner and winner.get('submission_id'):
        from bids.models import BidSubmission
        wb = BidSubmission.objects.filter(submission_id=winner['submission_id']).first()
        if wb:
            tech_data = context.get('tech_data', [])
            for td in tech_data:
                if td.get('submission_id') == winner['submission_id']:
                    winner['evaluated_price'] = td.get('evaluated_price')
                    winner['combined_total_score'] = td.get('combined_total_score')
                    break
    context['winner'] = winner

    fmt = request.GET.get('format', 'pdf')
    html = render_to_string('evaluations/ber_pdf.html', context)

    if fmt == 'html':
        return HttpResponse(html, content_type='text/html; charset=utf-8')

    try:
        options = {
            'page-size': 'A4',
            'margin-top': '15mm',
            'margin-right': '12mm',
            'margin-bottom': '20mm',
            'margin-left': '12mm',
            'encoding': 'UTF-8',
            'no-outline': None,
            'enable-local-file-access': None,
        }
        pdf = pdfkit.from_string(html, False, options=options)
        sol_number = content.get("solicitation", {}).get("sol_number", str(ber.ber_id))
        response = HttpResponse(pdf, content_type='application/pdf')
        response['Content-Disposition'] = f'attachment; filename="BER-{sol_number}.pdf"'
        return response
    except Exception:
        return HttpResponse(html, content_type='text/html; charset=utf-8')


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def evaluation_phase_status_view(request, solicitation_pk):
    from .models import PreliminaryExam, TechnicalScore, FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification, EvaluationCommittee, ConflictOfInterest
    from bids.models import BidSubmission

    from django.db.models import Count, Q

    committees = EvaluationCommittee.objects.filter(solicitation=solicitation_pk)

    # Collect all member IDs and recused IDs in a single pass
    all_member_ids = set()
    all_member_info = {}
    for c in committees:
        if c.chairperson_id:
            pid = str(c.chairperson_id)
            all_member_ids.add(pid)
            all_member_info[pid] = {'role': 'chairperson'}
        if c.secretary_id:
            sid = str(c.secretary_id)
            all_member_ids.add(sid)
            all_member_info[sid] = {'role': 'secretary'}
        for m in (c.members or []):
            uid = m.get('user') if isinstance(m, dict) else m
            if uid:
                uid_str = str(uid)
                all_member_ids.add(uid_str)
                all_member_info[uid_str] = {'role': 'member'}
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if uid:
                uid_str = str(uid)
                all_member_ids.add(uid_str)
                all_member_info[uid_str] = {'role': 'external_member', 'name': f"{nom.get('first_name', '')} {nom.get('last_name', '')}".strip()}

    # Single query for COI declarations and recused members
    coi_qs = ConflictOfInterest.objects.filter(committee__solicitation=solicitation_pk)
    coi_declared_count = coi_qs.values('member').distinct().count()
    coi_complete = coi_declared_count >= len(all_member_ids) and len(all_member_ids) > 0

    recused_ids = set(str(uid) for uid in coi_qs.filter(recused=True).values_list('member_id', flat=True))

    # Required member IDs (non-recused) for preliminary
    required_member_ids = all_member_ids - recused_ids

    # Bids count
    total_bids = BidSubmission.objects.filter(solicitation=solicitation_pk).count()

    # Preliminary exam
    prelim_exam_qs = PreliminaryExam.objects.filter(bid__solicitation=solicitation_pk)
    prelim_done_bids = prelim_exam_qs.values('bid').distinct().count()

    member_exam_counts = (
        prelim_exam_qs.filter(evaluated_by__isnull=False)
        .values('evaluated_by')
        .annotate(bid_count=Count('bid', distinct=True))
    )
    member_bid_map = {str(e['evaluated_by']): e['bid_count'] for e in member_exam_counts}

    member_progress = []
    for mid in required_member_ids:
        bids_examined = member_bid_map.get(mid, 0)
        member_progress.append({
            'member_id': mid,
            'role': all_member_info.get(mid, {}).get('role', 'member'),
            'name': all_member_info.get(mid, {}).get('name', ''),
            'bids_examined': bids_examined,
            'total_bids': total_bids,
            'complete': bids_examined >= total_bids,
        })

    prelim_complete = total_bids > 0 and all(m['complete'] for m in member_progress)

    # Technical scoring
    tech_scores = TechnicalScore.objects.filter(bid__solicitation=solicitation_pk)
    tech_unique_pairs = tech_scores.values('bid', 'evaluator').distinct().count()
    tech_bids_scored = tech_scores.values('bid').distinct().count()
    tech_evaluators = tech_scores.values('evaluator').distinct().count()
    tech_evaluator_ids = all_member_ids - recused_ids
    tech_total_members = len(tech_evaluator_ids)
    tech_expected_pairs = total_bids * tech_total_members if tech_total_members > 0 else 0
    tech_complete = tech_unique_pairs >= tech_expected_pairs and tech_expected_pairs > 0

    # Financial evaluation — single query with winner check
    financial_done = FinancialEvaluation.objects.filter(bid__solicitation=solicitation_pk).values('bid').distinct().count()
    winner_bid = BidSubmission.objects.filter(solicitation=solicitation_pk, status='awarded').first()
    financial_complete = financial_done >= total_bids and total_bids > 0 and winner_bid is not None

    # Consolidation
    consolidated_bids = CombinedScore.objects.filter(bid__solicitation=solicitation_pk).values('bid').distinct().count()
    consolidation_complete = consolidated_bids >= total_bids and total_bids > 0

    # BER
    ber_qs = BidEvaluationReport.objects.filter(solicitation=solicitation_pk)
    ber_complete = ber_qs.filter(status__in=['submitted', 'approved']).exists()

    # Post-qualification
    post_qual = PostQualification.objects.filter(bidder__solicitation=solicitation_pk)
    target_pq = None
    if winner_bid:
        target_pq = post_qual.filter(bidder=winner_bid).first()
    if not target_pq:
        target_pq = post_qual.order_by('rank').first()

    if target_pq:
        items = target_pq.verification_items or []
        all_items_cleared = len(items) > 0 and all(item.get('status') == 'cleared' for item in items)
        post_qual_complete = (
            target_pq.status == 'cleared' or
            target_pq.chair_decision == 'passed' or
            all_items_cleared
        )
        if (all_items_cleared or target_pq.chair_decision == 'passed') and target_pq.status != 'cleared':
            target_pq.status = 'cleared'
            target_pq.verified_at = timezone.now()
            target_pq.save(update_fields=['status', 'verified_at'])
    else:
        post_qual_complete = post_qual.filter(Q(status='cleared') | Q(chair_decision='passed')).exists()

    pq_counts = post_qual.aggregate(
        total=Count('pq_id'),
        cleared=Count('pq_id', filter=Q(status='cleared')),
        in_progress=Count('pq_id', filter=Q(status='in_progress')),
        pending=Count('pq_id', filter=Q(status='pending')),
    )

    return Response({
        'solicitation': str(solicitation_pk),
        'total_bids': total_bids,
        'phases': {
            'coi': {
                'complete': coi_complete,
                'declared_count': coi_declared_count,
                'total_members': len(all_member_ids),
            },
            'preliminary': {
                'complete': prelim_complete,
                'examined_bids': prelim_done_bids,
                'total_bids': total_bids,
                'member_progress': member_progress,
            },
            'technical': {
                'complete': tech_complete,
                'evaluators_scored': tech_evaluators,
                'bids_scored': tech_bids_scored,
                'unique_pairs': tech_unique_pairs,
                'expected_pairs': tech_expected_pairs,
                'total_members': tech_total_members,
                'total_bids': total_bids,
            },
            'consolidation': {
                'complete': consolidation_complete,
                'consolidated_count': consolidated_bids,
                'consolidated_bids': consolidated_bids,
                'total_bids': total_bids,
            },
            'financial': {
                'complete': financial_complete,
                'evaluations_done': financial_done,
                'total_bids': total_bids,
            },
            'post_qual': {
                'complete': post_qual_complete,
                'total': pq_counts['total'],
                'cleared': pq_counts['cleared'],
                'in_progress': pq_counts['in_progress'],
                'pending': pq_counts['pending'],
            },
            'ber': {
                'complete': ber_complete,
                **ber_qs.aggregate(
                    reports_count=Count('ber_id'),
                    submitted_count=Count('ber_id', filter=Q(status='submitted')),
                    approved_count=Count('ber_id', filter=Q(status='approved')),
                ),
            },
            'appeal': {
                'active_appeals': AwardAppeal.objects.filter(
                    solicitation=solicitation_pk,
                    status__in=['filed', 'under_review']
                ).count(),
                'has_active_appeal': AwardAppeal.objects.filter(
                    solicitation=solicitation_pk,
                    status__in=['filed', 'under_review']
                ).exists(),
            },
        },
    })


AWARD_APPEAL_STATUSES = ['filed', 'under_review', 'upheld', 'dismissed', 'withdrawn']


def _log_appeal_action(appeal, action, user=None, details='', metadata=None):
    """Log an action taken on an appeal for audit trail purposes."""
    AppealActionLog.objects.create(
        appeal=appeal,
        action=action,
        performed_by=user,
        details=details,
        metadata=metadata or {},
    )


class AwardAppealListView(generics.ListCreateAPIView):
    serializer_class = AwardAppealSerializer
    permission_classes = [IsAuthenticated]
    pagination_class = PageNumberPagination
    page_size = 25
    filter_backends = [DjangoFilterBackend, filters.SearchFilter, filters.OrderingFilter]
    filterset_fields = ['status', 'solicitation']
    search_fields = ['bidder__submission_id', 'solicitation__sol_number', 'grounds_detail']
    ordering_fields = ['filed_at', 'status']
    ordering = ['-filed_at']

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', '')
        qs = AwardAppeal.objects.select_related(
            'solicitation', 'bidder', 'bidder__supplier', 'filed_by', 'resolved_by'
        )
        if role == 'supplier_user':
            qs = qs.filter(bidder__supplier=user)
        solicitation = self.request.query_params.get('solicitation')
        if solicitation:
            qs = qs.filter(solicitation_id=solicitation)
        return qs

    def create(self, request, *args, **kwargs):
        user = request.user
        role = getattr(user, 'role', '')
        if role != 'supplier_user':
            return Response({'error': 'Only supplier users can file appeals'}, status=403)

        solicitation_id = request.data.get('solicitation')
        bidder_id = request.data.get('bidder')
        grounds = request.data.get('grounds')
        grounds_detail = request.data.get('grounds_detail', '')
        supporting_documents = request.data.get('supporting_documents', [])

        if not solicitation_id or not bidder_id or not grounds:
            return Response({'error': 'solicitation, bidder, and grounds are required'}, status=400)

        from solicitations.models import Solicitation
        from bids.models import BidSubmission

        try:
            sol = Solicitation.objects.get(pk=solicitation_id)
        except Solicitation.DoesNotExist:
            return Response({'error': 'Solicitation not found'}, status=404)

        try:
            bid = BidSubmission.objects.get(pk=bidder_id, solicitation=sol)
        except BidSubmission.DoesNotExist:
            return Response({'error': 'Bid not found for this solicitation'}, status=404)

        if bid.supplier != user:
            return Response({'error': 'You can only file appeals for your own bids'}, status=403)

        if sol.status != 'awarded':
            return Response({'error': 'Appeals can only be filed after the solicitation is awarded'}, status=400)

        if AwardAppeal.objects.filter(
            solicitation=sol, bidder=bid, status__in=['filed', 'under_review']
        ).exists():
            return Response({'error': 'An active appeal already exists for this bid'}, status=400)

        from datetime import timedelta
        deadline = timezone.now() + timedelta(days=14)

        appeal = AwardAppeal.objects.create(
            solicitation=sol,
            bidder=bid,
            filed_by=user,
            grounds=grounds,
            grounds_detail=grounds_detail,
            supporting_documents=supporting_documents or [],
            resolution_deadline=deadline,
        )

        # Log the appeal filing action
        _log_appeal_action(
            appeal, 'filed', user,
            details=f'Appeal filed for bid {bid.submission_id} under {sol.sol_number}. Grounds: {dict(AwardAppeal._meta.get_field("grounds").choices).get(grounds, grounds)}.',
            metadata={'grounds': grounds, 'solicitation_id': str(sol.solicitation_id), 'bid_id': str(bid.bid_id)}
        )

        contract = sol.contracts.first()
        if contract:
            contract.appeal_pending = True
            contract.save()

        # Send formal acknowledgement to the appellant
        try:
            notify_users(
                [user],
                f'Appeal Acknowledged — {sol.sol_number}',
                (
                    f'Dear {user.full_name},\n\n'
                    f'This is to acknowledge receipt of your award appeal filed on '
                    f'{timezone.now().strftime("%d %B %Y")}.\n\n'
                    f'Appeal Details:\n'
                    f'- Solicitation: {sol.sol_number} — {sol.title}\n'
                    f'- Bid Reference: {bid.submission_id}\n'
                    f'- Grounds: {dict(AwardAppeal._meta.get_field("grounds").choices).get(grounds, grounds)}\n'
                    f'- Resolution Deadline: {deadline.strftime("%d %B %Y")}\n\n'
                    f'Your appeal will be reviewed by the Procurement Officer within 2 business days. '
                    f'The procurement team may request additional clarification or schedule a hearing.\n\n'
                    f'You will be notified of all updates regarding your appeal. '
                    f'You may withdraw your appeal at any time before a decision is made.\n\n'
                    f'If you have additional evidence to submit, please upload it through the '
    f'Award Appeals section in the Vendor Portal.\n\n'
                    f'Regards,\nZAMMSA Procurement Team'
                ),
                notification_type='info',
                priority='high',
                source_module='evaluations',
                object_id=appeal.pk,
                action_url='/vendor/appeals',
                metadata={
                    'alert_key': 'appeal_acknowledgement',
                    'appeal_id': str(appeal.appeal_id),
                    'solicitation_id': str(sol.solicitation_id),
                    'sol_number': sol.sol_number,
                    'deadline': deadline.isoformat(),
                },
                email_required=True,
            )
        except Exception:
            pass

        # Notify procurement officers and managers about the new appeal
        from accounts.models import User
        proc_officers = User.objects.filter(
            role__in=['procurement_officer', 'procurement_manager', 'director_procurement'],
            is_active=True
        )
        ground_label = dict(AwardAppeal._meta.get_field('grounds').choices).get(grounds, grounds)
        notify_users(
            list(proc_officers),
            f'New Award Appeal Filed — {sol.sol_number}',
            f'{user.full_name} (Bid: {bid.submission_id}) filed an appeal for {sol.sol_number}.\n'
            f'Grounds: {ground_label}.\n'
            f'Resolution deadline: {deadline.strftime("%d %B %Y")}.\n'
            f'Action required: Review and take under review within 2 business days.',
            priority='high',
        )

        return Response(AwardAppealSerializer(appeal).data, status=201)


class AwardAppealDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AwardAppealDetailSerializer
    permission_classes = [IsAuthenticated]
    queryset = AwardAppeal.objects.select_related(
        'solicitation', 'bidder', 'bidder__supplier', 'filed_by', 'resolved_by'
    ).prefetch_related('action_logs')
    lookup_url_kwarg = 'appeal_pk'

    def get_queryset(self):
        user = self.request.user
        role = getattr(user, 'role', '')
        qs = super().get_queryset()
        if role == 'supplier_user':
            qs = qs.filter(bidder__supplier=user)
        return qs

    def partial_update(self, request, *args, **kwargs):
        user = request.user
        role = getattr(user, 'role', '')
        appeal = self.get_object()

        # ── Supplier: withdraw or respond to clarification ───────────────────
        if role == 'supplier_user':
            if request.data.get('status') == 'withdrawn' and appeal.status in ('filed', 'under_review'):
                old_status = appeal.status
                appeal.status = 'withdrawn'
                appeal.save()
                _log_appeal_action(
                    appeal, 'withdrawn', user,
                    details=f'Appeal withdrawn by appellant.',
                    metadata={'old_status': old_status, 'new_status': 'withdrawn'}
                )
                contract = appeal.solicitation.contracts.first()
                if contract and not AwardAppeal.objects.filter(
                    solicitation=appeal.solicitation, status__in=['filed', 'under_review']
                ).exclude(pk=appeal.pk).exists():
                    contract.appeal_pending = False
                    contract.save()
                return Response(AwardAppealDetailSerializer(appeal).data)
            # Bidder responds to a clarification request
            if 'clarification_response' in request.data:
                if not appeal.clarification_requested:
                    return Response({'error': 'No clarification was requested for this appeal'}, status=400)
                appeal.clarification_response = request.data['clarification_response'].strip()
                appeal.save()
                _log_appeal_action(
                    appeal, 'clarification_received', user,
                    details=f'Clarification response submitted: {appeal.clarification_response[:500]}',
                )
                # Notify officers that a response was received
                try:
                    from accounts.models import User as UserModel
                    officers = UserModel.objects.filter(
                        role__in=['procurement_officer', 'procurement_manager', 'director_procurement'], is_active=True
                    )
                    notify_users(
                        list(officers),
                        f'Clarification Response Received — {appeal.solicitation.sol_number}',
                        f'{user.full_name} responded to the clarification request for appeal '
                        f'(Bid: {appeal.bidder.submission_id}, {appeal.solicitation.sol_number}).\n'
                        f'Response: {appeal.clarification_response[:200]}',
                        priority='normal',
                    )
                except Exception:
                    pass
                return Response(AwardAppealDetailSerializer(appeal).data)
            return Response({'error': 'Suppliers can only withdraw their own appeals or respond to clarification requests'}, status=403)

        # ── Internal staff actions ───────────────────────────────────────────
        OFFICER_ROLES = ('procurement_officer',)
        RESOLVER_ROLES = ('procurement_manager', 'director_procurement', 'zpc_member')
        ALL_INTERNAL = OFFICER_ROLES + RESOLVER_ROLES

        if role not in ALL_INTERNAL:
            return Response({'error': 'Permission denied'}, status=403)

        new_status = request.data.get('status')
        action = request.data.get('action')  # custom action field

        # ── Action: Add internal review notes ────────────────────────────────
        if action == 'add_review_notes':
            notes = request.data.get('review_notes', '').strip()
            if not notes:
                return Response({'error': 'review_notes is required'}, status=400)
            appeal.review_notes = notes
            appeal.save()
            _log_appeal_action(
                appeal, 'review_notes_added', user,
                details=f'Review notes updated.',
            )
            return Response(AwardAppealDetailSerializer(appeal).data)

        # ── Action: Schedule hearing date ────────────────────────────────────
        if action == 'set_hearing_date':
            hearing_date_str = request.data.get('hearing_date')
            if not hearing_date_str:
                return Response({'error': 'hearing_date is required'}, status=400)
            from django.utils.dateparse import parse_datetime
            parsed = parse_datetime(hearing_date_str)
            if not parsed:
                return Response({'error': 'Invalid date format. Use ISO 8601 (e.g. 2026-07-30T10:00:00)'}, status=400)
            appeal.hearing_date = parsed
            appeal.save()
            _log_appeal_action(
                appeal, 'hearing_scheduled', user,
                details=f'Hearing scheduled for {parsed.strftime("%d %B %Y at %H:%M")}.',
                metadata={'hearing_date': parsed.isoformat()}
            )
            # Notify the bidder of the scheduled hearing
            try:
                notify_users(
                    [appeal.filed_by],
                    f'Hearing Scheduled — {appeal.solicitation.sol_number}',
                    f'A hearing for your appeal (Bid: {appeal.bidder.submission_id}) has been scheduled for '
                    f'{parsed.strftime("%d %B %Y at %H:%M")}.\n'
                    f'Please be available to present your case.',
                    priority='normal',
                )
            except Exception:
                pass
            return Response(AwardAppealDetailSerializer(appeal).data)

        # ── Action: Request clarification from bidder ────────────────────────
        if action == 'request_clarification':
            question = request.data.get('clarification_request', '').strip()
            if not question:
                return Response({'error': 'clarification_request text is required'}, status=400)
            appeal.clarification_requested = True
            appeal.clarification_request = question
            appeal.clarification_response = ''  # reset previous response
            appeal.save()
            _log_appeal_action(
                appeal, 'clarification_requested', user,
                details=f'Clarification requested: {question[:500]}',
            )
            try:
                notify_users(
                    [appeal.filed_by],
                    f'Clarification Requested — {appeal.solicitation.sol_number}',
                    f'The procurement team requires additional information regarding your appeal '
                    f'(Bid: {appeal.bidder.submission_id}).\n\nQuestion: {question}\n\n'
                    f'Please log in and respond to this request via the Award Appeals section.',
                    priority='high',
                )
            except Exception:
                pass
            return Response(AwardAppealDetailSerializer(appeal).data)

        # ── Status transition: filed → under_review ──────────────────────────
        if new_status == 'under_review':
            if appeal.status != 'filed':
                return Response({'error': 'Only a filed appeal can be taken under review'}, status=400)
            appeal.status = 'under_review'
            appeal.save()
            _log_appeal_action(
                appeal, 'under_review', user,
                details=f'Appeal taken under review by {user.full_name}.',
                metadata={'old_status': 'filed', 'new_status': 'under_review'}
            )
            try:
                notify_users(
                    [appeal.filed_by],
                    f'Appeal Under Review — {appeal.solicitation.sol_number}',
                    f'Your appeal for bid {appeal.bidder.submission_id} is now under review by the procurement team.\n'
                    f'Resolution deadline: {appeal.resolution_deadline.strftime("%d %B %Y") if appeal.resolution_deadline else "TBD"}.',
                    priority='normal',
                )
            except Exception:
                pass
            return Response(AwardAppealDetailSerializer(appeal).data)

        # ── Status transition: under_review → upheld | dismissed ─────────────
        if new_status in ('upheld', 'dismissed'):
            if role not in RESOLVER_ROLES:
                return Response(
                    {'error': 'Only Procurement Managers or Directors can uphold or dismiss appeals'},
                    status=403
                )
            if appeal.status != 'under_review':
                return Response(
                    {'error': 'An appeal must be under review before it can be upheld or dismissed. Take it under review first.'},
                    status=400
                )
            resolution = request.data.get('resolution', '').strip()
            if not resolution:
                return Response({'error': 'A resolution note is required when upholding or dismissing an appeal'}, status=400)

            appeal.status = new_status
            appeal.resolution = resolution
            appeal.resolved_by = user
            appeal.resolved_at = timezone.now()
            # Store decision letter PDF if uploaded
            decision_file = request.FILES.get('decision_letter')
            if decision_file:
                appeal.decision_letter = decision_file
            appeal.save()

            _log_appeal_action(
                appeal, new_status, user,
                details=f'Appeal {new_status} by {user.full_name}. Resolution: {resolution[:500]}',
                metadata={
                    'old_status': 'under_review',
                    'new_status': new_status,
                    'decision_letter': str(appeal.decision_letter) if appeal.decision_letter else '',
                    'reopen_evaluation': request.data.get('reopen_evaluation', False),
                    'cancel_procurement': request.data.get('cancel_procurement', False),
                }
            )

            sol = appeal.solicitation
            contract = sol.contracts.first()

            # Gather evaluation committee members for notifications
            from evaluations.models import EvaluationCommittee
            committees = EvaluationCommittee.objects.filter(solicitation=sol).select_related('chairperson', 'secretary')
            ec_member_users = []
            ec_member_ids = set()
            ec_non_official_emails = []
            for c in committees:
                if c.chairperson and str(c.chairperson_id) not in ec_member_ids:
                    ec_member_users.append(c.chairperson)
                    ec_member_ids.add(str(c.chairperson_id))
                if c.secretary and str(c.secretary_id) not in ec_member_ids:
                    ec_member_users.append(c.secretary)
                    ec_member_ids.add(str(c.secretary_id))
                for m in c.members or []:
                    uid = m.get('user') if isinstance(m, dict) else m
                    if uid and str(uid) not in ec_member_ids:
                        try:
                            u = User.objects.get(pk=uid)
                            ec_member_users.append(u)
                            ec_member_ids.add(str(uid))
                        except User.DoesNotExist:
                            pass
                for nm in c.non_official_members or []:
                    email = nm.get('email', '')
                    if email:
                        ec_non_official_emails.append({'email': email, 'name': f"{nm.get('first_name', '')} {nm.get('last_name', '')}".strip()})

            if new_status == 'dismissed':
                if contract and not AwardAppeal.objects.filter(
                    solicitation=appeal.solicitation, status__in=['filed', 'under_review']
                ).exclude(pk=appeal.pk).exists():
                    contract.appeal_pending = False
                    contract.save()
            elif new_status == 'upheld':
                # Keep appeal_pending = True; contract stays blocked
                if contract:
                    contract.appeal_pending = True
                    contract.save()
                # Re-open evaluation: reset solicitation back to evaluation phase
                if request.data.get('reopen_evaluation', False):
                    sol.status = 'evaluation'
                    sol.save()
                    # Cancel existing contract if any
                    if contract:
                        contract.status = 'cancelled'
                        contract.save()

                    # Reset all evaluation data for a fresh re-evaluation
                    from evaluations.models import (
                        PreliminaryExam, TechnicalScore, FinancialEvaluation,
                        CombinedScore, BidEvaluationReport, PostQualification,
                        ConflictOfInterest,
                    )
                    from bids.models import BidSubmission

                    # Clear COI declarations so members re-declare
                    ConflictOfInterest.objects.filter(
                        committee__solicitation=sol
                    ).delete()

                    # Clear preliminary examination results
                    PreliminaryExam.objects.filter(
                        bid__solicitation=sol
                    ).delete()

                    # Clear all technical scores
                    TechnicalScore.objects.filter(
                        bid__solicitation=sol
                    ).delete()

                    # Clear all financial evaluations
                    FinancialEvaluation.objects.filter(
                        bid__solicitation=sol
                    ).delete()

                    # Clear all combined/consolidated scores
                    CombinedScore.objects.filter(
                        bid__solicitation=sol
                    ).delete()

                    # Reset BER reports to draft or clear them
                    BidEvaluationReport.objects.filter(
                        solicitation=sol
                    ).update(status='draft', signatures=[], submitted_at=None, approved_at=None, approved_by=None)

                    # Clear post-qualification records
                    PostQualification.objects.filter(
                        bidder__solicitation=sol
                    ).delete()

                    # Reset bid statuses: awarded/non_responsive/unsuccessful → opened
                    BidSubmission.objects.filter(
                        solicitation=sol, status__in=['awarded', 'non_responsive', 'unsuccessful']
                    ).update(status='opened')

                    # Re-seal financial envelopes so authorization flow restarts
                    from bids.models import BidOpeningDetail
                    BidOpeningDetail.objects.filter(
                        bid__solicitation=sol
                    ).update(financial_sealed=True, price_read=None)

                    # Reactivate temporary accounts for non-official committee members
                    # so they can participate in the re-evaluation
                    temp_user_ids = []
                    committees = EvaluationCommittee.objects.filter(solicitation=sol)
                    for c in committees:
                        for nom in (c.non_official_members or []):
                            uid = nom.get('user_id')
                            if uid:
                                temp_user_ids.append(uid)
                    if temp_user_ids:
                        User.objects.filter(id__in=temp_user_ids).update(is_active=True)

                    # Log the full reset
                    _log_appeal_action(
                        appeal, 're_evaluation_initiated', user,
                        details=(
                            'Evaluation fully reset for re-evaluation. Cleared: COI declarations, '
                            'preliminary exams, technical scores, financial evaluations, '
                            'combined scores, BER signatures, post-qualification records. '
                            'Bid statuses reset from awarded to opened.'
                        ),
                        metadata={
                            'sol_number': sol.sol_number,
                            'action': 'reopen_evaluation',
                        }
                    )
                    # Notify all EC members + chair + secretary
                    sol_context = (
                        f'The solicitation {sol.sol_number} has been re-opened for re-evaluation following '
                        f'an upheld award appeal by {user.full_name}.\n\n'
                        f'All previous evaluation data has been cleared:\n'
                        f'- COI declarations reset (please re-declare)\n'
                        f'- Preliminary examination cleared\n'
                        f'- Technical scores cleared\n'
                        f'- Financial evaluations cleared\n'
                        f'- Combined scores cleared\n'
                        f'- BER signatures reset\n'
                        f'- Post-qualification records cleared\n'
                        f'- Bid statuses reset\n\n'
                        f'Please restart the evaluation process from the beginning.\n'
                        f'Grounds of upheld appeal: {appeal.get_grounds_display()}.\n'
                        f'Resolution: {resolution}'
                    )
                    sol_title = f'Re-Evaluation Required — {sol.sol_number}'
                    try:
                        notify_users(
                            ec_member_users,
                            sol_title,
                            sol_context,
                            priority='high',
                            email_required=True,
                        )
                    except Exception:
                        pass
                    for nm_info in ec_non_official_emails:
                        try:
                            send_external_email(sol_title, sol_context, nm_info['email'])
                        except Exception:
                            pass
                # Cancel procurement: cancel solicitation and its contract
                elif request.data.get('cancel_procurement', False):
                    sol = appeal.solicitation
                    sol.status = 'cancelled'
                    sol.save()
                    if contract:
                        contract.status = 'cancelled'
                        contract.save()
                    # Notify all bidders that the procurement has been cancelled
                    cancel_title = f'Procurement Cancelled — {sol.sol_number}'
                    cancel_msg = (
                        f'The solicitation {sol.sol_number} ({sol.title}) has been cancelled following '
                        f'an upheld award appeal.\n'
                        f'Resolution: {resolution}'
                    )
                    try:
                        from bids.models import BidSubmission
                        bids = BidSubmission.objects.filter(solicitation=sol).select_related('supplier')
                        bidder_users = [b.supplier for b in bids if b.supplier]
                        if bidder_users:
                            notify_users(
                                bidder_users,
                                cancel_title,
                                cancel_msg,
                                priority='high',
                                email_required=True,
                            )
                    except Exception:
                        pass
                    # Notify EC members and procurement officers
                    try:
                        officers = User.objects.filter(
                            role__in=['procurement_officer', 'procurement_manager', 'director_procurement'],
                            is_active=True,
                        )
                        internal_notifiers = list(ec_member_users) + list(officers)
                        notify_users(
                            internal_notifiers,
                            cancel_title,
                            cancel_msg,
                            priority='high',
                            email_required=True,
                        )
                        for nm_info in ec_non_official_emails:
                            send_external_email(cancel_title, cancel_msg, nm_info['email'])
                    except Exception:
                        pass

            # Notify all EC members + procurement officers of the decision
            decision_title = f'Appeal {new_status.title()} — {appeal.solicitation.sol_number}'
            decision_msg = (
                f'The award appeal for {appeal.bidder.submission_id} under {appeal.solicitation.sol_number} '
                f'has been {new_status} by {user.full_name}.\n'
                f'Grounds: {appeal.get_grounds_display()}\n'
                f'Resolution: {resolution}'
            )
            try:
                officers = User.objects.filter(
                    role__in=['procurement_officer', 'procurement_manager', 'director_procurement'],
                    is_active=True,
                )
                all_notifiers = list(set(ec_member_users + list(officers)))
                notify_users(
                    all_notifiers,
                    decision_title,
                    decision_msg,
                    priority='high',
                    email_required=True,
                )
                for nm_info in ec_non_official_emails:
                    send_external_email(decision_title, decision_msg, nm_info['email'])
            except Exception:
                pass

            # Notify the appellant of the decision
            appellant_title = f'Appeal {new_status.title()} — {appeal.solicitation.sol_number}'
            appellant_msg = (
                f'Your appeal for bid {appeal.bidder.submission_id} under {appeal.solicitation.sol_number} '
                f'has been {new_status}.\n'
                f'Resolution: {resolution}'
            )
            try:
                notify_users(
                    [appeal.filed_by],
                    appellant_title,
                    appellant_msg,
                    priority='high',
                    email_required=True,
                )
            except Exception:
                pass

            # Notify other unsuccessful bidders (non-appellants) of the outcome
            try:
                other_unsuccessful = BidSubmission.objects.filter(
                    solicitation=appeal.solicitation,
                    status='unsuccessful',
                ).exclude(
                    pk=appeal.bidder_id,
                ).select_related('supplier')
                other_bidder_users = [b.supplier for b in other_unsuccessful if b.supplier]
                if other_bidder_users:
                    other_title = f'Award Appeal Outcome — {appeal.solicitation.sol_number}'
                    other_msg = (
                        f'An award appeal filed against solicitation {appeal.solicitation.sol_number} '
                        f'({appeal.solicitation.title}) has been {new_status}.\n\n'
                        f'Grounds: {appeal.get_grounds_display()}\n'
                        f'Resolution: {resolution}\n\n'
                        f'Please contact ZAMMSA Procurement for further details.'
                    )
                    notify_users(
                        other_bidder_users,
                        other_title,
                        other_msg,
                        priority='medium',
                        email_required=True,
                    )
            except Exception:
                pass

            return Response(AwardAppealDetailSerializer(appeal).data)

        return Response({'error': f'Invalid action or status transition: {new_status or action}'}, status=400)


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def appeal_evidence_view(request, appeal_pk):
    """Return full evaluation evidence (technical scores, financial ranking, COI) for an appeal."""
    try:
        appeal = AwardAppeal.objects.select_related(
            'solicitation', 'bidder', 'bidder__supplier'
        ).get(pk=appeal_pk)
    except AwardAppeal.DoesNotExist:
        return Response({'error': 'Appeal not found'}, status=404)

    user = request.user
    role = getattr(user, 'role', '')
    INTERNAL_ROLES = ('procurement_officer', 'procurement_manager', 'director_procurement', 'zpc_member',
                      'evaluation_committee_chair', 'evaluation_committee_member')
    if role not in INTERNAL_ROLES:
        return Response({'error': 'Permission denied'}, status=403)

    sol = appeal.solicitation
    appellant_bid = appeal.bidder

    # ── Technical Scores for appellant's bid ──────────────────────────────
    tech_scores = TechnicalScore.objects.filter(bid=appellant_bid).select_related('criterion', 'evaluator')
    tech_data = []
    criteria_seen = {}
    for ts in tech_scores:
        cid = str(ts.criterion.criterion_id)
        if cid not in criteria_seen:
            criteria_seen[cid] = {
                'criterion_id': cid,
                'criterion_name': ts.criterion.criterion_name,
                'weight': float(ts.criterion.weight),
                'scores': [],
            }
        criteria_seen[cid]['scores'].append({
            'evaluator': ts.evaluator.full_name,
            'raw_score': float(ts.raw_score),
            'weighted_score': float(ts.weighted_score),
        })
    for cdata in criteria_seen.values():
        avg = sum(s['raw_score'] for s in cdata['scores']) / len(cdata['scores']) if cdata['scores'] else 0
        cdata['average_score'] = round(avg, 2)
        tech_data.append(cdata)

    # ── All bids' combined scores for ranking context ─────────────────────
    combined_scores = CombinedScore.objects.filter(
        bid__solicitation=sol
    ).select_related('bid', 'bid__supplier').order_by('rank')
    ranking = []
    for cs in combined_scores:
        ranking.append({
            'rank': cs.rank,
            'submission_id': cs.bid.submission_id,
            'bidder_name': cs.bid.supplier.full_name,
            'technical_score': float(cs.technical_score),
            'financial_score': float(cs.financial_score),
            'total_score': float(cs.total_score),
            'is_appellant': cs.bid.bid_id == appellant_bid.bid_id,
            'status': cs.bid.status,
        })

    # ── Financial evaluation for appellant ───────────────────────────────
    fin_eval = FinancialEvaluation.objects.filter(bid=appellant_bid).first()
    fin_data = None
    if fin_eval:
        fin_data = {
            'original_price': float(fin_eval.original_price or 0),
            'corrected_price': float(fin_eval.corrected_price or 0),
            'evaluated_price': float(fin_eval.evaluated_price or 0),
            'financial_score': float(fin_eval.financial_score or 0),
            'preference_category': fin_eval.preference_category or 'non_citizen',
            'preference_margin': float(fin_eval.preference_applied or 0),
            'arithmetic_corrections': fin_eval.arithmetic_corrections or [],
        }

    # ── Preliminary exam results for appellant ────────────────────────────
    prelim = PreliminaryExam.objects.filter(bid=appellant_bid)
    prelim_data = [
        {
            'criterion': p.criterion,
            'is_compliant': p.is_compliant,
            'comment': p.comment,
        }
        for p in prelim
    ]

    # ── COI declarations for the solicitation ────────────────────────────
    committees = EvaluationCommittee.objects.filter(solicitation=sol).prefetch_related('conflict_declarations')
    coi_data = []
    for c in committees:
        for decl in c.conflict_declarations.all():
            coi_data.append({
                'member': decl.member.full_name if decl.member else 'Unknown',
                'declaration_type': decl.declaration_type,
                'has_conflict': decl.has_conflict,
                'recused': decl.recused,
                'conflicted_bidders': decl.conflicted_bidders or [],
                'explanation': decl.explanation,
            })

    return Response({
        'appeal_id': str(appeal.appeal_id),
        'solicitation': {
            'id': str(sol.solicitation_id),
            'number': sol.sol_number,
            'title': sol.title,
            'status': sol.status,
        },
        'appellant': {
            'bid_id': str(appellant_bid.bid_id),
            'submission_id': appellant_bid.submission_id,
            'bidder_name': appellant_bid.supplier.full_name,
            'bid_amount': float(appellant_bid.bid_price or 0),
            'currency': appellant_bid.currency or 'ZMW',
            'status': appellant_bid.status,
        },
        'technical_scores': tech_data,
        'ranking': ranking,
        'financial_evaluation': fin_data,
        'preliminary_exam': prelim_data,
        'coi_declarations': coi_data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def appeal_action_logs_view(request, appeal_pk):
    """Return the full action history for an appeal."""
    try:
        appeal = AwardAppeal.objects.get(pk=appeal_pk)
    except AwardAppeal.DoesNotExist:
        return Response({'error': 'Appeal not found'}, status=404)

    user = request.user
    role = getattr(user, 'role', '')
    INTERNAL_ROLES = ('procurement_officer', 'procurement_manager', 'director_procurement', 'zpc_member')
    if role == 'supplier_user':
        if appeal.filed_by != user:
            return Response({'error': 'Permission denied'}, status=403)
    elif role not in INTERNAL_ROLES:
        return Response({'error': 'Permission denied'}, status=403)

    logs = AppealActionLog.objects.filter(appeal=appeal).select_related('performed_by')
    return Response({
        'appeal_id': str(appeal.appeal_id),
        'action_logs': AppealActionLogSerializer(logs, many=True).data,
    })
