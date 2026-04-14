import django.db.models.deletion
from django.db import migrations, models


def _delete_trip_comments(apps, schema_editor):
    Comment = apps.get_model("marketplace", "Comment")
    Comment.objects.filter(trip_id__isnull=False).delete()


def _drop_trip_comment_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    names = (
        "marketplace_trip_id_3008a2_idx",
        "marketplace_trip_id_0edf97_idx",
        "marketplace_c_trip_crt_idx",
        "marketplace_c_trip_likes_crt_idx",
    )
    with schema_editor.connection.cursor() as cursor:
        for name in names:
            cursor.execute(f'DROP INDEX IF EXISTS "{name}"')


class Migration(migrations.Migration):
    # DELETE + ALTER in one transaction leaves PostgreSQL with "pending trigger events";
    # non-atomic migration commits between steps.
    atomic = False

    dependencies = [
        ("marketplace", "0008_rename_marketplace_c_trip_crt_idx_marketplace_trip_id_3008a2_idx_and_more"),
    ]

    operations = [
        migrations.RunPython(_delete_trip_comments, migrations.RunPython.noop),
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_drop_trip_comment_indexes, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.RemoveIndex(
                    model_name="comment",
                    name="marketplace_trip_id_3008a2_idx",
                ),
                migrations.RemoveIndex(
                    model_name="comment",
                    name="marketplace_trip_id_0edf97_idx",
                ),
            ],
        ),
        migrations.RemoveConstraint(
            model_name="comment",
            name="marketplace_comment_place_xor_trip",
        ),
        migrations.RemoveField(
            model_name="comment",
            name="trip",
        ),
        migrations.AlterField(
            model_name="comment",
            name="place",
            field=models.ForeignKey(
                on_delete=django.db.models.deletion.CASCADE,
                related_name="comments",
                to="places.place",
            ),
        ),
    ]
