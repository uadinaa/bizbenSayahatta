import django.db.models.deletion
from django.db import migrations, models
from django.db.models import Q


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0009_remove_comment_trip_and_restore_place_required"),
    ]

    operations = [
        migrations.AddField(
            model_name="comment",
            name="trip",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="marketplace.trip",
            ),
        ),
        migrations.AlterField(
            model_name="comment",
            name="place",
            field=models.ForeignKey(
                blank=True,
                null=True,
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="places.place",
            ),
        ),
        migrations.AddConstraint(
            model_name="comment",
            constraint=models.CheckConstraint(
                condition=(
                    Q(place__isnull=False, trip__isnull=True)
                    | Q(place__isnull=True, trip__isnull=False)
                ),
                name="marketplace_comment_place_xor_trip",
            ),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(
                fields=["trip", "created_at"],
                name="marketplace_trip_id_3008a2_idx",
            ),
        ),
        migrations.AddIndex(
            model_name="comment",
            index=models.Index(
                fields=["trip", "likes_count", "created_at"],
                name="marketplace_trip_id_0edf97_idx",
            ),
        ),
    ]
