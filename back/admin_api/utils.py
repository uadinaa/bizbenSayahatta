from admin_api.models import AdminAuditLog


def log_admin_action(admin_user, action, target_type="", target_id="", metadata=None):
    """Create an audit log entry for a critical admin action."""
    AdminAuditLog.objects.create(
        admin=admin_user,
        action=action,
        target_type=target_type or "",
        target_id=str(target_id) if target_id else "",
        metadata=metadata or {},
    )
