import secrets

from django.db import migrations, models


def forwards_sync_map_public_and_tokens(apps, schema_editor):
    User = apps.get_model("users", "User")
    UserPreferences = apps.get_model("users", "UserPreferences")
    for user in User.objects.all():
        prefs = UserPreferences.objects.filter(user_id=user.id).first()
        if prefs and prefs.share_map:
            user.is_map_public = True
        if not user.map_share_token:
            user.map_share_token = secrets.token_urlsafe(32)
        user.save(update_fields=["is_map_public", "map_share_token"])


class Migration(migrations.Migration):

    dependencies = [
        ("users", "0007_userpreferences_traveler_profile"),
    ]

    operations = [
        migrations.AddField(
            model_name="user",
            name="is_map_public",
            field=models.BooleanField(db_index=True, default=False),
        ),
        migrations.AddField(
            model_name="user",
            name="map_share_token",
            field=models.CharField(blank=True, db_index=True, max_length=64, null=True, unique=True),
        ),
        migrations.RunPython(forwards_sync_map_public_and_tokens, migrations.RunPython.noop),
    ]
