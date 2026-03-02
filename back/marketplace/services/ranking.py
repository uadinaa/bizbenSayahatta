from marketplace.models import TripAdvisorProfile


def resolve_status_level(score: float) -> str:
    if score >= 180:
        return "GOLD"
    if score >= 90:
        return "SILVER"
    return "BRONZE"


def compute_ranking_score(profile: TripAdvisorProfile) -> float:
    rating_component = profile.rating * 20
    review_component = min(profile.total_reviews, 100) * 0.5
    completed_component = min(profile.completed_trips, 200) * 0.7
    engagement_component = profile.engagement_score * 0.3
    violation_penalty = profile.violation_count * 25
    trust_component = max(profile.trust_score, 0) * 0.2
    return max(0, rating_component + review_component + completed_component + engagement_component + trust_component - violation_penalty)


def refresh_profile_ranking(profile: TripAdvisorProfile) -> TripAdvisorProfile:
    score = compute_ranking_score(profile)
    profile.ranking_score = score
    profile.status_level = resolve_status_level(score)
    profile.verified = score >= 120 and profile.violation_count == 0
    profile.save(update_fields=["ranking_score", "status_level", "verified", "updated_at"])

    profile.user.ranking_score = score
    profile.user.status_level = profile.status_level
    profile.user.save(update_fields=["ranking_score", "status_level"])
    return profile
