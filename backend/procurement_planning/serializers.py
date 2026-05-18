from rest_framework import serializers
from .models import AnnualProcurementPlan, APPLineItem, ContractProcurementPlan, ProcurementMilestone, GeneralProcurementNotice


class APPLineItemSerializer(serializers.ModelSerializer):
    budget_available = serializers.SerializerMethodField()

    class Meta:
        model = APPLineItem
        fields = '__all__'
        read_only_fields = ('line_item_id',)

    def get_budget_available(self, obj):
        try:
            from finance.models import BudgetAllocation
            dept_code = obj.app.department.budget_code or obj.app.department.dept_code
            ba = BudgetAllocation.objects.filter(
                entity_code=dept_code,
                fiscal_year=obj.app.fiscal_year.year_code,
            ).first()
            if ba:
                return float(ba.available)
        except Exception:
            pass
        return None

    def validate_estimated_value(self, value):
        if value <= 0:
            raise serializers.ValidationError('Estimated value must be greater than zero')
        return value


class AnnualProcurementPlanSerializer(serializers.ModelSerializer):
    line_items = APPLineItemSerializer(many=True, read_only=True)
    gpns = serializers.SerializerMethodField()
    department_name = serializers.CharField(source='department.dept_name', read_only=True)
    fiscal_year_code = serializers.CharField(source='fiscal_year.year_code', read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    rejected_by_name = serializers.SerializerMethodField()
    consolidated_into_id = serializers.UUIDField(source='consolidated_into.app_id', read_only=True)
    consolidated_from_count = serializers.SerializerMethodField()
    zppa_days_remaining = serializers.SerializerMethodField()
    zppa_status = serializers.SerializerMethodField()

    class Meta:
        model = AnnualProcurementPlan
        fields = '__all__'
        read_only_fields = (
            'app_id', 'submitted_at', 'approved_at', 'rejected_at', 'created_at', 'updated_at',
        )

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else None

    def get_rejected_by_name(self, obj):
        return obj.rejected_by.full_name if obj.rejected_by else None

    def get_consolidated_from_count(self, obj):
        return obj.consolidated_from.count()

    def get_gpns(self, obj):
        gpns = obj.gpns.all()
        return GeneralProcurementNoticeSerializer(gpns, many=True).data

    def get_zppa_days_remaining(self, obj):
        if not obj.zppa_deadline or obj.zppa_submitted:
            return None
        from django.utils import timezone
        delta = obj.zppa_deadline - timezone.now()
        return delta.days

    def get_zppa_status(self, obj):
        if obj.zppa_submitted:
            return 'submitted'
        if not obj.zppa_deadline:
            return 'not_applicable'
        from django.utils import timezone
        delta = obj.zppa_deadline - timezone.now()
        if delta.days < 0:
            return 'overdue'
        elif delta.days <= 7:
            return 'approaching'
        return 'on_track'

    def validate(self, data):
        if data.get('is_consolidated') and not data.get('consolidated_into'):
            raise serializers.ValidationError('A consolidated APP must specify the target consolidated_into')
        return data


class AnnualProcurementPlanListSerializer(serializers.ModelSerializer):
    department_name = serializers.CharField(source='department.dept_name', read_only=True)
    fiscal_year_code = serializers.CharField(source='fiscal_year.year_code', read_only=True)
    submitted_by_name = serializers.SerializerMethodField()
    approved_by_name = serializers.SerializerMethodField()
    zppa_status = serializers.SerializerMethodField()
    zppa_days_remaining = serializers.SerializerMethodField()

    class Meta:
        model = AnnualProcurementPlan
        fields = (
            'app_id', 'fiscal_year_code', 'department_name', 'status',
            'total_estimated_value', 'submitted_at', 'approved_at',
            'submitted_by_name', 'approved_by_name', 'rejection_reason',
            'is_consolidated', 'created_at', 'zppa_submitted', 'zppa_status',
            'zppa_days_remaining',
        )

    def get_submitted_by_name(self, obj):
        return obj.submitted_by.full_name if obj.submitted_by else None

    def get_approved_by_name(self, obj):
        return obj.approved_by.full_name if obj.approved_by else None

    def get_zppa_status(self, obj):
        if getattr(obj, 'zppa_submitted', False):
            return 'submitted'
        if not getattr(obj, 'zppa_deadline', None):
            return 'not_applicable'
        from django.utils import timezone
        delta = obj.zppa_deadline - timezone.now()
        if delta.days < 0:
            return 'overdue'
        elif delta.days <= 7:
            return 'approaching'
        return 'on_track'

    def get_zppa_days_remaining(self, obj):
        if not getattr(obj, 'zppa_deadline', None) or getattr(obj, 'zppa_submitted', False):
            return None
        from django.utils import timezone
        delta = obj.zppa_deadline - timezone.now()
        return delta.days


class ProcurementMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementMilestone
        fields = '__all__'
        read_only_fields = ('milestone_id', 'variance_days')


class ContractProcurementPlanSerializer(serializers.ModelSerializer):
    milestones = ProcurementMilestoneSerializer(many=True, read_only=True)

    class Meta:
        model = ContractProcurementPlan
        fields = '__all__'
        read_only_fields = ('cpp_id', 'created_at', 'updated_at')


class GeneralProcurementNoticeSerializer(serializers.ModelSerializer):
    generated_by_name = serializers.SerializerMethodField()
    published_by_name = serializers.SerializerMethodField()

    class Meta:
        model = GeneralProcurementNotice
        fields = '__all__'
        read_only_fields = ('gpn_id', 'generated_at')

    def get_generated_by_name(self, obj):
        return obj.generated_by.full_name if obj.generated_by else None

    def get_published_by_name(self, obj):
        return obj.published_by.full_name if obj.published_by else None
