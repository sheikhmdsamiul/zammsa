from django.core.management.base import BaseCommand
from contracts.models import Contract, ContractMilestone
from contracts.views import _copy_cpp_milestones_to_contract, _generate_po_for_contract


class Command(BaseCommand):
    help = 'Backfill missing post-award milestones and POs on active contracts'

    def handle(self, *args, **options):
        from finance.models import PurchaseOrder
        active = Contract.objects.filter(status='active')
        mil_updated = 0
        mil_skipped = 0
        mil_errors = 0
        po_created = 0
        po_skipped = 0
        po_errors = 0

        for contract in active:
            # --- Milestones ---
            existing = contract.milestones.count()
            if existing > 0:
                self.stdout.write(f'{contract.contract_number}: already has {existing} milestones — skipped')
                mil_skipped += 1
            else:
                result = _copy_cpp_milestones_to_contract(contract)
                created = result.get('created', 0)
                if result.get('success') and created > 0:
                    mil_updated += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'{contract.contract_number}: created {created} milestones'
                    ))
                else:
                    mil_errors += 1
                    self.stderr.write(
                        f'{contract.contract_number}: milestone ERROR — {result.get("error", "unknown")}'
                    )

            # --- Purchase Order ---
            if PurchaseOrder.objects.filter(contract=contract).exists():
                self.stdout.write(f'{contract.contract_number}: already has PO — skipped')
                po_skipped += 1
            else:
                po_result = _generate_po_for_contract(contract)
                if po_result.get('success'):
                    po_created += 1
                    self.stdout.write(self.style.SUCCESS(
                        f'{contract.contract_number}: PO created'
                    ))
                else:
                    po_errors += 1
                    self.stderr.write(
                        f'{contract.contract_number}: PO ERROR — {po_result.get("error", "unknown")}'
                    )

        self.stdout.write(self.style.SUCCESS(
            f'Done. Milestones: {mil_updated} updated, {mil_skipped} skipped, {mil_errors} errors | '
            f'POs: {po_created} created, {po_skipped} skipped, {po_errors} errors'
        ))
