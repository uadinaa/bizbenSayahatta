import { useTranslation } from "react-i18next";
import emptyHeart from "../../assets/fHeart.svg";
import redHeart from "../../assets/filledredHeart.svg";

export default function InspirationCommentsPanel({
  styles,
  isAuthed,
  navigate,
  comments,
  commentsTotalCount = 0,
  commentsHasMore = false,
  newComment,
  loadingComments,
  loadingMoreComments = false,
  onCommentChange,
  onAddComment,
  onLoadMoreComments,
  onToggleCommentLike,
}) {
  const { t } = useTranslation();

  return (
    <div className={styles.commentsSection}>
      <h3>
        {t("inspiration.card.comments")}
        {(commentsTotalCount > 0 || comments.length > 0) && (
          <span className={styles.commentCount}>
            {commentsTotalCount || comments.length}
          </span>
        )}
      </h3>

      <div className={styles.commentsContainer}>
        {loadingComments && (
          <div className={styles.loadingComments}>{t("inspiration.card.loadingComments")}</div>
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
            <span>{t("inspiration.card.noCommentsYet")}</span>
            <span style={{ fontSize: "12px", marginTop: "4px" }}>
              {t("inspiration.card.beTheFirstToShareYourThoughts")}
            </span>
          </div>
        )}

        {!loadingComments &&
          comments.map((comment) => (
            <div key={comment.id} className={styles.comment}>
              <div className={styles.commentHeader}>
                <div className={styles.userAvatar}>
                  {comment.username?.charAt(0).toUpperCase() || "U"}
                </div>
                <strong>{comment.username || t("inspiration.card.anonymous")}</strong>
                {comment.is_trip_advisor && (
                  <span className={styles.tripAdvisorBadge}>✓ {t("inspiration.card.tripAdvisor")}</span>
                )}
              </div>

              <p>{comment.comment_text}</p>

              <div className={styles.commentFooter}>
                <button
                  type="button"
                  className={`${styles.commentLikeBtn} ${
                    comment.liked_by_me ? styles.commentLikeBtnActive : ""
                  }`}
                  onClick={() => onToggleCommentLike?.(comment)}
                  aria-pressed={Boolean(comment.liked_by_me)}
                  aria-label={comment.liked_by_me ? "Unlike comment" : "Like comment"}
                >
                  <img
                    src={comment.liked_by_me ? redHeart : emptyHeart}
                    alt=""
                    className={styles.commentLikeIcon}
                    width={18}
                    height={18}
                    aria-hidden
                  />
                  <span>{comment.likes_count ?? 0}</span>
                </button>
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
            </div>
          ))}
      </div>

      {!loadingComments && commentsHasMore && onLoadMoreComments ? (
        <button
          type="button"
          className={styles.commentsLoadMore}
          onClick={onLoadMoreComments}
          disabled={loadingMoreComments}
        > 
          {loadingMoreComments ? t("manager.loading") : t("inspiration.card.loadingComments")}
        </button>
      ) : null}

      {isAuthed ? (
        <div className={styles.addComment}>
          <textarea
            placeholder={t("inspiration.card.shareYourExperience")}
            value={newComment}
            onChange={(e) => onCommentChange(e.target.value)}
            rows="3"
          />
          <button className={styles.commentBtn} onClick={onAddComment} disabled={!newComment.trim()}>
            {t("inspiration.card.postComment")}
          </button>
        </div>
      ) : (
        <div className={styles.loginHint}>
          <button className={styles.loginLink} onClick={() => navigate("/login")}>
            {t("inspiration.card.signIn")}
          </button>{" "}
          {t("inspiration.card.toJoinTheConversation")}
        </div>
      )}
    </div>
  );
}
