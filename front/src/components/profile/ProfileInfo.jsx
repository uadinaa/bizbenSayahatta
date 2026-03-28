import { Link } from "react-router-dom";
import cupIcon from "../../assets/cup.svg";

export default function ProfileInfo({
  email, username, travelStyle, user,
  advisorStatus, advisorSuccess, latestApplication,
  privacySettings, privacySaving, onPrivacyChange,
  onOpenAdvisorModal, onLogout,
}) {
  return (
    <div className="info">
      <div className="style"><span>Email:</span> <span className="email">{email}</span></div>
      <div className="style"><span>Username:</span> <span className="username">{username}</span></div>
      <div className="style"><span>Travel style:</span><strong>{travelStyle}</strong></div>
      <div className="style"><span>Role:</span>
      
      <strong>{user?.role || "USER"}</strong>
        <strong className={`advisor-status status-${advisorStatus.code.toLowerCase()}`}>
          {advisorStatus.label}
        </strong>
      </div>

      {advisorSuccess && <p className="advisor-success">{advisorSuccess}</p>}
      {latestApplication?.review_reason && (
        <p className="advisor-note">Manager note: {latestApplication.review_reason}</p>
      )}

      {user?.role !== "TRIPADVISOR" ? (
        <button
          className="advisor-cta"
          disabled={advisorStatus.code === "PENDING"}
          onClick={onOpenAdvisorModal}
        >
          {advisorStatus.code === "PENDING" ? "Application pending" : "Become TripAdvisor"}
        </button>
      ) : (
        <div className="advisor-panel">
          <strong>TripAdvisor tools are active</strong>
          <div className="level">
            <span>Check Trip status</span>
            <Link to="/tripstatus"><button>check status</button></Link>
          </div>
        </div>
      )}

      {(user?.role === "MANAGER" || user?.role === "ADMIN") && (
        <Link className="plan-link" to="/manager/advisors">Open manager approvals</Link>
      )}

      <div className="advisor-panel">
        <div className="level">
          <span>Traveler Badge:</span>
          <Link to="/map">
            <button>upgrade level <img src={cupIcon} alt="Cup" width="15" height="15" /></button>
          </Link>
        </div>
      </div>

      <div className="privacy-panel">
        <div className="privacy-header">
          <strong>Map visibility</strong>
          <span>Choose what other users can see in shared maps.</span>
        </div>
        <label className="privacy-option">
          <input
            type="checkbox"
            checked={Boolean(privacySettings?.share_map)}
            disabled={privacySaving}
            onChange={(e) => onPrivacyChange("share_map", e.target.checked)}
          />
          <div>
            <span className="privacy-option-title">Share my map points</span>
            <span className="privacy-option-note">Cities and countries from my travel map.</span>
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
            <span className="privacy-option-title">Share visited places</span>
            <span className="privacy-option-note">The list of places I have visited.</span>
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
            <span className="privacy-option-title">Share badges</span>
            <span className="privacy-option-note">Traveler progress and earned badges.</span>
          </div>
        </label>
      </div>

      <button className="logout" onClick={onLogout}>Logout</button>
    </div>
  );
}
