import { useTranslation } from "react-i18next";
import styles from "../../styles/PublicTripsSection.module.css";

// Добавили onOpenTrip в пропсы
export default function PublicTripsSection({ loadingTrips, publicTrips, onOpenTrip }) {
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
              // ВАЖНО: Добавляем клик, который вызывает функцию открытия модалки
              onClick={() => onOpenTrip && onOpenTrip(trip)} 
              style={{ cursor: 'pointer' }} // Чтобы пользователь понимал, что карточка кликабельна
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
            </div>
          ))}
        </div>
      )}
    </>
  );
}