# Align trip comment index names with Django 6 defaults. Handles PostgreSQL DBs where
# 0007 short names were never created (create with final names) or exist (rename).

from django.db import migrations


def _ensure_trip_comment_indexes(apps, schema_editor):
    if schema_editor.connection.vendor != "postgresql":
        return
    with schema_editor.connection.cursor() as cursor:
        pairs = (
            (
                "marketplace_c_trip_crt_idx",
                "marketplace_trip_id_3008a2_idx",
                'CREATE INDEX IF NOT EXISTS "marketplace_trip_id_3008a2_idx" ON marketplace_comment (trip_id, created_at)',
            ),
            (
                "marketplace_c_trip_likes_crt_idx",
                "marketplace_trip_id_0edf97_idx",
                'CREATE INDEX IF NOT EXISTS "marketplace_trip_id_0edf97_idx" ON marketplace_comment (trip_id, likes_count, created_at)',
            ),
        )
        for old_name, new_name, create_sql in pairs:
            cursor.execute(
                "SELECT 1 FROM pg_indexes WHERE indexname = %s",
                [old_name],
            )
            if cursor.fetchone():
                cursor.execute(f'ALTER INDEX "{old_name}" RENAME TO "{new_name}"')
                continue
            cursor.execute(
                "SELECT 1 FROM pg_indexes WHERE indexname = %s",
                [new_name],
            )
            if not cursor.fetchone():
                cursor.execute(create_sql)


class Migration(migrations.Migration):

    dependencies = [
        ("marketplace", "0007_comment_trip_optional_place"),
    ]

    operations = [
        migrations.SeparateDatabaseAndState(
            database_operations=[
                migrations.RunPython(_ensure_trip_comment_indexes, migrations.RunPython.noop),
            ],
            state_operations=[
                migrations.RenameIndex(
                    model_name="comment",
                    new_name="marketplace_trip_id_3008a2_idx",
                    old_name="marketplace_c_trip_crt_idx",
                ),
                migrations.RenameIndex(
                    model_name="comment",
                    new_name="marketplace_trip_id_0edf97_idx",
                    old_name="marketplace_c_trip_likes_crt_idx",
                ),
            ],
        ),
    ]
