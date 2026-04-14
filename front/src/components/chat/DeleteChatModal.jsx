/** Confirm permanent chat deletion before calling the API. */
import { useTranslation } from "react-i18next";

export default function DeleteChatModal({ threadTitle, onClose, onConfirm, deleting }) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal planner-modal" onClick={(event) => event.stopPropagation()}>
        <div className="modal-header">
          <h3>{t("chat.deleteThisChatTitle")}</h3>
          <button type="button" className="close-btn" onClick={onClose}>
            ×
          </button>
        </div>
        <p className="planner-modal-copy">
          {t("chat.deleteThisChatBody")}
        </p>
        <p className="planner-modal-thread">{threadTitle || t("chat.untitledChat")}</p>
        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose} disabled={deleting}>
            {t("advisorTrips.cancel")}
          </button>
          <button type="button" className="save-btn planner-danger-btn" onClick={onConfirm} disabled={deleting}>
            {deleting ? t("chat.deleting") : t("chat.deleteForever")}
          </button>
        </div>
      </div>
    </div>
  );
}
