/** Confirm permanent chat deletion before calling the API. */
export default function DeleteChatModal({ threadTitle, onClose, onConfirm, deleting }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal planner-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>Delete this chat?</h3>
          <button type="button" className="close-btn planner-close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="planner-modal-copy">
          Delete this chat? This cannot be undone. The trip and all messages will be permanently deleted.
        </p>
        <p className="planner-modal-thread">{threadTitle || "Untitled chat"}</p>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={deleting}>
            Cancel
          </button>
          <button type="button" className="save-btn planner-danger-btn" onClick={onConfirm} disabled={deleting}>
            {deleting ? "Deleting..." : "Delete forever"}
          </button>
        </div>
      </div>
    </div>
  );
}

