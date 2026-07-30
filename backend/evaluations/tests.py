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
from evaluations.models import EvaluationCommittee, BidEvaluationReport, AwardAppeal, PostQualification, PQActionLog
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


class PostQualificationTests(APITestCase):
    def setUp(self):
        self.officer = User.objects.create_user(
            email='pq-officer@example.com', password='password',
            role='procurement_officer', full_name='PQ Officer', employee_id='EMP-PQ1'
        )
        self.manager = User.objects.create_user(
            email='pq-manager@example.com', password='password',
            role='procurement_manager', full_name='PQ Manager', employee_id='EMP-PQ2'
        )
        self.supplier_user = User.objects.create_user(
            email='pq-supplier@example.com', password='password',
            role='supplier_user', full_name='PQ Supplier', employee_id='SUP-001'
        )
        self.unauthorized_user = User.objects.create_user(
            email='pq-viewer@example.com', password='password',
            role='department_head', full_name='PQ Viewer', employee_id='EMP-V1'
        )

        self.dept = Department.objects.create(dept_code='MED', dept_name='Medical', level='national')
        self.req = Requisition.objects.create(
            req_number='REQ-PQ1', department=self.dept, requester=self.officer,
            description='Medical Supplies', required_date='2026-09-01'
        )
        self.sol = Solicitation.objects.create(
            sol_number='SOL-PQ1', title='Medical PQ Test', description='Test',
            method='open_tender', requisition=self.req, closing_date=timezone.now(), status='awarded'
        )
        self.committee = EvaluationCommittee.objects.create(
            solicitation=self.sol, chairperson=self.officer, secretary=self.officer
        )
        self.bid = BidSubmission.objects.create(
            submission_id='BID-PQ1', solicitation=self.sol, supplier=self.supplier_user, status='awarded'
        )
        self.ber = BidEvaluationReport.objects.create(
            solicitation=self.sol, report_content={}, created_by=self.officer
        )
        self.supplier = Supplier.objects.create(
            registration_number='SUP-PQ-001', tin='TIN-PQ-001', name='PQ Supplier Corp'
        )
        self.supplier_user.supplier = self.supplier
        self.supplier_user.save()

    def test_create_pq_unauthenticated(self):
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': str(self.sol.solicitation_id),
            'bidder_id': str(self.bid.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_401_UNAUTHORIZED)

    def test_create_pq_unauthorized_role(self):
        self.client.force_authenticate(user=self.unauthorized_user)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': str(self.sol.solicitation_id),
            'bidder_id': str(self.bid.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)

    def test_create_pq_missing_fields(self):
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('error', response.data)

    def test_create_pq_nonexistent_solicitation(self):
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': '00000000-0000-0000-0000-000000000000',
            'bidder_id': str(self.bid.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_create_pq_not_awarded_solicitation(self):
        self.sol.status = 'evaluation'
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': str(self.sol.solicitation_id),
            'bidder_id': str(self.bid.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_pq_not_winner(self):
        non_winner = BidSubmission.objects.create(
            submission_id='BID-PQ2', solicitation=self.sol, supplier=self.supplier_user, status='submitted'
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': str(self.sol.solicitation_id),
            'bidder_id': str(non_winner.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_create_pq_success(self):
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': str(self.sol.solicitation_id),
            'bidder_id': str(self.bid.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_201_CREATED)
        self.assertEqual(response.data['status'], 'pending')
        self.assertIsNotNone(response.data['deadline'])
        self.assertEqual(response.data['assigned_to_name'], 'PQ Officer')

        pq = PostQualification.objects.get(pk=response.data['id'])
        self.assertEqual(pq.bidder, self.bid)
        self.assertEqual(pq.assigned_to, self.officer)
        self.assertEqual(PQActionLog.objects.filter(pq=pq, action='pq_assigned').count(), 1)

    def test_create_pq_duplicate_prevented(self):
        PostQualification.objects.create(bidder=self.bid, status='pending')
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.post(url, {
            'solicitation_id': str(self.sol.solicitation_id),
            'bidder_id': str(self.bid.bid_id),
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_list_pq(self):
        PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)

    def test_list_pq_filter_by_status(self):
        PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-list')
        response = self.client.get(url, {'status': 'pending'})
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['count'], 1)
        response = self.client.get(url, {'status': 'cleared'})
        self.assertEqual(response.data['count'], 0)

    def test_generate_checklist(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-generate-checklist', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'in_progress')
        self.assertEqual(len(pq.verification_items), 13)
        self.assertIsNotNone(pq.deadline)
        self.assertEqual(PQActionLog.objects.filter(pq=pq, action='checklist_generated').count(), 1)

    def test_generate_checklist_already_exists(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'existing', 'label': 'Existing', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-generate-checklist', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_generate_checklist_auto_assigns_user(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending')
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-generate-checklist', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        self.assertEqual(pq.assigned_to, self.officer)

    def test_update_verification_item(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[
                {'id': 'tax-clearance', 'label': 'Tax Clearance', 'category': 'legal', 'status': 'pending', 'notes': ''},
                {'id': 'bank-reference', 'label': 'Bank Reference', 'category': 'financial', 'status': 'pending', 'notes': ''},
            ]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {
            'item_id': 'tax-clearance',
            'status': 'cleared',
            'notes': 'Verified with ZRA',
            'contact_result': 'Confirmed by phone on 2026-01-15',
        }, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        item = next(i for i in pq.verification_items if i['id'] == 'tax-clearance')
        self.assertEqual(item['status'], 'cleared')
        self.assertEqual(item['notes'], 'Verified with ZRA')
        self.assertEqual(item['contact_result'], 'Confirmed by phone on 2026-01-15')
        self.assertEqual(item['verified_by'], 'PQ Officer')
        self.assertIsNotNone(item['verified_at'])

    def test_update_item_auto_cleared(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[
                {'id': 'only-item', 'label': 'Only Item', 'category': 'legal', 'status': 'pending', 'notes': ''},
            ]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'only-item', 'status': 'cleared'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'cleared')
        self.assertIsNotNone(pq.verified_at)

    def test_update_item_auto_failed(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[
                {'id': 'item-a', 'label': 'A', 'category': 'legal', 'status': 'cleared', 'notes': ''},
                {'id': 'item-b', 'label': 'B', 'category': 'legal', 'status': 'pending', 'notes': ''},
            ]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'item-b', 'status': 'failed'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'failed')

    def test_update_item_missing_item_id(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'x', 'label': 'X', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'status': 'cleared'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_item_missing_status(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'x', 'label': 'X', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'x'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_item_invalid_status(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'x', 'label': 'X', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'x', 'status': 'invalid_status'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_item_nonexistent_item(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'real', 'label': 'Real', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'fake', 'status': 'cleared'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_update_item_notes_too_long(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'x', 'label': 'X', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'x', 'status': 'cleared', 'notes': 'x' * 2001}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_update_item_creates_action_log(self):
        pq = PostQualification.objects.create(
            bidder=self.bid, status='in_progress', assigned_to=self.officer,
            verification_items=[{'id': 'x', 'label': 'X', 'category': 'legal', 'status': 'pending', 'notes': ''}]
        )
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-update-item', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'item_id': 'x', 'status': 'cleared'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = PQActionLog.objects.get(pq=pq, action='item_updated')
        self.assertEqual(log.performed_by, self.officer)
        self.assertIn('item_id', log.metadata)
        self.assertEqual(log.metadata['old_status'], 'pending')
        self.assertEqual(log.metadata['new_status'], 'cleared')

    def test_add_notes(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-add-notes', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'notes': 'Test notes content'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        self.assertEqual(pq.notes, 'Test notes content')

    def test_add_notes_empty(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-add-notes', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'notes': ''}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_notes_too_long(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-add-notes', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'notes': 'x' * 5001}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_add_notes_creates_action_log(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-add-notes', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'notes': 'Important'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(PQActionLog.objects.filter(pq=pq, action='notes_added').count(), 1)

    def test_reassign(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-reassign', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'assigned_to': str(self.manager.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        pq.refresh_from_db()
        self.assertEqual(pq.assigned_to, self.manager)

    def test_reassign_missing_user(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-reassign', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {}, format='json')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_reassign_nonexistent_user(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-reassign', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'assigned_to': '00000000-0000-0000-0000-000000000000'}, format='json')
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_reassign_creates_action_log(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-reassign', kwargs={'pq_pk': pq.pk})
        response = self.client.post(url, {'assigned_to': str(self.manager.id)}, format='json')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        log = PQActionLog.objects.get(pq=pq, action='pq_reassigned')
        self.assertEqual(log.performed_by, self.officer)

    def test_detail_view(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-detail', kwargs={'pk': pq.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertEqual(response.data['status'], 'pending')
        self.assertEqual(response.data['bidder_name'], 'PQ Supplier')

    def test_detail_not_found(self):
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-detail', kwargs={'pk': '00000000-0000-0000-0000-000000000000'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)

    def test_delete_pq(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-detail', kwargs={'pk': pq.pk})
        response = self.client.delete(url)
        self.assertEqual(response.status_code, status.HTTP_204_NO_CONTENT)
        self.assertFalse(PostQualification.objects.filter(pk=pq.pk).exists())

    def test_verification_context(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending', assigned_to=self.officer)
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-verification-context', kwargs={'pq_pk': pq.pk})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        self.assertIn('bid', response.data)
        self.assertIn('verification_items', response.data)
        self.assertIn('supplier_user', response.data)
        self.assertEqual(response.data['bid']['submission_id'], 'BID-PQ1')

    def test_verification_context_not_found(self):
        self.client.force_authenticate(user=self.officer)
        url = reverse('evaluations:pq-verification-context', kwargs={'pq_pk': '00000000-0000-0000-0000-000000000000'})
        response = self.client.get(url)
        self.assertEqual(response.status_code, status.HTTP_404_NOT_FOUND)


class PostQualificationModelTests(TestCase):
    def setUp(self):
        self.officer = User.objects.create_user(
            email='model-test@example.com', password='password',
            role='procurement_officer', full_name='Model Test', employee_id='EMP-MT'
        )
        self.supplier_user = User.objects.create_user(
            email='model-sup@example.com', password='password',
            role='supplier_user', full_name='Model Supplier', employee_id='SUP-MT'
        )
        self.dept = Department.objects.create(dept_code='FIN', dept_name='Finance', level='national')
        self.req = Requisition.objects.create(
            req_number='REQ-MT1', department=self.dept, requester=self.officer,
            description='Finance Supplies', required_date='2026-09-01'
        )
        self.sol = Solicitation.objects.create(
            sol_number='SOL-MT1', title='Model Test Sol', description='Test',
            method='open_tender', requisition=self.req, closing_date=timezone.now(), status='awarded'
        )
        self.bid = BidSubmission.objects.create(
            submission_id='BID-MT1', solicitation=self.sol, supplier=self.supplier_user, status='awarded'
        )

    def test_str_representation(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending')
        self.assertIn('BID-MT1', str(pq))
        self.assertIn('pending', str(pq))

    def test_status_auto_pending_no_items(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='in_progress')
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'pending')

    def test_status_auto_cleared(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='in_progress',
            verification_items=[{'id': 'a', 'status': 'cleared'}])
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'cleared')
        self.assertIsNotNone(pq.verified_at)

    def test_status_auto_failed(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='in_progress',
            verification_items=[{'id': 'a', 'status': 'cleared'}, {'id': 'b', 'status': 'failed'}])
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'failed')

    def test_status_auto_in_progress(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending',
            verification_items=[{'id': 'a', 'status': 'pending'}, {'id': 'b', 'status': 'in_progress'}])
        pq.refresh_from_db()
        self.assertEqual(pq.status, 'in_progress')

    def test_action_log_str(self):
        pq = PostQualification.objects.create(bidder=self.bid, status='pending')
        log = PQActionLog.objects.create(pq=pq, action='item_updated', performed_by=self.officer, details='test')
        self.assertIn('BID-MT1', str(log))
        self.assertIn('item_updated', str(log))
