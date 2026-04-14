import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { useSelector } from "react-redux";
import { useToast } from "../../context/ToastContext";
import { LEVELS_LIST } from "../../constants/mapConstants";
import worldIcon from "../../assets/world.svg";
import pinIcon from "../../assets/pin.svg";
import addVPlace from "../../assets/addVPlace.svg";
import deleteVPlace from "../../assets/deleteVPlace.svg";
import pinVPlaces from "../../assets/pinVPlaces.svg";
import shareIcon from "../../assets/share.svg";
import "../../styles/MapSidebar.css";

export default function MapSidebar({
  places,
  level,
  countriesCount,
  citiesCount,
  progress,
  loadingPlaces,
  onOpenModal,
  onRemovePlace,
}) {
  const { t } = useTranslation();
  const { showToast } = useToast();
  const { user } = useSelector((s) => s.auth);

  const appShareLink =
    user?.id && user?.map_share_token
      ? `${window.location.origin}/map/u/${user.id}?share_token=${encodeURIComponent(user.map_share_token)}`
      : user?.id
        ? `${window.location.origin}/map/u/${user.id}`
        : "";

  const copyShareLink = async () => {
    try {
      await navigator.clipboard.writeText(appShareLink);
      showToast(t("map.linkCopied"), "success");
    } catch {
      showToast(t("map.copyFailed"), "error");
    }
  };

  return (
    <aside className="map-sidebar">
      <div className="map-sidebar__scroll">
        <div className="map-sidebar__intro">
          <h1 className="map-sidebar__title">{t("map.pageTitle")}</h1>
          <p className="map-sidebar__subtitle">{t("map.pageSubtitle")}</p>
          <div className="map-sidebar__actions">
            <Link to="/shared-maps" className="map-sidebar__link-maps">
              {t("map.seeOtherMaps")}
            </Link>
            {user?.id ? (
              <button
                type="button"
                className="shared-maps-btn map-share-btn"
                disabled={!appShareLink}
                title={t("map.copyAppLink")}
                onClick={copyShareLink}
              >
                <img
                  src={shareIcon}
                  alt=""
                  className="map-share-btn__icon"
                  width={20}
                  height={20}
                />
                <span>{t("map.shareMapWithOthers")}</span>
              </button>
            ) : null}
          </div>
        </div>

        <h3 className="map-sidebar__block-heading">
          {t("map.yourBadgesSection")}
        </h3>
        <div className="badge-scroll">
          {LEVELS_LIST.map((lvl, i) => {
            const isCurrent = lvl.name === level.name;
            const isCompleted =
              lvl.next != null
                ? places.length >= lvl.next
                : places.length >= lvl.min;
            const progressPercent = lvl.next
              ? ((places.length - lvl.min) / (lvl.next - lvl.min)) * 100
              : 100;

            return (
              <div
                key={i}
                className={`badge-card ${isCurrent ? "current" : isCompleted ? "completed" : "locked"}`}
              >
                <div className="badge-icon">🧭</div>
                <strong>
                  {t(`map.levels.${lvl.name}`, { defaultValue: lvl.name })}
                </strong>
                {lvl.next ? (
                  <div className="mini-progress">
                    <div
                      className="mini-bar"
                      style={{ width: `${Math.min(progressPercent, 100)}%` }}
                    />
                  </div>
                ) : (
                  <span className="max-label">MAX</span>
                )}
              </div>
            );
          })}
        </div>

        <div className="level-dots">
          {LEVELS_LIST.map((_, i) => (
            <div
              key={i}
              className={`level-dot ${i <= level.index ? "active" : ""}`}
            >
              {i + 1}
            </div>
          ))}
        </div>

        <section className="stats">
          <h3>{t("map.yourStatistics")}</h3>
          <div className="stats-row">
            <div className="stat-card">
              <img src={worldIcon} alt="" />
              <strong>{countriesCount}</strong> {t("map.countries")}
            </div>
            <div className="stat-card">
              <img src={pinIcon} alt="" />
              <strong>{citiesCount}</strong> {t("map.cities")}
            </div>
          </div>
          <div className="world-progress">
            <strong>{progress}%</strong> {t("map.worldExplored")}
          </div>
        </section>

        <section className="visited">
          <div className="visited-header">
            <h3>
              {t("map.visitedPlaces")}
              <button
                type="button"
                className="inline-add-btn"
                onClick={onOpenModal}
              >
                <img src={addVPlace} alt="" />
              </button>
            </h3>
          </div>
          {loadingPlaces && <p>{t("map.loading")}</p>}
          <div className="visited-list">
            {places.map((p) => (
              <div className="place" key={p.id}>
                <img src={pinVPlaces} alt="" />
                <div className="place-info">
                  <strong>{p.city}</strong>
                  <span>{p.country}</span>
                </div>
                <div className="place-side">
                  <span className="date">{p.date}</span>
                  <div className="place-actions">
                    <button type="button" onClick={() => onRemovePlace(p.id)}>
                      <img src={deleteVPlace} alt="" />
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        </section>
      </div>
    </aside>
  );
}
