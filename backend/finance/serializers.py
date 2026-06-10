import json
from rest_framework import serializers
from django.core.files.storage import default_storage
from django.db import connection
from django.utils import timezone
from .models import (
    BudgetAllocation, BudgetEncumbrance, DeliveryAdvice, GoodsReceiptNote, GRNLineItem,
    Invoice, InvoiceLineItem, PurchaseOrder, PurchaseOrderLineItem,
    ThreeWayMatch, Payment, LetterOfCredit, RetentionRelease,
)
from suppliers.models import Supplier


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


class PurchaseOrderLineItemSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='line_item_id', read_only=True)

    class Meta:
        model = PurchaseOrderLineItem
        fields = '__all__'
        read_only_fields = ('line_item_id',)


class PurchaseOrderSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='po_id', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    line_items = PurchaseOrderLineItemSerializer(many=True, read_only=True)

    class Meta:
        model = PurchaseOrder
        fields = '__all__'
        read_only_fields = ('po_id', 'created_at')


class DeliveryAdviceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='advice_id', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    official_grn_number = serializers.SerializerMethodField()

    class Meta:
        model = DeliveryAdvice
        fields = '__all__'
        read_only_fields = ('advice_id', 'submitted_at', 'verified_at')

    def get_official_grn_number(self, obj):
        grn = obj.official_grns.order_by('-received_date').first()
        return grn.grn_number if grn else ''


class GRNLineItemSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='line_item_id', read_only=True)

    class Meta:
        model = GRNLineItem
        fields = '__all__'
        read_only_fields = ('line_item_id',)


class GoodsReceiptNoteSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='grn_id', read_only=True)
    line_items = serializers.SerializerMethodField()

    class Meta:
        model = GoodsReceiptNote
        fields = '__all__'
        read_only_fields = ('grn_id', 'received_date')

    def get_line_items(self, obj):
        if 'fin_grn_line_item' not in connection.introspection.table_names():
            return []
        return GRNLineItemSerializer(obj.line_items.all(), many=True).data


class InvoiceLineItemSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='line_item_id', read_only=True)

    class Meta:
        model = InvoiceLineItem
        fields = '__all__'
        read_only_fields = ('line_item_id',)


class InvoiceLineItemWriteSerializer(serializers.Serializer):
    line_number = serializers.IntegerField()
    item_code = serializers.CharField(required=False, allow_blank=True)
    item_name = serializers.CharField(required=False, allow_blank=True)
    quantity = serializers.DecimalField(max_digits=15, decimal_places=2)
    unit_price = serializers.DecimalField(max_digits=20, decimal_places=2)
    total_amount = serializers.DecimalField(max_digits=20, decimal_places=2)
    grn_line_item_id = serializers.UUIDField(required=False, allow_null=True)


class ThreeWayMatchSerializer(serializers.ModelSerializer):
    class Meta:
        model = ThreeWayMatch
        fields = '__all__'


class PaymentSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='payment_id', read_only=True)
    payment_date = serializers.DateTimeField(source='processed_at', read_only=True, allow_null=True)
    invoice_number = serializers.CharField(source='invoice.invoice_number', read_only=True)

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
        fields = (
            'id', 'invoice_id', 'invoice_number', 'contract_number', 'supplier_name',
            'amount', 'original_amount', 'undelivered_amount', 'liquidated_damages_amount',
            'net_before_retention', 'retention_amount', 'net_payable_amount',
            'status', 'approval_route', 'due_date', 'paid_date', 'submitted_at',
            'approved_at', 'paid_at', 'created_at',
        )


class InvoiceSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='invoice_id', read_only=True)
    contract_number = serializers.CharField(source='contract.contract_number', read_only=True)
    contract_value = serializers.DecimalField(source='contract.value', max_digits=20, decimal_places=2, read_only=True)
    supplier_name = serializers.CharField(source='supplier.name', read_only=True)
    paid_date = serializers.DateTimeField(source='paid_at', read_only=True, allow_null=True)
    three_way_matches = ThreeWayMatchSerializer(many=True, read_only=True)
    payments = PaymentSerializer(many=True, read_only=True)
    grn_details = GoodsReceiptNoteSerializer(source='grn', read_only=True)
    line_items = InvoiceLineItemSerializer(many=True, read_only=True)
    suggested_approval_route = serializers.SerializerMethodField()
    po_details = serializers.SerializerMethodField()
    supplier_bank = serializers.SerializerMethodField()
    line_items_data = InvoiceLineItemWriteSerializer(many=True, required=False, write_only=True)
    
    # Allow blank invoice_number for auto-generation
    invoice_number = serializers.CharField(required=False, allow_blank=True)
    # Handle document as a file during upload
    document = serializers.FileField(required=False, allow_null=True)
    delivery_note = serializers.FileField(required=False, allow_null=True)
    zamra_certificate = serializers.FileField(required=False, allow_null=True)
    temperature_log = serializers.FileField(required=False, allow_null=True)
    
    # These are derived from contract but needed for model creation
    supplier = serializers.PrimaryKeyRelatedField(queryset=Supplier.objects.all(), required=False)
    po_number = serializers.CharField(required=False, allow_blank=True)

    def to_internal_value(self, data):
        if isinstance(data.get('line_items_data'), str):
            data = data.copy()
            data['line_items_data'] = json.loads(data['line_items_data'])
        return super().to_internal_value(data)

    class Meta:
        model = Invoice
        fields = '__all__'
        read_only_fields = ('invoice_id', 'created_at', 'updated_at', 'erp_posted_at', 'payment_advice_sent_at')
        extra_kwargs = {
            'amount': {'required': False},
            'original_amount': {'required': False},
        }

    def validate(self, attrs):
        contract = attrs.get('contract') or getattr(self.instance, 'contract', None)
        supplier = attrs.get('supplier') or getattr(self.instance, 'supplier', None)
        grn = attrs.get('grn') or getattr(self.instance, 'grn', None)
        line_items_data = attrs.pop('line_items_data', [])
        self._line_items_data = line_items_data

        if contract and supplier and contract.supplier_id != supplier.supplier_id:
            raise serializers.ValidationError('Invoice supplier must match the selected contract supplier.')
        if contract and not supplier:
            attrs['supplier'] = contract.supplier

        if contract and contract.status != 'active':
            raise serializers.ValidationError('Contract must be ACTIVE before submitting an invoice.')

        if grn:
            if Invoice.objects.filter(
                contract=contract, grn=grn,
                status__in=['submitted', 'pending_matching', 'finance_reviewed', 'pending_approval', 'approved', 'fully_approved', 'paid']
            ).exclude(pk=getattr(self.instance, 'invoice_id', None)).exists():
                raise serializers.ValidationError('An invoice has already been submitted for this GRN.')
            if grn.contract_id != contract.contract_id:
                raise serializers.ValidationError('GRN does not belong to the selected contract.')
            if grn.status not in ('complete', 'partial'):
                raise serializers.ValidationError('GRN must be COMPLETE or PARTIAL to invoice against.')

        if contract and contract.appeal_pending:
            raise serializers.ValidationError('Cannot invoice while an appeal or dispute is pending.')

        if line_items_data:
            total = Decimal('0')
            for item in line_items_data:
                total += item['total_amount']
            if 'amount' not in attrs or not attrs['amount']:
                attrs['amount'] = total
            if 'original_amount' not in attrs or not attrs['original_amount']:
                attrs['original_amount'] = total

        if not attrs.get('amount') and not line_items_data:
            raise serializers.ValidationError('Either amount or line_items_data is required.')

        # Auto-generate invoice number if not provided
        if not attrs.get('invoice_number'):
            today = timezone.now().strftime('%Y%m%d')
            count = Invoice.objects.filter(created_at__date=timezone.now().date()).count() + 1
            attrs['invoice_number'] = f'INV-{today}-{count:04d}'
            
        if contract and not attrs.get('po_number') and not getattr(self.instance, 'po_number', ''):
            po = PurchaseOrder.objects.filter(contract=contract, status='active').first()
            attrs['po_number'] = po.po_number if po else contract.contract_number
        return attrs

    def create(self, validated_data):
        document = validated_data.pop('document', None)
        delivery_note = validated_data.pop('delivery_note', None)
        zamra_certificate = validated_data.pop('zamra_certificate', None)
        temperature_log = validated_data.pop('temperature_log', None)
        
        line_items_data = getattr(self, '_line_items_data', [])
        invoice = Invoice.objects.create(**validated_data)
        
        for item in line_items_data:
            grn_line_item_id = item.pop('grn_line_item_id', None)
            grn_line_item = None
            if grn_line_item_id:
                try:
                    grn_line_item = GRNLineItem.objects.get(pk=grn_line_item_id)
                except (GRNLineItem.DoesNotExist, Exception):
                    pass
            InvoiceLineItem.objects.create(invoice=invoice, grn_line_item=grn_line_item, **item)
        
        # Save uploaded files
        update_fields = []
        if document and hasattr(document, 'name'):
            path = default_storage.save(f'invoices/{invoice.invoice_id}/{document.name}', document)
            invoice.document = default_storage.url(path)
            update_fields.append('document')
        elif document:
            invoice.document = str(document)
            update_fields.append('document')
            
        if delivery_note and hasattr(delivery_note, 'name'):
            path = default_storage.save(f'invoices/{invoice.invoice_id}/{delivery_note.name}', delivery_note)
            invoice.delivery_note = default_storage.url(path)
            update_fields.append('delivery_note')
        elif delivery_note:
            invoice.delivery_note = str(delivery_note)
            update_fields.append('delivery_note')
            
        if zamra_certificate and hasattr(zamra_certificate, 'name'):
            path = default_storage.save(f'invoices/{invoice.invoice_id}/{zamra_certificate.name}', zamra_certificate)
            invoice.zamra_certificate = default_storage.url(path)
            update_fields.append('zamra_certificate')
        elif zamra_certificate:
            invoice.zamra_certificate = str(zamra_certificate)
            update_fields.append('zamra_certificate')
            
        if temperature_log and hasattr(temperature_log, 'name'):
            path = default_storage.save(f'invoices/{invoice.invoice_id}/{temperature_log.name}', temperature_log)
            invoice.temperature_log = default_storage.url(path)
            update_fields.append('temperature_log')
        elif temperature_log:
            invoice.temperature_log = str(temperature_log)
            update_fields.append('temperature_log')
            
        if invoice.status == 'submitted' and not invoice.submitted_at:
            invoice.submitted_at = timezone.now()
            update_fields.append('submitted_at')
            
        if update_fields:
            invoice.save(update_fields=update_fields)
            
        return invoice

    def get_suggested_approval_route(self, obj):
        return obj.determine_approval_route()

    def get_po_details(self, obj):
        po = PurchaseOrder.objects.filter(contract=obj.contract, status='active').first()
        if po:
            return PurchaseOrderSerializer(po).data
        return None

    def get_supplier_bank(self, obj):
        supplier = obj.supplier or getattr(obj.contract, 'supplier', None)
        if not supplier:
            return None
        bank_number = supplier.bank_account_number
        masked = f'****{bank_number[-4:]}' if bank_number and len(bank_number) >= 4 else '****'
        return {
            'bank_name': supplier.bank_name,
            'bank_account_number': masked,
            'bank_account_name': supplier.bank_account_name,
        }


class LetterOfCreditSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='loc_id', read_only=True)

    class Meta:
        model = LetterOfCredit
        fields = '__all__'


class RetentionReleaseSerializer(serializers.ModelSerializer):
    id = serializers.UUIDField(source='release_id', read_only=True)
    released_by_name = serializers.CharField(source='released_by.full_name', read_only=True)

    class Meta:
        model = RetentionRelease
        fields = '__all__'
        read_only_fields = ('release_id', 'released_at')
