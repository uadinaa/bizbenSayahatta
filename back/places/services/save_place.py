from django.db import transaction
from places.models import Place, SavedPlace


@transaction.atomic
def save_place_for_user(user, place_id):
    place = Place.objects.select_for_update().get(id=place_id)

    saved, created = SavedPlace.objects.get_or_create(
        user=user,
        place=place,
    )

    if created:
        place.saves_count += 1
        place.save(update_fields=["saves_count"])

    return saved
