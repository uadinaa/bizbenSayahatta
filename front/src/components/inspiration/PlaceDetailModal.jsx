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

  return (
    <div className={styles.modalOverlay} onClick={onClose}>
      <div className={styles.modal} onClick={(e) => e.stopPropagation()}>

        {/* 📸 Фото + иконки */}
        {place.photo_url && (
          <div className={styles.photoWrapper}>
            <img
              className={styles.modalPhoto}
              src={place.photo_url}
              alt={place.name}
            />

            {/* ❤️ + ❌ */}
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
        <button className={styles.modalClose} onClick={onClose}>{t("inspiration.card.close")}</button>

      </div>
    </div>
  );
}