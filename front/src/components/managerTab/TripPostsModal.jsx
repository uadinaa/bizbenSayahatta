import { useTranslation } from "react-i18next";
import closeIcon from "../../assets/X.svg";

export default function TripPostsModal({
  styles, // Мы можем передать стили из модалки или использовать общие
  trip,
  onClose,
}) {
  const { t } = useTranslation();

  if (!trip) return null;

  // Парсинг описания из itinerary_json
  const getDescription = () => {
    const data = trip.itinerary_json;
    if (!data) return "";
    if (typeof data === 'object' && !Array.isArray(data)) return data.notes || "";
    if (typeof data === 'string') {
      try {
        const parsed = JSON.parse(data);
        return parsed.notes || "";
      } catch (e) {
        return data;
      }
    }
    return "";
  };

  // Расчет дат
  const renderDateRange = () => {
    const dates = trip.available_dates;
    const duration = parseInt(trip.duration_days);
    if (!dates || !Array.isArray(dates) || dates.length === 0) return "-";

    const startDate = new Date(dates[0]);
    const endDate = new Date(startDate);
    if (!isNaN(duration)) {
      endDate.setDate(startDate.getDate() + (duration - 1));
    }

    const options = { day: '2-digit', month: '2-digit', year: '2-digit' };
    return `${startDate.toLocaleDateString('ru-RU', options)} — ${endDate.toLocaleDateString('ru-RU', options)}`;
  };

  const descriptionText = getDescription();
  const tripPhoto = trip.media_urls?.[0];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        
        <div className={styles.photoWrapper}>
          {tripPhoto ? (
            <img src={tripPhoto} alt={trip.title} className={styles.modalPhoto} />
          ) : (
            <div className={styles.tripPhotoPlaceholder} style={{ height: '250px', background: '#eee' }} />
          )}

          <div className={styles.iconGroup}>
            <img
              src={closeIcon}
              alt="close"
              className={styles.iconBtnClose}
              onClick={onClose}
            />
          </div>
        </div>

        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>{trip.title}</h2>

          <div className={styles.infoList}>
            <p><strong>{t("inspiration.trip.cart.category")}</strong> {trip.category?.name || "-"}</p>
            <p><strong>{t("inspiration.trip.cart.place")}</strong> {trip.destination || "-"}</p>
            <p><strong>{t("inspiration.trip.cart.dates")}</strong> {renderDateRange()}</p>
            <p><strong>{t("inspiration.trip.cart.budget")}</strong> {trip.price ? `$${trip.price}` : t("inspiration.card.contact")}</p>
          </div>

          {descriptionText && (
            <div className={styles.descriptionSection} style={{ marginTop: '20px' }}>
              <h4>{t("inspiration.trip.cart.description")}</h4>
              <p style={{ whiteSpace: 'pre-line', fontSize: '0.95em', color: '#444' }}>
                {String(descriptionText)}
              </p>
            </div>
          )}
        </div>

        <button className={styles.modalClose} onClick={onClose}>
          {t("inspiration.trip.cart.close")}
        </button>
      </div>
    </div>
  );
}