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
    planned_date = serializers.DateField(required=False, allow_null=True)
    actual_date = serializers.DateField(required=False, allow_null=True)
    variance_days = serializers.IntegerField(read_only=True)
    variance_flag = serializers.CharField(read_only=True)
    source_procurement_milestone = serializers.UUIDField(required=False, allow_null=True)

    class Meta:
        model = ContractMilestone
        fields = (
            'id', 'contract', 'sequence_number', 'milestone_name', 'planned_date', 
            'due_date', 'actual_date', 'completed_at', 'variance_days', 'variance_flag',
            'source_procurement_milestone', 'status', 'notes', 'created_at', 'updated_at'
        )
        read_only_fields = ('milestone_id', 'variance_days', 'variance_flag', 'created_at', 'updated_at')


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
    operational_phases = serializers.SerializerMethodField()

    class Meta:
        model = Contract
        fields = '__all__'
        read_only_fields = ('contract_id', 'created_at', 'updated_at')

    def get_vendor(self, obj):
        return str(obj.supplier.supplier_id) if obj.supplier else None

    def get_requires_performance_bond(self, obj):
        return obj.requires_performance_bond()

    def get_operational_phases(self, obj):
        invoices = list(getattr(obj, 'invoices').all())
        goods_receipts = list(getattr(obj, 'goods_receipt_notes').all())
        payments = list(getattr(obj, 'payments').all())
        retention_releases = list(getattr(obj, 'retention_releases').all())
        supplier_performances = list(getattr(obj, 'supplier_performances').all())
        closure_manager = getattr(obj, 'closure_checklists')
        closure_checklists = list(
            closure_manager.order_by('-completed_at', '-checklist_id')
            if hasattr(closure_manager, 'order_by')
            else closure_manager.all()
        )
        latest_closure = closure_checklists[0] if closure_checklists else None

        active_or_beyond = obj.status in ('active', 'completed', 'terminated', 'closed', 'archived')
        archived = bool(obj.archived_at)
        has_grn = bool(goods_receipts)
        has_invoice = bool(invoices)
        invoice_reviewed = any(inv.status in ('pending_matching', 'pending_approval', 'approved', 'paid') for inv in invoices)
        invoice_approved = any(inv.status in ('pending_approval', 'approved', 'paid') for inv in invoices)
        invoice_paid = any(inv.status == 'paid' for inv in invoices)
        payment_started = any(pay.status in ('processing', 'sent', 'confirmed') for pay in payments)
        payment_complete = any(pay.status == 'confirmed' for pay in payments) or invoice_paid
        retention_complete = bool(retention_releases) or any(getattr(pay, 'retention_released', False) for pay in payments)
        performance_complete = bool(supplier_performances)
        closure_complete = bool(
            latest_closure and (
                getattr(latest_closure, 'status', '') == 'completed' or getattr(latest_closure, 'is_complete', lambda: False)()
            )
        ) or obj.status in ('completed', 'closed', 'archived')

        def phase(code, label, role, state, evidence, detail, path=None):
            return {
                'code': code,
                'label': label,
                'role': role,
                'state': state,
                'evidence': evidence,
                'detail': detail,
                'path': path,
            }

        return [
            phase(
                'A',
                'Contract Execution & Monitoring',
                'R-12',
                'complete' if active_or_beyond else 'current' if obj.status in ('draft', 'pending_acceptance') else 'upcoming',
                'Contract is active or ready for execution monitoring' if active_or_beyond else 'Execution plan is being prepared',
                'R-12 tracks delivery, deviations, communications, and milestone follow-up during execution.',
                f'/contracts/{obj.contract_id}/execution',
            ),
            phase(
                'B',
                'Delivery & Goods Receipt',
                'WMS + R-12',
                'complete' if has_grn else 'current' if active_or_beyond else 'upcoming',
                f'{len(goods_receipts)} goods receipt note(s)',
                'Warehouse and contract management confirm delivery against the contract.',
                f'/contracts/{obj.contract_id}/delivery',
            ),
            phase(
                'C',
                'Invoice Submission',
                'R-11',
                'complete' if has_invoice else 'current' if has_grn and active_or_beyond else 'upcoming',
                f'{len(invoices)} invoice(s) on file',
                'Supplier submits invoices after accepted delivery milestones.',
                f'/finance/invoices?contract={obj.contract_id}',
            ),
            phase(
                'D',
                '3-Way Match & Finance Review',
                'R-07',
                'complete' if invoice_reviewed else 'current' if has_invoice and active_or_beyond else 'upcoming',
                f'{len(invoices)} invoice(s) reviewed for matching',
                'Finance compares PO, GRN, and invoice values before approval.',
                f'/finance/matching?contract={obj.contract_id}',
            ),
            phase(
                'E',
                'Payment Approval Chain',
                'R-07, R-02, R-10',
                'complete' if invoice_approved else 'current' if invoice_reviewed and active_or_beyond else 'upcoming',
                f'{len(payments)} payment record(s) linked' if payment_started else 'Awaiting payment initiation',
                'Approval follows the internal payment chain before release to bank.',
                f'/finance/payments?contract={obj.contract_id}',
            ),
            phase(
                'F',
                'Payment Processing',
                'R-07 + Bank',
                'complete' if payment_complete else 'current' if invoice_approved and active_or_beyond else 'upcoming',
                f'{len([p for p in payments if p.status in ("processing", "sent", "confirmed")])} processed payment(s)',
                'Payments are transmitted through the bank and confirmed in finance.',
                f'/finance/payments?contract={obj.contract_id}',
            ),
            phase(
                'G',
                'Retention Management',
                'R-12',
                'complete' if retention_complete else 'current' if payment_complete and active_or_beyond else 'upcoming',
                'Retention release or withholding recorded' if retention_complete else 'Retention still held',
                'Retention is monitored until the contractual release conditions are met.',
                f'/finance/retention',
            ),
            phase(
                'H',
                'Supplier Performance Evaluation',
                'R-12',
                'complete' if performance_complete else 'current' if active_or_beyond else 'upcoming',
                f'{len(supplier_performances)} evaluation(s) recorded',
                'Contract management captures supplier performance against delivery outcomes.',
                f'/contracts/{obj.contract_id}/supplier-performance',
            ),
            phase(
                'I',
                'Contract Closure',
                'R-12',
                'complete' if closure_complete else 'current' if active_or_beyond and performance_complete else 'upcoming',
                f'{len(closure_checklists)} closure checklist(s)',
                'Closure checklist confirms all obligations, disputes, and documents are settled.',
                f'/contracts/{obj.contract_id}/closure',
            ),
            phase(
                'J',
                'Archiving',
                'System automated',
                'complete' if archived else 'current' if obj.status == 'closed' else 'upcoming',
                'Encrypted archive package created' if archived else 'Awaiting archive trigger',
                'Records management applies the retention policy and archives the contract package.',
                f'/contracts/{obj.contract_id}/archive',
            ),
        ]

    def to_internal_value(self, data):
        from suppliers.models import Supplier, VendorApplication
        from accounts.models import User
        
        supplier_val = data.get('supplier')
        if supplier_val:
            try:
                if not Supplier.objects.filter(pk=supplier_val).exists():
                    user = User.objects.filter(pk=supplier_val).first()
                    if user and user.role == 'supplier_user':
                        reg_no = user.employee_id.replace('SUP-', '', 1)
                        supplier = Supplier.objects.filter(registration_number=reg_no).first()
                        if not supplier:
                            app = VendorApplication.objects.filter(email=user.email).first()
                            supplier = Supplier.objects.create(
                                registration_number=reg_no,
                                tin=app.tin if app else f"TIN-{reg_no}",
                                name=user.full_name,
                                ceec_category=app.ceec_category if app else 'non_citizen',
                                status='active'
                            )
                        if hasattr(data, '_mutable'):
                            data = data.copy()
                        else:
                            data = dict(data)
                        data['supplier'] = str(supplier.supplier_id)
            except Exception:
                pass
        return super().to_internal_value(data)

    def create(self, validated_data):
        title = self.initial_data.get('title')
        if title and 'title' not in validated_data:
            validated_data['title'] = title
        currency = self.initial_data.get('currency')
        if currency and 'currency' not in validated_data:
            validated_data['currency'] = currency
        return super().create(validated_data)
