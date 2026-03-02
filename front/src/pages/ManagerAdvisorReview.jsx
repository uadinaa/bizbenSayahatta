import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../slices/authSlice";
import api from "../api/axios";

export default function ManagerAdvisorReview() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [apps, setApps] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reasons, setReasons] = useState({});

  const toList = (data) => (Array.isArray(data) ? data : Array.isArray(data?.results) ? data.results : []);

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
    <div style={{ maxWidth: 900, margin: "0 auto", padding: 20 }}>
      <h2>TripAdvisor Applications</h2>
      <p>Pending requests for manager review.</p>

      {loading && <p>Loading...</p>}
      {error && <p style={{ color: "#b42318" }}>{error}</p>}
      {!loading && !apps.length && <p>No pending applications.</p>}

      {apps.map((app) => (
        <div key={app.id} style={{ border: "1px solid #ddd", borderRadius: 10, padding: 14, marginBottom: 12, background: "#fff" }}>
          <p><strong>User:</strong> {app.user_email} (id: {app.user_id})</p>
          <p><strong>Plan:</strong> {app.subscription_plan || "-"}</p>
          <p><strong>Portfolio:</strong> {(app.portfolio_links || []).join(", ") || "-"}</p>
          <p><strong>Notes:</strong> {app.notes || "-"}</p>
          {app.cv_file ? <p><strong>CV:</strong> <a href={app.cv_file} target="_blank" rel="noreferrer">Open CV</a></p> : null}

          <input type="text" placeholder="Reason (optional)" value={reasons[app.id] || ""} onChange={(e) => setReasons((prev) => ({ ...prev, [app.id]: e.target.value }))} style={{ width: "100%", padding: 8, marginTop: 10 }} />

          <div style={{ display: "flex", gap: 8, marginTop: 10 }}>
            <button onClick={() => moderate(app.id, "APPROVED")}>Approve</button>
            <button onClick={() => moderate(app.id, "REJECTED")}>Reject</button>
            <button onClick={() => moderate(app.id, "MORE_INFO")}>Need more info</button>
          </div>
        </div>
      ))}
    </div>
  );
}
