from django.core.management.base import BaseCommand
from suppliers.models import Supplier, VendorApplication
from accounts.models import User


class Command(BaseCommand):
    help = 'Create test VendorApplication and Supplier records for the supplier test user'

    def handle(self, *args, **options):
        email = 'supplier@zammsa.gov.zm'
        user = User.objects.filter(email=email).first()
        if not user:
            self.stdout.write(self.style.ERROR(f'User {email} not found. Run seed_test_users first.'))
            return

        reg_number = 'SUP-2026-001'
        tin = '1000000001'

        supplier, s_created = Supplier.objects.get_or_create(
            registration_number=reg_number,
            defaults={
                'tin': tin,
                'name': 'ZAMMSA Test Supplier Ltd',
                'ceec_category': 'citizen_owned',
                'status': 'active',
                'bank_name': 'ZANACO',
                'bank_account_number': '1234567890',
                'bank_account_name': 'ZAMMSA Test Supplier Ltd',
            },
        )
        if s_created:
            self.stdout.write(self.style.SUCCESS(f'Created Supplier: {supplier.name} ({reg_number})'))
        else:
            self.stdout.write(f'Supplier already exists: {supplier.name} ({reg_number})')

        application, a_created = VendorApplication.objects.get_or_create(
            email=email,
            defaults={
                'company_name': 'ZAMMSA Test Supplier Ltd',
                'registration_number': reg_number,
                'tin': tin,
                'business_type': 'Private Limited Company',
                'year_established': '2015',
                'employee_count': '50-100',
                'annual_turnover': 'ZMW 5,000,000',
                'ceec_certificate_number': 'CEEC-2026-TEST',
                'ceec_category': 'citizen_owned',
                'contact_person': 'Test Supplier Contact',
                'contact_phone': '+260-977-123456',
                'contact_email': email,
                'address': '123 Test Street, Lusaka, Zambia',
                'bank_name': 'ZANACO',
                'bank_account_number': '1234567890',
                'bank_account_name': 'ZAMMSA Test Supplier Ltd',
                'bank_branch': 'Lusaka Main',
                'commodity_categories': ['Medical Supplies', 'Laboratory Equipment'],
                'pacra_validated': True,
                'ceec_validated': True,
                'status': 'approved',
            },
        )
        if a_created:
            self.stdout.write(self.style.SUCCESS(f'Created VendorApplication for {email}'))
        else:
            self.stdout.write(f'VendorApplication already exists for {email}')

        self.stdout.write(self.style.SUCCESS('Done! Supplier test user now has a vendor profile.'))
