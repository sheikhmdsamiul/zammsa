from django.core.management.base import BaseCommand
from accounts.models import User, ROLE_CHOICES

TEST_USERS = [
    {'email': 'procurement.officer@zammsa.gov.zm', 'role': 'procurement_officer', 'full_name': 'John Procurement'},
    {'email': 'finance.officer@zammsa.gov.zm', 'role': 'finance_officer', 'full_name': 'Jane Finance'},
    {'email': 'dept.head@zammsa.gov.zm', 'role': 'department_head', 'full_name': 'Robert Department'},
    {'email': 'director@zammsa.gov.zm', 'role': 'director_procurement', 'full_name': 'Alice Director'},
    {'email': 'dg@zammsa.gov.zm', 'role': 'director_general', 'full_name': 'Michael General'},
    {'email': 'zpc@zammsa.gov.zm', 'role': 'zpc_member', 'full_name': 'Sarah ZPC'},
    {'email': 'supplier@zammsa.gov.zm', 'role': 'supplier_user', 'full_name': 'David Supplier'},
    {'email': 'auditor@zammsa.gov.zm', 'role': 'auditor', 'full_name': 'Emily Auditor'},
    {'email': 'zppa@zammsa.zm', 'role': 'zppa_reporting_officer', 'full_name': 'ZPPA Reporting Officer'},
    {'email': 'evaluator@zammsa.gov.zm', 'role': 'evaluation_committee_member', 'full_name': 'Chris Evaluator'},
    {'email': 'contract@zammsa.gov.zm', 'role': 'contract_manager', 'full_name': 'Patricia Contract'},
    {'email': 'supplier.manager@zammsa.gov.zm', 'role': 'supplier_relationship_manager', 'full_name': 'Grace Supplier Relations'},
    {'email': 'staff@zammsa.gov.zm', 'role': 'user_dept_staff', 'full_name': 'Peter Staff'},
    {'email': 'bc@zammsa.gov.zm', 'role': 'budget_controller', 'full_name': 'Beatrice Budget'},
]


class Command(BaseCommand):
    help = 'Seed test users for development'

    def handle(self, *args, **options):
        for user_data in TEST_USERS:
            user, created = User.objects.update_or_create(
                email=user_data['email'],
                defaults={
                    'employee_id': f'TST-{user_data["role"][:3].upper()}-{hash(user_data["email"]) % 1000:03d}',
                    'full_name': user_data['full_name'],
                    'role': user_data['role'],
                    'is_active': True,
                }
            )
            user.set_password('Test@123')
            user.save()
            self.stdout.write(self.style.SUCCESS(f'Ready: {user_data["email"]} / Test@123'))
