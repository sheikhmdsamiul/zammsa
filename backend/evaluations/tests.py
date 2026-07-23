from django.test import TestCase
from django.utils import timezone
from django.urls import reverse
from rest_framework.test import APITestCase
from rest_framework import status
from accounts.models import User
from master_data.models import Department
from requisitions.models import Requisition
from solicitations.models import Solicitation
from bids.models import BidSubmission
from evaluations.models import EvaluationCommittee, BidEvaluationReport, AwardAppeal
from contracts.models import Contract
from suppliers.models import Supplier

class AwardAppealWorkflowTests(APITestCase):
    def setUp(self):
        # Create users
        self.supplier_user = User.objects.create_user(
            email='sup@example.com', password='password', role='supplier_user', full_name='Supplier A', employee_id='EMP-SUP'
        )
        self.officer_user = User.objects.create_user(
            email='off@example.com', password='password', role='procurement_officer', full_name='Officer B', employee_id='EMP-OFF'
        )
        self.manager_user = User.objects.create_user(
            email='man@example.com', password='password', role='procurement_manager', full_name='Manager C', employee_id='EMP-MAN'
        )

        # Setup procurement hierarchy
        self.dept = Department.objects.create(dept_code='MED', dept_name='Medical', level='national')
        self.req = Requisition.objects.create(
            req_number='REQ-100', department=self.dept, requester=self.officer_user,
            description='Medical Supplies', required_date='2026-09-01'
        )
        self.sol = Solicitation.objects.create(
            sol_number='SOL-100', title='Medical Solicitation', description='Need medical supplies',
            method='open_tender', requisition=self.req, closing_date=timezone.now(), status='awarded'
        )
        self.committee = EvaluationCommittee.objects.create(
            solicitation=self.sol, chairperson=self.officer_user, secretary=self.officer_user
        )
        self.bid = BidSubmission.objects.create(
            submission_id='BID-100', solicitation=self.sol, supplier=self.supplier_user, status='unsuccessful'
        )
        self.ber = BidEvaluationReport.objects.create(
            solicitation=self.sol, report_content={}, created_by=self.officer_user
        )
        self.supplier = Supplier.objects.create(
            registration_number='SUP-100', tin='TIN-100', name='Supplier A Corp'
        )

        # Link supplier_user to supplier
        self.supplier_user.supplier = self.supplier
        self.supplier_user.save()

        self.contract = Contract.objects.create(
            contract_number='CON-100', solicitation=self.sol, winning_bid=self.bid,
            ber=self.ber, supplier=self.supplier, title='Medical Contract',
            contract_type='po', value=50000, start_date='2026-08-01', end_date='2026-12-31'
        )

    def test_file_appeal_suspends_contract(self):
        self.client.force_authenticate(user=self.supplier_user)
        url = reverse('evaluations:appeal-list')
        data = {
            'solicitation': str(self.sol.solicitation_id),
            'bidder': str(self.bid.bid_id),
            'grounds': 'scoring_error',
            'grounds_detail': 'We scored higher than the winner.'
        }
        response = self.client.post(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)

        # Assert contract is suspended
        self.contract.refresh_from_db()
        self.assertTrue(self.contract.appeal_pending)

    def test_dismiss_appeal_unsuspends_contract(self):
        # File appeal
        appeal = AwardAppeal.objects.create(
            solicitation=self.sol, bidder=self.bid, filed_by=self.supplier_user,
            grounds='scoring_error', grounds_detail='Detail', status='under_review',
            resolution_deadline=timezone.now()
        )
        self.contract.appeal_pending = True
        self.contract.save()

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('evaluations:appeal-detail', kwargs={'appeal_pk': appeal.appeal_id})
        data = {
            'status': 'dismissed',
            'resolution': 'The evaluation was done fairly.'
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Assert contract is no longer suspended
        self.contract.refresh_from_db()
        self.assertFalse(self.contract.appeal_pending)
        self.assertEqual(self.contract.status, 'draft')

    def test_uphold_appeal_reopen_evaluation(self):
        appeal = AwardAppeal.objects.create(
            solicitation=self.sol, bidder=self.bid, filed_by=self.supplier_user,
            grounds='scoring_error', grounds_detail='Detail', status='under_review',
            resolution_deadline=timezone.now()
        )
        self.contract.appeal_pending = True
        self.contract.save()

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('evaluations:appeal-detail', kwargs={'appeal_pk': appeal.appeal_id})
        data = {
            'status': 'upheld',
            'resolution': 'Error found in scoring. Bid will be re-evaluated.',
            'reopen_evaluation': True
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Assert solicitation status is reset back to evaluation
        self.sol.refresh_from_db()
        self.assertEqual(self.sol.status, 'evaluation')

        # Assert contract is cancelled
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'cancelled')

    def test_uphold_appeal_cancel_procurement(self):
        appeal = AwardAppeal.objects.create(
            solicitation=self.sol, bidder=self.bid, filed_by=self.supplier_user,
            grounds='scoring_error', grounds_detail='Detail', status='under_review',
            resolution_deadline=timezone.now()
        )
        self.contract.appeal_pending = True
        self.contract.save()

        self.client.force_authenticate(user=self.manager_user)
        url = reverse('evaluations:appeal-detail', kwargs={'appeal_pk': appeal.appeal_id})
        data = {
            'status': 'upheld',
            'resolution': 'Procedural error. Cancelling procurement.',
            'cancel_procurement': True
        }
        response = self.client.patch(url, data, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)

        # Assert solicitation is cancelled
        self.sol.refresh_from_db()
        self.assertEqual(self.sol.status, 'cancelled')

        # Assert contract is cancelled
        self.contract.refresh_from_db()
        self.assertEqual(self.contract.status, 'cancelled')
