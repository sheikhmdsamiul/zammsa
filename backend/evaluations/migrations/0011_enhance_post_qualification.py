from django.db import migrations, models
import django.db.models.deletion
import django.utils.timezone


class Migration(migrations.Migration):

    dependencies = [
        ('accounts', '0001_initial'),
        ('bids', '0001_initial'),
        ('evaluations', '0010_postqualification_pre_ber'),
    ]

    operations = [
        migrations.AddField(
            model_name='postqualification',
            name='assigned_to',
            field=models.ForeignKey(
                blank=True, null=True,
                on_delete=django.db.models.deletion.SET_NULL,
                related_name='pq_assignments',
                to='accounts.user',
                help_text='Procurement Officer responsible for verification',
            ),
        ),
        migrations.AddField(
            model_name='postqualification',
            name='created_at',
            field=models.DateTimeField(auto_now_add=True, default=django.utils.timezone.now),
            preserve_default=False,
        ),
        migrations.AddField(
            model_name='postqualification',
            name='updated_at',
            field=models.DateTimeField(auto_now=True),
        ),
        migrations.AddField(
            model_name='postqualification',
            name='notes',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AlterField(
            model_name='postqualification',
            name='status',
            field=models.CharField(
                choices=[
                    ('pending', 'Pending'),
                    ('in_progress', 'In Progress'),
                    ('cleared', 'Cleared'),
                    ('failed', 'Failed'),
                ],
                default='pending',
                max_length=20,
            ),
        ),
        migrations.AlterField(
            model_name='postqualification',
            name='verification_items',
            field=models.JSONField(
                blank=True, default=list,
                help_text='List of {id, label, category, status, notes, verified_by, verified_at}',
            ),
        ),
    ]
