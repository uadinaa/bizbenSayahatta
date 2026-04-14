import { LEVELS_LIST } from "../../constants/mapConstants";
import "../../styles/ProfileBadgePanel.css";
import cupIcon from "../../assets/cup.svg";
import { Link } from "react-router-dom";

// Computes the current traveler level from saved places.
function getTravelerLevel(placesCount) {
  let level = { ...LEVELS_LIST[0], index: 0 };

  for (let i = 0; i < LEVELS_LIST.length; i += 1) {
    if (placesCount >= LEVELS_LIST[i].min) {
      level = { ...LEVELS_LIST[i], index: i };
    }
  }

  return level;
}

// Renders the traveler badge summary row above the badge list.
// function ProfileBadgeSummary({ places, t }) {
//   const level = getTravelerLevel(places.length);

//   return (
//     <div className="advisor-panel profilePage__badgeSummaryBar">
//       <div className="level">
//         <span>{t("profile.travelerBadge")}:</span>
//         <strong>{t(`map.levels.${level.name}`, { defaultValue: level.name })}</strong>
//         <Link to="/map">
//           <button>{t("profile.upgradeLevel")} <img src={cupIcon} alt={t("common.cup")} width="15" height="15" /></button>
//         </Link>
//       </div>
//     </div>
//   );
// }

// Renders the traveler level cards using the existing badge thresholds.
export default function ProfileBadgePanel({ places, t }) {
  if (!places.length) {
    return <p className="profilePage__placeholder">Complete trips to earn badges</p>;
  }

  const level = getTravelerLevel(places.length);

  return (
    <div className="profilePage__badgePanel">
      <div className="profilePage__badgeSummary">
        <h2>{t("map.travelerLevel")}</h2>
        <p>
          <span className="travelerBadge">{t("profile.travelerBadge")}:</span> {t(`map.levels.${level.name}`, { defaultValue: level.name })} • {places.length} visited places
        </p>
        <div className="level">
          <Link to="/map">
            <button>{t("profile.upgradeLevel")} <img src={cupIcon} alt={t("common.cup")} width="15" height="15" /></button>
          </Link>
        </div>
      </div>

      <div className="profilePage__badgeGrid">
        {LEVELS_LIST.map((badge, index) => {
          const isCurrent = index === level.index;
          const isUnlocked = places.length >= badge.min;
          const isMax = badge.next === null;

          return (
            <article
              key={badge.name}
              className={`profilePage__badgeCard ${isCurrent ? "profilePage__badgeCard--current" : ""} ${isUnlocked ? "profilePage__badgeCard--earned" : ""}`}
            >
              <div className="profilePage__badgeIcon">🧭</div>
              <strong>{t(`map.levels.${badge.name}`, { defaultValue: badge.name })}</strong>
              <span>
                {isUnlocked ? "Unlocked" : `${badge.min} places needed`}
              </span>
              {isMax ? (
                <span className="profilePage__badgeMax">MAX</span>
              ) : (
                <span className="profilePage__badgeHint">
                  {Math.max(0, places.length - badge.min)} / {badge.next - badge.min} places in this level
                </span>
              )}
            </article>
          );
        })}
      </div>
    </div>
  );
}
