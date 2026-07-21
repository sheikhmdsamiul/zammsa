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
from accounts.permissions import CanManageEvaluationCommittees
from accounts.models import User
from accounts.serializers import UserCreateSerializer
from system_config.notifications import notify_role, notify_users, send_external_email

from .crypto_sign import sign_ber_payload, verify_signature
from .models import EvaluationCommittee, ConflictOfInterest, PreliminaryExam, TechnicalScore, FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification, AwardAppeal
from .serializers import (
    EvaluationCommitteeSerializer, ConflictOfInterestSerializer, PreliminaryExamSerializer, TechnicalScoreSerializer,
    FinancialEvaluationSerializer, CombinedScoreSerializer, BidEvaluationReportSerializer,
    PostQualificationSerializer, AwardAppealSerializer,
)
from solicitations.models import Solicitation, EvaluationCriterion
from bids.models import BidSubmission, BidOpening, BidOpeningDetail


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


def _bid_failed_preliminary(bid):
    return PreliminaryExam.objects.filter(bid=bid, is_compliant=False).exists()


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

    class Meta:
        model = PostQualification
        fields = ['solicitation', 'status', 'bidder']

    def filter_solicitation(self, queryset, name, value):
        return queryset.filter(Q(ber__solicitation=value) | Q(bidder__solicitation=value))


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
    queryset = EvaluationCommittee.objects.all()
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
        return super().create(request, *args, **kwargs)

    def perform_create(self, serializer):
        exam = serializer.save()
        if not exam.is_compliant and exam.bid.status != 'non_responsive':
            exam.bid.status = 'non_responsive'
            exam.bid.save(update_fields=['status'])


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

    return Response({
        'message': 'Conflict of interest declared',
        'coi': ConflictOfInterestSerializer(coi).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def coi_committee_view(request, committee_pk):
    try:
        committee = EvaluationCommittee.objects.get(pk=committee_pk)
    except EvaluationCommittee.DoesNotExist:
        return Response({'error': 'Committee not found'}, status=404)

    declarations = ConflictOfInterest.objects.filter(committee=committee).select_related('member')
    return Response({
        'declarations': ConflictOfInterestSerializer(declarations, many=True).data,
        'recused_members': [str(d.member.id) for d in declarations if d.recused],
    })


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

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_procurement = request.user.role in ('director_procurement', 'procurement_manager', 'procurement_officer')
    if not is_chair and not is_procurement:
        return Response({'error': 'Only the committee chair or procurement staff can view passed bids'}, status=403)

    threshold = Decimal(str(request.query_params.get('threshold', sol.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT)))
    criteria = EvaluationCriterion.objects.filter(solicitation=sol, criterion_type='technical')
    total_tech_weight = criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')

    # Financial envelopes are only truly "opened" after chairperson authorization
    # (which creates CombinedScore records). Raw BidOpeningDetail.financial_sealed
    # may be False from the bid opening ceremony itself.
    financial_authorized = CombinedScore.objects.filter(bid__solicitation=sol).exists()

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'awarded'])
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
            'financial_sealed': not financial_authorized,
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
        return Response({'error': 'Solicitation not found'}, status=404)

    err = _require_bid_opening_completed(sol)
    if err:
        return err
    err = _require_coi_clearance(sol)
    if err:
        return err

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can calculate QCBS'}, status=403)

    financial_authorized = CombinedScore.objects.filter(bid__solicitation=sol).exists()

    criteria = EvaluationCriterion.objects.filter(solicitation=sol)

    eval_method = sol.evaluation_method or ('qcbs' if sol.method == 'rfp' else 'lowest_price')

    if eval_method == 'qcbs' and sol.financial_weight is not None:
        fin_weight = Decimal(str(sol.financial_weight))
        tech_weight = Decimal('100') - fin_weight
    elif eval_method == 'qbs':
        tech_weight = Decimal('100')
        fin_weight = Decimal('0')
    else:
        tech_weight = Decimal('80')
        fin_weight = Decimal('20')

    threshold = Decimal(str(sol.minimum_technical_threshold or TECHNICAL_THRESHOLD_DEFAULT))
    tech_criteria = criteria.filter(criterion_type='technical')
    total_tech_weight = tech_criteria.aggregate(s=Sum('weight'))['s'] or Decimal('100')

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'awarded'])
    results = []

    # Pre-compute evaluated prices for all tech-passing bids
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
        if opening_detail and opening_detail.financial_sealed and eval_method != 'qbs':
            continue
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
        else:
            fin_score = (min_evaluated_price / evaluated_price) * Decimal('100') if evaluated_price > 0 else Decimal('100')
            fin_eval = FinancialEvaluation.objects.create(
                bid=bid,
                original_price=bid.bid_price or 0,
                corrected_price=bid.bid_price or 0,
                evaluated_price=evaluated_price,
                financial_score=fin_score,
                preference_category='0',
            )

        avg_tech = overall_pct
        if eval_method in ('qcbs', 'qbs'):
            total_score = (avg_tech * tech_weight / Decimal('100')) + (Decimal(str(fin_score)) * fin_weight / Decimal('100'))

            CombinedScore.objects.update_or_create(
                bid=bid,
                defaults={
                    'technical_score': avg_tech,
                    'financial_score': fin_score,
                    'total_score': total_score,
                    'rank': 0,
                }
            )
        else:
            total_score = Decimal('0')
            
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
            'financial_score': float(fin_score),
            'total_score': float(total_score),
            'passed': True,
            'financial_evaluation_id': str(fin_eval.evaluation_id) if fin_eval else None,
            'evaluated_price': float(fin_eval.evaluated_price) if fin_eval else None,
            'financial_sealed': not financial_authorized,
            'ceec_category': ceec_category,
            'ceec_priority': ceec_priority,
            'details': details,
        })

    # BR-EVAL-04: Tie-breaking: higher tech score wins; if still tied, higher citizen ownership wins
    if eval_method in ('qcbs', 'qbs'):
        results.sort(key=lambda x: (x.get('total_score', 0), x.get('technical_score', 0), x.get('ceec_priority', 0)), reverse=True)
        for i, bid_data in enumerate(results):
            bid_data['rank'] = i + 1
            CombinedScore.objects.filter(bid_id=bid_data['bid_id']).update(rank=i + 1)
    else:
        results.sort(key=lambda x: x.get('evaluated_price', 0))
        for i, bid_data in enumerate(results):
            bid_data['rank'] = i + 1

    winner_name = None
    if sol.status == 'awarded':
        awarded_bid = BidSubmission.objects.filter(solicitation=sol, status='awarded').first()
        if awarded_bid and awarded_bid.supplier:
            winner_name = awarded_bid.supplier.full_name

    return Response({
        'message': 'QCBS calculation completed successfully',
        'solicitation_id': str(sol.solicitation_id),
        'threshold': float(threshold),
        'tech_weight': float(tech_weight),
        'fin_weight': float(fin_weight),
        'results': results,
        'winner_name': winner_name,
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

    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    is_chair = any(str(c.chairperson.id) == str(request.user.id) for c in committees)
    is_director = request.user.role == 'director_procurement'
    if not is_chair and not is_director:
        return Response({'error': 'Only the committee chair or Director of Procurement can authorize financial opening'}, status=403)

    # Verify all committee members have submitted technical scores for all bids
    criteria = EvaluationCriterion.objects.filter(solicitation=sol, criterion_type='technical')
    criteria_count = criteria.count()
    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive'])
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

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive'])
    opened_count = 0
    eligible_bids = []

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

    # Persist combined scores to mark consolidation phase complete
    eval_method = sol.evaluation_method or ('qcbs' if sol.method == 'rfp' else 'lowest_price')
    if eval_method == 'qcbs' and sol.financial_weight is not None:
        fin_weight_combined = Decimal(str(sol.financial_weight))
        tech_weight_combined = Decimal('100') - fin_weight_combined
    elif eval_method == 'qbs':
        tech_weight_combined = Decimal('100')
        fin_weight_combined = Decimal('0')
    else:
        tech_weight_combined = Decimal('80')
        fin_weight_combined = Decimal('20')

    evaluated_prices = {}
    for bid, _ in eligible_bids:
        fe = FinancialEvaluation.objects.filter(bid=bid).first()
        evaluated_prices[bid.bid_id] = fe.evaluated_price if fe else Decimal(str(bid.bid_price or 0))

    min_eval_price = min(evaluated_prices.values()) if evaluated_prices else Decimal('0')

    combined_records = []
    for bid, overall_pct in eligible_bids:
        fe = FinancialEvaluation.objects.filter(bid=bid).first()
        eval_price = evaluated_prices.get(bid.bid_id, Decimal('0'))

        if fe:
            fin_score = fe.financial_score
        else:
            fin_score = (min_eval_price / eval_price) * Decimal('100') if eval_price > 0 else Decimal('100')
            fe = FinancialEvaluation.objects.create(
                bid=bid,
                original_price=bid.bid_price or 0,
                corrected_price=bid.bid_price or 0,
                evaluated_price=eval_price,
                financial_score=fin_score,
                preference_category='0',
            )

        total_score = (overall_pct * tech_weight_combined / Decimal('100')) + (Decimal(str(fin_score)) * fin_weight_combined / Decimal('100'))
        cs, _ = CombinedScore.objects.update_or_create(
            bid=bid,
            defaults={
                'technical_score': overall_pct,
                'financial_score': fin_score,
                'total_score': total_score,
                'rank': 0,
            }
        )
        combined_records.append(cs)

    if combined_records:
        if eval_method in ('qcbs', 'qbs'):
            combined_records.sort(key=lambda x: x.total_score, reverse=True)
        for i, cr in enumerate(combined_records):
            cr.rank = i + 1
            cr.save(update_fields=['rank'])

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

    err = _require_bid_opening_completed(bid.solicitation)
    if err:
        return err
    err = _require_coi_clearance(bid.solicitation)
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

    currency_converted_price = None
    if conversion_rate and source_currency != 'ZMW':
        currency_converted_price = corrected_price * Decimal(str(conversion_rate))

    price_for_eval = currency_converted_price if currency_converted_price else corrected_price
    evaluated_price = price_for_eval * (Decimal('1') - preference_margin / Decimal('100'))

    min_price = FinancialEvaluation.objects.filter(bid__solicitation=bid.solicitation).order_by('evaluated_price').first()
    min_evaluated = min_price.evaluated_price if min_price else evaluated_price
    financial_score = (min_evaluated / evaluated_price) * Decimal('100') if evaluated_price > 0 else Decimal('100')


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

    winner.status = 'awarded'
    winner.save(update_fields=['status'])

    sol.status = 'awarded'
    sol.save(update_fields=['status'])

    other_bids = BidSubmission.objects.filter(solicitation=sol).exclude(pk=bid_id)
    other_bids.update(status='responsive')

    # Create Post-Qualification record for the winner
    if not PostQualification.objects.filter(bidder=winner).exists():
        PostQualification.objects.create(
            bidder=winner,
            status='pending',
            verification_items=[],
        )

    # Deactivate temp accounts for non-official committee members
    committees = EvaluationCommittee.objects.filter(solicitation=sol)
    temp_user_ids = []
    for c in committees:
        for nom in (c.non_official_members or []):
            uid = nom.get('user_id')
            if uid:
                temp_user_ids.append(uid)
    if temp_user_ids:
        User.objects.filter(id__in=temp_user_ids, role='evaluation_committee_member').update(is_active=False)

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
            member_list.append({'id': str(uid)})
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
    for c in committees:
        members.append({
            'id': str(c.chairperson.id),
            'full_name': c.chairperson.full_name,
            'role': 'chairperson',
            'signed': any(s['member_id'] == str(c.chairperson.id) for s in ber.signatures),
        })
        members.append({
            'id': str(c.secretary.id),
            'full_name': c.secretary.full_name,
            'role': 'secretary',
            'signed': any(s['member_id'] == str(c.secretary.id) for s in ber.signatures),
        })
        for m in c.members:
            uid = m.get('user') if isinstance(m, dict) else m
            members.append({
                'id': str(uid),
                'full_name': m.get('full_name', str(uid)[:8]) if isinstance(m, dict) else str(uid)[:8],
                'role': 'member',
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

    financial_authorized = CombinedScore.objects.filter(bid__solicitation=sol).exists()

    bids = BidSubmission.objects.filter(solicitation=sol, status__in=['submitted', 'opened', 'responsive', 'awarded'])
    
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
            'financial_sealed': not financial_authorized,
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
    queryset = PostQualification.objects.select_related('ber', 'bidder', 'assigned_to').all()
    serializer_class = PostQualificationSerializer
    filterset_class = PostQualificationFilter
    search_fields = ['bidder__submission_id', 'status', 'notes']
    ordering = ['-pq_id']

    def get_queryset(self):
        qs = super().get_queryset()
        solicitation = self.request.query_params.get('solicitation')
        if solicitation:
            qs = qs.filter(Q(ber__solicitation_id=solicitation) | Q(bidder__solicitation_id=solicitation))
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
            status='pending',
            verification_items=[],
        )
        return Response(PostQualificationSerializer(pq).data, status=201)


class PostQualificationDetailView(generics.RetrieveUpdateDestroyAPIView):
    queryset = PostQualification.objects.select_related('ber', 'bidder', 'assigned_to').all()
    serializer_class = PostQualificationSerializer
    permission_classes = [IsAuthenticated]


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pq_update_verification_item_view(request, pq_pk):
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    item_id = request.data.get('item_id')
    status = request.data.get('status')
    notes = request.data.get('notes', '')
    contact_result = request.data.get('contact_result', '')

    if not item_id:
        return Response({'error': 'item_id is required'}, status=400)

    items = list(pq.verification_items or [])
    updated = False
    for item in items:
        if item.get('id') == item_id:
            if status:
                item['status'] = status
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

    pq.verification_items = items
    pq.save()

    return Response({
        'message': 'Verification item updated',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['POST'])
@permission_classes([IsAuthenticated])
def pq_generate_checklist_view(request, pq_pk):
    try:
        pq = PostQualification.objects.get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    DEFAULT_CHECKLIST = [
        {'id': 'company-registration', 'label': 'Company Registration Certificate', 'category': 'legal', 'status': 'pending', 'notes': ''},
        {'id': 'tax-clearance', 'label': 'Tax Clearance Certificate', 'category': 'legal', 'status': 'pending', 'notes': ''},
        {'id': 'zppa-registration', 'label': 'ZPPA Registration Status', 'category': 'legal', 'status': 'pending', 'notes': ''},
        {'id': 'financial-statements', 'label': 'Audited Financial Statements (last 2 years)', 'category': 'financial', 'status': 'pending', 'notes': ''},
        {'id': 'bank-reference', 'label': 'Bank Reference Letter', 'category': 'financial', 'status': 'pending', 'notes': ''},
        {'id': 'experience-cert', 'label': 'Similar Works Experience Certificate', 'category': 'technical', 'status': 'pending', 'notes': ''},
        {'id': 'technical-capacity', 'label': 'Technical Capacity Documentation', 'category': 'technical', 'status': 'pending', 'notes': ''},
        {'id': 'personnel-qual', 'label': 'Key Personnel Qualifications', 'category': 'technical', 'status': 'pending', 'notes': ''},
        {'id': 'equipment-capacity', 'label': 'Equipment & Capacity Verification', 'category': 'technical', 'status': 'pending', 'notes': ''},
        {'id': 'reference-1', 'label': 'Client Reference 1', 'category': 'reference', 'status': 'pending', 'notes': ''},
        {'id': 'reference-2', 'label': 'Client Reference 2', 'category': 'reference', 'status': 'pending', 'notes': ''},
        {'id': 'labor-compliance', 'label': 'Labour Law Compliance', 'category': 'compliance', 'status': 'pending', 'notes': ''},
        {'id': 'safety-cert', 'label': 'Safety & Environmental Compliance', 'category': 'compliance', 'status': 'pending', 'notes': ''},
    ]

    pq.verification_items = DEFAULT_CHECKLIST
    pq.status = 'in_progress'
    pq.save()

    return Response({
        'message': 'Verification checklist generated',
        'pq': PostQualificationSerializer(pq).data,
    })


@api_view(['GET'])
@permission_classes([IsAuthenticated])
def pq_verification_context_view(request, pq_pk):
    try:
        pq = PostQualification.objects.select_related('bidder', 'bidder__supplier', 'assigned_to').get(pk=pq_pk)
    except PostQualification.DoesNotExist:
        return Response({'error': 'Post-qualification record not found'}, status=404)

    bid = pq.bidder
    user = bid.supplier

    supplier_profile = None
    from suppliers.models import Supplier as SupplierModel, VendorApplication, SupplierDocument
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
    if supplier_profile:
        supplier_docs = list(SupplierDocument.objects.filter(supplier=supplier_profile).values(
            'document_id', 'document_type', 'file_path', 'expiry_date', 'verification_status'
        ))
        from suppliers.models import Blacklist
        blacklist_entry = Blacklist.objects.filter(
            Q(registration_number=supplier_profile.registration_number) |
            Q(tin=supplier_profile.tin)
        ).order_by('-created_at').first()

    from bids.models import BidDocument, BidSecurity
    bid_docs = list(BidDocument.objects.filter(bid=bid).values(
        'document_id', 'document_type', 'file_path', 'uploaded_at'
    ))
    bid_securities = list(BidSecurity.objects.filter(bid=bid).values(
        'security_id', 'security_type', 'amount', 'issuing_institution',
        'reference_number', 'validity_date', 'verification_status'
    ))

    from evaluations.models import TechnicalScore, FinancialEvaluation
    tech_scores = TechnicalScore.objects.filter(bid=bid, is_final=True).select_related('criterion', 'evaluator')
    tech_data = []
    for ts in tech_scores:
        tech_data.append({
            'criterion': ts.criterion.criterion_name if ts.criterion else '',
            'evaluator': ts.evaluator.full_name if ts.evaluator else '',
            'raw_score': float(ts.raw_score),
            'weighted_score': float(ts.weighted_score),
        })

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
        'verification_items': pq.verification_items or [],
        'notes': pq.notes,
        'assigned_to_name': pq.assigned_to.full_name if pq.assigned_to else None,
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
            'risk_level': supplier_profile.risk_level if supplier_profile else None,
            'bank_name': supplier_profile.bank_name if supplier_profile else None,
            'bank_account_number': supplier_profile.bank_account_number if supplier_profile else None,
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
    from .models import PreliminaryExam, TechnicalScore, FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification, EvaluationCommittee
    from bids.models import BidSubmission

    total_bids = BidSubmission.objects.filter(solicitation=solicitation_pk).count()

    preliminary_exams = PreliminaryExam.objects.filter(bid__solicitation=solicitation_pk)
    prelim_done_bids = preliminary_exams.values('bid').distinct().count()
    prelim_complete = prelim_done_bids >= total_bids and total_bids > 0

    tech_scores = TechnicalScore.objects.filter(bid__solicitation=solicitation_pk)
    tech_unique_pairs = tech_scores.values('bid', 'evaluator').distinct().count()
    tech_bids_scored = tech_scores.values('bid').distinct().count()
    tech_evaluators = tech_scores.values('evaluator').distinct().count()
    tech_total_members = 0
    committees = EvaluationCommittee.objects.filter(solicitation=solicitation_pk)
    for c in committees:
        official_count = len(c.members or [])
        non_official_count = sum(1 for nom in (c.non_official_members or []) if nom.get('user_id'))
        tech_total_members = max(tech_total_members, official_count + non_official_count)
    tech_expected_pairs = total_bids * tech_total_members if tech_total_members > 0 else 0
    tech_complete = tech_unique_pairs >= tech_expected_pairs and tech_expected_pairs > 0

    financial_evals = FinancialEvaluation.objects.filter(bid__solicitation=solicitation_pk)
    financial_done = financial_evals.values('bid').distinct().count()
    winner_selected = BidSubmission.objects.filter(solicitation=solicitation_pk, status='awarded').exists()
    financial_complete = financial_done >= total_bids and total_bids > 0 and winner_selected

    consolidated = CombinedScore.objects.filter(bid__solicitation=solicitation_pk)
    consolidation_complete = consolidated.exists()

    ber = BidEvaluationReport.objects.filter(solicitation=solicitation_pk)
    ber_complete = ber.filter(status__in=['submitted', 'approved']).exists()

    post_qual = PostQualification.objects.filter(ber__solicitation=solicitation_pk)
    post_qual_complete = post_qual.filter(status='cleared').exists()

    return Response({
        'solicitation': str(solicitation_pk),
        'total_bids': total_bids,
        'phases': {
            'preliminary': {
                'complete': prelim_complete,
                'examined_bids': prelim_done_bids,
                'total_bids': total_bids,
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
                'consolidated_count': consolidated.count(),
            },
            'financial': {
                'complete': financial_complete,
                'evaluations_done': financial_done,
                'total_bids': total_bids,
            },
            'post_qual': {
                'complete': post_qual_complete,
                'total': post_qual.count(),
                'cleared': post_qual.filter(status='cleared').count(),
                'in_progress': post_qual.filter(status='in_progress').count(),
                'pending': post_qual.filter(status='pending').count(),
            },
            'ber': {
                'complete': ber_complete,
                'reports_count': ber.count(),
                'submitted_count': ber.filter(status='submitted').count(),
                'approved_count': ber.filter(status='approved').count(),
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

        contract = getattr(sol, 'contract', None)
        if contract:
            contract.appeal_pending = True
            contract.save()

        from accounts.models import User
        proc_officers = User.objects.filter(role='procurement_officer', is_active=True)
        pq_members = User.objects.filter(
            role__in=['evaluation_committee_chair', 'evaluation_committee_member'], is_active=True
        )
        ground_label = dict(AwardAppeal._meta.get_field('grounds').choices).get(grounds, grounds)
        notify_users(
            list(set(list(proc_officers) + list(pq_members))),
            f'New Award Appeal Filed — {sol.sol_number}',
            f'{user.full_name} filed an appeal for bid {bid.submission_id} under {sol.sol_number}. '
            f'Grounds: {ground_label}. '
            f'Resolution deadline: {deadline.strftime("%d %B %Y")}.',
            priority='high',
        )

        return Response(AwardAppealSerializer(appeal).data, status=201)


class AwardAppealDetailView(generics.RetrieveUpdateDestroyAPIView):
    serializer_class = AwardAppealSerializer
    permission_classes = [IsAuthenticated]
    queryset = AwardAppeal.objects.select_related(
        'solicitation', 'bidder', 'bidder__supplier', 'filed_by', 'resolved_by'
    )
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

        if role == 'supplier_user':
            if request.data.get('status') == 'withdrawn' and appeal.status in ('filed', 'under_review'):
                appeal.status = 'withdrawn'
                appeal.save()
                contract = getattr(appeal.solicitation, 'contract', None)
                if contract and not AwardAppeal.objects.filter(
                    solicitation=appeal.solicitation, status__in=['filed', 'under_review']
                ).exclude(pk=appeal.pk).exists():
                    contract.appeal_pending = False
                    contract.save()
                return Response(AwardAppealSerializer(appeal).data)
            return Response({'error': 'Suppliers can only withdraw their own appeals'}, status=403)

        new_status = request.data.get('status')
        if new_status and new_status not in ('under_review', 'upheld', 'dismissed'):
            return Response({'error': f'Invalid status: {new_status}'}, status=400)

        if new_status == 'under_review':
            appeal.status = 'under_review'
        elif new_status == 'upheld':
            appeal.status = 'upheld'
            appeal.resolution = request.data.get('resolution', '')
            appeal.resolved_by = user
            appeal.resolved_at = timezone.now()
        elif new_status == 'dismissed':
            appeal.status = 'dismissed'
            appeal.resolution = request.data.get('resolution', '')
            appeal.resolved_by = user
            appeal.resolved_at = timezone.now()

        appeal.save()

        if new_status in ('upheld', 'dismissed', 'withdrawn'):
            contract = getattr(appeal.solicitation, 'contract', None)
            if contract and not AwardAppeal.objects.filter(
                solicitation=appeal.solicitation, status__in=['filed', 'under_review']
            ).exclude(pk=appeal.pk).exists():
                contract.appeal_pending = False
                contract.save()

        if new_status in ('upheld', 'dismissed'):
            try:
                notify_users(
                    [appeal.filed_by],
                    f'Appeal {new_status.title()} — {appeal.solicitation.sol_number}',
                    f'Your appeal for bid {appeal.bidder.submission_id} under {appeal.solicitation.sol_number} '
                    f'has been {new_status}. Resolution: {appeal.resolution}',
                    priority='high',
                )
            except Exception:
                pass

        return Response(AwardAppealSerializer(appeal).data)
