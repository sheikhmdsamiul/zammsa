from decimal import Decimal
from django.core.management.base import BaseCommand, CommandError
from django.db import transaction


class Command(BaseCommand):
    help = 'Create budget allocations for all departments in master data'

    def add_arguments(self, parser):
        parser.add_argument('--amount', type=float, default=0,
                            help='Default budget amount for departments without specific amounts')
        parser.add_argument('--fiscal-year', type=str, default='',
                            help='Fiscal year code (e.g. 2025-2026). Defaults to current fiscal year.')
        parser.add_argument('--by-dept', nargs='+', default=[],
                            help='Per-department budgets: dept_code=amount (e.g. HQ=5000000 FIN=3000000)')

    @transaction.atomic
    def handle(self, *args, **options):
        from master_data.models import Department, FiscalYear
        from finance.models import BudgetAllocation

        default_amount = Decimal(str(options['amount']))
        dept_overrides = {}
        for item in options['by_dept']:
            if '=' not in item:
                raise CommandError(f'Invalid --by-dept format: "{item}". Use dept_code=amount (e.g. HQ=5000000)')
            code, amount = item.split('=', 1)
            dept_overrides[code.upper()] = Decimal(amount)

        fy = None
        if options['fiscal_year']:
            fy = FiscalYear.objects.filter(year_code=options['fiscal_year']).first()
        else:
            fy = FiscalYear.objects.filter(is_current=True).first()

        if not fy:
            fy = FiscalYear.objects.order_by('-start_date').first()

        if not fy:
            raise CommandError('No fiscal year found. Run loaddata initial_data first.')

        departments = Department.objects.filter(is_active=True)
        if not departments.exists():
            raise CommandError('No active departments found. Run loaddata initial_data first.')

        created = 0
        updated = 0

        for dept in departments:
            amount = dept_overrides.get(dept.dept_code.upper(), default_amount)
            if amount <= 0:
                self.stdout.write(f'  Skipping {dept.dept_name} ({dept.dept_code}): no amount set')
                continue

            entity_code = dept.budget_code or dept.dept_code
            entity_level = dept.level or 'department'

            ba, is_new = BudgetAllocation.objects.update_or_create(
                entity_code=entity_code,
                fiscal_year=fy.year_code,
                defaults={
                    'entity_level': entity_level,
                    'entity_name': dept.dept_name,
                    'allocated_amount': amount,
                    'encumbered_amount': Decimal('0'),
                    'expended_amount': Decimal('0'),
                }
            )

            if is_new:
                created += 1
                self.stdout.write(f'  Created: {dept.dept_name} ({entity_code}) = K {amount:,.2f}')
            else:
                updated += 1
                self.stdout.write(f'  Updated: {dept.dept_name} ({entity_code}) = K {amount:,.2f}')

        self.stdout.write(self.style.SUCCESS(f'\nDone! {created} created, {updated} updated.'))
