from django.contrib import admin

from .models import (
    AdvisorCategory,
    TripAdvisorApplication,
    TripAdvisorProfile,
    UserRestriction,
    Trip,
    TripVersion,
    WishlistFolder,
    WishlistItem,
    ReferralReward,
    ModerationLog,
    SubscriptionEvent,
)


admin.site.register(AdvisorCategory)
admin.site.register(TripAdvisorApplication)
admin.site.register(TripAdvisorProfile)
admin.site.register(UserRestriction)
admin.site.register(Trip)
admin.site.register(TripVersion)
admin.site.register(WishlistFolder)
admin.site.register(WishlistItem)
admin.site.register(ReferralReward)
admin.site.register(ModerationLog)
admin.site.register(SubscriptionEvent)
