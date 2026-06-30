from rest_framework import serializers
from .models import AnnualProcurementPlan, APPLineItem, ContractProcurementPlan, ProcurementMilestone, GeneralProcurementNotice, CPPRisk, CPPDocument


class APPLineItemSerializer(serializers.ModelSerializer):
    funding_source_name = serializers.CharField(source='funding_source.source_name', read_only=True, allow_null=True)
    commodity_name = serializers.CharField(source='commodity.commodity_name', read_only=True, allow_null=True)
    commodity_category = serializers.CharField(source='commodity.category', read_only=True, allow_null=True)
    procurement_type_display = serializers.CharField(source='get_procurement_type_display', read_only=True)
    app_status = serializers.CharField(source='app.status', read_only=True)
    app_department = serializers.CharField(source='app.department.dept_name', read_only=True)
    app_fiscal_year = serializers.CharField(source='app.fiscal_year.year_code', read_only=True)
    app_name = serializers.SerializerMethodField()

    class Meta:
        model = APPLineItem
        fields = '__all__'
        read_only_fields = ('line_item_id',)

    def get_app_name(self, obj):
        return obj.app.app_number or f"APP {obj.app.fiscal_year.year_code} - {obj.app.department.dept_name}"


class AnnualProcurementPlanListSerializer(serializers.ModelSerializer):
    fiscal_year_code = serializers.CharField(source='fiscal_year.year_code', read_only=True)
    department_name = serializers.CharField(source='department.dept_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    line_items_count = serializers.SerializerMethodField()

    class Meta:
        model = AnnualProcurementPlan
        fields = (
            'app_id', 'app_number', 'fiscal_year', 'fiscal_year_code', 'department',
            'department_name', 'status', 'total_estimated_value',
            'created_by', 'created_by_name',
            'submitted_by_name', 'submitted_at',
            'approved_by_name', 'approved_at',
            'line_items_count', 'created_at', 'updated_at',
        )

    def get_line_items_count(self, obj):
        return obj.line_items.count()


class AnnualProcurementPlanSerializer(serializers.ModelSerializer):
    line_items = APPLineItemSerializer(many=True, read_only=True)
    fiscal_year_code = serializers.CharField(source='fiscal_year.year_code', read_only=True)
    department_name = serializers.CharField(source='department.dept_name', read_only=True)
    department_code = serializers.CharField(source='department.dept_code', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    submitted_by_name = serializers.CharField(source='submitted_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    rejected_by_name = serializers.CharField(source='rejected_by.full_name', read_only=True)

    class Meta:
        model = AnnualProcurementPlan
        fields = '__all__'
        read_only_fields = ('app_id', 'app_number', 'created_by', 'created_at', 'updated_at')


class CPPRiskSerializer(serializers.ModelSerializer):
    class Meta:
        model = CPPRisk
        fields = '__all__'
        read_only_fields = ('risk_id', 'created_at')


class ProcurementMilestoneSerializer(serializers.ModelSerializer):
    class Meta:
        model = ProcurementMilestone
        fields = '__all__'
        read_only_fields = ('milestone_id', 'variance_days', 'variance_flag')


class CPPDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='document_id', read_only=True)
    filename = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    uploaded_by_name = serializers.SerializerMethodField()

    class Meta:
        model = CPPDocument
        fields = ('id', 'document_id', 'cpp', 'document', 'filename', 'file_url', 'document_type', 'description', 'uploaded_at', 'uploaded_by', 'uploaded_by_name')
        read_only_fields = ('document_id', 'uploaded_at')

    def get_filename(self, obj):
        if obj.document:
            return obj.document.name
        return None

    def get_file_url(self, obj):
        if obj.document:
            return obj.document.url
        return None

    def get_uploaded_by_name(self, obj):
        if obj.uploaded_by:
            return obj.uploaded_by.full_name or obj.uploaded_by.email
        return None


class ContractProcurementPlanSerializer(serializers.ModelSerializer):
    milestones = ProcurementMilestoneSerializer(many=True, read_only=True, source='procurement_milestones')
    risks = CPPRiskSerializer(many=True, read_only=True)
    documents = CPPDocumentSerializer(many=True, read_only=True)
    requisition_number = serializers.CharField(source='requisition.req_number', read_only=True)
    requisition_description = serializers.CharField(source='requisition.description', read_only=True)
    requisition_department = serializers.CharField(source='requisition.department.dept_name', read_only=True)
    requisition_required_date = serializers.DateField(source='requisition.required_date', read_only=True)
    requisition_estimated_value = serializers.DecimalField(source='requisition.estimated_total', max_digits=20, decimal_places=2, read_only=True)
    requisition_delivery_location = serializers.CharField(source='requisition.delivery_location', read_only=True)
    requisition_encumbrance_ref = serializers.CharField(source='requisition.encumbrance_ref', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    approved_by_name = serializers.CharField(source='approved_by.full_name', read_only=True)
    baseline_locked_by_name = serializers.CharField(source='baseline_locked_by.full_name', read_only=True)
    zpc_approved_by_name = serializers.CharField(source='zpc_approved_by.full_name', read_only=True)
    override_approved_by_name = serializers.CharField(source='override_approved_by.full_name', read_only=True)
    overall_risk_display = serializers.SerializerMethodField()

    class Meta:
        model = ContractProcurementPlan
        fields = '__all__'
        read_only_fields = ('cpp_id', 'cpp_number', 'created_at', 'updated_at', 'completed_at')

    def get_overall_risk_display(self, obj):
        if obj.overall_risk_level:
            labels = {'low': 'Low Risk', 'medium': 'Medium Risk', 'high': 'High Risk'}
            return labels.get(obj.overall_risk_level, obj.overall_risk_level)
        return None

    def validate(self, data):
        requisition = data.get('requisition') or (self.instance.requisition if self.instance else None)
        if requisition and requisition.status != 'approved':
            raise serializers.ValidationError({
                'requisition': 'CPP can only be created from an approved requisition. '
                               f'Current status: "{requisition.status}"'
            })

        # BR-CPP-09: Multi-year contracts must document future year commitments
        is_multi_year = data.get('is_multi_year', self.instance.is_multi_year if self.instance else False)
        multi_year_commitments = data.get('multi_year_commitments',
                                          self.instance.multi_year_commitments if self.instance else [])
        if is_multi_year and not multi_year_commitments:
            raise serializers.ValidationError({
                'multi_year_commitments': 'Multi-year contracts must have future year budget commitments documented.'
            })
        if multi_year_commitments and not isinstance(multi_year_commitments, list):
            raise serializers.ValidationError({
                'multi_year_commitments': 'Must be a list of commitment objects.'
            })
        for idx, commitment in enumerate(multi_year_commitments or []):
            if not commitment.get('fiscal_year'):
                raise serializers.ValidationError({
                    'multi_year_commitments': f'Commitment #{idx + 1} is missing "fiscal_year".'
                })
            if not commitment.get('amount'):
                raise serializers.ValidationError({
                    'multi_year_commitments': f'Commitment #{idx + 1} is missing "amount".'
                })

        return data


class ContractProcurementPlanListSerializer(serializers.ModelSerializer):
    requisition_number = serializers.CharField(source='requisition.req_number', read_only=True)
    requisition_description = serializers.CharField(source='requisition.description', read_only=True)
    department_name = serializers.CharField(source='requisition.department.dept_name', read_only=True)
    created_by_name = serializers.CharField(source='created_by.full_name', read_only=True)
    milestones_count = serializers.SerializerMethodField()
    method_display = serializers.SerializerMethodField()

    class Meta:
        model = ContractProcurementPlan
        fields = (
            'cpp_id', 'cpp_number', 'requisition', 'requisition_number',
            'requisition_description', 'department_name', 'method', 'method_display',
            'recommended_method', 'method_override', 'zpc_approval_required',
            'status', 'overall_risk_level', 'estimated_value',
            'is_baseline_locked', 'created_by_name', 'created_at',
            'approved_at', 'milestones_count',
        )

    def get_milestones_count(self, obj):
        return obj.procurement_milestones.count()

    def get_method_display(self, obj):
        choices = dict(ContractProcurementPlan.METHOD_CHOICES)
        return choices.get(obj.method, obj.method)


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

