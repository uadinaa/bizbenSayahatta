from rest_framework.throttling import UserRateThrottle


class AdminSensitiveOperationThrottle(UserRateThrottle):
    """Rate limit for destructive admin operations (e.g. delete, block)."""

    rate = "30/hour"
    scope = "admin_sensitive"
