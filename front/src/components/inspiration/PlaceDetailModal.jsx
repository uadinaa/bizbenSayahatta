import { formatCategory, formatLocation, priceTierLabel } from "../../utils/placeUtils";
import emptyHeart from "../../assets/eHeart.svg";
import redHeart from "../../assets/fHeart.svg";
import closeIcon from "../../assets/X.svg";

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
  newComment,
  loadingComments,
  navigate,
  onClose,
  onToggleMustVisit,
  onCreateTrip,
  onCommentChange,
  onAddComment,
}) {
  if (!place) return null;

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
                className={styles.iconBtn}
                onClick={onClose}
              />
            </div>
          </div>
        )}

        <div className={styles.modalContent}>
          <h2>{place.name}</h2>

          <p><strong>Category:</strong> {formatCategory(place.category)}</p>

          {place.rating && (
            <p><strong>Rating:</strong> {renderStars(place.rating)}</p>
          )}

          <p><strong>Price level:</strong> {priceTierLabel(place.price_level)}</p>
          <p>{place.description || "No description available"}</p>
          <p><strong>Location:</strong> {formatLocation(place)}</p>

          {place.opening_hours?.openNow !== undefined && (
            <p>
              <strong>Status:</strong>{" "}
              {place.opening_hours.openNow ? "Open now" : "Closed"}
            </p>
          )}

          <div className={styles.modalActions}>
  <button className={styles.lightActionBtn} onClick={onCreateTrip}>
    ✈️ Add to trip
  </button>
</div>

          {/* 💬 Комментарии */}
          <div className={styles.commentsSection}>
            <h3>
              Comments
              {comments.length > 0 && (
                <span className={styles.commentCount}>{comments.length}</span>
              )}
            </h3>

            <div className={styles.commentsContainer}>
              {loadingComments && (
                <div className={styles.loadingComments}>
                  Loading comments...
                </div>
              )}

              {!loadingComments && comments.length === 0 && (
                <div className={styles.emptyComments}>
                  <svg viewBox="0 0 24 24" fill="none">
                    <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5" />
                    <path
                      d="M8 12h8M8 8h8M8 16h4"
                      stroke="currentColor"
                      strokeWidth="1.5"
                      strokeLinecap="round"
                    />
                  </svg>
                  <span>No comments yet</span>
                  <span style={{ fontSize: "12px", marginTop: "4px" }}>
                    Be the first to share your thoughts!
                  </span>
                </div>
              )}

              {!loadingComments && comments.map((comment) => (
                <div key={comment.id} className={styles.comment}>
                  <div className={styles.commentHeader}>
                    <div className={styles.userAvatar}>
                      {comment.username?.charAt(0).toUpperCase() || "U"}
                    </div>
                    <strong>{comment.username || "Anonymous"}</strong>

                    {comment.is_trip_advisor && (
                      <span className={styles.tripAdvisorBadge}>
                        ✓ TripAdvisor
                      </span>
                    )}
                  </div>

                  <p>{comment.comment_text}</p>

                  {comment.created_at && (
                    <small className={styles.commentDate}>
                      {new Date(comment.created_at).toLocaleDateString("en-US", {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                        hour: "2-digit",
                        minute: "2-digit",
                      })}
                    </small>
                  )}
                </div>
              ))}
            </div>

            {isAuthed ? (
              <div className={styles.addComment}>
                <textarea
                  placeholder="Share your experience... 💭"
                  value={newComment}
                  onChange={(e) => onCommentChange(e.target.value)}
                  rows="3"
                />

                <button
                  className={styles.commentBtn}
                  onClick={onAddComment}
                  disabled={!newComment.trim()}
                >
                  Post Comment
                </button>
              </div>
            ) : (
              <div className={styles.loginHint}>
                <button
                  className={styles.loginLink}
                  onClick={() => navigate("/login")}
                >
                  Sign in
                </button>{" "}
                to join the conversation
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}