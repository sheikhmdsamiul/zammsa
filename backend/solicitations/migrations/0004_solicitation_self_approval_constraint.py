from django.db import migrations, models
from django.db.models import F, Q


class Migration(migrations.Migration):

    dependencies = [
        ('solicitations', '0003_alter_solicitation_opening_date_and_more'),
    ]

    operations = [
        migrations.AddConstraint(
            model_name='solicitation',
            constraint=models.CheckConstraint(
                check=~Q(created_by=F('approved_by')),
                name='sol_no_self_approval',
            ),
        ),
    ]
