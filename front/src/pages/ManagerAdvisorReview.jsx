import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../slices/authSlice";
import api from "../api/axios";
import "../styles/managerReview.css";

export default function ManagerAdvisorReview() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  // Состояние для управления вкладками
  const [activeTab, setActiveTab] = useState("applications"); 

  const [apps, setApps] = useState([]);
  const [trips, setTrips] = useState([]);
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});

  const toList = (data) =>
    Array.isArray(data)
      ? data
      : Array.isArray(data?.results)
      ? data.results
      : [];

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
      setError(err.response?.data?.detail || "Cannot load data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (user?.role === "MANAGER" || user?.role === "ADMIN") {
      loadQueue();
    }
  }, [user]);

  const moderate = async (id, status) => {
    try {
      await api.post(`marketplace/manager/applications/${id}/review/`, {
        status,
        reason: reasons[id] || "",
      });
      await loadQueue();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed moderation action");
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
      alert(err.response?.data?.detail || "Failed trip moderation");
    }
  };

  if (user?.role !== "MANAGER" && user?.role !== "ADMIN") {
    return <p style={{ padding: 20 }}>Manager access only.</p>;
  }

  return (
    <div className="manager-review">
      <h1 className="manager-main-title">Management Dashboard</h1>

      {/* Переключатели вкладок */}
      <div className="tabs-container">
        <button 
          className={`tab-button ${activeTab === "applications" ? "active" : ""}`}
          onClick={() => setActiveTab("applications")}
        >
          Applications ({apps.length})
        </button>
        <button 
          className={`tab-button ${activeTab === "trips" ? "active" : ""}`}
          onClick={() => setActiveTab("trips")}
        >
          Trip Posts ({trips.length})
        </button>
        <button 
          className={`tab-button ${activeTab === "history" ? "active" : ""}`}
          onClick={() => setActiveTab("history")}
        >
          History
        </button>
      </div>

      <div className="tab-content">
        {loading && <p className="manager-loading">Loading...</p>}
        {error && <p className="manager-error">{error}</p>}

        {/* Секция Заявок */}
        {activeTab === "applications" && !loading && (
          <div className="fade-in">
            <h2 className="manager-title">TripAdvisor Applications</h2>
            {!apps.length && <p>No pending applications.</p>}
            {apps.map((app) => (
              <div key={app.id} className="application-card">
                <p><strong>User:</strong> {app.user_email}</p>
                <p><strong>Plan:</strong> {app.subscription_plan || "-"}</p>
                <p><strong>Portfolio:</strong> {(app.portfolio_links || []).join(", ") || "-"}</p>
                <input
                  className="reason-input"
                  type="text"
                  placeholder="Reason (optional)"
                  value={reasons[app.id] || ""}
                  onChange={(e) => setReasons(prev => ({ ...prev, [app.id]: e.target.value }))}
                />
                <div className="actions">
                  <button onClick={() => moderate(app.id, "APPROVED")}>Approve</button>
                  <button onClick={() => moderate(app.id, "REJECTED")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Секция Постов */}
        {activeTab === "trips" && !loading && (
          <div className="fade-in">
            <h2 className="manager-title">Trip Posts</h2>
            {!trips.length && <p>No pending trips.</p>}
            {trips.map((trip) => (
              <div key={trip.id} className="application-card">
                <p><strong>Title:</strong> {trip.title}</p>
                <p><strong>Destination:</strong> {trip.destination}</p>
                <input
                  className="reason-input"
                  type="text"
                  placeholder="Reason (optional)"
                  value={reasons[`trip-${trip.id}`] || ""}
                  onChange={(e) => setReasons(prev => ({ ...prev, [`trip-${trip.id}`]: e.target.value }))}
                />
                <div className="actions">
                  <button onClick={() => moderateTrip(trip.id, "APPROVED")}>Approve</button>
                  <button onClick={() => moderateTrip(trip.id, "REJECTED")}>Reject</button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Секция Истории */}
        {activeTab === "history" && !loading && (
  <div className="fade-in">
    <h2 className="manager-title">Moderation History</h2>
    {!logs.length && <p>No moderation history yet.</p>}

    <div className="history-grid">
      {logs.map((log) => (
        <div key={log.id} className="history-card">
          <p><strong>Action:</strong> {log.action}</p>
          <p><strong>At:</strong> {new Date(log.created_at).toLocaleString()}</p>
          <p><strong>Reason:</strong> {log.reason || "-"}</p>
        </div>
      ))}
    </div>
  </div>
)}
      </div>
    </div>
  );
}