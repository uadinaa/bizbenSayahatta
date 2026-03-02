from django.urls import path

from . import views


urlpatterns = [
    path("categories/", views.AdvisorCategoryListView.as_view(), name="advisor-category-list"),
    path("public/trips/", views.PublicTripListView.as_view(), name="public-trip-list"),
    path("leaderboard/", views.TripAdvisorLeaderboardView.as_view(), name="advisor-leaderboard"),

    path("advisor/apply/", views.TripAdvisorApplyView.as_view(), name="advisor-apply"),
    path("advisor/applications/", views.MyTripAdvisorApplicationsView.as_view(), name="advisor-my-applications"),
    path("advisor/profile/", views.TripAdvisorProfileView.as_view(), name="advisor-profile"),
    path("advisor/trips/", views.AdvisorTripListCreateView.as_view(), name="advisor-trip-list-create"),
    path("advisor/trips/<int:trip_id>/", views.AdvisorTripDetailView.as_view(), name="advisor-trip-detail"),
    path("advisor/trips/<int:trip_id>/update/", views.AdvisorTripUpdateView.as_view(), name="advisor-trip-update"),
    path("advisor/trips/<int:trip_id>/submit/", views.AdvisorTripSubmitView.as_view(), name="advisor-trip-submit"),
    path("advisor/trips/<int:trip_id>/versions/", views.AdvisorTripVersionsView.as_view(), name="advisor-trip-versions"),
    path("advisor/threads/<int:thread_id>/convert/", views.ConvertThreadToTripView.as_view(), name="advisor-convert-thread"),

    path("wishlist/folders/", views.WishlistFolderListCreateView.as_view(), name="wishlist-folder-list-create"),
    path("wishlist/folders/<int:folder_id>/items/", views.WishlistFolderItemView.as_view(), name="wishlist-folder-items"),

    path("manager/applications/", views.ManagerApplicationQueueView.as_view(), name="manager-application-queue"),
    path("manager/applications/<int:application_id>/review/", views.ManagerApplicationReviewView.as_view(), name="manager-application-review"),
    path("manager/trips/queue/", views.ManagerTripModerationQueueView.as_view(), name="manager-trip-queue"),
    path("manager/trips/<int:trip_id>/moderate/", views.ManagerTripModerationActionView.as_view(), name="manager-trip-moderate"),
    path("manager/users/<int:user_id>/restrict/", views.ManagerRestrictUserView.as_view(), name="manager-user-restrict"),
    path("manager/logs/", views.ManagerModerationLogView.as_view(), name="manager-logs"),

    path("admin/users/<int:user_id>/assign-manager/", views.AdminAssignManagerView.as_view(), name="admin-assign-manager"),
    path("admin/users/<int:user_id>/permanent-ban/", views.AdminPermanentBanView.as_view(), name="admin-permanent-ban"),

    path("billing/webhook/", views.SubscriptionWebhookView.as_view(), name="subscription-webhook"),
]
