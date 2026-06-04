from django.core.management.base import BaseCommand
from accounts.models import User

TEST_PASSWORD = 'Test@123'

# Mirrors frontend/src/components/auth/Login.tsx TEST_ACCOUNTS
TEST_USERS = [
    {'email': 'admin@zammsa.gov.zm', 'role': 'system_admin', 'full_name': 'System Admin', 'employee_id': 'EMP-ADMIN'},
    {'email': 'dg@zammsa.gov.zm', 'role': 'director_general', 'full_name': 'Director General', 'employee_id': 'EMP-DG'},
    {'email': 'director@zammsa.gov.zm', 'role': 'director_procurement', 'full_name': 'Director of Procurement', 'employee_id': 'EMP-DIR-PROC'},
    {'email': 'procurement.officer@zammsa.gov.zm', 'role': 'procurement_officer', 'full_name': 'Procurement Officer', 'employee_id': 'EMP-PROC-OFF'},
    {'email': 'dept.head@zammsa.gov.zm', 'role': 'department_head', 'full_name': 'Department Head', 'employee_id': 'EMP-DEPT-HEAD'},
    {'email': 'staff@zammsa.gov.zm', 'role': 'user_dept_staff', 'full_name': 'Department Staff', 'employee_id': 'EMP-STAFF'},
    {'email': 'bc@zammsa.gov.zm', 'role': 'budget_controller', 'full_name': 'Budget Controller', 'employee_id': 'EMP-BC'},
    {'email': 'finance.officer@zammsa.gov.zm', 'role': 'finance_officer', 'full_name': 'Finance Officer', 'employee_id': 'EMP-FIN'},
    {'email': 'zpc@zammsa.gov.zm', 'role': 'zpc_member', 'full_name': 'ZPC Member', 'employee_id': 'EMP-ZPC'},
    {'email': 'evaluator@zammsa.gov.zm', 'role': 'evaluation_committee_member', 'full_name': 'EC Member', 'employee_id': 'EMP-EC1'},
    {'email': 'ecm3@zammsa.gov.zm', 'role': 'evaluation_committee_member', 'full_name': 'EC Member Alice', 'employee_id': 'EMP-EC3'},
    {'email': 'ecm4@zammsa.gov.zm', 'role': 'evaluation_committee_member', 'full_name': 'EC Member Brian', 'employee_id': 'EMP-EC4'},
    {'email': 'contract@zammsa.gov.zm', 'role': 'contract_manager', 'full_name': 'Contract Manager', 'employee_id': 'EMP-CONTRACT'},
    {'email': 'zppa@zammsa.gov.zm', 'role': 'zppa_reporting_officer', 'full_name': 'ZPPA Reporter', 'employee_id': 'EMP-ZPPA'},
    {'email': 'auditor@zammsa.gov.zm', 'role': 'auditor', 'full_name': 'Auditor', 'employee_id': 'EMP-AUDITOR'},
    {'email': 'supplier@zammsa.gov.zm', 'role': 'supplier_user', 'full_name': 'Supplier User', 'employee_id': 'EMP-SUPPLIER'},
    {'email': 'supplier.manager@zammsa.gov.zm', 'role': 'supplier_relationship_manager', 'full_name': 'Supplier Relations Manager', 'employee_id': 'EMP-SRM'},
    {'email': 'pm@zammsa.gov.zm', 'role': 'procurement_manager', 'full_name': 'Procurement Manager', 'employee_id': 'EMP-PM'},
    {'email': 'ecchair@zammsa.gov.zm', 'role': 'evaluation_committee_chair', 'full_name': 'EC Chair', 'employee_id': 'EMP-EC-CHAIR'},
    {'email': 'integration@zammsa.gov.zm', 'role': 'integration_manager', 'full_name': 'Integration Manager', 'employee_id': 'EMP-INTEGRATION'},
]


class Command(BaseCommand):
    help = 'Create or update quick-login test users (password: Test@123)'

    def add_arguments(self, parser):
        parser.add_argument(
            '--reset-passwords',
            action='store_true',
            help='Reset passwords to Test@123 for all test accounts',
        )

    def handle(self, *args, **options):
        created = 0
        updated = 0
        reset = options['reset_passwords']

        for spec in TEST_USERS:
            user, was_created = User.objects.get_or_create(
                email=spec['email'],
                defaults={
                    'employee_id': spec['employee_id'],
                    'full_name': spec['full_name'],
                    'role': spec['role'],
                    'is_active': True,
                    'must_change_password': False,
                    'mfa_enabled': False,
                },
            )
            if was_created:
                user.set_password(TEST_PASSWORD)
                user.save()
                created += 1
                self.stdout.write(self.style.SUCCESS(f'Created {spec["email"]}'))
                continue

            changed = False
            for field in ('full_name', 'role', 'employee_id'):
                if getattr(user, field) != spec[field]:
                    setattr(user, field, spec[field])
                    changed = True
            if not user.is_active:
                user.is_active = True
                changed = True
            if user.mfa_enabled:
                user.mfa_enabled = False
                changed = True
            if user.must_change_password:
                user.must_change_password = False
                changed = True
            if user.is_locked():
                user.reset_failed_attempts()
                changed = True
            if reset or not user.check_password(TEST_PASSWORD):
                user.set_password(TEST_PASSWORD)
                changed = True
            if changed:
                user.save()
                updated += 1
                self.stdout.write(f'Updated {spec["email"]}')

        self.stdout.write(
            self.style.SUCCESS(f'Done: {created} created, {updated} updated ({len(TEST_USERS)} accounts)')
        )
