from django.db import migrations, models


class Migration(migrations.Migration):

    dependencies = [
        ("places", "0009_remove_savedplace_tour_fields"),
    ]

    operations = [
        migrations.AddField(
            model_name="visitedplace",
            name="visited_at",
            field=models.DateTimeField(blank=True, null=True),
        ),
    ]
