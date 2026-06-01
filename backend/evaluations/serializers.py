from rest_framework import serializers
from .models import EvaluationCommittee, ConflictOfInterest, PreliminaryExam, TechnicalScore, FinancialEvaluation, CombinedScore, BidEvaluationReport, PostQualification


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
    coi_declarations = ConflictOfInterestSerializer(many=True, read_only=True)
    member_count = serializers.SerializerMethodField()

    class Meta:
        model = EvaluationCommittee
        fields = '__all__'
        read_only_fields = ('committee_id', 'formed_at')

    def get_status(self, obj):
        return 'active'

    def get_member_count(self, obj):
        if isinstance(obj.members, list):
            return len(obj.members)
        return 0

    def validate_members(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('Members must be a list.')
        return value

    def validate(self, attrs):
        members = attrs.get('members', [])
        def _to_id(val):
            if val is None:
                return ''
            if hasattr(val, 'pk'):
                return str(val.pk)
            return str(val)
        chairperson_id = _to_id(attrs.get('chairperson'))
        secretary_id = _to_id(attrs.get('secretary'))
        if chairperson_id and secretary_id and chairperson_id == secretary_id:
            raise serializers.ValidationError('Chairperson and secretary must be different users.')
        all_members = list({_to_id(m) for m in members} | {chairperson_id, secretary_id} - {''})
        if len(all_members) < 3:
            raise serializers.ValidationError(
                'Committee must have at least 3 unique members (including chairperson and secretary).'
            )
        attrs['members'] = all_members
        return attrs


class PreliminaryExamSerializer(serializers.ModelSerializer):
    class Meta:
        model = PreliminaryExam
        fields = '__all__'


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
    all_signed = serializers.SerializerMethodField()
    signed_count = serializers.SerializerMethodField()
    required_count = serializers.SerializerMethodField()

    class Meta:
        model = BidEvaluationReport
        fields = '__all__'
        read_only_fields = ('ber_id', 'created_at', 'updated_at', 'approved_at')

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
        return len(member_ids)


class PostQualificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = PostQualification
        fields = '__all__'
