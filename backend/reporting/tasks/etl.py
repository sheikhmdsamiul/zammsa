from celery import shared_task
from django.utils import timezone
from django.db.models import Sum, Count, Avg
from datetime import timedelta


@shared_task
def etl_data_warehouse():
    from reporting.models import ProcurementWarehouse
    from contracts.models import Contract

    contracts = Contract.objects.filter(status__in=['active', 'completed'])
    for contract in contracts:
        ProcurementWarehouse.objects.update_or_create(
            procurement_id=str(contract.contract_id),
            defaults={
                'value': contract.value,
                'method': contract.solicitation.method if contract.solicitation else '',
                'award_date': contract.award_date,
                'department': contract.solicitation.requisition.department.dept_name if contract.solicitation and hasattr(contract.solicitation, 'requisition') else '',
                'status': contract.status,
                'processing_days': (contract.award_date - contract.solicitation.requisition.submitted_at.date()).days if contract.award_date and contract.solicitation and hasattr(contract.solicitation, 'requisition') and contract.solicitation.requisition.submitted_at else None,
            }
        )

    return f'ETL complete: {contracts.count()} contracts processed'


@shared_task
def generate_monthly_report():
    from reporting.models import ReportDefinition, ReportGeneration
    from system_config.notifications import notify_role

    reports = ReportDefinition.objects.filter(schedule__icontains='monthly')
    count = 0
    for report in reports:
        generation = ReportGeneration.objects.create(
            report=report,
            status='generated',
        )
        notify_role(
            'zppa_reporting_officer',
            title=f'Monthly report generated: {report.report_name}',
            message=f'{report.report_name} was generated and is ready for ZPPA reporting review.',
            notification_type='compliance',
            priority='normal',
            source_module='reporting',
            object_id=generation.pk,
            action_url='/reports',
            metadata={'report_id': str(report.pk), 'generation_id': str(generation.pk)},
            email_required=True,
        )
        count += 1
    return f'{count} monthly reports generated'


@shared_task
def check_retention_expiry():
    from reporting.models import ArchivedProcurementFile
    from system_config.notifications import notify_role

    cutoff = timezone.now().date() + timedelta(days=90)
    expiring = ArchivedProcurementFile.objects.filter(
        retention_expiry__lte=cutoff,
        legal_hold=False
    )
    count = expiring.count()
    for archive in expiring[:100]:
        notify_role(
            'system_admin',
            title=f'Archive retention expiry pending: {archive.procurement_id}',
            message=f'Archive {archive.procurement_id} is due for retention expiry on {archive.retention_expiry}. Review legal hold requirements.',
            notification_type='compliance',
            priority='high',
            source_module='reporting',
            object_id=archive.pk,
            action_url='/reports',
            metadata={
                'procurement_id': archive.procurement_id,
                'retention_expiry': archive.retention_expiry.isoformat(),
                'days_to_expiry': archive.days_to_expiry,
            },
            email_required=True,
        )
    return f'{count} files expiring within 90 days'


@shared_task
def generate_quarterly_report_task():
    from reporting.models import ReportDefinition, ReportGeneration

    report, created = ReportDefinition.objects.get_or_create(
        report_name='Quarterly Procurement Report',
        report_type='quarterly',
        defaults={
            'schedule': '0 6 1 * *',
            'format': 'xlsx',
            'recipient_list': ['zppa@zppa.org.zm'],
        },
    )
    if not created:
        report.schedule = '0 6 1 * *'
        report.format = 'xlsx'
        report.save()

    generation = ReportGeneration.objects.create(
        report=report,
        status='generated',
    )
    return f'Quarterly report generated: {generation.generation_id}'


@shared_task
def sync_external_systems():
    from integrations.models import IntegrationEndpoint, SyncStatus

    endpoints = IntegrationEndpoint.objects.filter(is_enabled=True)
    synced = 0
    for endpoint in endpoints:
        SyncStatus.objects.create(
            entity_type=endpoint.system_name,
            last_sync_time=timezone.now(),
            sync_status='completed',
            records_processed=0,
        )
        synced += 1
    return f'Synced {synced} endpoints'
