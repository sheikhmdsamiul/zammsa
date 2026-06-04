from rest_framework import serializers
from .models import Contract, ContractSecurity, ContractAmendment, ContractMilestone, LiquidatedDamages, ContractTermination, Appeal, ClosureChecklist


class ContractSecuritySerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractSecurity
        fields = '__all__'


class ContractAmendmentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='amendment_id', read_only=True)
    value_change = serializers.DecimalField(source='financial_impact', max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = ContractAmendment
        fields = '__all__'
        read_only_fields = ('amendment_id', 'amendment_number', 'created_at')


class ContractMilestoneSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='milestone_id', read_only=True)
    title = serializers.CharField(source='milestone_name', read_only=True)

    class Meta:
        model = ContractMilestone
        fields = '__all__'


class LiquidatedDamagesSerializer(serializers.ModelSerializer):
    class Meta:
        model = LiquidatedDamages
        fields = '__all__'


class ContractTerminationSerializer(serializers.ModelSerializer):
    class Meta:
        model = ContractTermination
        fields = '__all__'


class AppealSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='appeal_id', read_only=True)
    bidder_name = serializers.CharField(source='bidder.full_name', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    contract_title = serializers.CharField(source='contract.title', read_only=True)

    class Meta:
        model = Appeal
        fields = '__all__'
        read_only_fields = ('appeal_id', 'filed_at', 'resolved_at')


class ClosureChecklistSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='checklist_id', read_only=True)
    is_complete = serializers.SerializerMethodField()

    class Meta:
        model = ClosureChecklist
        fields = '__all__'
        read_only_fields = ('checklist_id', 'completed_at')

    def get_is_complete(self, obj):
        return obj.is_complete()


class ContractListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='contract_id', read_only=True)
    title = serializers.CharField(read_only=True)
    vendor_name = serializers.CharField(source='supplier.name', read_only=True)
    vendor = serializers.CharField(source='supplier.name', read_only=True)
    solicitation_number = serializers.CharField(source='solicitation.sol_number', read_only=True)
    performance_bond = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = ('id', 'contract_id', 'contract_number', 'title', 'vendor_name', 'vendor', 'contract_type', 'value', 'currency', 'start_date', 'end_date', 'status', 'award_date', 'created_at', 'solicitation_number', 'vendor', 'performance_security_required', 'performance_security_uploaded', 'performance_security_validated', 'performance_bond')

    def get_performance_bond(self, obj):
        perf_securities = [s for s in obj.securities.all() if s.security_type == 'performance']
        if perf_securities:
            s = perf_securities[0]
            return {
                'amount': str(s.amount),
                'expiry_date': s.expiry_date.isoformat() if s.expiry_date else None,
                'status': s.status,
                'issuing_bank': s.issuing_bank,
                'reference_number': s.reference_number,
            }
        return None


class ContractSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='contract_id', read_only=True)
    vendor_name = serializers.CharField(source='supplier.name', read_only=True)
    vendor = serializers.SerializerMethodField()
    securities = ContractSecuritySerializer(many=True, read_only=True)
    amendments = ContractAmendmentSerializer(many=True, read_only=True)
    milestones = ContractMilestoneSerializer(many=True, read_only=True)
    appeals = AppealSerializer(many=True, read_only=True)
    closure_checklists = ClosureChecklistSerializer(many=True, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    requires_performance_bond = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ('contract_id', 'created_at', 'updated_at')

    def get_vendor(self, obj):
        return str(obj.supplier.supplier_id) if obj.supplier else None

    def get_requires_performance_bond(self, obj):
        return obj.requires_performance_bond()

    def create(self, validated_data):
        title = self.initial_data.get('title')
        if title and 'title' not in validated_data:
            validated_data['title'] = title
        currency = self.initial_data.get('currency')
        if currency and 'currency' not in validated_data:
            validated_data['currency'] = currency
        return super().create(validated_data)
