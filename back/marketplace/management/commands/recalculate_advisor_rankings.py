from django.core.management.base import BaseCommand

from marketplace.models import TripAdvisorProfile
from marketplace.services.ranking import refresh_profile_ranking


class Command(BaseCommand):
    help = "Recalculate TripAdvisor ranking scores and status levels."

    def handle(self, *args, **options):
        total = 0
        for profile in TripAdvisorProfile.objects.all().iterator():
            refresh_profile_ranking(profile)
            total += 1
        self.stdout.write(self.style.SUCCESS(f"Recalculated rankings for {total} profiles."))
