import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../slices/authSlice";
import api from "../api/axios";
import "../styles/managerReview.css";
import { useTranslation } from "react-i18next";
import TabBar from "../components/TabBar/TabBar";
import TripPostsModal from "../components/managerTab/TripPostsModal";
import s from "../styles/Inspiration.module.css";

const MANAGER_TABS = [
  { id: "applications", labelKey: "manager.applications" },
  { id: "trips", labelKey: "manager.tripPosts" },
  { id: "history", labelKey: "manager.history" },
];

export default function ManagerAdvisorReview() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const { t } = useTranslation();
  
  const [activeTab, setActiveTab] = useState("applications"); 
  const [apps, setApps] = useState([]);
  const [trips, setTrips] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});

  // Состояния для модалки деталей поста
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);

  const toList = (data) =>
    Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
      ? data.results
      : [];

  const getHistoryActionLabel = (action) => {
    if (!action) return t("manager.noReason");
    const translated = t(`manager.historyActions.${action}`);
    if (translated !== `manager.historyActions.${action}`) return translated;
    return action.split(".").map((part) => part.charAt(0).toUpperCase() + part.slice(1)).join(" ");
  };

  useEffect(() => {
    if (!user && localStorage.getItem("access")) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  const loadQueue = async () => {
    setLoading(true);
    setError("");
    try {
      const [appsRes, tripsRes, logsRes] = await Promise.all([
        api.get("marketplace/manager/applications/?status=PENDING"),
        api.get("marketplace/manager/trips/queue/"),
        api.get("marketplace/manager/logs/"),
      ]);
      setApps(toList(appsRes.data));
      setTrips(toList(tripsRes.data));
      setLogs(toList(logsRes.data));
    } catch (err) {
      setError(err.response?.data?.detail || t("manager.cannotLoadData"));
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "MANAGER" || user?.role === "ADMIN") {
      loadQueue();
    }
  }, [user]);

  const openTripDetails = (trip) => {
    setSelectedTrip(trip);
    setIsTripModalOpen(true);
  };

  const closeTripDetails = () => {
    setSelectedTrip(null);
    setIsTripModalOpen(false);
  };

  const moderate = async (id, status) => {
    try {
      await api.post(`marketplace/manager/applications/${id}/review/`, {
        status,
        reason: reasons[id] || "",
      });
      await loadQueue();
    } catch (err) {
      alert(err.response?.data?.detail || t("manager.failedModerationAction"));
    }
  };

  const moderateTrip = async (id, status) => {
    try {
      await api.post(`marketplace/manager/trips/${id}/moderate/`, {
        status,
        reason: reasons[`trip-${id}`] || "",
      });
      await loadQueue();
    } catch (err) {
      alert(err.response?.data?.detail || t("manager.failedTripModeration"));
    }
  };

  if (user?.role !== "MANAGER" && user?.role !== "ADMIN") {
    return <p style={{ padding: 20 }}>{t("manager.accessOnly")}</p>;
  }

  return (
    <div className="manager-review">
      <h1 className="manager-main-title">{t("manager.dashboard")}</h1>

      <TabBar
        tabs={MANAGER_TABS.map((tab) => ({
          id: tab.id,
          label:
            tab.id === "applications"
              ? `${t(tab.labelKey)} (${apps.length})`
              : tab.id === "trips"
              ? `${t(tab.labelKey)} (${trips.length})`
              : t(tab.labelKey),
        }))}
        activeTab={activeTab}
        onTabChange={setActiveTab}
      />

      <div className="tab-content">
        {loading && <p className="manager-loading">{t("manager.loading")}</p>}
        {error && <p className="manager-error">{error}</p>}

        {/* Секция Заявок */}
        {activeTab === "applications" && !loading && (
          <div className="fade-in">
            <h2 className="manager-title">{t("manager.advisorApplications")}</h2>
            {!apps.length && <p>{t("manager.noPendingApplications")}</p>}
            {apps.map((app) => (
              <div key={app.id} className="application-card">
                <p><strong>{t("manager.user")}:</strong> {app.user_email}</p>
                <p><strong>{t("manager.plan")}:</strong> {app.subscription_plan || "-"}</p>
                <p><strong>{t("manager.portfolio")}:</strong> {(app.portfolio_links || []).join(", ") || "-"}</p>
                <input
                  className="reason-input"
                  type="text"
                  placeholder={t("manager.reasonOptional")}
                  value={reasons[app.id] || ""}
                  onChange={(e) => setReasons(prev => ({ ...prev, [app.id]: e.target.value }))}
                />
                <div className="actions">
                  <button onClick={() => moderate(app.id, "APPROVED")}>{t("manager.approve")}</button>
                  <button onClick={() => moderate(app.id, "REJECTED")}>{t("manager.reject")}</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Секция Постов */}
        {activeTab === "trips" && !loading && (
          <div className="fade-in">
            <h2 className="manager-title">{t("manager.tripPosts")}</h2>
            {!trips.length && <p>{t("manager.noPendingTrips")}</p>}
            {trips.map((trip) => (
              <div 
                key={trip.id} 
                className="application-card" 
                style={{ cursor: 'pointer' }}
                onClick={() => openTripDetails(trip)}
              >
                <p><strong>{t("manager.title")}:</strong> {trip.title}</p>
                <p><strong>{t("manager.destination")}:</strong> {trip.destination}</p>
                
                {/* Остановка всплытия события, чтобы клик по инпуту или кнопкам не открывал модалку */}
                <div onClick={(e) => e.stopPropagation()}>
                  <input
                    className="reason-input"
                    type="text"
                    placeholder={t("manager.reasonOptional")}
                    value={reasons[`trip-${trip.id}`] || ""}
                    onChange={(e) => setReasons(prev => ({ ...prev, [`trip-${trip.id}`]: e.target.value }))}
                  />
                  <div className="actions">
                    <button onClick={() => moderateTrip(trip.id, "APPROVED")}>{t("manager.approve")}</button>
                    <button onClick={() => moderateTrip(trip.id, "REJECTED")}>{t("manager.reject")}</button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Секция Истории */}
        {activeTab === "history" && !loading && (
          <div className="fade-in">
            <h2 className="manager-title">{t("manager.moderationHistory")}</h2>
            {!logs.length && <p>{t("manager.noModerationHistory")}</p>}

            <div className="history-grid">
              {logs.map((log) => (
                <div key={log.id} className="history-card">
                  <p><strong>{t("manager.action")}:</strong> {getHistoryActionLabel(log.action)}</p>
                  <p><strong>{t("manager.at")}:</strong> {new Date(log.created_at).toLocaleString()}</p>
                  <p><strong>{t("manager.reason")}:</strong> {log.reason || t("manager.noReason")}</p>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>

      {/* Модалка для просмотра деталей трипа */}
      {isTripModalOpen && selectedTrip && (
        <TripPostsModal
          styles={s}
          trip={selectedTrip}
          onClose={closeTripDetails}
        />
      )}
    </div>
  );
}