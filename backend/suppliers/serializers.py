from rest_framework import serializers
from .models import Supplier, VendorApplication, VendorApplicationDocument, SupplierDocument, SupplierPerformance, SupplierRiskScore, Blacklist


class SupplierDocumentSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierDocument
        fields = '__all__'


class SupplierPerformanceSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierPerformance
        fields = '__all__'
        read_only_fields = ('performance_id', 'needs_improvement')


class SupplierRiskScoreSerializer(serializers.ModelSerializer):
    class Meta:
        model = SupplierRiskScore
        fields = '__all__'


class SupplierListSerializer(serializers.ModelSerializer):
    class Meta:
        model = Supplier
        fields = ('supplier_id', 'registration_number', 'tin', 'name', 'ceec_category', 'status', 'risk_level', 'registered_at')


class SupplierSerializer(serializers.ModelSerializer):
    documents = SupplierDocumentSerializer(many=True, read_only=True)
    performances = SupplierPerformanceSerializer(many=True, read_only=True)

    class Meta:
        model = Supplier
        fields = '__all__'
        read_only_fields = ('supplier_id', 'registered_at', 'updated_at')


class VendorApplicationDocumentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='document_id', read_only=True)
    type = serializers.CharField(source='document_type', read_only=True)
    file = serializers.CharField(source='file_path', read_only=True)
    filename = serializers.SerializerMethodField()

    class Meta:
        model = VendorApplicationDocument
        fields = ('id', 'type', 'file', 'filename', 'file_path', 'document_type', 'uploaded_at')
        read_only_fields = ('document_id', 'uploaded_at')

    def get_filename(self, obj):
        return obj.file_path.split('/')[-1] if obj.file_path else ''


class VendorApplicationSerializer(serializers.ModelSerializer):
    documents = VendorApplicationDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = VendorApplication
        fields = '__all__'
        read_only_fields = ('application_id', 'submitted_at', 'created_at', 'updated_at', 'pacra_validated', 'ceec_validated')

    def to_internal_value(self, data):
        # Support JSON strings for JSONFields when using multipart/form-data
        if 'commodity_categories' in data and isinstance(data['commodity_categories'], str):
            import json
            try:
                data = data.copy()
                data['commodity_categories'] = json.loads(data['commodity_categories'])
            except (json.JSONDecodeError, TypeError):
                pass
        return super().to_internal_value(data)


class VendorApplicationListSerializer(serializers.ModelSerializer):
    documents = VendorApplicationDocumentSerializer(many=True, read_only=True)

    class Meta:
        model = VendorApplication
        fields = ('application_id', 'company_name', 'registration_number', 'ceec_category', 'status', 'submitted_at', 'email', 'contact_person', 'documents')


class BlacklistSerializer(serializers.ModelSerializer):
    class Meta:
        model = Blacklist
        fields = '__all__'
