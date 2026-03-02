from django.db import transaction
from django.db.models import F

from marketplace.models import ReferralReward
from users.models import User

REFERRAL_REWARD_TOKENS = 1000


def _is_valid_referral(referrer: User, referred_user: User) -> bool:
    if not referrer or not referred_user:
        return False
    if referrer.id == referred_user.id:
        return False
    if referrer.role not in {User.Role.TRIPADVISOR, User.Role.ADMIN}:
        return False
    return True


@transaction.atomic
def reward_referral_if_eligible(*, referred_user: User, referral_code: str):
    if not referral_code:
        return None
    referrer = User.objects.filter(referral_code=referral_code).first()
    if not _is_valid_referral(referrer, referred_user):
        return None
    if ReferralReward.objects.filter(referred_user=referred_user).exists():
        return None

    User.objects.filter(id=referrer.id).update(tokens=F("tokens") + REFERRAL_REWARD_TOKENS)
    return ReferralReward.objects.create(
        referrer=referrer,
        referred_user=referred_user,
        tokens_awarded=REFERRAL_REWARD_TOKENS,
        valid_signup=True,
    )
