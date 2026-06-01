from rest_framework import serializers
from django.core.files.storage import default_storage
from django.utils import timezone
from .models import BudgetAllocation, BudgetEncumbrance, GoodsReceiptNote, Invoice, ThreeWayMatch, Payment, LetterOfCredit


class BudgetAllocationSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='allocation_id', read_only=True)
    budget_code = serializers.CharField(source='entity_code', read_only=True)
    spent_amount = serializers.DecimalField(source='expended_amount', max_digits=20, decimal_places=2, read_only=True)
    remaining_amount = serializers.DecimalField(source='available', max_digits=20, decimal_places=2, read_only=True)
    available = serializers.DecimalField(max_digits=20, decimal_places=2, read_only=True)

    class Meta:
        model = BudgetAllocation
        fields = '__all__'


class BudgetEncumbranceSerializer(serializers.ModelSerializer):
    class Meta:
        model = BudgetEncumbrance
        fields = '__all__'


class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='grn_id', read_only=True)

    class Meta:
        model = GoodsReceiptNote
        fields = '__all__'
        read_only_fields = ('grn_id', 'received_date')


class ThreeWayMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThreeWayMatch
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='payment_id', read_only=True)
    payment_date = serializers.DateTimeField(source='processed_at', read_only=True, allow_null=True)

    class Meta:
        model = Payment
        fields = '__all__'
        read_only_fields = ('payment_id', 'created_at')


class InvoiceListSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='invoice_id', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    paid_date = serializers.DateTimeField(source='paid_at', read_only=True, allow_null=True)

    class Meta:
        model = Invoice
        fields = ('id', 'invoice_id', 'invoice_number', 'contract_number', 'supplier_name', 'amount', 'status', 'approval_route', 'due_date', 'paid_date', 'submitted_at', 'approved_at', 'paid_at', 'created_at')


class InvoiceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='invoice_id', read_only=True)
    paid_date = serializers.DateTimeField(source='paid_at', read_only=True, allow_null=True)
    three_way_matches = ThreeWayMatchSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    grn_details = GoodsReceiptNoteSerializer(source='grn', read_only=True)
    suggested_approval_route = serializers.SerializerMethodField()

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ('invoice_id', 'created_at', 'updated_at', 'erp_posted_at', 'payment_advice_sent_at')

    def validate(self, attrs):
        contract = attrs.get('contract') or getattr(self.instance, 'contract', None)
        supplier = attrs.get('supplier') or getattr(self.instance, 'supplier', None)
        if contract and supplier and contract.supplier_id != supplier.supplier_id:
            raise serializers.ValidationError('Invoice supplier must match the selected contract supplier.')
        if contract and not supplier:
            attrs['supplier'] = contract.supplier
        if not attrs.get('invoice_number') and not getattr(self.instance, 'invoice_number', ''):
            today = timezone.now().strftime('%Y%m%d')
            attrs['invoice_number'] = f'INV-{today}-{Invoice.objects.count() + 1:05d}'
        if contract and not attrs.get('po_number') and not getattr(self.instance, 'po_number', ''):
            attrs['po_number'] = contract.contract_number
        return attrs

    def create(self, validated_data):
        document = validated_data.get('document')
        invoice = Invoice(**{k: v for k, v in validated_data.items() if k != 'document'})
        if hasattr(document, 'name'):
            invoice.document = default_storage.save(f'invoices/{document.name}', document)
        elif document:
            invoice.document = str(document)
        invoice.status = validated_data.get('status') or 'submitted'
        if invoice.status == 'submitted' and not invoice.submitted_at:
            invoice.submitted_at = timezone.now()
        invoice.save()
        return invoice

    def get_suggested_approval_route(self, obj):
        return obj.determine_approval_route()


class LetterOfCreditSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='loc_id', read_only=True)

    class Meta:
        model = LetterOfCredit
        fields = '__all__'
