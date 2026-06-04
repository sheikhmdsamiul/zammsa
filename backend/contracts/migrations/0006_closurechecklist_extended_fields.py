# Generated manually to add extended closure checklist fields

from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('contracts', '0005_contractamendment_signed_by_authority_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='closurechecklist',
            name='acceptance_certificate_issued',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='closurechecklist',
            name='all_docs_saved',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='closurechecklist',
            name='liquidated_damages_deducted',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='closurechecklist',
            name='no_outstanding_disputes',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='closurechecklist',
            name='no_pending_amendments',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='closurechecklist',
            name='retention_released',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='closurechecklist',
            name='supplier_evaluation_completed',
            field=models.BooleanField(default=False),
        ),
    ]
