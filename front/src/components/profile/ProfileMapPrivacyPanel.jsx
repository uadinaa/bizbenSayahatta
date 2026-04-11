import "../../styles/ProfileMapPrivacyPanel.css";

// Renders the privacy controls for shared map visibility.
export default function ProfileMapPrivacyPanel({ privacySettings, privacySaving, onPrivacyChange, t }) {
  return (
    <div className="privacy-panel profilePage__privacyPanel">
      <div className="privacy-header">
        <strong>{t("profile.mapVisibility")}</strong>
        <span>{t("profile.mapVisibilityDescription")}</span>
      </div>
      <label className="privacy-option">
        <input
          type="checkbox"
          checked={Boolean(privacySettings?.is_map_public)}
          disabled={privacySaving}
          onChange={(e) => onPrivacyChange("is_map_public", e.target.checked)}
        />
        <div>
          <span className="privacy-option-title">{t("profile.listInPublicGallery")}</span>
          <span className="privacy-option-note">{t("profile.listInPublicGalleryNote")}</span>
        </div>
      </label>
      <label className="privacy-option">
        <input
          type="checkbox"
          checked={Boolean(privacySettings?.share_map)}
          disabled={privacySaving}
          onChange={(e) => onPrivacyChange("share_map", e.target.checked)}
        />
        <div>
          <span className="privacy-option-title">{t("profile.shareMapPoints")}</span>
          <span className="privacy-option-note">{t("profile.shareMapPointsNote")}</span>
        </div>
      </label>
      <label className="privacy-option">
        <input
          type="checkbox"
          checked={Boolean(privacySettings?.share_visited_places)}
          disabled={privacySaving}
          onChange={(e) => onPrivacyChange("share_visited_places", e.target.checked)}
        />
        <div>
          <span className="privacy-option-title">{t("profile.shareVisitedPlaces")}</span>
          <span className="privacy-option-note">{t("profile.shareVisitedPlacesNote")}</span>
        </div>
      </label>
      <label className="privacy-option">
        <input
          type="checkbox"
          checked={Boolean(privacySettings?.share_badges)}
          disabled={privacySaving}
          onChange={(e) => onPrivacyChange("share_badges", e.target.checked)}
        />
        <div>
          <span className="privacy-option-title">{t("profile.shareBadges")}</span>
          <span className="privacy-option-note">{t("profile.shareBadgesNote")}</span>
        </div>
      </label>
    </div>
  );
}