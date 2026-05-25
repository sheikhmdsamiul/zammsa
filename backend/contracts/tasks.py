from celery import shared_task
from django.utils import timezone
from django.core.mail import send_mail
from django.conf import settings
from datetime import timedelta

from .models import Contract


@shared_task
def check_retention_expiry_alerts():
    today = timezone.now().date()
    alert_window = today + timedelta(days=90)

    contracts = Contract.objects.filter(
        archived_at__isnull=False,
        retention_expiry__isnull=False,
        retention_expiry__lte=alert_window,
        retention_expiry__gte=today,
    ).select_related('supplier')

    for contract in contracts:
        days_left = (contract.retention_expiry - today).days
        subject = f"Retention Expiry Alert: {contract.contract_number} expires in {days_left} days"
        message = (
            f"Contract: {contract.contract_number}\n"
            f"Title: {contract.title}\n"
            f"Supplier: {contract.supplier.name if contract.supplier else 'N/A'}\n"
            f"Archived At: {contract.archived_at.date() if contract.archived_at else 'N/A'}\n"
            f"Retention Expiry: {contract.retention_expiry}\n"
            f"Days Remaining: {days_left}\n\n"
            f"Action Required: Review and prepare for secure deletion or extend retention per ZPPA guidelines."
        )
        recipient = getattr(settings, 'RETENTION_ALERT_RECIPIENT', 'records.manager@zammsa.gov.zm')
        send_mail(
            subject=subject,
            message=message,
            from_email=settings.DEFAULT_FROM_EMAIL,
            recipient_list=[recipient],
            fail_silently=False,
        )

    return f"Checked {contracts.count()} contracts nearing retention expiry"


@shared_task
def cleanup_expired_contracts():
    today = timezone.now().date()
    seven_years_ago = today - timedelta(days=365 * 7)

    expired = Contract.objects.filter(
        archived_at__isnull=False,
        retention_expiry__lte=seven_years_ago,
        legal_hold=False,
    )

    count = expired.count()
    for contract in expired:
        contract.status = 'deleted'
        contract.save()

    return f"Marked {count} contracts as deleted (retention expired)"
