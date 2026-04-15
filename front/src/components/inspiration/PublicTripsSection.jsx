import { useTranslation } from "react-i18next";
import styles from "../../styles/PublicTripsSection.module.css";
import emptyHeart from "../../assets/emptyHeart.svg";
import redHeart from "../../assets/redHeart.svg";
import { bookTrip } from "../../api/trips";

// Added onOpenTrip and onToggleSavedTrip props
export default function PublicTripsSection({ loadingTrips, publicTrips, onOpenTrip, onToggleSavedTrip, isAuthed, navigate }) {
  const handleBookTrip = async (e, trip) => {
    e.stopPropagation();
    if (!isAuthed) {
      navigate("/login");
      return;
    }

    if (trip.is_booked_by_me) {
      alert(t("inspiration.card.alreadyBooked"));
      return;
    }

    if (trip.is_full) {
      alert(t("inspiration.card.tripFull"));
      return;
    }

    try {
      await bookTrip(trip.id, 1);
      alert(t("inspiration.card.bookingSuccess"));
      // Refresh trips after booking
      if (window.location.reload) window.location.reload();
    } catch (err) {
      console.error("Booking failed:", err);
      alert(err.response?.data?.detail || t("inspiration.card.bookingFailed"));
    }
  };
  const { t } = useTranslation();

  return (
    <>
      <div className={styles.sectionHeader}>
        <h2>{t("inspiration.card.tripAdvisorTrips")}</h2>
        <span>{t("inspiration.card.verifiedTripsFromTripAdvisors")}</span>
      </div>

      {loadingTrips && (
        <div className={styles.sectionNote}>{t("inspiration.card.loadingTrips")}</div>
      )}

      {!loadingTrips && publicTrips.length === 0 && (
        <div className={styles.sectionNote}>
          {t("inspiration.card.noApprovedTripsYet")}
        </div>
      )}

      {!loadingTrips && publicTrips.length > 0 && (
        <div className={styles.tripGrid}>
          {publicTrips.map((trip) => (
            <div
              key={trip.id}
              className={styles.tripCard}
              onClick={() => onOpenTrip && onOpenTrip(trip)}
              style={{ cursor: 'pointer' }}
            >
              {trip.media_urls?.[0] ? (
                <img
                  className={styles.tripPhoto}
                  src={trip.media_urls[0]}
                  alt={trip.title}
                  loading="lazy"
                />
              ) : (
                <div className={styles.tripPhotoPlaceholder} />
              )}

              {/* Heart button for saving trips */}
              <button
                className={styles.heartBtn}
                onClick={(e) => {
                  e.stopPropagation();
                  if (onToggleSavedTrip) {
                    onToggleSavedTrip(trip);
                  }
                }}
                aria-label={trip.is_saved ? t("inspiration.card.removeFromWishlist") : t("inspiration.card.addToWishlist")}
              >
                <img
                  src={trip.is_saved ? redHeart : emptyHeart}
                  alt={trip.is_saved ? "Red heart" : "Empty heart"}
                  className={styles.heartImg}
                  width="20"
                  height="20"
                />
              </button>

              <div className={styles.tripMeta}>
                <span className={styles.tripBadge}>
                  {t("inspiration.card.tripAdvisor")}
                </span>
                <span className={styles.tripCategory}>
                  {trip.category?.name || t("inspiration.card.trip")}
                </span>
              </div>
              <h3 className={styles.tripTitle}>{trip.title}</h3>
              <p className={styles.tripDestination}>{trip.destination}</p>
              <div className={styles.tripFooter}>
                <span>
                  {trip.duration_days} {t("inspiration.card.days")}
                </span>
                <span>
                  {trip.price ? `$${trip.price}` : t("inspiration.card.contact")}
                </span>
              </div>

              {/* Availability info */}
              <div className={styles.availabilityInfo}>
                <span className={styles.spotsLeft}>
                  {trip.is_full
                    ? t("inspiration.card.tripFull")
                    : `${trip.current_bookings || 0}/${trip.max_travelers || 10} ${t("inspiration.card.spotsBooked")}`
                  }
                </span>
                {trip.is_booked_by_me && (
                  <span className={styles.alreadyBookedBadge}>
                    ✓ {t("inspiration.card.alreadyBooked")}
                  </span>
                )}
              </div>

              {/* Book button */}
              {!trip.is_booked_by_me && !trip.is_full && (
                <button
                  className={styles.bookBtn}
                  onClick={(e) => handleBookTrip(e, trip)}
                >
                  {t("inspiration.card.bookTrip")}
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </>
  );
}