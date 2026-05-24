from rest_framework import serializers
from .models import SolicitationTemplate, Solicitation, EvaluationCriterion, SolicitationAddendum, ClarificationRequest, SolicitationDocument
from master_data.models import Department
from requisitions.models import Requisition


class SolicitationTemplateSerializer(serializers.ModelSerializer):
    class Meta:
        model = SolicitationTemplate
        fields = '__all__'

    def validate_mandatory_clauses(self, value):
        if not isinstance(value, list):
            raise serializers.ValidationError('mandatory_clauses must be a list')
        for clause in value:
            if not isinstance(clause, dict) or 'clause_id' not in clause or 'clause_text' not in clause:
                raise serializers.ValidationError('Each clause must have clause_id and clause_text')
        return value


class EvaluationCriterionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='criterion_id', read_only=True)

    class Meta:
        model = EvaluationCriterion
        fields = '__all__'
        read_only_fields = ('criterion_id',)

    def validate_weight(self, value):
        if value < 0:
            raise serializers.ValidationError('Weight must be non-negative')
        weight = float(value)
        if self.instance:
            current_sum = sum(float(c.weight) for c in self.instance.solicitation.evaluation_criteria.exclude(criterion_id=self.instance.criterion_id))
        elif self.initial_data.get('solicitation'):
            from .models import Solicitation
            try:
                sol = Solicitation.objects.get(pk=self.initial_data['solicitation'])
                current_sum = sum(float(c.weight) for c in sol.evaluation_criteria.all())
            except Solicitation.DoesNotExist:
                current_sum = 0
        else:
            current_sum = 0
        if current_sum + weight > 100:
            raise serializers.ValidationError(f'Total criteria weight would exceed 100% (currently {current_sum}%, adding {weight}%)')
        return value


class SolicitationAddendumSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='addendum_id', read_only=True)
    number = serializers.IntegerField(source='addendum_number', read_only=True)
    issued_at = serializers.DateTimeField(source='created_at', read_only=True)

    class Meta:
        model = SolicitationAddendum
        fields = '__all__'
        read_only_fields = ('addendum_id', 'addendum_number', 'created_at')


class ClarificationRequestSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='clarification_id', read_only=True)
    supplier_name = serializers.CharField(source='supplier.full_name', read_only=True)

    class Meta:
        model = ClarificationRequest
        fields = '__all__'
        read_only_fields = ('clarification_id', 'asked_at')


class SolicitationDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='document_id', read_only=True)
    filename = serializers.CharField(source='file_path', read_only=True)

    class Meta:
        model = SolicitationDocument
        fields = '__all__'


class SolicitationListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='solicitation_id', read_only=True)
    type = serializers.CharField(source='method', read_only=True)
    department = serializers.SerializerMethodField()
    estimated_value = serializers.SerializerMethodField()
    issue_date = serializers.SerializerMethodField()
    requisition_number = serializers.CharField(source='requisition.req_number', read_only=True)

    class Meta:
        model = Solicitation
        fields = ('id', 'solicitation_id', 'sol_number', 'title', 'type', 'method', 'department', 'estimated_value', 'issue_date', 'closing_date', 'status', 'published_at', 'created_at', 'requisition_number')

    def get_department(self, obj):
        if obj.department:
            return obj.department.dept_name
        if obj.requisition:
            return obj.requisition.department.dept_name
        return None

    def get_estimated_value(self, obj):
        if obj.estimated_value is not None:
            return float(obj.estimated_value)
        if obj.requisition:
            return float(obj.requisition.estimated_total)
        return None

    def get_issue_date(self, obj):
        if obj.issue_date:
            return obj.issue_date.isoformat()
        if obj.published_at:
            return obj.published_at.date().isoformat()
        return obj.created_at.date().isoformat()


class SolicitationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='solicitation_id', read_only=True)
    type = serializers.CharField(source='method', required=False)
    procurement_method = serializers.CharField(source='method', required=False)
    estimated_value = serializers.SerializerMethodField()
    issue_date = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    opening_date = serializers.DateTimeField(required=False)
    requisition = serializers.PrimaryKeyRelatedField(required=True, queryset=Requisition.objects.all())
    document_sets = SolicitationDocumentSerializer(many=True, source='documents', read_only=True)
    clarification_responses = ClarificationRequestSerializer(many=True, source='clarifications', read_only=True)
    evaluation_criteria = EvaluationCriterionSerializer(many=True, read_only=True)
    addenda = SolicitationAddendumSerializer(many=True, read_only=True)
    documents = SolicitationDocumentSerializer(many=True, read_only=True)
    publication_targets = serializers.ListField(child=serializers.CharField(), read_only=True)
    egp_reference = serializers.CharField(read_only=True)
    rejection_reason = serializers.CharField(read_only=True)
    created_by = serializers.SerializerMethodField()
    approved_by = serializers.SerializerMethodField()
    rejected_by = serializers.SerializerMethodField()
    non_open_justifications = serializers.SerializerMethodField()

    class Meta:
        model = Solicitation
        exclude = ('method',)
        read_only_fields = ('solicitation_id', 'sol_number', 'published_at', 'created_at', 'updated_at')

    def get_estimated_value(self, obj):
        if obj.estimated_value is not None:
            return float(obj.estimated_value)
        if obj.requisition:
            return float(obj.requisition.estimated_total)
        return None

    def get_issue_date(self, obj):
        if obj.issue_date:
            return obj.issue_date.isoformat()
        if obj.published_at:
            return obj.published_at.date().isoformat()
        return obj.created_at.date().isoformat()

    def get_department(self, obj):
        if obj.department:
            return obj.department.dept_name
        if obj.requisition:
            return obj.requisition.department.dept_name
        return None

    def get_department_name(self, obj):
        return self.get_department(obj)

    def get_created_by(self, obj):
        if obj.created_by:
            return {'full_name': obj.created_by.full_name or f"{obj.created_by.first_name} {obj.created_by.last_name}".strip(), 'email': obj.created_by.email}
        return None

    def get_approved_by(self, obj):
        if obj.approved_by:
            return {'full_name': obj.approved_by.full_name or f"{obj.approved_by.first_name} {obj.approved_by.last_name}".strip(), 'email': obj.approved_by.email}
        return None

    def get_rejected_by(self, obj):
        if obj.rejected_by:
            return {'full_name': obj.rejected_by.full_name or f"{obj.rejected_by.first_name} {obj.rejected_by.last_name}".strip(), 'email': obj.rejected_by.email}
        return None

    def get_non_open_justifications(self, obj):
        from method_selection.models import NonOpenJustification
        justs = NonOpenJustification.objects.filter(solicitation=obj)
        return [{
            'id': str(j.justification_id),
            'method': j.method,
            'reason_code': j.reason_code,
            'reason_text': j.reason_text,
            'status': j.status,
            'submitted_by': j.submitted_by.full_name if j.submitted_by else None,
            'approved_by': j.approved_by.full_name if j.approved_by else None,
            'zpc_approved_at': j.zpc_approved_at.isoformat() if j.zpc_approved_at else None,
            'rejection_reason': j.rejection_reason,
            'created_at': j.created_at.isoformat(),
        } for j in justs]

    EXTRA_FIELDS = [
        'submission_format', 'bid_validity_days', 'pre_bid_date', 'pre_bid_venue',
        'citizen_preference', 'bid_security_required', 'bid_security_type',
        'bid_security_rate', 'contact_person', 'contact_phone', 'contact_email',
        'minimum_technical_threshold', 'document_fee_enabled', 'document_fee_amount',
    ]

    @staticmethod
    def resolve_department(value):
        if not value:
            return None
        try:
            from uuid import UUID
            UUID(value)
            return Department.objects.filter(pk=value).first()
        except (ValueError, TypeError):
            return Department.objects.filter(dept_name=value).first()

    def create(self, validated_data):
        from django.utils import timezone
        import secrets

        type_val = self.initial_data.get('type')
        if type_val and 'method' not in validated_data:
            validated_data['method'] = type_val
        procurement_method = self.initial_data.get('procurement_method')
        if procurement_method and 'method' not in validated_data:
            validated_data['method'] = procurement_method

        dept_val = self.initial_data.get('department') or validated_data.pop('department', None)
        if dept_val and 'department' not in validated_data:
            dept = self.resolve_department(dept_val)
            if dept:
                validated_data['department'] = dept

        # Persist extra fields not on the model
        for field in self.EXTRA_FIELDS:
            val = self.initial_data.get(field)
            if val is not None:
                validated_data[field] = val

        # Persist publication_channels as publication_targets
        channels = self.initial_data.get('publication_channels')
        if channels:
            validated_data['publication_targets'] = channels

        if 'sol_number' not in validated_data or not validated_data.get('sol_number'):
            validated_data['sol_number'] = f"SOL-{timezone.now().strftime('%Y%m%d')}-{secrets.token_hex(3).upper()}"

        # Auto-recommend method based on estimated value
        if 'method' not in validated_data or not validated_data.get('method'):
            est_value = validated_data.get('estimated_value')
            if est_value is None and validated_data.get('requisition'):
                est_value = validated_data['requisition'].estimated_total
            if est_value is not None:
                try:
                    from system_config.models import ThresholdRule
                    rules = ThresholdRule.objects.filter(
                        applies_to='procurement', is_active=True,
                    ).order_by('min_value')
                    for rule in rules:
                        if rule.min_value <= est_value:
                            if rule.max_value is None or est_value <= rule.max_value:
                                validated_data['method'] = rule.default_method or 'open_tender'
                                break
                    if 'method' not in validated_data:
                        validated_data['method'] = 'open_tender'
                except Exception:
                    validated_data['method'] = 'open_tender'
            else:
                validated_data['method'] = 'open_tender'

        instance = super().create(validated_data)

        # Create evaluation criteria from technical_criteria and mandatory_criteria
        from .models import SolicitationTemplate, SolicitationDocument
        technical_criteria = self.initial_data.get('technical_criteria', [])
        for i, tc in enumerate(technical_criteria):
            EvaluationCriterion.objects.create(
                solicitation=instance,
                criterion_name=tc.get('criterion_name', ''),
                criterion_type='technical',
                weight=tc.get('weight', 0),
                minimum_threshold=tc.get('max_score', 100),
                order_index=i,
            )

        mandatory_criteria = self.initial_data.get('mandatory_criteria', [])
        for i, mc in enumerate(mandatory_criteria):
            EvaluationCriterion.objects.create(
                solicitation=instance,
                criterion_name=mc.get('name', ''),
                criterion_type='mandatory',
                weight=0,
                order_index=len(technical_criteria) + i,
            )

        template = SolicitationTemplate.objects.filter(
            method__iexact=instance.method,
            is_active=True,
        ).first()
        if template:
            SolicitationDocument.objects.create(
                solicitation=instance,
                document_type=template.document_type,
                file_path=template.template_content,
            )

        return instance

    def update(self, instance, validated_data):
        type_val = self.initial_data.get('type')
        if type_val:
            validated_data['method'] = type_val

        procurement_method = self.initial_data.get('procurement_method')
        if procurement_method:
            validated_data['method'] = procurement_method

        dept_val = self.initial_data.get('department')
        if dept_val:
            dept = self.resolve_department(dept_val)
            if dept:
                validated_data['department'] = dept

        for field in self.EXTRA_FIELDS:
            val = self.initial_data.get(field)
            if val is not None:
                validated_data[field] = val

        channels = self.initial_data.get('publication_channels')
        if channels:
            validated_data['publication_targets'] = channels

        return super().update(instance, validated_data)
