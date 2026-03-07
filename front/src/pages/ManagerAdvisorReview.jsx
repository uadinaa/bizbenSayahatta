import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../slices/authSlice";
import api from "../api/axios";
import "../styles/managerReview.css";

export default function ManagerAdvisorReview() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);

  const [apps, setApps] = useState([]);
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
      const res = await api.get("marketplace/manager/applications/?status=PENDING");
      setApps(toList(res.data));
    } catch (err) {
      setError(err.response?.data?.detail || "Cannot load applications");
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

  if (user?.role !== "MANAGER" && user?.role !== "ADMIN") {
    return <p style={{ padding: 20 }}>Manager access only.</p>;
  }

  return (
    <div className="manager-review">

      <h2 className="manager-title">TripAdvisor Applications</h2>
      <p className="manager-subtitle">Pending requests for manager review.</p>

      {loading && <p className="manager-loading">Loading...</p>}
      {error && <p className="manager-error">{error}</p>}
      {!loading && !apps.length && <p>No pending applications.</p>}

      {apps.map((app) => (
        <div key={app.id} className="application-card">

          <p><strong>User:</strong> {app.user_email} (id: {app.user_id})</p>
          <p><strong>Plan:</strong> {app.subscription_plan || "-"}</p>
          <p><strong>Portfolio:</strong> {(app.portfolio_links || []).join(", ") || "-"}</p>
          <p><strong>Notes:</strong> {app.notes || "-"}</p>

          {app.cv_file && (
            <p>
              <strong>CV:</strong>{" "}
              <a
                className="cv-link"
                href={app.cv_file}
                target="_blank"
                rel="noreferrer"
              >
                Open CV
              </a>
            </p>
          )}

          <input
            className="reason-input"
            type="text"
            placeholder="Reason (optional)"
            value={reasons[app.id] || ""}
            onChange={(e) =>
              setReasons((prev) => ({
                ...prev,
                [app.id]: e.target.value,
              }))
            }
          />

          <div className="actions">
            <button onClick={() => moderate(app.id, "APPROVED")}>
              Approve
            </button>

            <button onClick={() => moderate(app.id, "REJECTED")}>
              Reject
            </button>

            <button onClick={() => moderate(app.id, "MORE_INFO")}>
              Need more info
            </button>
          </div>

        </div>
      ))}
    </div>
  );
}