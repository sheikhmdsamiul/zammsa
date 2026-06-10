from rest_framework import serializers
from django.db import models as db_models
from .models import Requisition, RequisitionItem, Specification, RequisitionApproval, RequisitionVersion, BudgetEncumbrance


class RequisitionItemSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='item_id', read_only=True)
    unit = serializers.CharField(source='unit_of_measure.uom_name', read_only=True, allow_null=True)
    estimated_unit_cost = serializers.DecimalField(source='unit_price_estimate', max_digits=15, decimal_places=2, read_only=True)
    uom_name = serializers.CharField(source='unit_of_measure.uom_name', read_only=True, allow_null=True)

    class Meta:
        model = RequisitionItem
        fields = ('id', 'item_id', 'requisition', 'item_code', 'description', 'quantity', 'unit', 'unit_of_measure', 'uom_name', 'estimated_unit_cost', 'unit_price_estimate', 'total_estimate')
        read_only_fields = ('item_id', 'total_estimate')


class SpecificationSerializer(serializers.ModelSerializer):
    class Meta:
        model = Specification
        fields = '__all__'


class RequisitionApprovalSerializer(serializers.ModelSerializer):
    approver_name = serializers.CharField(source='approver.full_name', read_only=True)

    class Meta:
        model = RequisitionApproval
        fields = '__all__'
        read_only_fields = ('approval_id', 'created_at')


class RequisitionVersionSerializer(serializers.ModelSerializer):
    class Meta:
        model = RequisitionVersion
        fields = '__all__'
        read_only_fields = ('version_id', 'created_at')


class RequisitionListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='requisition_id', read_only=True)
    title = serializers.CharField(source='description', read_only=True)
    department = serializers.CharField(source='department.dept_name', read_only=True)
    requester_name = serializers.CharField(source='requester.full_name', read_only=True)
    department_name = serializers.CharField(source='department.dept_name', read_only=True)
    cpp_number = serializers.SerializerMethodField()
    recommended_method = serializers.SerializerMethodField()
    procurement_type = serializers.SerializerMethodField()
    commodity_category = serializers.SerializerMethodField()

    class Meta:
        model = Requisition
        fields = ('id', 'requisition_id', 'req_number', 'title', 'department', 'department_name', 'requester_name', 'estimated_total', 'required_date', 'status', 'current_approver', 'submitted_at', 'approved_at', 'created_at', 'days_at_current_stage', 'app_line_item', 'cpp_number', 'recommended_method', 'procurement_type', 'commodity_category')

    def get_cpp_number(self, obj):
        cpp = obj.cpp.filter(status='approved').first()
        return cpp.cpp_number if cpp else None

    def get_recommended_method(self, obj):
        cpp = obj.cpp.filter(status='approved').first()
        return cpp.recommended_method or cpp.method if cpp else None

    def get_procurement_type(self, obj):
        if obj.app_line_item:
            return obj.app_line_item.procurement_type
        return None

    def get_commodity_category(self, obj):
        if obj.app_line_item and obj.app_line_item.commodity:
            return obj.app_line_item.commodity.category
        return None


class RequisitionSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='requisition_id', read_only=True)
    title = serializers.CharField(source='description', required=False)
    description = serializers.CharField(read_only=True)
    department = serializers.CharField(source='department.dept_name', read_only=True)
    department_name = serializers.CharField(source='department.dept_name', read_only=True)
    created_by = serializers.CharField(source='requester.full_name', read_only=True)
    estimated_value = serializers.DecimalField(source='estimated_total', max_digits=15, decimal_places=2, required=False)
    date_required = serializers.DateField(source='required_date', required=False)
    delivery_location = serializers.CharField(read_only=True)
    app_line_item_id = serializers.UUIDField(source='app_line_item.line_item_id', read_only=True, allow_null=True)
    app_line_item_ref = serializers.CharField(source='app_line_item.description', read_only=True, allow_null=True)
    items = RequisitionItemSerializer(many=True, read_only=True)
    approvals = RequisitionApprovalSerializer(many=True, read_only=True)
    requester_name = serializers.CharField(source='requester.full_name', read_only=True)

    def validate(self, data):
        if self.instance is None and not data.get('app_line_item'):
            raise serializers.ValidationError({'app_line_item': 'APP line item is required on create.'})

        app_line_item = data.get('app_line_item')
        department = data.get('department')
        if app_line_item and department:
            app_department = app_line_item.app.department
            if app_department.pk != department.pk:
                raise serializers.ValidationError(
                    f'Department mismatch: requisition is for "{department}" but the APP line item belongs to "{app_department}".'
                )

        # BR-CPP-02: Requisition can only reference APP line items from an approved/published APP
        if app_line_item and self.instance is None:
            app = app_line_item.app
            if app.status not in ('approved', 'published'):
                raise serializers.ValidationError({
                    'app_line_item': f'Cannot create requisition from APP line item "{app_line_item.description}" — '
                    f'the Annual Procurement Plan (APP) is currently "{app.status}". '
                    'Only approved or published APPs can be used to create requisitions.'
                })

        return data

    class Meta:
        model = Requisition
        fields = ('id', 'requisition_id', 'title', 'description', 'req_number', 'department', 'department_name', 'requester_name', 'created_by', 'estimated_value', 'estimated_total', 'date_required', 'delivery_location', 'app_line_item', 'app_line_item_id', 'app_line_item_ref', 'status', 'budget_validated', 'encumbrance_ref', 'submitted_at', 'approved_at', 'created_at', 'updated_at', 'current_approver', 'items', 'approvals')
        read_only_fields = ('requisition_id', 'req_number', 'submitted_at', 'approved_at', 'created_at', 'updated_at', 'days_at_current_stage')

    def create(self, validated_data):
        from master_data.models import Department, UnitOfMeasure
        from .models import RequisitionItem
        department_value = self.initial_data.get('department')
        if department_value:
            dept = Department.objects.filter(pk=department_value).first()
            if dept:
                validated_data['department'] = dept
            else:
                dept = Department.objects.filter(dept_name=department_value).first()
                if dept:
                    validated_data['department'] = dept
        validated_data['requester'] = self.context['request'].user
        if 'delivery_location' not in validated_data:
            validated_data['delivery_location'] = ''
        req = super().create(validated_data)
        items_data = self.initial_data.get('items', [])
        for item in items_data:
            unit_of_measure = None
            unit_name = item.get('unit', '')
            if unit_name:
                unit_of_measure = UnitOfMeasure.objects.filter(uom_name__iexact=unit_name).first()
            RequisitionItem.objects.create(
                requisition=req,
                item_code=item.get('item_code', ''),
                description=item.get('description', ''),
                quantity=item.get('quantity', 1),
                unit_of_measure=unit_of_measure,
                unit_price_estimate=item.get('estimated_unit_cost', 0),
            )
        req.refresh_from_db()
        item_total = req.items.aggregate(total=db_models.Sum('total_estimate'))['total'] or 0
        if item_total:
            req.estimated_total = item_total
            req.save(update_fields=['estimated_total'])
        return req

    def update(self, instance, validated_data):
        from master_data.models import Department, UnitOfMeasure
        from .models import RequisitionItem
        department_value = self.initial_data.get('department')
        if department_value:
            dept = Department.objects.filter(pk=department_value).first()
            if dept:
                validated_data['department'] = dept
            else:
                dept = Department.objects.filter(dept_name=department_value).first()
                if dept:
                    validated_data['department'] = dept
        instance = super().update(instance, validated_data)
        items_data = self.initial_data.get('items')
        if items_data is not None:
            instance.items.all().delete()
            for item in items_data:
                unit_of_measure = None
                unit_name = item.get('unit', '')
                if unit_name:
                    unit_of_measure = UnitOfMeasure.objects.filter(uom_name__iexact=unit_name).first()
                RequisitionItem.objects.create(
                    requisition=instance,
                    item_code=item.get('item_code', ''),
                    description=item.get('description', ''),
                    quantity=item.get('quantity', 1),
                    unit_of_measure=unit_of_measure,
                    unit_price_estimate=item.get('estimated_unit_cost', 0),
                )
        instance.refresh_from_db()
        item_total = instance.items.aggregate(total=db_models.Sum('total_estimate'))['total'] or 0
        if item_total:
            instance.estimated_total = item_total
            instance.save(update_fields=['estimated_total'])
        return instance


class BudgetEncumbranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetEncumbrance
        fields = '__all__'
        read_only_fields = ('encumbrance_id', 'created_at')


class RequisitionTrackingSerializer(serializers.Serializer):
    requisition_id = serializers.UUIDField()
    req_number = serializers.CharField()
    status = serializers.CharField()
    days_at_stage = serializers.IntegerField()
    current_approver = serializers.CharField(allow_null=True)
    approval_history = serializers.ListField()
