import { formatCategory, formatLocation, priceTierLabel } from "../../utils/placeUtils";
import emptyHeart from "../../assets/emptyHeart.svg"
import redHeart from "../../assets/redHeart.svg"

export default function PlaceCard({
  place,
  variant = "inspiration",
  classes = {},
  onOpen,
  onToggleFavorite,
  isFavorited: isFavoritedProp,
}) {

    // Use the explicit prop if provided, otherwise fall back to checking place data
    const isFavorited = isFavoritedProp !== undefined ? isFavoritedProp : place?.is_must_visit;

    const HeartButton = () => (
    <button
      className={`${classes.heartBtn || "heart-btn"} ${isFavorited ? classes.heartActive || "heart-active" : ""}`}
      onClick={(e) => {
        e.stopPropagation();
        onToggleFavorite?.();
      }}
      aria-label={isFavorited ? "Remove from wishlist" : "Add to wishlist"}
    >
      <img
        src={isFavorited ? redHeart : emptyHeart}
        alt={isFavorited ? "Red heart" : "Empty heart"}
        className={classes.heartImg || "heart-img"}
        width="24"
        height="24"
      />
    </button>
  );

  if (variant === "wishlist") {
    return (
      <div className={classes.card} onClick={onOpen}>
        {/* <div className={classes.cardTop}>
          <button className={classes.redHeart}><img src={redHeart} alt="red heart" /></button>
        </div> */}

        <HeartButton />

        <div className={classes.imageContainer}>
          <img
            src={place.photo_url}
            alt={place.name}
            className={classes.image}
          />

          <button
            className={classes.favoriteButton}
            onClick={(event) => {
              event.stopPropagation();
              onToggleFavorite?.();
            }}
          >
            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <defs>
                <linearGradient id={`heartGradient-${place.id}`} x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#ff6b6b" />
                  <stop offset="100%" stopColor="#ee5a6f" />
                </linearGradient>
              </defs>
              <path
                d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                fill={`url(#heartGradient-${place.id})`}
              />
            </svg>
          </button>

          <div className={classes.tags}>
            <span className={`${classes.tag} tag-${place.category}`}>
              {place.category.replace("_", " ")}
            </span>
          </div>
        </div>

        <div className={classes.content}>
          <h3 className={classes.name}>{place.name}</h3>
          <p className={classes.location}>
            {place.city}, {place.country}
          </p>
          {place.rating && <div className={classes.metaRow}>⭐ {place.rating}</div>}
          <button
            type="button"
            className={classes.detailsLink}
            onClick={(event) => {
              event.stopPropagation();
              onOpen?.();
            }}
          >
            View Details →
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className={classes.card} onClick={onOpen}>

      <HeartButton />
      {/* <div className={classes.cardTop}>
        <button className={classes.emptyHeart}><img src={emptyHeart} alt="empty heart" /></button>
      </div> */}

      {place.photo_url ? (
        <img className={classes.photo} src={place.photo_url} alt={place.name} loading="lazy" />
      ) : (
        <div className={classes.photoPlaceholder} />
      )}

      <div className={classes.cardHeader}>
        <span className={classes.category}>{formatCategory(place.category)}</span>
        <div className={classes.metaRow}>
          {place.rating && <span className={classes.rating}>★ {place.rating}</span>}
          <span className={classes.priceTag}>{priceTierLabel(place.price_level)}</span>
        </div>
      </div>

      <h3 className={classes.name}>{place.name}</h3>
      <p className={classes.location}>{formatLocation(place)}</p>
    </div>
  );
}
