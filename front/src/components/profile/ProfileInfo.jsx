import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import cupIcon from "../../assets/cup.svg";

export default function ProfileInfo({
  email, username, travelStyle, user,
  advisorStatus, advisorSuccess, latestApplication,
  privacySettings, privacySaving, onPrivacyChange,
  onOpenAdvisorModal, onLogout,
}) {
  const { t } = useTranslation();
  const styleKeyMap = {
    Hiking: "hiking",
    "City trips": "cityTrips",
    Beach: "beach",
    Adventure: "adventure",
    Relax: "relax",
    Cultural: "cultural",
  };

  return (
    <div className="info">
      <div className="style"><span>{t("profile.email")}:</span> <span className="email">{email}</span></div>
      <div className="style"><span>{t("profile.username")}:</span> <span className="username">{username}</span></div>
      <div className="style"><span>{t("profile.travelStyle")}:</span><strong>{t(`profile.styles.${styleKeyMap[travelStyle]}`, { defaultValue: travelStyle })}</strong></div>
      <div className="style"><span>{t("profile.role")}:</span>
      
      <strong>{user?.role || "USER"}</strong>
        <strong className={`advisor-status status-${advisorStatus.code.toLowerCase()}`}>
          {advisorStatus.label}
        </strong>
      </div>

      {advisorSuccess && <p className="advisor-success">{advisorSuccess}</p>}
      {latestApplication?.review_reason && (
        <p className="advisor-note">{t("profile.managerNote")}: {latestApplication.review_reason}</p>
      )}

      {user?.role !== "TRIPADVISOR" ? (
        <button
          className="advisor-cta"
          disabled={advisorStatus.code === "PENDING"}
          onClick={onOpenAdvisorModal}
        >
          {advisorStatus.code === "PENDING" ? t("profile.applicationPending") : t("profile.becomeAdvisor")}
        </button>
      ) : (
        <div className="advisor-panel">
          <strong>{t("profile.advisorToolsActive")}</strong>
          <div className="level">
            <span>{t("profile.checkTripStatus")}</span>
            <Link to="/tripstatus"><button>{t("profile.checkStatus")}</button></Link>
          </div>
        </div>
      )}

      {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
        <Link className="plan-link" to="/manager/advisors">{t("profile.openManagerApprovals")}</Link>
      )}

      <div className="advisor-panel">
        <div className="level">
          <span>{t("profile.travelerBadge")}:</span>
          <Link to="/map">
            <button>{t("profile.upgradeLevel")} <img src={cupIcon} alt={t("common.cup")} width="15" height="15" /></button>
          </Link>
        </div>
      </div>

      <div className="privacy-panel">
        <div className="privacy-header">
          <strong>{t("profile.mapVisibility")}</strong>
          <span>{t("profile.mapVisibilityDescription")}</span>
        </div>
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

      <button className="logout" onClick={onLogout}>{t("profile.logout")}</button>
    </div>
  );
}
