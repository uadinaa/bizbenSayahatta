from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0007_visitedplace"),
    ]

    operations = [
        migrations.AddField(
            model_name="savedplace",
            name="duration_days",
            field=models.PositiveIntegerField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="savedplace",
            name="notes",
            field=models.TextField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="savedplace",
            name="tour_currency",
            field=models.CharField(blank=True, max_length=10, null=True),
        ),
        migrations.AddField(
            model_name="savedplace",
            name="tour_date",
            field=models.DateField(blank=True, null=True),
        ),
        migrations.AddField(
            model_name="savedplace",
            name="tour_price",
            field=models.DecimalField(blank=True, decimal_places=2, max_digits=10, null=True),
        ),
    ]
