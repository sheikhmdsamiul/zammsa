from decimal import Decimal
from django.test import TestCase
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase
from accounts.models import User
from master_data.models import Department
from requisitions.models import Requisition
from solicitations.models import Solicitation
from bids.models import BidSubmission
from evaluations.models import BidEvaluationReport, EvaluationCommittee
from suppliers.models import Supplier
from contracts.models import Contract
from .models import BudgetAllocation, BudgetEncumbrance, GoodsReceiptNote, Invoice, Payment, LetterOfCredit


class BudgetAllocationTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='FIN001',
            full_name='Finance User',
            email='finance@test.gov.zm',
            password='testpass123',
            role='finance_officer',
        )
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse('budget-allocation-list')

    def test_create_budget_allocation(self):
        data = {
            'entity_level': 'department',
            'entity_code': 'DEPT-A',
            'entity_name': 'Department A',
            'fiscal_year': '2026',
            'allocated_amount': '1000000.00',
        }
        response = self.client.post(self.list_url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(BudgetAllocation.objects.count(), 1)
        ba = BudgetAllocation.objects.first()
        self.assertEqual(ba.entity_code, 'DEPT-A')
        self.assertEqual(ba.available, Decimal('1000000.00'))

    def test_list_budget_allocations(self):
        BudgetAllocation.objects.create(
            entity_level='department', entity_code='DEPT-A',
            entity_name='Dept A', fiscal_year='2026',
            allocated_amount=500000,
        )
        BudgetAllocation.objects.create(
            entity_level='department', entity_code='DEPT-B',
            entity_name='Dept B', fiscal_year='2026',
            allocated_amount=300000,
        )
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 2)

    def test_budget_allocation_detail(self):
        ba = BudgetAllocation.objects.create(
            entity_level='department', entity_code='DEPT-A',
            entity_name='Dept A', fiscal_year='2026',
            allocated_amount=500000,
        )
        url = reverse('budget-allocation-detail', args=[ba.allocation_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['entity_code'], 'DEPT-A')

    def test_budget_summary(self):
        BudgetAllocation.objects.create(
            entity_level='department', entity_code='DEPT-A',
            entity_name='Dept A', fiscal_year='2026',
            allocated_amount=1000000, encumbered_amount=200000, expended_amount=100000,
        )
        url = reverse('budget-summary')
        response = self.client.get(url, {'fiscal_year': '2026'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(float(response.data['total_allocated']), 1000000.0)
        self.assertEqual(float(response.data['total_encumbered']), 200000.0)
        self.assertEqual(float(response.data['total_expended']), 100000.0)
        self.assertEqual(response.data['allocation_count'], 1)

    def test_budget_sync_from_erp(self):
        url = reverse('budget-sync-erp')
        data = {
            'allocations': [
                {
                    'entity_code': 'ERP-001',
                    'fiscal_year': '2026',
                    'allocated_amount': 500000,
                    'entity_level': 'department',
                    'entity_name': 'ERP Dept',
                }
            ]
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(BudgetAllocation.objects.count(), 1)

    def test_budget_sync_non_finance_user_blocked(self):
        other = User.objects.create_user(
            employee_id='OTHER', full_name='Other',
            email='other@test.gov.zm', password='testpass123',
            role='department_head',
        )
        self.client.force_authenticate(user=other)
        url = reverse('budget-sync-erp')
        response = self.client.post(url, {'allocations': []}, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)


class GoodsReceiptNoteWebhookTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='WH001', full_name='Warehouse',
            email='wh@test.gov.zm', password='testpass123',
            role='procurement_officer',
        )
        self.client.force_authenticate(user=self.user)
        self.url = reverse('grn-webhook')

    def _create_contract(self):
        dept = Department.objects.create(dept_code='TEST', dept_name='Test', level='national')
        req = Requisition.objects.create(
            req_number='REQ-TEST', department=dept,
            requester=self.user, description='Test', required_date='2026-06-01',
        )
        sol = Solicitation.objects.create(
            sol_number='SOL-TEST', title='Test', description='Test', method='rfq',
            requisition=req, closing_date=timezone.now(),
        )
        committee = EvaluationCommittee.objects.create(
            solicitation=sol, chairperson=self.user, secretary=self.user,
        )
        bid = BidSubmission.objects.create(
            submission_id='BID-TEST', solicitation=sol, supplier=self.user,
        )
        ber = BidEvaluationReport.objects.create(
            solicitation=sol, report_content={}, created_by=self.user,
        )
        supplier = Supplier.objects.create(
            registration_number='SUP-TEST', tin='TIN-TEST', name='Test Supplier',
        )
        contract = Contract.objects.create(
            contract_number='CTR-TEST', solicitation=sol, winning_bid=bid,
            ber=ber, supplier=supplier, title='Test Contract',
            contract_type='po', value=100000, start_date='2026-01-01',
            end_date='2026-12-31',
        )
        return contract

    def test_grn_webhook_create(self):
        response = self.client.post(self.url, {
            'grn_number': 'GRN-001',
            'po_number': 'PO-001',
            'quantity_received': 100,
            'unit_price': 50,
            'item_description': 'Test Item',
            'received_by': 'John',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertTrue(response.data['created'])
        self.assertEqual(GoodsReceiptNote.objects.count(), 1)

    def test_grn_webhook_update_existing(self):
        contract = self._create_contract()
        GoodsReceiptNote.objects.create(
            contract=contract, grn_number='GRN-001', po_number='PO-001',
            quantity_received=50, unit_price=25, total_amount=1250,
        )
        response = self.client.post(self.url, {
            'grn_number': 'GRN-001',
            'po_number': 'PO-001',
            'quantity_received': 100,
            'unit_price': 50,
            'item_description': 'Updated Item',
            'received_by': 'Jane',
            'contract_id': str(contract.contract_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertFalse(response.data['created'])
        grn = GoodsReceiptNote.objects.get(grn_number='GRN-001')
        self.assertEqual(grn.quantity_received, 100)

    def test_grn_webhook_missing_required_fields(self):
        response = self.client.post(self.url, {
            'grn_number': '',
            'po_number': '',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_grn_webhook_with_contract(self):
        contract = self._create_contract()
        response = self.client.post(self.url, {
            'grn_number': 'GRN-002',
            'po_number': 'PO-002',
            'quantity_received': 10,
            'unit_price': 1000,
            'contract_id': str(contract.contract_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        grn = GoodsReceiptNote.objects.get(grn_number='GRN-002')
        self.assertEqual(grn.contract.contract_number, 'CTR-TEST')


class InvoiceWorkflowTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.finance_officer = User.objects.create_user(
            employee_id='FINOFF', full_name='Finance Officer',
            email='finoff@test.gov.zm', password='testpass123',
            role='finance_officer',
        )
        cls.dept_head = User.objects.create_user(
            employee_id='DEPTHEAD', full_name='Dept Head',
            email='depthead@test.gov.zm', password='testpass123',
            role='department_head',
        )
        cls.dir_gen = User.objects.create_user(
            employee_id='DIRGEN', full_name='Director General',
            email='dirgen@test.gov.zm', password='testpass123',
            role='director_general',
        )
        dept = Department.objects.create(dept_code='FIN', dept_name='Finance', level='national')
        req = Requisition.objects.create(
            req_number='REQ-INV', department=dept,
            requester=cls.finance_officer, description='Test', required_date='2026-06-01',
        )
        sol = Solicitation.objects.create(
            sol_number='SOL-INV', title='Test', description='Test', method='rfq',
            requisition=req, closing_date=timezone.now(),
        )
        committee = EvaluationCommittee.objects.create(
            solicitation=sol, chairperson=cls.finance_officer, secretary=cls.finance_officer,
        )
        cls.bid = BidSubmission.objects.create(
            submission_id='BID-INV', solicitation=sol, supplier=cls.finance_officer,
        )
        ber = BidEvaluationReport.objects.create(
            solicitation=sol, report_content={}, created_by=cls.finance_officer,
        )
        cls.supplier = Supplier.objects.create(
            registration_number='SUP-INV', tin='TIN-INV', name='Invoice Supplier',
        )
        cls.contract = Contract.objects.create(
            contract_number='CTR-INV', solicitation=sol, winning_bid=cls.bid,
            ber=ber, supplier=cls.supplier, title='Test Contract',
            contract_type='po', value=500000, start_date='2026-01-01',
            end_date='2026-12-31',
        )

    def setUp(self):
        self.client.force_authenticate(user=self.finance_officer)
        self.list_url = reverse('invoice-list')

    def _create_invoice(self, amount=50000, status='draft'):
        inv = Invoice.objects.create(
            contract=self.contract,
            po_number='PO-INV',
            supplier=self.supplier,
            invoice_number='INV-001',
            amount=amount,
            status=status,
        )
        return inv

    def test_create_invoice(self):
        response = self.client.post(self.list_url, {
            'contract': str(self.contract.contract_id),
            'po_number': 'PO-001',
            'supplier': str(self.supplier.supplier_id),
            'invoice_number': 'INV-NEW',
            'amount': 75000,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(Invoice.objects.count(), 1)

    def test_list_invoices(self):
        self._create_invoice()
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_submit_invoice(self):
        inv = self._create_invoice()
        url = reverse('invoice-submit', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'submitted')

    def test_submit_invoice_not_found(self):
        url = reverse('invoice-submit', args=['00000000-0000-0000-0000-000000000000'])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_match_invoice_complete(self):
        inv = self._create_invoice()
        url = reverse('invoice-match', args=[inv.invoice_id])
        response = self.client.post(url, {
            'po_quantity': 10, 'grn_quantity': 10, 'invoice_quantity': 10,
            'po_price': 100, 'invoice_price': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['match_status'], 'complete')
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'pending_approval')

    def test_match_invoice_partial(self):
        inv = self._create_invoice()
        url = reverse('invoice-match', args=[inv.invoice_id])
        response = self.client.post(url, {
            'po_quantity': 10, 'grn_quantity': 10, 'invoice_quantity': 8,
            'po_price': 100, 'invoice_price': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['match_status'], 'partial')

    def test_match_invoice_no_match(self):
        inv = self._create_invoice()
        url = reverse('invoice-match', args=[inv.invoice_id])
        response = self.client.post(url, {
            'po_quantity': 10, 'grn_quantity': 0, 'invoice_quantity': 10,
            'po_price': 100, 'invoice_price': 100,
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['match_status'], 'no_match')

    def test_reject_invoice(self):
        inv = self._create_invoice(status='submitted')
        url = reverse('invoice-reject', args=[inv.invoice_id])
        response = self.client.post(url, {'reason': 'Duplicate invoice'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'rejected')
        self.assertEqual(inv.rejection_reason, 'Duplicate invoice')

    def test_approve_invoice_finance_officer(self):
        inv = self._create_invoice(amount=50000)
        inv.status = 'pending_approval'
        inv.save()
        url = reverse('invoice-approve', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'approved')
        self.assertEqual(inv.approval_route, 'finance_officer')

    def test_approve_invoice_wrong_role_blocked(self):
        self.client.force_authenticate(user=self.dept_head)
        inv = self._create_invoice(amount=50000)
        inv.status = 'pending_approval'
        inv.save()
        url = reverse('invoice-approve', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_approve_invoice_department_head(self):
        inv = self._create_invoice(amount=200000)
        inv.status = 'pending_approval'
        inv.save()
        url = reverse('invoice-approve', args=[inv.invoice_id])

        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'pending_approval')
        self.assertEqual(inv.approval_route, 'department_head')

        self.client.force_authenticate(user=self.dept_head)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'approved')
        self.assertEqual(inv.approval_route, 'department_head')

    def test_approve_invoice_director_general(self):
        inv = self._create_invoice(amount=600000)
        inv.status = 'pending_approval'
        inv.save()
        url = reverse('invoice-approve', args=[inv.invoice_id])

        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.approval_route, 'department_head')

        self.client.force_authenticate(user=self.dept_head)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.approval_route, 'director_general')

        self.client.force_authenticate(user=self.dir_gen)
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'approved')
        self.assertEqual(inv.approval_route, 'director_general')


class PaymentTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            employee_id='PAYUSER', full_name='Payment User',
            email='pay@test.gov.zm', password='testpass123',
            role='finance_officer',
        )
        dept = Department.objects.create(dept_code='PAY', dept_name='Pay', level='national')
        req = Requisition.objects.create(
            req_number='REQ-PAY', department=dept,
            requester=cls.user, description='Test', required_date='2026-06-01',
        )
        sol = Solicitation.objects.create(
            sol_number='SOL-PAY', title='Test', description='Test', method='rfq',
            requisition=req, closing_date=timezone.now(),
        )
        committee = EvaluationCommittee.objects.create(
            solicitation=sol, chairperson=cls.user, secretary=cls.user,
        )
        bid = BidSubmission.objects.create(
            submission_id='BID-PAY', solicitation=sol, supplier=cls.user,
        )
        ber = BidEvaluationReport.objects.create(
            solicitation=sol, report_content={}, created_by=cls.user,
        )
        supplier = Supplier.objects.create(
            registration_number='SUP-PAY', tin='TIN-PAY', name='Pay Supplier',
        )
        cls.contract = Contract.objects.create(
            contract_number='CTR-PAY', solicitation=sol, winning_bid=bid,
            ber=ber, supplier=supplier, title='Test Contract',
            contract_type='po', value=100000, start_date='2026-01-01',
            end_date='2026-12-31',
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.pay_url = lambda pk: reverse('invoice-pay', args=[pk])

    def _create_invoice(self, amount=50000, status='approved'):
        inv = Invoice.objects.create(
            contract=self.contract, po_number='PO-PAY',
            supplier=Supplier.objects.first(), invoice_number='INV-PAY',
            amount=amount, status=status,
        )
        return inv

    def test_process_payment_electronic(self):
        inv = self._create_invoice()
        response = self.client.post(self.pay_url(inv.invoice_id), {
            'amount': 50000, 'payment_method': 'electronic',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'approved')
        self.assertIsNone(inv.paid_at)
        self.assertEqual(Payment.objects.count(), 1)
        payment = Payment.objects.first()
        self.assertEqual(payment.status, 'sent')

    def test_process_payment_iso20022(self):
        inv = self._create_invoice()
        response = self.client.post(self.pay_url(inv.invoice_id), {
            'amount': 50000, 'payment_method': 'iso20022',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'sent')
        self.assertIn('iso20022_file_ref', response.data)
        self.assertIn('xml_content', response.data)

    def test_bank_confirm_payment(self):
        inv = self._create_invoice()
        self.client.post(self.pay_url(inv.invoice_id), {
            'amount': 50000, 'payment_method': 'electronic',
        }, format='json')
        url = reverse('invoice-bank-confirm', args=[inv.invoice_id])
        response = self.client.post(url, {'confirmed': True, 'bank_reference': 'BNK-001'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertEqual(inv.status, 'paid')
        payment = Payment.objects.first()
        self.assertEqual(payment.status, 'confirmed')
        self.assertEqual(payment.reference, 'BNK-001')

    def test_bank_confirm_payment_failed(self):
        inv = self._create_invoice()
        self.client.post(self.pay_url(inv.invoice_id), {
            'amount': 50000, 'payment_method': 'electronic',
        }, format='json')
        url = reverse('invoice-bank-confirm', args=[inv.invoice_id])
        response = self.client.post(url, {'confirmed': False}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        payment = Payment.objects.first()
        self.assertEqual(payment.status, 'failed')

    def test_bank_confirm_no_sent_payment(self):
        inv = self._create_invoice()
        url = reverse('invoice-bank-confirm', args=[inv.invoice_id])
        response = self.client.post(url, {'confirmed': True}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_send_payment_advice(self):
        inv = self._create_invoice(status='paid')
        inv.paid_at = timezone.now()
        inv.save()
        url = reverse('invoice-send-advice', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertTrue(inv.payment_advice_sent)
        self.assertIsNotNone(inv.payment_advice_sent_at)

    def test_send_payment_advice_not_paid_blocked(self):
        inv = self._create_invoice(status='approved')
        url = reverse('invoice-send-advice', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_post_to_erp(self):
        inv = self._create_invoice(status='paid')
        inv.paid_at = timezone.now()
        inv.save()
        url = reverse('invoice-post-erp', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        inv.refresh_from_db()
        self.assertTrue(inv.erp_posted)
        self.assertIsNotNone(inv.erp_posted_at)

    def test_post_to_erp_not_paid_blocked(self):
        inv = self._create_invoice(status='approved')
        url = reverse('invoice-post-erp', args=[inv.invoice_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_payments(self):
        inv = self._create_invoice()
        self.client.post(self.pay_url(inv.invoice_id), {
            'amount': 50000, 'payment_method': 'electronic',
        }, format='json')
        url = reverse('payment-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)


class LetterOfCreditTests(APITestCase):
    @classmethod
    def setUpTestData(cls):
        cls.user = User.objects.create_user(
            employee_id='LCUSER', full_name='LC User',
            email='lc@test.gov.zm', password='testpass123',
            role='finance_officer',
        )
        dept = Department.objects.create(dept_code='LC', dept_name='LC', level='national')
        req = Requisition.objects.create(
            req_number='REQ-LC', department=dept,
            requester=cls.user, description='Test', required_date='2026-06-01',
        )
        sol = Solicitation.objects.create(
            sol_number='SOL-LC', title='Test', description='Test', method='rfq',
            requisition=req, closing_date=timezone.now(),
        )
        committee = EvaluationCommittee.objects.create(
            solicitation=sol, chairperson=cls.user, secretary=cls.user,
        )
        bid = BidSubmission.objects.create(
            submission_id='BID-LC', solicitation=sol, supplier=cls.user,
        )
        ber = BidEvaluationReport.objects.create(
            solicitation=sol, report_content={}, created_by=cls.user,
        )
        supplier = Supplier.objects.create(
            registration_number='SUP-LC', tin='TIN-LC', name='LC Supplier',
        )
        cls.contract = Contract.objects.create(
            contract_number='CTR-LC', solicitation=sol, winning_bid=bid,
            ber=ber, supplier=supplier, title='Test Contract',
            contract_type='po', value=200000, start_date='2026-01-01',
            end_date='2026-12-31',
        )

    def setUp(self):
        self.client.force_authenticate(user=self.user)
        self.list_url = reverse('loc-list')

    def test_create_letter_of_credit(self):
        response = self.client.post(self.list_url, {
            'contract': str(self.contract.contract_id),
            'loc_type': 'sight',
            'issuing_bank': 'Bank of Zambia',
            'beneficiary': 'Supplier Co',
            'amount': 100000,
            'expiry_date': '2026-12-31',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(LetterOfCredit.objects.count(), 1)

    def test_list_letters_of_credit(self):
        LetterOfCredit.objects.create(
            contract=self.contract, loc_type='sight',
            issuing_bank='Bank A', beneficiary='Supplier A',
            amount=50000, expiry_date='2026-12-31',
        )
        response = self.client.get(self.list_url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_letter_of_credit_detail(self):
        lc = LetterOfCredit.objects.create(
            contract=self.contract, loc_type='usance',
            issuing_bank='Bank B', beneficiary='Supplier B',
            amount=75000, expiry_date='2026-12-31',
        )
        url = reverse('loc-detail', args=[lc.loc_id])
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['issuing_bank'], 'Bank B')


class BudgetEncumberReleaseTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='ENC001', full_name='Enc User',
            email='enc@test.gov.zm', password='testpass123',
            role='finance_officer',
        )
        self.client.force_authenticate(user=self.user)
        dept = Department.objects.create(dept_code='ENC', dept_name='Enc', level='national', budget_code='ENC-BUDGET')
        self.allocation = BudgetAllocation.objects.create(
            entity_level='department', entity_code='ENC-BUDGET',
            entity_name='Enc Dept', fiscal_year='2026',
            allocated_amount=100000,
        )
        self.requisition = Requisition.objects.create(
            req_number='REQ-ENC', department=dept,
            requester=self.user, description='Test', required_date='2026-06-01',
        )

    def test_encumber_budget(self):
        url = reverse('budget-encumber', args=[self.allocation.allocation_id])
        response = self.client.post(url, {
            'amount': 50000,
            'requisition': str(self.requisition.requisition_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.allocation.refresh_from_db()
        self.assertEqual(float(self.allocation.encumbered_amount), 50000.0)
        self.assertEqual(float(self.allocation.available), 50000.0)
        self.assertEqual(BudgetEncumbrance.objects.count(), 1)

    def test_encumber_insufficient_budget(self):
        url = reverse('budget-encumber', args=[self.allocation.allocation_id])
        response = self.client.post(url, {
            'amount': 200000,
            'requisition': str(self.requisition.requisition_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_release_encumbrance(self):
        enc = BudgetEncumbrance.objects.create(
            requisition=self.requisition, amount=30000,
        )
        self.allocation.encumbered_amount = 30000
        self.allocation.save()
        url = reverse('budget-release', args=[enc.encumbrance_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        enc.refresh_from_db()
        self.assertEqual(enc.status, 'released')
        self.assertIsNotNone(enc.released_at)

    def test_release_already_released(self):
        enc = BudgetEncumbrance.objects.create(
            requisition=self.requisition, amount=30000, status='released',
            released_at=timezone.now(),
        )
        url = reverse('budget-release', args=[enc.encumbrance_id])
        response = self.client.post(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class LetterOfCreditDrawdownTests(APITestCase):
    def setUp(self):
        self.user = User.objects.create_user(
            employee_id='LCDRAW', full_name='LC Draw',
            email='lcdraw@test.gov.zm', password='testpass123',
            role='finance_officer',
        )
        self.client.force_authenticate(user=self.user)
        dept = Department.objects.create(dept_code='LCD', dept_name='LCD', level='national')
        req = Requisition.objects.create(
            req_number='REQ-LCD', department=dept,
            requester=self.user, description='Test', required_date='2026-06-01',
        )
        sol = Solicitation.objects.create(
            sol_number='SOL-LCD', title='Test', description='Test', method='rfq',
            requisition=req, closing_date=timezone.now(),
        )
        committee = EvaluationCommittee.objects.create(
            solicitation=sol, chairperson=self.user, secretary=self.user,
        )
        bid = BidSubmission.objects.create(
            submission_id='BID-LCD', solicitation=sol, supplier=self.user,
        )
        ber = BidEvaluationReport.objects.create(
            solicitation=sol, report_content={}, created_by=self.user,
        )
        supplier = Supplier.objects.create(
            registration_number='SUP-LCD', tin='TIN-LCD', name='LCD Supplier',
        )
        contract = Contract.objects.create(
            contract_number='CTR-LCD', solicitation=sol, winning_bid=bid,
            ber=ber, supplier=supplier, title='Test Contract',
            contract_type='po', value=200000, start_date='2026-01-01',
            end_date='2026-12-31',
        )
        self.lc = LetterOfCredit.objects.create(
            contract=contract, loc_type='sight',
            issuing_bank='Bank X', beneficiary='Supplier X',
            amount=100000, expiry_date='2026-12-31',
        )

    def test_lc_drawdown(self):
        url = reverse('loc-drawdown', args=[self.lc.loc_id])
        response = self.client.post(url, {'amount': 30000}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.lc.refresh_from_db()
        self.assertEqual(self.lc.status, 'utilized')

    def test_lc_drawdown_exhausted_blocked(self):
        self.lc.status = 'exhausted'
        self.lc.save()
        url = reverse('loc-drawdown', args=[self.lc.loc_id])
        response = self.client.post(url, {'amount': 10000}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_lc_drawdown_expired_blocked(self):
        self.lc.status = 'expired'
        self.lc.save()
        url = reverse('loc-drawdown', args=[self.lc.loc_id])
        response = self.client.post(url, {'amount': 10000}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)


class AuthenticationTests(APITestCase):
    def test_unauthenticated_access_blocked(self):
        urls = [
            reverse('budget-allocation-list'),
            reverse('invoice-list'),
            reverse('payment-list'),
            reverse('loc-list'),
        ]
        for url in urls:
            response = self.client.get(url)
            self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED,
                             f'{url} did not return 401')
