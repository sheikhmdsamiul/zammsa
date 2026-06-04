from datetime import date, timedelta
from decimal import Decimal
from django.core.management.base import BaseCommand
from django.db import transaction
from django.utils import timezone


DEPARTMENT_SPECS = [
    {
        'code': 'HQ',
        'name': 'Headquarters',
        'level': 'national',
        'region': 'Lusaka',
        'budget_code': 'HQ-BUDGET',
    },
]


REQUISITIONS = [
    {
        'description': 'Annual IT Equipment and Infrastructure Procurement',
        'required_date': date(2026, 9, 30),
        'delivery_location': 'ZAMMSA Headquarters, Lusaka',
        'estimated_total': 1250000,
        'items': [
            {
                'description': 'Enterprise Server Infrastructure',
                'quantity': 5, 'unit_price_estimate': 120000,
            },
            {
                'description': 'Workstation Computers (High-Performance)',
                'quantity': 50, 'unit_price_estimate': 8500,
            },
            {
                'description': 'Network Security Appliances',
                'quantity': 3, 'unit_price_estimate': 45000,
            },
        ],
    },
    {
        'description': 'Office Furniture and Fittings - Phase 2',
        'required_date': date(2026, 8, 15),
        'delivery_location': 'ZAMMSA Headquarters, Lusaka',
        'estimated_total': 750000,
        'items': [
            {
                'description': 'Executive Office Desks',
                'quantity': 20, 'unit_price_estimate': 12000,
            },
            {
                'description': 'Ergonomic Office Chairs',
                'quantity': 100, 'unit_price_estimate': 3500,
            },
            {
                'description': 'Filing Cabinets (4-Drawer)',
                'quantity': 30, 'unit_price_estimate': 2800,
            },
        ],
    },
]

CPP_SPECS = [
    {
        'method': 'open_tender',
        'estimated_value': 1250000,
        'procurement_strategy': 'Open National Bidding with 30% citizen preference',
        'overall_risk_level': 'medium',
        'milestones': [
            ('Advertisement / Invitation to Bid', 1, 15),
            ('Bid Opening and Evaluation', 2, 45),
            ('Contract Award', 3, 75),
            ('Delivery and Installation', 4, 120),
            ('Acceptance and Commissioning', 5, 150),
        ],
        'risks': [
            ('supply', 'Potential global supply chain delays for server hardware',
             'medium', 'high', 'Order 30 days early; maintain approved vendor list of at least 3'),
            ('price', 'Foreign exchange volatility affecting import costs',
             'medium', 'medium', 'Include forex adjustment clause; lock exchange rate at bid submission'),
            ('quality', 'Non-compliant equipment specifications',
             'medium', 'high', 'Mandatory pre-bid meeting; technical evaluation with pass/fail criteria'),
        ],
    },
    {
        'method': 'open_tender',
        'estimated_value': 750000,
        'procurement_strategy': 'Open National Bidding with local content preference',
        'overall_risk_level': 'low',
        'milestones': [
            ('Advertisement / Invitation to Bid', 1, 10),
            ('Bid Opening and Evaluation', 2, 35),
            ('Contract Award', 3, 60),
            ('Delivery and Installation', 4, 90),
            ('Acceptance and Commissioning', 5, 110),
        ],
        'risks': [
            ('delivery', 'Manufacturing delays by local suppliers',
             'low', 'medium', 'Include liquidated damages clause at 0.5% per week'),
            ('quality', 'Inferior materials in furniture',
             'low', 'high', 'Require sample submission and material testing before mass production'),
        ],
    },
]


