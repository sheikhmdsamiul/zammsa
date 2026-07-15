from datetime import datetime
from django.db.models import Q
from django.utils import timezone
from rest_framework import serializers
from .models import SolicitationTemplate, Solicitation, EvaluationCriterion, SolicitationAddendum, ClarificationRequest, SolicitationDocument
from master_data.models import Department
from requisitions.models import Requisition
from procurement_planning.models import ProcurementMilestone
from procurement_planning.serializers import ProcurementMilestoneSerializer


def get_solicitation_ready_cpp(requisition):
    """
    Get an approved CPP with locked baseline for solicitation creation.
    Per SRS BR-CPP-01: No solicitation can be created without an approved CPP with locked baseline.
    """
    if not requisition:
        return None
    return requisition.cpp.filter(
        status='approved',
        is_baseline_locked=True,
    ).order_by('-approved_at', '-updated_at', '-created_at').first()


class SolicitationTemplateSerializer(serializers.ModelSerializer):
    # Human-readable display labels
    template_type_display = serializers.CharField(
        source='get_template_type_display', read_only=True
    )
    procurement_type_display = serializers.CharField(
        source='get_procurement_type_display', read_only=True
    )

    class Meta:
        model = SolicitationTemplate
        fields = (
            # Identity
            'template_id', 'template_name', 'template_description',
            # Classification (FR-SOL-01)
            'template_type', 'template_type_display',
            'procurement_type', 'procurement_type_display',
            'method',
            # Content
            'document_type', 'template_content',
            # Clause management (FR-SOL-02)
            'mandatory_clauses',
            # Flags
            'is_zppa_template', 'is_active', 'requires_cpp',
            # Governance
            'applicable_value_range', 'auto_populate_fields',
            # Versioning
            'version',
            # Audit (AUD-SOL-04)
            'created_at', 'updated_at',
        )
        read_only_fields = ('template_id', 'created_at', 'updated_at')

    def validate_mandatory_clauses(self, value):
        """FR-SOL-02: Each clause must have clause_id, clause_text, and is_locked."""
        if not isinstance(value, list):
            raise serializers.ValidationError('mandatory_clauses must be a list')
        for clause in value:
            if not isinstance(clause, dict):
                raise serializers.ValidationError('Each clause must be a JSON object')
            if 'clause_id' not in clause or 'clause_text' not in clause:
                raise serializers.ValidationError(
                    'Each clause must have clause_id and clause_text'
                )
            if 'is_locked' not in clause:
                clause['is_locked'] = True  # default to locked for safety
        return value

    def validate_applicable_value_range(self, value):
        """Enforce {"min": int, "max": int} shape."""
        if not value:
            return value
        if not isinstance(value, dict):
            raise serializers.ValidationError(
                'applicable_value_range must be a JSON object with "min" and "max" keys'
            )
        for key in ('min', 'max'):
            if key in value and not isinstance(value[key], (int, float)):
                raise serializers.ValidationError(
                    f'applicable_value_range["{key}"] must be a number'
                )
        if 'min' in value and 'max' in value and value['min'] > value['max']:
            raise serializers.ValidationError(
                'applicable_value_range "min" must not exceed "max"'
            )
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
        read_only_fields = ('addendum_id', 'addendum_number', 'created_at', 'addendum_status', 'approved_by', 'approved_at', 'rejection_reason')


class ClarificationRequestSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='clarification_id', read_only=True)
    supplier_name = serializers.CharField(source='supplier.full_name', read_only=True)

    class Meta:
        model = ClarificationRequest
        fields = '__all__'
        read_only_fields = ('clarification_id', 'asked_at')


class SolicitationDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='document_id', read_only=True)
    filename = serializers.SerializerMethodField()
    file_url = serializers.SerializerMethodField()
    size = serializers.SerializerMethodField()

    class Meta:
        model = SolicitationDocument
        fields = '__all__'

    def get_filename(self, obj):
        if obj.file:
            return obj.file.name
        return obj.file_path or 'Document'

    def get_file_url(self, obj):
        if obj.file:
            return obj.file.url
        if obj.file_path:
            return f'/media/solicitation_documents/{obj.file_path}'
        return None

    def get_size(self, obj):
        if obj.file:
            try:
                return obj.file.size
            except (OSError, ValueError):
                return None
        return None


class SolicitationListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='solicitation_id', read_only=True)
    type = serializers.CharField(source='method', read_only=True)
    department = serializers.SerializerMethodField()
    estimated_value = serializers.SerializerMethodField()
    issue_date = serializers.SerializerMethodField()
    requisition_number = serializers.CharField(source='requisition.req_number', read_only=True)
    cpp_number = serializers.CharField(source='cpp.cpp_number', read_only=True)
    cpp_resource_requirements = serializers.SerializerMethodField()
    total_bids = serializers.SerializerMethodField()

    class Meta:
        model = Solicitation
        fields = ('id', 'solicitation_id', 'sol_number', 'title', 'type', 'method', 'department', 'estimated_value', 'issue_date', 'closing_date', 'status', 'published_at', 'created_at', 'requisition_number', 'cpp_number', 'cpp_resource_requirements', 'total_bids')

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

    def get_cpp_resource_requirements(self, obj):
        if obj.cpp and obj.cpp.resource_requirements:
            return obj.cpp.resource_requirements
        return None

    def get_total_bids(self, obj):
        return obj.bids.filter(status='submitted').count()


class SolicitationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='solicitation_id', read_only=True)
    type = serializers.CharField(source='method', required=False)
    procurement_method = serializers.CharField(source='method', required=False)
    description = serializers.CharField(required=False, allow_blank=True)
    estimated_value = serializers.SerializerMethodField()
    issue_date = serializers.SerializerMethodField()
    department = serializers.SerializerMethodField()
    department_name = serializers.SerializerMethodField()

    opening_date = serializers.DateTimeField(required=False, allow_null=True)
    requisition = serializers.PrimaryKeyRelatedField(required=True, queryset=Requisition.objects.all())
    cpp = serializers.PrimaryKeyRelatedField(read_only=True)
    cpp_number = serializers.CharField(source='cpp.cpp_number', read_only=True)
    cpp_milestones = serializers.SerializerMethodField()
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
    total_bids = serializers.SerializerMethodField()
    items = serializers.SerializerMethodField()

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

    def get_total_bids(self, obj):
        return obj.bids.filter(status='submitted').count()

    def get_cpp_milestones(self, obj):
        if not obj.cpp:
            return []

        milestones = obj.cpp.procurement_milestones.all().order_by('sequence_number', 'planned_date')
        data = list(ProcurementMilestoneSerializer(milestones, many=True).data)

        # Helper: convert a date/datetime to ISO date string
        def _iso(val):
            if val is None:
                return None
            if hasattr(val, 'date'):
                return val.date().isoformat()
            return str(val)

        # Compute variance_days and variance_flag from planned + actual (mirrors ProcurementMilestone.save)
        def _variance(planned_iso, actual_iso):
            if not planned_iso or not actual_iso:
                return None, ''
            try:
                from datetime import date as _date
                delta = (_date.fromisoformat(actual_iso) - _date.fromisoformat(planned_iso)).days
                if delta <= 0:
                    return delta, 'green'
                elif delta <= 7:
                    return delta, 'yellow'
                elif delta <= 14:
                    return delta, 'orange'
                else:
                    return delta, 'red'
            except Exception:
                return None, ''

        sol_status = obj.status or ''
        cpp = obj.cpp

        # Lifecycle map: (keyword_fragments, inferred_actual_date, condition_met)
        # Ordered earliest-to-latest so the first match wins.
        lifecycle = [
            (
                # CPP approval — uses cpp.approved_at directly
                ('cpp approved', 'cpp approval', 'contract procurement plan approved',
                 'cpp baseline locked', 'baseline locked', 'cpp finalised', 'cpp finalized'),
                _iso(cpp.approved_at),
                bool(cpp.approved_at),
            ),
            (
                # Solicitation created / document ready
                ('solicitation creation', 'requisition to solicitation',
                 'solicitation document ready', 'solicitation document'),
                _iso(obj.created_at),
                True,
            ),
            (
                # Solicitation internally approved
                ('solicitation approved', 'sol approved', 'approval of solicitation'),
                _iso(obj.updated_at) if sol_status in ('approved', 'published', 'closed', 'awarded') else None,
                sol_status in ('approved', 'published', 'closed', 'awarded'),
            ),
            (
                # Solicitation published / issued / advertised
                ('solicitation published', 'solicitation issued', 'solicitation advertised',
                 'advert published', 'issue date', 'publication', 'tender published',
                 'tender issued', 'tender advertised'),
                _iso(obj.published_at) or _iso(obj.issue_date),
                bool(obj.published_at or obj.issue_date),
            ),
            (
                # Pre-bid conference / site visit
                ('pre-bid', 'prebid', 'pre bid', 'bidders conference', 'site visit'),
                _iso(obj.pre_bid_date),
                bool(obj.pre_bid_date),
            ),
            (
                # Bid closing / submission deadline
                ('bid closing', 'closing date', 'bid submission', 'submission deadline',
                 'tender closing', 'close of bidding'),
                _iso(obj.closing_date),
                sol_status in ('closed', 'awarded', 'cancelled'),
            ),
            (
                # Bid opening
                ('bid opening', 'public bid opening', 'opening ceremony',
                 'tender opening', 'opening of bids'),
                _iso(obj.opening_date) or _iso(obj.closing_date),
                sol_status in ('closed', 'awarded') and bool(obj.opening_date or obj.closing_date),
            ),
        ]

        for entry in data:
            name = (entry.get('milestone_name') or '').lower()

            # Infer actual_date if not already in DB
            if not entry.get('actual_date'):
                for keywords, inferred_date, condition in lifecycle:
                    if condition and inferred_date and any(k in name for k in keywords):
                        entry['actual_date'] = inferred_date
                        break

            # Compute variance when actual_date is present but variance fields are missing
            if entry.get('actual_date') and not entry.get('variance_flag'):
                variance_days, variance_flag = _variance(
                    entry.get('planned_date'), entry['actual_date']
                )
                entry['variance_days'] = variance_days
                entry['variance_flag'] = variance_flag

        return data


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

    def get_items(self, obj):
        if obj.requisition:
            return [
                {
                    'description': item.description,
                    'quantity': float(item.quantity),
                    'unit': item.unit_of_measure.uom_name if item.unit_of_measure else '',
                    'unit_price': float(item.unit_price_estimate) if item.unit_price_estimate else 0,
                    'total_estimate': float(item.total_estimate) if item.total_estimate else 0,
                }
                for item in obj.requisition.items.all()
            ]
        return []

    EXTRA_FIELDS = [
        'submission_format', 'bid_validity_days', 'pre_bid_date', 'pre_bid_venue',
        'citizen_preference', 'bid_security_required', 'bid_security_type',
        'bid_security_rate', 'contact_person', 'contact_phone', 'contact_email',
        'minimum_technical_threshold', 'document_fee_enabled', 'document_fee_amount',
        'evaluation_method', 'financial_weight',
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

    MIN_BIDDING_PERIOD_DAYS = {
        'open_tender': 21,
        'international': 30,
        'limited': 14,
        'simplified': 14,
        'direct': 0,
    }

    def validate(self, data):
        if self.instance is None and not data.get('requisition'):
            raise serializers.ValidationError({'requisition': 'A requisition is required to create a solicitation.'})

        method = data.get('method', getattr(self.instance, 'method', None))
        closing_date = data.get('closing_date', getattr(self.instance, 'closing_date', None))
        issue_date = data.get('issue_date', getattr(self.instance, 'issue_date', None))

        # BR-SOL-01: Validate minimum bidding period
        if method and closing_date:
            min_days = self.MIN_BIDDING_PERIOD_DAYS.get(method, 0)
            if min_days > 0:
                ref_date = issue_date or timezone.now().date()
                if isinstance(ref_date, datetime):
                    ref_date = ref_date.date()
                if isinstance(closing_date, datetime):
                    closing_date = closing_date.date()
                gap = (closing_date - ref_date).days
                if gap < min_days:
                    raise serializers.ValidationError(
                        f'Minimum bidding period for "{method}" is {min_days} days. '
                        f'Current gap is {gap} days.'
                    )

        # Validate clarification cutoff is ≥ 5 working days before closing
        cutoff = data.get('clarification_cutoff', getattr(self.instance, 'clarification_cutoff', None))
        closing = data.get('closing_date', getattr(self.instance, 'closing_date', None))
        if cutoff and closing:
            if isinstance(cutoff, str):
                from django.utils.dateparse import parse_datetime
                cutoff = parse_datetime(cutoff)
            if isinstance(closing, str):
                from django.utils.dateparse import parse_datetime
                closing = parse_datetime(closing)
            if cutoff and closing:
                if cutoff >= closing:
                    raise serializers.ValidationError(
                        {'clarification_cutoff': 'Clarification cutoff must be before the closing date.'}
                    )
                remaining = (closing - cutoff).days
                if remaining < 5:
                    raise serializers.ValidationError(
                        {'clarification_cutoff': f'Clarification cutoff must be at least 5 working days before closing. Currently {remaining} day(s).'}
                    )

        # BR-SOL-04: Validate bid opening is on or after closing
        opening = data.get('opening_date', getattr(self.instance, 'opening_date', None))
        if opening and closing:
            if isinstance(opening, str):
                from django.utils.dateparse import parse_datetime
                opening = parse_datetime(opening)
            if isinstance(closing, str):
                from django.utils.dateparse import parse_datetime
                closing = parse_datetime(closing)
            if opening and closing and opening < closing:
                raise serializers.ValidationError(
                    {'opening_date': 'Bid opening date must be on or after the closing date.'}
                )

        return data

    def validate_method(self, value):
        requisition_id = self.initial_data.get('requisition')
        if requisition_id:
            requisition = Requisition.objects.filter(pk=requisition_id).first()
            approved_cpp = get_solicitation_ready_cpp(requisition)
            if approved_cpp and approved_cpp.method and approved_cpp.method != value:
                raise serializers.ValidationError(
                    f'Method "{value}" does not match the approved CPP method "{approved_cpp.method}". '
                    'The solicitation method must align with the CPP.'
                )
        return value

    def create(self, validated_data):
        from django.utils import timezone
        import secrets
        from procurement_planning.models import ContractProcurementPlan

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

        # SRS FR-SOL-01: Auto-populate from approved CPP with locked baseline
        requisition = validated_data.get('requisition')
        approved_cpp = None
        if requisition:
            approved_cpp = get_solicitation_ready_cpp(requisition)
            if not approved_cpp:
                raise serializers.ValidationError({
                    'requisition': 'Cannot create solicitation. An approved Contract Procurement Plan (CPP) with a locked baseline is required first. '
                                   'Please ensure the CPP is approved and the baseline is locked.'
                })

        if approved_cpp:
            validated_data['cpp'] = approved_cpp
            # Auto-set method from CPP (SRS FR-METHOD-01)
            if not validated_data.get('method'):
                validated_data['method'] = approved_cpp.method
            # Auto-set estimated value from CPP
            if not validated_data.get('estimated_value') and approved_cpp.estimated_value:
                validated_data['estimated_value'] = approved_cpp.estimated_value
            # Auto-set department from requisition/CPP
            if not validated_data.get('department') and requisition.department_id:
                validated_data['department'] = requisition.department
            # Default opening date to closing date if not set
            if not validated_data.get('opening_date') and validated_data.get('closing_date'):
                validated_data['opening_date'] = validated_data['closing_date']
            # Auto-generate description from requisition and CPP data (SRS FR-SOL-01)
            if not validated_data.get('description'):
                item_lines = [
                    f'- {item.description}: {item.quantity} {item.unit_of_measure.uom_name if item.unit_of_measure else ""}'.strip()
                    for item in requisition.items.all()
                ]
                cpp_strategy = approved_cpp.procurement_strategy or 'Standard procurement strategy'
                validated_data['description'] = (
                    f'{requisition.description}\n\n'
                    f'Procurement Strategy: {cpp_strategy}\n'
                    f'Delivery location: {requisition.delivery_location or "To be specified"}\n'
                    f'Required date: {requisition.required_date}\n'
                    f'CPP Reference: {approved_cpp.cpp_number}\n'
                    f'Requisition items:\n' + '\n'.join(item_lines)
                )
            # Set default evaluation method based on CPP if not specified
            if not validated_data.get('evaluation_method'):
                if approved_cpp.method in ('open_tender', 'international'):
                    validated_data['evaluation_method'] = 'lowest_price'
                else:
                    validated_data['evaluation_method'] = 'lowest_price'

        # Fallback: auto-recommend method based on estimated value (no CPP available)
        if not validated_data.get('method'):
            est_value = validated_data.get('estimated_value')
            if est_value is None and requisition:
                est_value = requisition.estimated_total
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
                max_score=tc.get('max_score', 100),
                scoring_guidance=tc.get('scoring_guidance', ''),
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

        METHOD_TEMPLATE_MAP = {
            'open_tender': 'itb',
            'international': 'itb',
            'limited': 'itb',
            'simplified': 'rfq',
            'direct': 'rfq',
            'proposal': 'rfp',
        }
        lookup_method = METHOD_TEMPLATE_MAP.get(instance.method, instance.method)
        template = SolicitationTemplate.objects.filter(
            Q(method__iexact=lookup_method) | Q(method__iexact=instance.method),
            is_active=True,
        ).first()
        if template:
            from solicitations.pdf_generator import save_solicitation_pdf
            generated = save_solicitation_pdf(instance)
            if not generated:
                SolicitationDocument.objects.create(
                    solicitation=instance,
                    document_type=template.document_type or 'bidding_document',
                    file_path=template.template_name,
                )
        else:
            SolicitationDocument.objects.create(
                solicitation=instance,
                document_type='bidding_document',
                file_path=f"No template found for method: {instance.method}",
            )

        additional_documents = self.initial_data.get('additional_documents', [])
        for doc in additional_documents:
            SolicitationDocument.objects.create(
                solicitation=instance,
                document_type='other',
                file_path=doc.get('name', 'uploaded_document'),
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

        instance = super().update(instance, validated_data)

        technical_criteria = self.initial_data.get('technical_criteria')
        if technical_criteria is not None:
            instance.evaluation_criteria.filter(criterion_type='technical').delete()
            for i, tc in enumerate(technical_criteria):
                EvaluationCriterion.objects.create(
                    solicitation=instance,
                    criterion_name=tc.get('criterion_name', ''),
                    criterion_type='technical',
                    weight=tc.get('weight', 0),
                    max_score=tc.get('max_score', 100),
                    scoring_guidance=tc.get('scoring_guidance', ''),
                    order_index=i,
                )

        mandatory_criteria = self.initial_data.get('mandatory_criteria')
        if mandatory_criteria is not None:
            instance.evaluation_criteria.filter(criterion_type='mandatory').delete()
            tech_count = instance.evaluation_criteria.filter(criterion_type='technical').count()
            for i, mc in enumerate(mandatory_criteria):
                EvaluationCriterion.objects.create(
                    solicitation=instance,
                    criterion_name=mc.get('name', ''),
                    criterion_type='mandatory',
                    weight=0,
                    order_index=tech_count + i,
                )

        return instance
