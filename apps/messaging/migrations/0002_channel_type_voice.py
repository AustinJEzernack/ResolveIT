from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ('messaging', '0001_initial'),
    ]

    operations = [
        migrations.AlterField(
            model_name='channel',
            name='type',
            field=models.CharField(
                choices=[
                    ('DIRECT', 'Direct Message'),
                    ('PRIVATE', 'Private Channel'),
                    ('PUBLIC', 'Public Channel'),
                    ('VOICE', 'Voice Channel'),
                ],
                db_index=True,
                max_length=10,
            ),
        ),
    ]
