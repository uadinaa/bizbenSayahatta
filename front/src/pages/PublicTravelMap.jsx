import { useEffect, useMemo, useState } from "react";
import { Link, useParams, useSearchParams } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
  GeoJSON,
  Pane,
} from "react-leaflet";
import { useTranslation } from "react-i18next";
import domtoimage from "dom-to-image-more"; 
import { jsPDF } from "jspdf";
import { getPublicMapMarkers, getUserMap } from "../api/map";
import { LEVELS_LIST } from "../constants/mapConstants";
import worldIcon from "../assets/world.svg";
import pinIcon from "../assets/pin.svg";
import profileIcon from "../assets/profile.svg";
import "../styles/Map.css";
import "../styles/PublicTravelMap.css";

function resolveMediaUrl(url, fallback) {
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  const base = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";
  const origin = String(base)
    .replace(/\/api\/?$/, "")
    .replace(/\/+$/, "");
  return `${origin}${url}`;
}

function computeTravelerStats(pinPlaces) {
  const list = Array.isArray(pinPlaces) ? pinPlaces : [];
  const countriesCount = new Set(list.map((p) => p.country).filter(Boolean))
    .size;
  const citiesCount = new Set(
    list
      .map((p) => (p.city != null ? String(p.city).toLowerCase().trim() : ""))
      .filter(Boolean),
  ).size;
  const n = list.length;
  const progress = Math.min(100, (n / 1000) * 100).toFixed(1);
  let currentIndex = 0;
  let currentLevel = LEVELS_LIST[0];
  for (let i = 0; i < LEVELS_LIST.length; i++) {
    if (n >= LEVELS_LIST[i].min) {
      currentLevel = LEVELS_LIST[i];
      currentIndex = i;
    }
  }
  const level = currentLevel.next
    ? {
        name: currentLevel.name,
        current: n - currentLevel.min,
        needed: currentLevel.next - currentLevel.min,
        index: currentIndex,
      }
    : {
        name: currentLevel.name,
        current: "MAX",
        needed: "",
        index: currentIndex,
      };
  return { countriesCount, citiesCount, progress, level, pinCount: n };
}

