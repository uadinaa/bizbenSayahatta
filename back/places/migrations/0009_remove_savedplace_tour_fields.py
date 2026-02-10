from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0008_savedplace_tour_fields"),
    ]

    operations = [
        migrations.RemoveField(
            model_name="savedplace",
            name="duration_days",
        ),
        migrations.RemoveField(
            model_name="savedplace",
            name="notes",
        ),
        migrations.RemoveField(
            model_name="savedplace",
            name="tour_currency",
        ),
        migrations.RemoveField(
            model_name="savedplace",
            name="tour_date",
        ),
        migrations.RemoveField(
            model_name="savedplace",
            name="tour_price",
        ),
    ]
