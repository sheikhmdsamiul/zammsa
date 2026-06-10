from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from accounts.models import User
from solicitations.models import Solicitation
from requisitions.models import Requisition
from master_data.models import Department
from procurement_planning.models import ContractProcurementPlan
from django.utils import timezone
from decimal import Decimal
import datetime

class SolicitationPermissionTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager_user = User.objects.create_user(
            email='manager@example.com',
            password='password123',
            full_name='Proc Manager',
            employee_id='PM001',
            role='procurement_manager'
        )
        self.officer_user = User.objects.create_user(
            email='officer@example.com',
            password='password123',
            full_name='Proc Officer',
            employee_id='PO001',
            role='procurement_officer'
        )
        self.department = Department.objects.create(
            dept_code='DEPT',
            dept_name='Test Department',
            level='national',
        )
        self.requisition = Requisition.objects.create(
            department=self.department,
            requester=self.manager_user,
            description='Test requisition',
            required_date=timezone.now().date(),
            estimated_total=Decimal('10000.00'),
        )
        ContractProcurementPlan.objects.create(
            requisition=self.requisition,
            status='approved',
            method='open_tender',
            created_by=self.manager_user,
        )
        self.solicitation = Solicitation.objects.create(
            title='Test Solicitation',
            sol_number='SOL-001',
            description='Test solicitation description',
            status='approved',
            method='open_tender',
            closing_date=timezone.now() + datetime.timedelta(days=30)
        )

    def test_manager_can_publish(self):
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('solicitation-publish', kwargs={'pk': self.solicitation.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        self.solicitation.refresh_from_db()
        self.assertEqual(self.solicitation.status, 'published')

    def test_officer_can_publish(self):
        self.client.force_authenticate(user=self.officer_user)
        url = reverse('solicitation-publish', kwargs={'pk': self.solicitation.pk})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200)
        
    def test_manager_can_create(self):
        self.client.force_authenticate(user=self.manager_user)
        url = reverse('solicitation-list')
        data = {
            'title': 'New Solicitation',
            'sol_number': 'SOL-NEW',
            'method': 'open_tender',
            'description': 'Test description',
            'closing_date': (timezone.now() + datetime.timedelta(days=30)).isoformat(),
            'requisition': str(self.requisition.requisition_id),
        }
        response = self.client.post(url, data)
        self.assertEqual(response.status_code, 201, f"Create failed: {response.data}")


from decimal import Decimal
from solicitations.models import EvaluationCriterion


class SolicitationBiddingPeriodValidationTests(TestCase):
    def setUp(self):
        self.client = APIClient()
        self.manager = User.objects.create_user(
            email='mgr2@example.com',
            password='password123',
            full_name='Proc Manager 2',
            employee_id='PM002',
            role='procurement_manager',
        )
        self.officer = User.objects.create_user(
            email='off2@example.com',
            password='password123',
            full_name='Proc Officer 2',
            employee_id='PO002',
            role='procurement_officer',
        )
        self.sol = Solicitation.objects.create(
            title='Validation Test Sol',
            sol_number='SOL-VALID-001',
            description='Test for bidding period validation',
            method='open_tender',
            closing_date=timezone.now() + datetime.timedelta(days=30),
            created_by=self.officer,
        )
        self.submit_url = reverse('solicitation-submit', kwargs={'pk': self.sol.solicitation_id})
        self.approve_url = reverse('solicitation-approve', kwargs={'pk': self.sol.solicitation_id})
        self.publish_url = reverse('solicitation-publish', kwargs={'pk': self.sol.solicitation_id})

    def test_submit_closing_too_soon_returns_400(self):
        self.sol.closing_date = timezone.now() + datetime.timedelta(days=10)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('bidding period', response.data['error'].lower())

    def test_submit_valid_closing_returns_200(self):
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)
        self.sol.refresh_from_db()
        self.assertEqual(self.sol.status, 'pending_approval')

    def test_approve_closing_too_soon_returns_400(self):
        self.sol.status = 'pending_approval'
        self.sol.closing_date = timezone.now() + datetime.timedelta(days=10)
        self.sol.save()
        self.client.force_authenticate(user=self.manager)
        response = self.client.post(self.approve_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('bidding period', response.data['error'].lower())

    def test_publish_closing_too_soon_returns_400(self):
        self.sol.status = 'approved'
        self.sol.closing_date = timezone.now() + datetime.timedelta(days=10)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.publish_url, {'targets': ['zammsa_website']}, format='json')
        self.assertEqual(response.status_code, 400)
        self.assertIn('bidding period', response.data['error'].lower())

    def test_limited_bidding_requires_14_days(self):
        self.sol.method = 'limited'
        self.sol.closing_date = timezone.now() + datetime.timedelta(days=7)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('bidding period', response.data['error'].lower())

    def test_direct_procurement_no_bidding_period_check(self):
        self.sol.method = 'direct'
        self.sol.closing_date = timezone.now() + datetime.timedelta(days=1)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)

    def test_clarification_cutoff_too_close_returns_400(self):
        self.sol.clarification_cutoff = timezone.now() + datetime.timedelta(days=28)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('cutoff', response.data['error'].lower())

    def test_clarification_cutoff_after_closing_returns_400(self):
        self.sol.clarification_cutoff = timezone.now() + datetime.timedelta(days=35)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('cutoff', response.data['error'].lower())

    def test_clarification_cutoff_valid(self):
        self.sol.clarification_cutoff = timezone.now() + datetime.timedelta(days=20)
        self.sol.save()
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)

    def test_weights_must_sum_to_100(self):
        EvaluationCriterion.objects.create(
            solicitation=self.sol,
            criterion_name='Technical',
            criterion_type='technical',
            weight=Decimal('40'),
        )
        EvaluationCriterion.objects.create(
            solicitation=self.sol,
            criterion_name='Financial',
            criterion_type='financial',
            weight=Decimal('30'),
        )
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 400)
        self.assertIn('weight', response.data['error'].lower())

    def test_weights_sum_100_passes(self):
        EvaluationCriterion.objects.create(
            solicitation=self.sol,
            criterion_name='Technical',
            criterion_type='technical',
            weight=Decimal('70'),
        )
        EvaluationCriterion.objects.create(
            solicitation=self.sol,
            criterion_name='Financial',
            criterion_type='financial',
            weight=Decimal('30'),
        )
        self.client.force_authenticate(user=self.officer)
        response = self.client.post(self.submit_url)
        self.assertEqual(response.status_code, 200)
