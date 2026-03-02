from django.db import migrations


class Migration(migrations.Migration):

    dependencies = [
        ('admin_api', '0001_initial'),
    ]

    operations = [
        migrations.RenameIndex(
            model_name='adminauditlog',
            new_name='admin_api_a_admin_i_0e9cf5_idx',
            old_name='admin_api_a_admin_i_8a2b0d_idx',
        ),
        migrations.RenameIndex(
            model_name='adminauditlog',
            new_name='admin_api_a_action_57d10f_idx',
            old_name='admin_api_a_action_8a2b0d_idx',
        ),
    ]
