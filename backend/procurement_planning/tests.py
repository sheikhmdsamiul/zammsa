from django.test import TestCase
from django.urls import reverse
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import date, timedelta
from accounts.models import User
from master_data.models import Department
from requisitions.models import Requisition
from .models import ContractProcurementPlan
from .views import _validate_milestone_minimum_periods
from decimal import Decimal


class CPPDateValidationTests(TestCase):
    """BR-CPP-08/09: Validate milestone minimum periods and date ordering."""

    def test_milestone_minimum_period_open_tender(self):
        milestones = [
            {'milestone_name': 'Solicitation Published', 'planned_date': '2026-06-01'},
            {'milestone_name': 'Bid Closing', 'planned_date': '2026-06-25'},
        ]
        errors = _validate_milestone_minimum_periods(milestones, 'open_tender')
        self.assertEqual(errors, [])

    def test_milestone_minimum_period_too_short(self):
        milestones = [
            {'milestone_name': 'Solicitation Published', 'planned_date': '2026-06-01'},
            {'milestone_name': 'Bid Closing', 'planned_date': '2026-06-10'},
        ]
        errors = _validate_milestone_minimum_periods(milestones, 'open_tender')
        self.assertTrue(len(errors) > 0)
        self.assertIn('Closing date', errors[0])
        self.assertIn('21', errors[0])

    def test_milestone_opening_before_closing(self):
        milestones = [
            {'milestone_name': 'Bid Closing', 'planned_date': '2026-06-25'},
            {'milestone_name': 'Bid Opening', 'planned_date': '2026-06-24'},
        ]
        errors = _validate_milestone_minimum_periods(milestones, 'open_tender')
        self.assertTrue(len(errors) > 0)
        self.assertIn('Bid opening', errors[0])

    def test_milestone_opening_on_closing(self):
        milestones = [
            {'milestone_name': 'Bid Closing', 'planned_date': '2026-06-25'},
            {'milestone_name': 'Bid Opening', 'planned_date': '2026-06-25'},
        ]
        errors = _validate_milestone_minimum_periods(milestones, 'open_tender')
        self.assertEqual(errors, [])

    def test_milestone_opening_after_closing(self):
        milestones = [
            {'milestone_name': 'Bid Closing', 'planned_date': '2026-06-25'},
            {'milestone_name': 'Bid Opening', 'planned_date': '2026-06-26'},
        ]
        errors = _validate_milestone_minimum_periods(milestones, 'open_tender')
        self.assertEqual(errors, [])


class CPPBaselineLockingTests(TestCase):
    """BR-CPP-01/03: Baseline locking on approval."""

    def setUp(self):
        self.client = APIClient()
        self.user = User.objects.create_user(
            email='procuser@example.com',
            password='testpass123',
            full_name='Proc User',
            employee_id='PU001',
            role='procurement_officer',
        )
        self.department = Department.objects.create(
            dept_code='TEST',
            dept_name='Test Department',
            level='national',
        )
        self.requisition = Requisition.objects.create(
            department=self.department,
            requester=self.user,
            description='Test requisition',
            required_date=timezone.now().date(),
            estimated_total=Decimal('50000.00'),
        )
        self.cpp = ContractProcurementPlan.objects.create(
            requisition=self.requisition,
            method='open_tender',
            status='draft',
            estimated_value=Decimal('50000.00'),
            created_by=self.user,
        )

    def _setup_cpp_for_submit(self):
        """Add required data (risks, milestones, resources) for CPP submission."""
        from .models import CPPRisk, ProcurementMilestone
        CPPRisk.objects.create(
            cpp=self.cpp,
            risk_category='supply',
            risk_description='Test risk',
            likelihood='medium',
            impact='medium',
            mitigation_strategy='Test mitigation',
        )
        ProcurementMilestone.objects.create(
            cpp=self.cpp,
            milestone_name='Solicitation Published',
            sequence_number=1,
            planned_date=timezone.now().date(),
        )
        ProcurementMilestone.objects.create(
            cpp=self.cpp,
            milestone_name='Bid Closing',
            sequence_number=2,
            planned_date=timezone.now().date() + timedelta(days=25),
        )
        ProcurementMilestone.objects.create(
            cpp=self.cpp,
            milestone_name='Bid Opening',
            sequence_number=3,
            planned_date=timezone.now().date() + timedelta(days=25),
        )
        self.cpp.resource_requirements = {
            'evaluationCommitteeSize': 3,
            'requiredExpertise': ['procurement'],
        }
        self.cpp.save(update_fields=['resource_requirements'])

    def test_approved_cpp_has_baseline_locked(self):
        """Approving an open-method CPP should lock the baseline."""
        self._setup_cpp_for_submit()
        self.client.force_authenticate(user=self.user)
        url = reverse('cpp-submit', kwargs={'pk': self.cpp.cpp_id})
        response = self.client.post(url)
        self.assertEqual(response.status_code, 200, f'Submit failed: {response.data}')
        self.cpp.refresh_from_db()
        self.assertEqual(self.cpp.status, 'approved')
        self.assertTrue(self.cpp.is_baseline_locked)
        self.assertIsNotNone(self.cpp.baseline_locked_at)

    def test_baseline_locked_prevents_milestone_updates(self):
        """Once locked, milestone updates should be blocked."""
        self.cpp.is_baseline_locked = True
        self.cpp.status = 'approved'
        self.cpp.save()

        self.client.force_authenticate(user=self.user)
        url = reverse('cpp-detail', kwargs={'pk': self.cpp.cpp_id})
        response = self.client.patch(url, {
            'milestones': [{'milestone_name': 'New', 'planned_date': '2026-07-01'}]
        }, format='json')
        self.cpp.refresh_from_db()
        self.assertNotEqual(response.status_code, 200)

