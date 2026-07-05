from django.test import TestCase
from django.urls import reverse
from django.core.files.base import ContentFile
from rest_framework.test import APIClient
from django.utils import timezone
from datetime import date, timedelta
from accounts.models import User
from master_data.models import Department, FiscalYear
from requisitions.models import Requisition
from .models import AnnualProcurementPlan, ContractProcurementPlan, CPPDocument
from .views import _validate_milestone_minimum_periods, _compute_cpp_milestone_planned_dates
from decimal import Decimal


class AnnualProcurementPlanTraceIdTests(TestCase):
    def test_create_app_with_split_fiscal_year_generates_four_digit_trace_id(self):
        fiscal_year = FiscalYear.objects.create(
            year_code='2026/2027',
            start_date=date(2026, 1, 1),
            end_date=date(2027, 12, 31),
        )
        department = Department.objects.create(
            dept_code='PRC',
            dept_name='Procurement Department',
            level='national',
        )

        app = AnnualProcurementPlan.objects.create(
            fiscal_year=fiscal_year,
            department=department,
        )

        self.assertEqual(app.app_number, 'APP-2026-00001')

    def test_create_app_with_long_department_code_generates_three_character_trace_id(self):
        fiscal_year = FiscalYear.objects.create(
            year_code='2026',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
        )
        department = Department.objects.create(
            dept_code='PHARMACY',
            dept_name='Pharmacy Department',
            level='national',
        )

        app = AnnualProcurementPlan.objects.create(
            fiscal_year=fiscal_year,
            department=department,
        )

        self.assertEqual(app.app_number, 'APP-2026-00001')


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

    def test_compute_milestone_dates_open_tender(self):
        start = date(2026, 6, 1)
        planned = dict(_compute_cpp_milestone_planned_dates('open_tender', 'goods', start))
        self.assertEqual(planned['Solicitation Published'], date(2026, 6, 4))
        self.assertEqual(planned['Bid Closing Date'], date(2026, 6, 25))
        self.assertEqual(planned['Public Bid Opening'], date(2026, 6, 25))
        self.assertEqual((planned['Bid Closing Date'] - planned['Solicitation Published']).days, 21)

    def test_compute_milestone_dates_simplified(self):
        start = date(2026, 6, 1)
        planned = dict(_compute_cpp_milestone_planned_dates('simplified', 'goods', start))
        self.assertEqual(planned['Solicitation Published'], date(2026, 6, 3))
        self.assertEqual(planned['Bid Closing Date'], date(2026, 6, 17))
        self.assertEqual((planned['Bid Closing Date'] - planned['Solicitation Published']).days, 14)

    def test_publication_date_not_confused_with_document_ready(self):
        milestones = [
            {'milestone_name': 'Solicitation Document Ready', 'planned_date': '2026-06-02'},
            {'milestone_name': 'Solicitation Published', 'planned_date': '2026-06-03'},
            {'milestone_name': 'Bid Closing Date', 'planned_date': '2026-06-24'},
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

    def test_zpc_approval_accepts_modal_justification_payload(self):
        """ZPC approval should validate the grounds/justification sent with the approval request."""
        self.cpp.method = 'direct'
        self.cpp.status = 'pending_zpc'
        self.cpp.zpc_approval_required = True
        self.cpp.save(update_fields=['method', 'status', 'zpc_approval_required'])
        self._setup_cpp_for_submit()
        doc = CPPDocument.objects.create(
            cpp=self.cpp,
            document_type='strategy',
            description='Supporting evidence for non-open method',
            uploaded_by=self.user,
        )
        doc.document.save('supporting-evidence.pdf', ContentFile(b'PDF evidence'), save=True)

        zpc_user = User.objects.create_user(
            email='zpc@example.com',
            password='testpass123',
            full_name='ZPC Member',
            employee_id='ZPC001',
            role='zpc_member',
        )
        self.client.force_authenticate(user=zpc_user)
        url = reverse('cpp-approve', kwargs={'pk': self.cpp.cpp_id})
        response = self.client.post(url, {
            'zpc_grounds': 'Emergency procurement',
            'zpc_justification': 'Critical medicine stockout risk requires direct procurement.',
            'zpc_resolution_ref': 'ZPC/RES/2026/042',
        }, format='json')

        self.assertEqual(response.status_code, 200, f'Approval failed: {response.data}')
        self.cpp.refresh_from_db()
        self.assertEqual(self.cpp.status, 'approved')
        self.assertEqual(self.cpp.zpc_grounds, 'Emergency procurement')
        self.assertEqual(self.cpp.zpc_justification, 'Critical medicine stockout risk requires direct procurement.')
        self.assertEqual(self.cpp.zpc_resolution_ref, 'ZPC/RES/2026/042')
        self.assertEqual(self.cpp.zpc_approved_by, zpc_user)
        self.assertIsNotNone(self.cpp.zpc_approved_at)