export default function PublicTravelMap() {
  const { t } = useTranslation();
  const { userId } = useParams();
  const [searchParams] = useSearchParams();
  const shareToken =
    searchParams.get("share_token") || searchParams.get("token") || "";

  const [markers, setMarkers] = useState([]);
  const [mapMeta, setMapMeta] = useState(null);
  const [countriesData, setCountriesData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [isExporting, setIsExporting] = useState(false); 
  const [error, setError] = useState(null);

  const pinPlacesForStats = useMemo(() => {
    const fromApi = mapMeta?.map_places;
    if (Array.isArray(fromApi) && fromApi.length > 0) return fromApi;
    return (markers || []).map((m) => ({ city: m.name, country: m.country }));
  }, [mapMeta, markers]);

  const stats = useMemo(
    () => computeTravelerStats(pinPlacesForStats),
    [pinPlacesForStats],
  );

  const center = useMemo(() => {
    if (!markers.length) return [20, 0];
    return [markers[0].lat, markers[0].lng];
  }, [markers]);

  const displayUser = mapMeta?.user;
  const displayName = useMemo(() => {
    if (!displayUser) return t("publicMap.traveler");
    const u = displayUser.username;
    if (u && String(u).trim()) return String(u).trim();
    if (displayUser.email) return String(displayUser.email).split("@")[0];
    return t("publicMap.traveler");
  }, [displayUser, t]);

  
  const exportToPdf = async () => {
    const element = document.querySelector(".public-travel-map-page");
    if (!element) return;

    setIsExporting(true);

    try {
      
      const dataUrl = await domtoimage.toPng(element, {
        bgcolor: "#ffffff",
        width: element.offsetWidth,
        height: element.offsetHeight,
        filter: (node) => {
          
          if (node.tagName === "BUTTON") return false;
          if (node.classList && node.classList.contains("leaflet-control-container")) return false;
          return true;
        }
      });

      const pdf = new jsPDF({
        orientation: element.offsetWidth > element.offsetHeight ? "landscape" : "portrait",
        unit: "px",
        format: [element.offsetWidth, element.offsetHeight]
      });

      pdf.addImage(dataUrl, "PNG", 0, 0, element.offsetWidth, element.offsetHeight);
      pdf.save(`${displayName}-travel-map.pdf`);
    } catch (err) {
      console.error("PDF Export Error:", err);
      alert(t("publicMap.exportError", "Ошибка при создании PDF"));
    } finally {
      setIsExporting(false);
    }
  };

  const avatarSrc = resolveMediaUrl(displayUser?.avatar, profileIcon);

  const visitedCountriesForGeo = useMemo(() => {
    return pinPlacesForStats
      .map((p) => String(p.country || "").toLowerCase().trim())
      .filter(Boolean);
  }, [pinPlacesForStats]);

  const countryStyle = (feature) => {
    const name = String(feature.properties?.name || feature.properties?.ADMIN || "").toLowerCase().trim();
    const isVisited = visitedCountriesForGeo.includes(name);
    return {
      fillColor: isVisited ? "#FDD835" : "#E0E0E0",
      weight: 0.8,
      color: "#FFFFFF",
      fillOpacity: isVisited ? 0.32 : 0.08,
    };
  };

  useEffect(() => {
    document.title = t("publicMap.browserTitle");
  }, [t]);

  useEffect(() => {
    fetch("/data/countries.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCountriesData(data))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!userId) return;
    let cancelled = false;
    setLoading(true);
    setError(null);

    const run = async () => {
      try {
        const [mRes, uRes] = await Promise.allSettled([
          getPublicMapMarkers(userId, shareToken || undefined),
          getUserMap(userId, shareToken || undefined),
        ]);
        if (cancelled) return;
        if (mRes.status === "rejected") {
          const err = mRes.reason;
          if (err?.response?.status === 403) setError("private");
          else if (err?.response?.status === 404) setError("notfound");
          else setError("generic");
          return;
        }
        setMarkers(Array.isArray(mRes.value) ? mRes.value : []);
        if (uRes.status === "fulfilled" && uRes.value) {
          setMapMeta(uRes.value);
        } else {
          setMapMeta(null);
        }
      } catch {
        if (!cancelled) setError("generic");
      } finally {
        if (!cancelled) setLoading(false);
      }
    };
    run();
    return () => {
      cancelled = true;
    };
  }, [userId, shareToken]);

  if (!userId) return <div className="public-map-page public-map-fallback">{t("publicMap.invalidLink")}</div>;
  if (loading) return <div className="public-map-page public-map-fallback">{t("publicMap.loading")}</div>;
  if (error === "private") return <div className="public-map-page--message public-map-fallback"><p>{t("publicMap.private")}</p><Link to="/">{t("publicMap.home")}</Link></div>;
  if (error === "notfound") return <div className="public-map-page--message public-map-fallback"><p>{t("publicMap.notFound")}</p><Link to="/">{t("publicMap.home")}</Link></div>;
  if (error) return <div className="public-map-page--message public-map-fallback"><p>{t("publicMap.error")}</p><Link to="/">{t("publicMap.home")}</Link></div>;
  if (!markers.length) return <div className="public-map-page--message public-map-fallback"><p>{t("publicMap.empty")}</p><Link to="/">{t("publicMap.home")}</Link></div>;

  return (
    <div className="map-page public-travel-map-page">
      <aside className="map-sidebar">
        <div className="map-sidebar__scroll">
          <div className="public-map-user">
            <img src={avatarSrc} alt="" className="public-map-user__avatar" width={56} height={56} />
            <div className="public-map-user__text">
              <h2 className="public-map-user__name">{displayName}</h2>
              <p className="public-map-user__subtitle">{t("publicMap.sharedTravelMap")}</p>
            </div>
          </div>

          <h3 className="public-map-sidebar__heading">{t("map.travelerLevel")}</h3>

          <div className="badge-scroll">
            {LEVELS_LIST.map((lvl, i) => {
              const isCurrent = lvl.name === stats.level.name;
              const isCompleted = lvl.next != null ? stats.pinCount >= lvl.next : stats.pinCount >= lvl.min;
              const progressPercent = lvl.next ? ((stats.pinCount - lvl.min) / (lvl.next - lvl.min)) * 100 : 100;
              return (
                <div key={i} className={`badge-card ${isCurrent ? "current" : isCompleted ? "completed" : "locked"}`}>
                  <div className="badge-icon">🧭</div>
                  <strong>{t(`map.levels.${lvl.name}`, { defaultValue: lvl.name })}</strong>
                  {lvl.next ? (
                    <div className="mini-progress">
                      <div className="mini-bar" style={{ width: `${Math.min(progressPercent, 100)}%` }} />
                    </div>
                  ) : <span className="max-label">MAX</span>}
                </div>
              );
            })}
          </div>

          <div className="level-dots">
            {LEVELS_LIST.map((_, i) => (
              <div key={i} className={`level-dot ${i <= stats.level.index ? "active" : ""}`}>{i + 1}</div>
            ))}
          </div>

          <section className="stats">
            <h3>{t("publicMap.statisticsHeading")}</h3>
            <div className="stats-row">
              <div className="stat-card">
                <img src={worldIcon} alt="" />
                <strong>{stats.countriesCount}</strong> {t("map.countries")}
              </div>
              <div className="stat-card">
                <img src={pinIcon} alt="" />
                <strong>{stats.citiesCount}</strong> {t("map.cities")}
              </div>
            </div>
            <div className="world-progress">
              <strong>{stats.progress}%</strong> {t("map.worldExplored")}
            </div>
          </section>

          {Array.isArray(mapMeta?.badges) && mapMeta.badges.length > 0 && (
            <section className="public-map-badges">
              <h3>{t("publicMap.badgesHeading")}</h3>
              <ul className="public-map-badges__list">
                {mapMeta.badges.map((b) => <li key={b.code}>{b.label}</li>)}
              </ul>
            </section>
          )}

          <button 
            onClick={exportToPdf} 
            disabled={isExporting}
            className="export-button"
            style={{ 
              margin: '20px 10px', 
              padding: '12px', 
              cursor: isExporting ? 'not-allowed' : 'pointer',
              backgroundColor: '#511eb0',
              color: 'white',
              border: 'none',
              borderRadius: '8px',
              fontWeight: 'bold'
            }}
          >
            {isExporting ? t("sharedMaps.exporting") : t("sharedMaps.downloadPdf")}
          </button>
        </div>
      </aside>

      <main className="map-area">
        <MapContainer
          center={center}
          zoom={2}
          preferCanvas={true} 
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap &copy; CARTO"
          />
          {countriesData && (
            <GeoJSON
              data={countriesData}
              style={countryStyle}
              interactive={false}
            />
          )}
          <Pane name="labels" style={{ zIndex: 650, pointerEvents: "none" }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
              pane="labels"
            />
          </Pane>
          {markers.map((m, i) => (
            <CircleMarker
              key={`${m.lat}-${m.lng}-${i}`}
              center={[m.lat, m.lng]}
              radius={6}
              color="#1e88e5"
            >
              <Popup>
                <strong>{m.name}</strong>
                {m.country && <><br />{m.country}</>}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>
      </main>
    </div>
  );
}