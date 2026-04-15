import { formatCategory, formatLocation, priceTierLabel } from "../../utils/placeUtils";
import { useTranslation } from "react-i18next";
import emptyHeart from "../../assets/fHeart.svg";
import redHeart from "../../assets/filledredHeart.svg";
import closeIcon from "../../assets/X.svg";
import InspirationCommentsPanel from "./InspirationCommentsPanel";


function renderStars(rating) {
  if (!rating) return null;
  const fullStars = Math.floor(rating);
  const emptyStars = 5 - fullStars;

  return (
    <span>
      {"★".repeat(fullStars)}
      {"☆".repeat(emptyStars)}
      <span style={{ marginLeft: 6, fontWeight: 500 }}>{rating}</span>
    </span>
  );
}

function ExternalDetailContent({ place, styles }) {
  const sourceLabel =
    place.source === "ticketmaster"
      ? "Ticketmaster"
      : place.source === "tripadvisor"
        ? "TripAdvisor"
        : "External";
  const awardLabel = (() => {
    const a = place.award;
    if (!a) return null;
    if (typeof a === "object") return [a.award_name, a.year].filter(Boolean).join(" ");
    return String(a);
  })();

  const reviewsText = place.num_reviews > 0
    ? `${place.num_reviews >= 1000
        ? `${(place.num_reviews / 1000).toFixed(1)}k`
        : place.num_reviews} reviews`
    : null;

  const hasDescription = place.description && !place.description.startsWith("http");

  return (
    <div className={styles.modalContent}>
      <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 8 }}>
        <span style={{
          background: "linear-gradient(135deg, #00aa6c, #00875a)", color: "#fff", fontSize: 11, fontWeight: 700,
          padding: "3px 10px", borderRadius: 999, 
        }}>
          {sourceLabel}
        </span>
        {awardLabel && (
          <span style={{ color: "#b8860b", fontSize: 12, fontWeight: 500 }}>
            🏆 {awardLabel}
          </span>
        )}
      </div>

      <h2>{place.name}</h2>

      {place.category && (
        <p><strong>Category:</strong> {formatCategory(place.category)}</p>
      )}

      {place.subcategory && (
        <p><strong>Subcategory:</strong> {formatCategory(place.subcategory)}</p>
      )}

      {place.rating && (
        <p>
          <strong>Rating:</strong> {renderStars(place.rating)}
          {reviewsText && <span style={{ color: "#999", fontSize: 13, marginLeft: 6 }}>{reviewsText}</span>}
        </p>
      )}

      {place.price_amount > 0 && (
        <p><strong>Price:</strong> {place.price_currency} {place.price_amount}</p>
      )}

      {place.city && (
        <p><strong>City:</strong> {place.city}</p>
      )}

      {place.booking_url && (
        <p><strong>Booking:</strong> {place.booking_url}</p>
      )}

      {place.web_url && (
        <p><strong>Web url:</strong> {place.web_url}</p>
      )}

      {place.venue && (
        <p><strong>Venue:</strong> {place.venue}</p>
      )}

      {place.start_date && (
        <p><strong>Start_date:</strong> {place.start_date}</p>
      )}

      {hasDescription && (
        <p style={{ marginTop: 12, lineHeight: 1.6, color: "#444" }}>{place.description}</p>
      )}

      <div className={styles.modalActions} style={{ marginTop: 20 }}>
        {place.booking_url && (
          <a
            href={place.booking_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.lightActionBtn}
            style={{ textDecoration: "none" }}
          >
            Book Now →
          </a>
        )}
        {(place.web_url && place.web_url !== place.description) && (
          <a
            href={place.web_url}
            target="_blank"
            rel="noopener noreferrer"
            className={styles.lightActionBtn}
            style={{ textDecoration: "none" }}
          >
            View source
          </a>
        )}
      </div>
    </div>
  );
}

export default function PlaceDetailModal({
  styles,
  place,
  isAuthed,
  comments,
  commentsTotalCount = 0,
  commentsHasMore = false,
  newComment,
  loadingComments,
  loadingMoreComments = false,
  navigate,
  onClose,
  onToggleMustVisit,
  onCreateTrip,
  onCommentChange,
  onAddComment,
  onLoadMoreComments,
  onToggleCommentLike,
}) {
  if (!place) return null;

  const { t } = useTranslation();
  const isExternal = place.source === "tripadvisor" || place.source === "ticketmaster";

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {place.photo_url && (
          <div className={styles.photoWrapper}>
            <img
              className={styles.modalPhoto}
              src={place.photo_url}
              alt={place.name}
            />

            <div className={styles.iconGroup}>
              <img
                src={place.is_must_visit ? redHeart : emptyHeart}
                alt="wishlist"
                className={styles.iconBtn}
                onClick={onToggleMustVisit}
              />
              <img
                src={closeIcon}
                alt="close"
                className={styles.iconBtnClose}
                onClick={onClose}
              />
            </div>
          </div>
        )}

        {isExternal ? (
          <ExternalDetailContent place={place} styles={styles} />
        ) : (
          <div className={styles.modalContent}>
            <h2>{place.name}</h2>

            <p><strong>{t("inspiration.card.category")}</strong> {formatCategory(place.category)}</p>

            {place.rating && (
              <p><strong>{t("inspiration.card.rating")}</strong> {renderStars(place.rating)}</p>
            )}

            <p><strong>{t("inspiration.card.priceLevel")}</strong> {priceTierLabel(place.price_level)}</p>
            <p>{place.description || t("inspiration.card.noDescriptionAvailable")}</p>
            <p><strong>{t("inspiration.card.location")}</strong> {formatLocation(place)}</p>

            {place.opening_hours?.openNow !== undefined && (
              <p><strong>{t("inspiration.card.status")}</strong> {place.opening_hours.openNow ? t("inspiration.card.openNow") : t("inspiration.card.closed")}</p>
            )}

            <div className={styles.modalActions}>
              <button className={styles.lightActionBtn} onClick={onToggleMustVisit}>
                {place.is_must_visit ? t("inspiration.card.addedToWishlist") : t("inspiration.card.addToWishlist")}
              </button>
              <button className={styles.lightActionBtn} onClick={onCreateTrip}>
                ✈️ {t("inspiration.card.addToTrip")}
              </button>
            </div>

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
        )}

        <button className={styles.modalClose} onClick={onClose}>{t("inspiration.card.close")}</button>
      </div>
    </div>
  );
}