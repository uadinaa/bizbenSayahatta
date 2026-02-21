from django.urls import path
from . import views

urlpatterns = [
    # Users
    path("users/", views.AdminUserListAPIView.as_view(), name="admin-user-list"),
    path("users/<int:user_id>/", views.AdminUserDetailAPIView.as_view(), name="admin-user-detail"),
    path("users/<int:user_id>/block/", views.AdminUserBlockAPIView.as_view(), name="admin-user-block"),
    path("users/<int:user_id>/delete/", views.AdminUserDeleteAPIView.as_view(), name="admin-user-delete"),
    # Wishlists (SavedPlace)
    path("wishlists/", views.AdminWishlistListAPIView.as_view(), name="admin-wishlist-list"),
    path("wishlists/<int:pk>/", views.AdminWishlistDeleteAPIView.as_view(), name="admin-wishlist-delete"),
    # Visited places
    path("visited-places/", views.AdminVisitedPlaceListAPIView.as_view(), name="admin-visited-list"),
    path("visited-places/countries/", views.AdminVisitedCountriesAPIView.as_view(), name="admin-visited-countries"),
    path("visited-places/<int:pk>/", views.AdminVisitedPlaceDeleteAPIView.as_view(), name="admin-visited-delete"),
    # Threads (trips)
    path("threads/", views.AdminThreadListAPIView.as_view(), name="admin-thread-list"),
    path("threads/<int:pk>/", views.AdminThreadDeleteAPIView.as_view(), name="admin-thread-delete"),
    # Chat messages
    path("chat-messages/", views.AdminChatMessageListAPIView.as_view(), name="admin-chat-message-list"),
    path("chat-messages/<int:pk>/", views.AdminChatMessageDeleteAPIView.as_view(), name="admin-chat-message-delete"),
    # Reference: InterestMapping
    path("interests/", views.AdminInterestMappingListCreateAPIView.as_view(), name="admin-interest-list-create"),
    path("interests/<int:pk>/", views.AdminInterestMappingDetailAPIView.as_view(), name="admin-interest-detail"),
    # Audit log
    path("audit-log/", views.AdminAuditLogListAPIView.as_view(), name="admin-audit-log"),
]