class Command(BaseCommand):
    help = 'Seed sample Contract Procurement Plans (CPPs) with approved requisitions, APP, milestones, and risks'

    def add_arguments(self, parser):
        parser.add_argument(
            '--clear',
            action='store_true',
            help='Remove all existing CPP seed data before seeding',
        )

    @transaction.atomic
    def handle(self, *args, **options):
        from master_data.models import FiscalYear, Department, UnitOfMeasure, Commodity, FundingSource
        from finance.models import BudgetAllocation
        from requisitions.models import Requisition, RequisitionItem, RequisitionApproval
        from procurement_planning.models import (
            AnnualProcurementPlan,
            APPLineItem,
            ContractProcurementPlan,
            ProcurementMilestone,
            CPPRisk,
        )
        from accounts.models import User

        if options['clear']:
            self._clear_data(ContractProcurementPlan, CPPRisk, ProcurementMilestone,
                             APPLineItem, AnnualProcurementPlan, RequisitionItem,
                             RequisitionApproval, Requisition)
            self.stdout.write(self.style.WARNING('Cleared existing CPP seed data'))

        fy = self._get_or_create_fiscal_year(FiscalYear)
        dept = self._get_or_create_department(Department)
        self._ensure_budget_allocation(BudgetAllocation, dept, fy.year_code)

        uom = self._get_or_create_uom(UnitOfMeasure)
        commodity = self._get_or_create_commodity(Commodity, uom)
        funding_source = self._get_or_create_funding_source(FundingSource)
        procurement_officer = User.objects.filter(
            role__in=('procurement_officer', 'system_admin')
        ).first()
        if not procurement_officer:
            procurement_officer = User.objects.filter(is_superuser=True).first()
        if not procurement_officer:
            procurement_officer = User.objects.create(
                email='procurement@zammsa.gov.zm',
                role='procurement_officer',
                full_name='Procurement Officer',
                employee_id='EMP-SEED',
                is_active=True,
            )
            procurement_officer.set_password('Test@123')
            procurement_officer.save()

        app = self._get_or_create_app(AnnualProcurementPlan, APPLineItem, fy, dept, funding_source, commodity)

        for req_spec, cpp_spec in zip(REQUISITIONS, CPP_SPECS):
            req = self._get_or_create_requisition(
                Requisition, RequisitionItem, RequisitionApproval,
                req_spec, dept, procurement_officer, uom, commodity, app,
            )
            self._get_or_create_cpp(
                ContractProcurementPlan, ProcurementMilestone, CPPRisk,
                cpp_spec, req, procurement_officer,
            )

        self.stdout.write(self.style.SUCCESS(
            f'Done. Seeded {len(CPP_SPECS)} approved CPP(s) for {dept.dept_name}.'
        ))

    # ------------------------------------------------------------------
    # helpers
    # ------------------------------------------------------------------

    def _clear_data(self, *models):
        for model in reversed(models):
            model.objects.all().delete()

    def _get_or_create_fiscal_year(self, model):
        fy = model.objects.filter(year_code='2026').first()
        if fy:
            return fy
        fy = model.objects.filter(is_current=True).first()
        if fy:
            return fy
        fy = model.objects.create(
            year_code='2026',
            start_date=date(2026, 1, 1),
            end_date=date(2026, 12, 31),
            is_current=True,
        )
        self.stdout.write(f'  Created FiscalYear: {fy.year_code}')
        return fy

    def _get_or_create_department(self, model):
        spec = DEPARTMENT_SPECS[0]
        dept, created = model.objects.get_or_create(
            dept_code=spec['code'],
            defaults={
                'dept_name': spec['name'],
                'level': spec['level'],
                'region': spec['region'],
                'budget_code': spec['budget_code'],
                'is_active': True,
            },
        )
        if created:
            self.stdout.write(f'  Created Department: {dept.dept_name}')
        return dept

    def _ensure_budget_allocation(self, model, dept, fy_code):
        entity_code = dept.budget_code or dept.dept_code
        model.objects.update_or_create(
            entity_code=entity_code,
            fiscal_year=fy_code,
            defaults={
                'entity_level': dept.level or 'department',
                'entity_name': dept.dept_name,
                'allocated_amount': Decimal('5000000'),
                'encumbered_amount': Decimal('0'),
                'expended_amount': Decimal('0'),
            },
        )

    def _get_or_create_uom(self, model):
        uom, created = model.objects.get_or_create(
            uom_code='LOT',
            defaults={'uom_name': 'Lot', 'category': 'procurement'},
        )
        if created:
            self.stdout.write(f'  Created UOM: {uom.uom_code}')
        return uom

    def _get_or_create_commodity(self, model, uom):
        comm, created = model.objects.get_or_create(
            commodity_code='IT-EQUIP',
            defaults={
                'commodity_name': 'IT Equipment and Infrastructure',
                'category': 'Information Technology',
                'sub_category': 'Hardware',
                'unit_of_measure': uom,
                'is_active': True,
            },
        )
        if created:
            self.stdout.write(f'  Created Commodity: {comm.commodity_name}')
        return comm

    def _get_or_create_funding_source(self, model):
        fs, created = model.objects.get_or_create(
            source_code='GOZ',
            defaults={
                'source_name': 'Government of Zambia',
                'type': 'government',
                'budget_reference': 'GRZ-TREASURY-2026',
                'is_active': True,
            },
        )
        if created:
            self.stdout.write(f'  Created FundingSource: {fs.source_name}')
        return fs

    def _get_or_create_app(self, model, line_item_model, fy, dept, funding_source, commodity):
        app, created = model.objects.get_or_create(
            fiscal_year=fy,
            department=dept,
            defaults={'status': 'approved'},
        )
        if created:
            total = Decimal('0')
            for req_spec in REQUISITIONS:
                line_item, _ = line_item_model.objects.get_or_create(
                    app=app,
                    description=req_spec['description'],
                    defaults={
                        'procurement_type': 'goods',
                        'estimated_value': req_spec['estimated_total'],
                        'funding_source': funding_source,
                        'commodity': commodity,
                        'is_citizen_reserved': True,
                    },
                )
                total += req_spec['estimated_total']
                self.stdout.write(f'    APP Line Item: {line_item.description[:60]}')
            model.objects.filter(pk=app.pk).update(total_estimated_value=total)
            self.stdout.write(f'  Created AnnualProcurementPlan for {dept.dept_name}')
        return app

    def _get_or_create_requisition(self, model, item_model, approval_model,
                                   spec, dept, user, uom, commodity, app):
        description_key = spec['description'][:50]
        req = model.objects.filter(description__startswith=description_key).first()
        if req:
            return req

        req = model.objects.create(
            department=dept,
            requester=user,
            description=spec['description'],
            estimated_total=spec['estimated_total'],
            required_date=spec['required_date'],
            delivery_location=spec['delivery_location'],
            status='approved',
            budget_validated=True,
            submitted_at=timezone.now(),
            approved_at=timezone.now(),
        )
        self.stdout.write(f'  Created Requisition: {req.req_number}')

        for i, item_spec in enumerate(spec['items']):
            item_model.objects.create(
                requisition=req,
                description=item_spec['description'],
                quantity=item_spec['quantity'],
                unit_of_measure=uom,
                unit_price_estimate=item_spec['unit_price_estimate'],
                commodity=commodity,
                item_code=f'{req.req_number}-{i+1:02d}',
            )

        approval_model.objects.create(
            requisition=req,
            approver=user,
            approval_level='procurement',
            decision='approved',
            approved_at=timezone.now(),
        )

        return req

    def _get_or_create_cpp(self, model, milestone_model, risk_model,
                           spec, req, user):
        cpp = model.objects.filter(requisition=req).first()
        if cpp:
            return cpp

        cpp = model.objects.create(
            requisition=req,
            method=spec['method'],
            recommended_method=spec['method'],
            procurement_strategy=spec['procurement_strategy'],
            estimated_value=spec['estimated_value'],
            overall_risk_level=spec['overall_risk_level'],
            status='approved',
            created_by=user,
            approved_by=user,
            approved_at=timezone.now(),
        )
        self.stdout.write(f'  Created CPP: {cpp.cpp_number}')

        for name, seq, days_from_now in spec['milestones']:
            milestone_model.objects.create(
                cpp=cpp,
                milestone_name=name,
                sequence_number=seq,
                planned_date=date.today() + timedelta(days=days_from_now),
            )

        for category, desc, likelihood, impact, mitigation in spec['risks']:
            risk_model.objects.create(
                cpp=cpp,
                risk_category=category,
                risk_description=desc,
                likelihood=likelihood,
                impact=impact,
                mitigation_strategy=mitigation,
                risk_owner='Procurement Officer',
            )

        return cpp
