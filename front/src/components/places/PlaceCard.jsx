import { formatCategory, formatLocation, priceTierLabel } from "../../utils/placeUtils";
import emptyHeart from "../../assets/emptyHeart.svg";
import redHeart from "../../assets/redHeart.svg";
import styles from "../../styles/PlaceCard.module.css";
import defaultStyles from "../../styles/PlaceCard.module.css";
import { useTranslation } from "react-i18next";

export default function PlaceCard({
  place,
  variant = "inspiration",
  onOpen,
  onToggleFavorite,
  isFavorited: isFavoritedProp,
  classes,         // Optional CSS classes override
  // New optional props (all nullable — no errors if missing)
  source,          // "google" | "tripadvisor"
  duration,        // e.g. "3 hours"
  bookingUrl,      // direct booking link
  numReviews,      // number of reviews
  award,           // e.g. "Travelers' Choice 2024"
  webUrl,          // TripAdvisor page link
}) {
  const isFavorited = isFavoritedProp !== undefined ? isFavoritedProp : place?.is_must_visit;
  const isWishlist = variant === "wishlist";
  const location = isWishlist ? `${place.city || ""}${place.city && place.country ? ", " : ""}${place.country || ""}` : formatLocation(place);
  const { t } = useTranslation();

  // Support both direct props and place object fields (for TripAdvisor data)
  const displayDuration = duration || place?.duration;
  const displayBookingUrl = bookingUrl || place?.booking_url;
  const displayNumReviews = numReviews || place?.num_reviews;
  const displayAward = award || place?.award;
  const displayWebUrl = webUrl || place?.web_url;
  const displaySource = source || place?.source;
  const isTripAdvisor = displaySource === "tripadvisor";

  // Use provided classes or default styles
  const s = classes || defaultStyles;

  return (
    <div
      className={`${styles.card} ${isWishlist ? styles.cardWishlist : ""}`}
      onClick={onOpen}
    >
      <div className={styles.imageContainer}>
        {place.photo_url ? (
          <img className={styles.photo} src={place.photo_url} alt={place.name} loading="lazy" />
        ) : (
          <div className={styles.photoPlaceholder} />
        )}

        <button
          className={`${styles.heartBtn} ${isFavorited ? styles.heartActive : ""}`}
          onClick={(event) => {
            event.stopPropagation();
            onToggleFavorite?.();
          }}
          aria-label={isFavorited ? t("inspiration.card.removeFromWishlist") : t("inspiration.card.addToWishlist")}
        >
          <img
            src={isFavorited ? redHeart : emptyHeart}
            alt={isFavorited ? "Red heart" : "Empty heart"}
            className={styles.heartImg}
            width="20"
            height="20"
          />
        </button>

        {isWishlist ? (
          <div className={styles.tags}>
            <span className={styles.tag}>{formatCategory(place.category)}</span>
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        <div className={styles.cardHeader}>
          {!isWishlist ? <span className={styles.category}>{formatCategory(place.category)}</span> : <span />}
          <div className={styles.metaRow}>
            {place.rating ? <span className={styles.rating}>★ {place.rating}</span> : null}
            <span className={styles.priceTag}>{priceTierLabel(place.price_level)}</span>
          </div>
        </div>

        <h3 className={styles.name}>{place.name}</h3>
        <p className={styles.location}>{location}</p>

        {isWishlist ? (
          <button
            type="button"
            className={styles.detailsLink}
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
          > 
          {t("inspiration.card.viewDetails")} →
          </button>
        ) : null}
      </div>
    </div>
  );
}
