from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('bids', '0005_bidopening_status_bidopening_witness_signatures_and_more'),
    ]

    operations = [
        migrations.AddField(
            model_name='bidopening',
            name='completed_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bidopening',
            name='observations',
            field=models.TextField(blank=True, default=''),
        ),
        migrations.AddField(
            model_name='bidopening',
            name='public_live_link',
            field=models.CharField(blank=True, default='', max_length=255),
        ),
        migrations.AddField(
            model_name='bidopening',
            name='scheduled_opening_time',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bidopening',
            name='started_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bidopening',
            name='viewers_connected',
            field=models.IntegerField(default=0),
        ),
        migrations.AddField(
            model_name='bidopeningdetail',
            name='is_opened',
            field=models.BooleanField(default=False),
        ),
        migrations.AddField(
            model_name='bidopeningdetail',
            name='opened_at',
            field=models.DateTimeField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name='bidopeningdetail',
            name='security_amount_read',
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=20, null=True),
        ),
        migrations.AddField(
            model_name='bidopeningdetail',
            name='security_verified_read',
            field=models.BooleanField(default=False),
        ),
    ]
