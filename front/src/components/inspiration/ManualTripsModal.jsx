import { useTranslation } from "react-i18next";
import emptyHeart from "../../assets/fHeart.svg";
import redHeart from "../../assets/filledredHeart.svg";
import closeIcon from "../../assets/X.svg";
import InspirationCommentsPanel from "./InspirationCommentsPanel";

export default function ManualTripsModal({
  styles,
  trip,
  onClose,
  onToggleWishlist,
  isAuthed,
  navigate,
  comments = [],
  commentsTotalCount = 0,
  commentsHasMore = false,
  newComment = "",
  loadingComments = false,
  loadingMoreComments = false,
  onCommentChange,
  onAddComment,
  onLoadMoreComments,
  onToggleCommentLike,
}) {
  const { t } = useTranslation();

  if (!trip) return null;

  // 1. Безопасное извлечение описания из itinerary_json
  const getDescription = () => {
    const data = trip.itinerary_json;
    if (!data) return "";

    // Если бэк прислал уже объект
    if (typeof data === "object" && !Array.isArray(data)) {
      return data.notes || "";
    }

    // Если пришла строка, парсим её
    if (typeof data === "string") {
      try {
        const parsed = JSON.parse(data);
        return parsed.notes || "";
      } catch (e) {
        return data; // Если это не JSON, а просто текст
      }
    }
    return "";
  };

  // 2. Расчет диапазона дат (например, 14.07.26 — 23.07.26)
  const renderDateRange = () => {
    const dates = trip.available_dates;
    const duration = parseInt(trip.duration_days);

    if (!dates || !Array.isArray(dates) || dates.length === 0) return "-";

    const startDate = new Date(dates[0]);
    const endDate = new Date(startDate);

    if (!isNaN(duration)) {
      // Прибавляем количество дней (duration - 1, так как первый день включен)
      endDate.setDate(startDate.getDate() + (duration - 1));
    }

    const options = { day: "2-digit", month: "2-digit", year: "2-digit" };
    const startStr = startDate.toLocaleDateString("ru-RU", options);
    const endStr = endDate.toLocaleDateString("ru-RU", options);

    return `${startStr} — ${endStr}`;
  };

  const descriptionText = getDescription();
  const tripPhoto = trip.media_urls?.[0];

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>
        {/* 📸 Блок с фото */}
        <div className={styles.photoWrapper}>
          {tripPhoto ? (
            <img src={tripPhoto} alt={trip.title} className={styles.modalPhoto} />
          ) : (
            <div className={styles.tripPhotoPlaceholder} style={{ height: "250px", background: "#eee" }} />
          )}

          <div className={styles.iconGroup}>
            <img
              src={trip.is_saved ? redHeart : emptyHeart}
              alt="wishlist"
              className={styles.iconBtn}
              onClick={onToggleWishlist}
            />
            <img src={closeIcon} alt="close" className={styles.iconBtnClose} onClick={onClose} />
          </div>
        </div>

        {/* 📄 Контентная часть */}
        <div className={styles.modalContent}>
          <h2 className={styles.modalTitle}>{trip.title || "Untitled Trip"}</h2>

          <div className={styles.infoList}>
            <p>
              <strong>{t("inspiration.trip.cart.category")}</strong> {trip.category?.name || "-"}
            </p>
            <p>
              <strong>{t("inspiration.trip.cart.place")}</strong> {trip.destination || "-"}
            </p>

            <p>
              <strong>{t("inspiration.trip.cart.dates") || "Dates"}</strong> {renderDateRange()}
            </p>

            <p>
              <strong>{t("inspiration.trip.cart.budget")}</strong>{" "}
              {trip.price ? `$${trip.price}` : t("inspiration.card.contact")}
            </p>
          </div>

          {descriptionText && (
            <div className={styles.descriptionSection} style={{ marginTop: "20px" }}>
              <h4 style={{ marginBottom: "8px" }}>{t("inspiration.trip.cart.description") || "Description"}</h4>
              <p style={{ whiteSpace: "pre-line", color: "#444", lineHeight: "1.5" }}>{String(descriptionText)}</p>
            </div>
          )}

          <InspirationCommentsPanel
            styles={styles}
            isAuthed={isAuthed}
            navigate={navigate}
            comments={comments}
            commentsTotalCount={commentsTotalCount}
            commentsHasMore={commentsHasMore}
            newComment={newComment}
            loadingComments={loadingComments}
            loadingMoreComments={loadingMoreComments}
            onCommentChange={onCommentChange}
            onAddComment={onAddComment}
            onLoadMoreComments={onLoadMoreComments}
            onToggleCommentLike={onToggleCommentLike}
          />
        </div>

        <button className={styles.modalClose} onClick={onClose}>
          {t("inspiration.trip.cart.close")}
        </button>
      </div>
    </div>
  );
}
