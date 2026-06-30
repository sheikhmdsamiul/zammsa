from django.core.management.base import BaseCommand
from django.utils import timezone
from requisitions.models import Requisition


class Command(BaseCommand):
    help = 'Auto-cancel requisitions that have exceeded the 90-day expiry period'

    def handle(self, *args, **options):
        expired = Requisition.objects.filter(
            status__in=('draft', 'pending_dept_head', 'pending_finance', 'pending_dg', 'pending_zpc'),
        )
        count = 0
        for req in expired:
            if req.is_expired:
                old_status = req.status
                req.status = 'cancelled'
                req.save()
                count += 1
                self.stdout.write(
                    f'Cancelled {req.req_number}: {old_status} -> cancelled '
                    f'({req.days_since_creation} days since creation)'
                )
        self.stdout.write(self.style.SUCCESS(f'Expired {count} requisition(s)'))
