import "../../styles/ProfileAdvisorPanel.css";
import { Link } from "react-router-dom";

// Renders the Trip Advisor call-to-action and supporting copy.
export default function ProfileAdvisorPanel({ user, advisorStatus, onOpenAdvisorModal, t }) {
  return (
    <div className="profilePage__advisorPanel">
      <h3>{t("profile.becomeAdvisor")}</h3>
      <p className="profilePage__advisorText">
        {user?.role === "TRIPADVISOR"
          ? t("profile.advisorToolsActive")
          : "Share your travel experience, help other users plan better trips, and unlock advisor tools on your account."}
      </p>

      {user?.role !== "TRIPADVISOR" ? (
        <button
          type="button"
          className="advisor-cta"
          disabled={advisorStatus.code === "PENDING"}
          onClick={onOpenAdvisorModal}
        >
          {advisorStatus.code === "PENDING" ? t("profile.applicationPending") : t("profile.becomeAdvisor")}
        </button>
      ) : (
        <div className="advisor-panel">
          <div className="level">
            <span className="checking">{t("profile.checkTripStatus")}</span>
            <Link to="/tripstatus"><button className="checking-btn">{t("profile.checkStatus")}</button></Link>
          </div>
        </div>
      )}
    </div>
  );
}