from django.core.management.base import BaseCommand
from django.db import transaction


class Command(BaseCommand):
    help = 'Delete all transaction/dummy data from APP through Invoice pipeline'

    @transaction.atomic
    def handle(self, *args, **options):
        self.stdout.write('Cleaning up all transaction data...')

        # Finance
        from finance.models import (
            Invoice, Payment, LetterOfCredit, ThreeWayMatch,
            GoodsReceiptNote, BudgetAllocation, BudgetEncumbrance
        )
        fin_models = [
            ('BudgetEncumbrance', BudgetEncumbrance),
            ('ThreeWayMatch', ThreeWayMatch),
            ('Payment', Payment),
            ('GoodsReceiptNote', GoodsReceiptNote),
            ('LetterOfCredit', LetterOfCredit),
            ('Invoice', Invoice),
            ('BudgetAllocation', BudgetAllocation),
        ]
        for name, model in fin_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Contracts
        from contracts.models import (
            Contract, ContractMilestone, ContractSecurity,
            ContractAmendment, Appeal, LiquidatedDamages, ClosureChecklist
        )
        ctr_models = [
            ('ClosureChecklist', ClosureChecklist),
            ('LiquidatedDamages', LiquidatedDamages),
            ('ContractAmendment', ContractAmendment),
            ('Appeal', Appeal),
            ('ContractSecurity', ContractSecurity),
            ('ContractMilestone', ContractMilestone),
            ('Contract', Contract),
        ]
        for name, model in ctr_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Evaluations
        from evaluations.models import (
            EvaluationCommittee, TechnicalScore, FinancialEvaluation,
            CombinedScore, BidEvaluationReport, PreliminaryExam,
            PostQualification
        )
        eval_models = [
            ('PostQualification', PostQualification),
            ('PreliminaryExam', PreliminaryExam),
            ('CombinedScore', CombinedScore),
            ('FinancialEvaluation', FinancialEvaluation),
            ('TechnicalScore', TechnicalScore),
            ('BidEvaluationReport', BidEvaluationReport),
            ('EvaluationCommittee', EvaluationCommittee),
        ]
        for name, model in eval_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Bids
        from bids.models import (
            BidSubmission, BidSecurity, BidOpening,
            BidOpeningDetail, PreBidConference
        )
        bid_models = [
            ('BidOpeningDetail', BidOpeningDetail),
            ('BidSecurity', BidSecurity),
            ('PreBidConference', PreBidConference),
            ('BidOpening', BidOpening),
            ('BidSubmission', BidSubmission),
        ]
        for name, model in bid_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Solicitations
        from solicitations.models import Solicitation, SolicitationDocument, EvaluationCriterion
        sol_models = [
            ('SolicitationDocument', SolicitationDocument),
            ('EvaluationCriterion', EvaluationCriterion),
            ('Solicitation', Solicitation),
        ]
        for name, model in sol_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Requisitions
        from requisitions.models import Requisition, RequisitionItem, RequisitionApproval, Specification
        req_models = [
            ('RequisitionApproval', RequisitionApproval),
            ('Specification', Specification),
            ('RequisitionItem', RequisitionItem),
            ('Requisition', Requisition),
        ]
        for name, model in req_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Procurement Planning
        from procurement_planning.models import AnnualProcurementPlan, APPLineItem
        app_models = [
            ('APPLineItem', APPLineItem),
            ('AnnualProcurementPlan', AnnualProcurementPlan),
        ]
        for name, model in app_models:
            count = model.objects.all().delete()[0]
            self.stdout.write(f'  {name}: {count} deleted')

        # Reporting
        from reporting.models import ProcurementWarehouse
        count = ProcurementWarehouse.objects.all().delete()[0]
        self.stdout.write(f'  ProcurementWarehouse: {count} deleted')

        # Audit Logs
        from accounts.models import AuditLog
        count = AuditLog.objects.all().delete()[0]
        self.stdout.write(f'  AuditLog: {count} deleted')

        # Suppliers (from seed_data/seed_transactions)
        from suppliers.models import Supplier
        count = Supplier.objects.all().delete()[0]
        self.stdout.write(f'  Supplier: {count} deleted')

        # Remove non-essential test users created by seeds
        from accounts.models import User
        test_emails = [
            'supplier1@pharmahealth.zm', 'supplier2@medsupply.zm',
            'supplier3@globalmed.zm', 'vendor@healthpharma.zm',
            'vendor@healthpharma.zm',
        ]
        for email in test_emails:
            deleted, _ = User.objects.filter(email=email).delete()
            if deleted:
                self.stdout.write(f'  User {email}: deleted')

        self.stdout.write(self.style.SUCCESS('All transaction data cleaned up successfully!'))
