from django.core.management.base import BaseCommand

from places.services.google_places import get_places


DEFAULT_CITIES = [
    "Tokyo",
    "Paris",
    "Rome",
    "Milan",
    "Florence",
    "Nice",
]

DEFAULT_CATEGORIES = [
    "restaurant",
    "museum",
    "tourist_attraction",
]


class Command(BaseCommand):
    help = "Refresh cached places from Google Places API."

    def add_arguments(self, parser):
        parser.add_argument(
            "--cities",
            type=str,
            default=",".join(DEFAULT_CITIES),
            help="Comma-separated list of cities to refresh.",
        )
        parser.add_argument(
            "--categories",
            type=str,
            default=",".join(DEFAULT_CATEGORIES),
            help="Comma-separated list of categories to refresh.",
        )
        parser.add_argument(
            "--max-results",
            type=int,
            default=10,
            help="Max results per query.",
        )

    def handle(self, *args, **options):
        cities = [city.strip() for city in options["cities"].split(",") if city.strip()]
        categories = [
            category.strip()
            for category in options["categories"].split(",")
            if category.strip()
        ]
        max_results = options["max_results"]

        if not cities or not categories:
            self.stdout.write(self.style.WARNING("No cities or categories provided."))
            return

        for city in cities:
            for category in categories:
                self.stdout.write(
                    f"Refreshing {city} / {category} (max {max_results})..."
                )
                get_places(
                    city=city,
                    category=category,
                    max_results=max_results,
                    force_refresh=True,
                )

        self.stdout.write(self.style.SUCCESS("Refresh complete."))
