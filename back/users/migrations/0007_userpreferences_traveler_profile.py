from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0006_add_privacy_settings"),
    ]

    operations = [
        migrations.AddField(
            model_name="userpreferences",
            name="badges",
            field=models.JSONField(blank=True, default=list),
        ),
        migrations.AddField(
            model_name="userpreferences",
            name="citizenship",
            field=models.CharField(blank=True, default="", max_length=80),
        ),
        migrations.AddField(
            model_name="userpreferences",
            name="traveler_level",
            field=models.CharField(blank=True, default="Explorer", max_length=64),
        ),
    ]
