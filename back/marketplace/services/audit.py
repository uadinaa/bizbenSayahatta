from marketplace.models import ModerationLog


def log_action(*, actor, action, reason="", target_user=None, trip=None, application=None, metadata=None):
    ModerationLog.objects.create(
        actor=actor,
        action=action,
        reason=reason or "",
        target_user=target_user,
        trip=trip,
        application=application,
        metadata=metadata or {},
    )
