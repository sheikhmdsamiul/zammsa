from django.db import migrations, models
from django.utils import timezone


def backfill_solicitation_and_stage(apps, schema_editor):
    PostQualification = apps.get_model('evaluations', 'PostQualification')
    BidSubmission = apps.get_model('bids', 'BidSubmission')
    for pq in PostQualification.objects.iterator():
        updated = False
        if not pq.solicitation_id and pq.bidder_id:
            try:
                bid = BidSubmission.objects.get(pk=pq.bidder_id)
                pq.solicitation_id = bid.solicitation_id
                updated = True
            except Exception:
                pass
        if not pq.workflow_stage or pq.workflow_stage == '':
            if pq.status == 'cleared':
                pq.workflow_stage = 'closed'
            elif pq.status == 'failed':
                pq.workflow_stage = 'closed'
            elif pq.verification_items and len(pq.verification_items) > 0:
                pq.workflow_stage = 'desktop_review'
            else:
                pq.workflow_stage = 'initiation'
            updated = True
        if not pq.initiation_date:
            pq.initiation_date = pq.created_at or timezone.now()
            updated = True
        if not pq.result:
            if pq.chair_decision == 'passed':
                pq.result = 'award'
                updated = True
            elif pq.chair_decision == 'failed':
                pq.result = 'no_award'
                updated = True
        if updated:
            pq.save(update_fields=['solicitation', 'workflow_stage', 'initiation_date', 'result'])


class Migration(migrations.Migration):

    dependencies = [
        ('evaluations', '0023_pq_redesign_workflow'),
    ]

    operations = [
        migrations.RunPython(backfill_solicitation_and_stage, migrations.RunPython.noop),
    ]
