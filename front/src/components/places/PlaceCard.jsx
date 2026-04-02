import { formatCategory, formatLocation, priceTierLabel } from "../../utils/placeUtils";
import emptyHeart from "../../assets/emptyHeart.svg";
import redHeart from "../../assets/redHeart.svg";
import styles from "../../styles/PlaceCard.module.css";

export default function PlaceCard({
  place,
  variant = "inspiration",
  onOpen,
  onToggleFavorite,
  isFavorited: isFavoritedProp,
}) {
  const isFavorited = isFavoritedProp !== undefined ? isFavoritedProp : place?.is_must_visit;
  const isWishlist = variant === "wishlist";
  const location = isWishlist ? `${place.city || ""}${place.city && place.country ? ", " : ""}${place.country || ""}` : formatLocation(place);

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
          aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
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
            <span className={styles.tag}>{formatCategory(place.category)} uu</span>
          </div>
        ) : null}
      </div>

      <div className={styles.content}>
        <div className={styles.cardHeader}>
          {!isWishlist ? <span className={styles.category}>{formatCategory(place.category)}uu</span> : <span />}
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
            View Details →
          </button>
        ) : null}
      </div>
    </div>
  );
}
