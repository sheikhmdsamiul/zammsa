from django.core.files.uploadedfile import SimpleUploadedFile
from django.urls import reverse
from django.utils import timezone
from rest_framework import status
from rest_framework.test import APITestCase

from accounts.models import User
from bids.models import BidSubmission
from master_data.models import Department
from requisitions.models import Requisition
from solicitations.models import Solicitation


class BidSubmissionProductionRulesTests(APITestCase):
    def setUp(self):
        self.supplier = User.objects.create_user(
            employee_id='SUP-BID',
            full_name='Supplier Bidder',
            email='supplier.bid@test.gov.zm',
            password='testpass123',
            role='supplier_user',
        )
        self.procurement_officer = User.objects.create_user(
            employee_id='PO-BID',
            full_name='Procurement Officer',
            email='po.bid@test.gov.zm',
            password='testpass123',
            role='procurement_officer',
        )
        dept = Department.objects.create(dept_code='BID', dept_name='Bid Dept', level='national')
        req = Requisition.objects.create(
            req_number='REQ-BID',
            department=dept,
            requester=self.procurement_officer,
            description='Bid test',
            required_date='2026-06-01',
        )
        self.solicitation = Solicitation.objects.create(
            sol_number='SOL-BID',
            title='Bid Test',
            description='Bid Test',
            method='open_tender',
            requisition=req,
            status='published',
            submission_format='two',
            closing_date=timezone.now() + timezone.timedelta(days=1),
        )
        self.client.force_authenticate(user=self.supplier)

    def _file(self, name='doc.pdf'):
        return SimpleUploadedFile(name, b'%PDF-1.4 test', content_type='application/pdf')

    def test_supplier_can_submit_complete_bid(self):
        response = self.client.post(reverse('bid-submit'), {
            'solicitation_id': str(self.solicitation.solicitation_id),
            'bid_price': '100000',
            'security_amount': '3000',
            'addenda_acknowledged': True,
            'technical_proposal': self._file('technical.pdf'),
            'financial_proposal': self._file('financial.pdf'),
            'bid_security': self._file('security.pdf'),
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_200_OK)
        bid = BidSubmission.objects.get()
        self.assertTrue(bid.financial_envelope_encrypted)
        self.assertEqual(bid.status, 'submitted')

    def test_late_bid_is_rejected_without_persisting_submission(self):
        self.solicitation.closing_date = timezone.now() - timezone.timedelta(seconds=1)
        self.solicitation.save()
        response = self.client.post(reverse('bid-submit'), {
            'solicitation_id': str(self.solicitation.solicitation_id),
            'technical_proposal': self._file('technical.pdf'),
            'financial_proposal': self._file('financial.pdf'),
            'bid_security': self._file('security.pdf'),
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertEqual(BidSubmission.objects.count(), 0)

    def test_missing_bid_security_is_blocked_when_required(self):
        response = self.client.post(reverse('bid-submit'), {
            'solicitation_id': str(self.solicitation.solicitation_id),
            'technical_proposal': self._file('technical.pdf'),
            'financial_proposal': self._file('financial.pdf'),
        }, format='multipart')
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)
        self.assertIn('Bid security is required', response.data['details'])


class BidOpeningProductionRulesTests(APITestCase):
    def setUp(self):
        self.procurement_officer = User.objects.create_user(
            employee_id='PO-OPEN',
            full_name='Opening Officer',
            email='open@test.gov.zm',
            password='testpass123',
            role='procurement_officer',
        )
        self.supplier = User.objects.create_user(
            employee_id='SUP-OPEN',
            full_name='Opening Supplier',
            email='supplier.open@test.gov.zm',
            password='testpass123',
            role='supplier_user',
        )
        dept = Department.objects.create(dept_code='OPN', dept_name='Opening Dept', level='national')
        req = Requisition.objects.create(
            req_number='REQ-OPEN',
            department=dept,
            requester=self.procurement_officer,
            description='Open test',
            required_date='2026-06-01',
        )
        self.solicitation = Solicitation.objects.create(
            sol_number='SOL-OPEN',
            title='Open Test',
            description='Open Test',
            method='open_tender',
            requisition=req,
            status='published',
            closing_date=timezone.now() + timezone.timedelta(days=1),
        )
        BidSubmission.objects.create(
            submission_id='BID-OPEN',
            receipt_number='RCT-OPEN',
            solicitation=self.solicitation,
            supplier=self.supplier,
        )

    def test_opening_before_deadline_is_blocked(self):
        self.client.force_authenticate(user=self.procurement_officer)
        response = self.client.post(reverse('opening-start', args=[self.solicitation.solicitation_id]))
        self.assertEqual(response.status_code, status.HTTP_400_BAD_REQUEST)

    def test_supplier_cannot_start_opening(self):
        self.solicitation.closing_date = timezone.now() - timezone.timedelta(seconds=1)
        self.solicitation.save()
        self.client.force_authenticate(user=self.supplier)
        response = self.client.post(reverse('opening-start', args=[self.solicitation.solicitation_id]))
        self.assertEqual(response.status_code, status.HTTP_403_FORBIDDEN)
