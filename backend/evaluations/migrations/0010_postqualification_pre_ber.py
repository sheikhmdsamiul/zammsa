from django.db import migrations, models
import django.db.models.deletion


class Migration(migrations.Migration):

    dependencies = [
        ('evaluations', '0009_traceable_ids'),
    ]

    operations = [
        migrations.AlterField(
            model_name='postqualification',
            name='ber',
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name='post_qualifications',
                to='evaluations.bidevaluationreport',
            ),
        ),
    ]
