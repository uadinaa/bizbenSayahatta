import { useEffect, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { Link, useNavigate } from "react-router-dom";
import { logoutUser, fetchProfile, updatePreferences } from "../slices/authSlice";

export default function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading } = useSelector((state) => state.auth);
  const [budget, setBudget] = useState("");
  const [travelStyle, setTravelStyle] = useState("");
  const [interests, setInterests] = useState("");
  const [openNow, setOpenNow] = useState("");

  useEffect(() => {
  const token = localStorage.getItem("access");
  if (!token) {
    navigate("/login");
    return;
  }

  dispatch(fetchProfile()).unwrap().catch(() => navigate("/login"));
}, [dispatch, navigate]);

  useEffect(() => {
    if (user?.preferences) {
      setBudget(
        user.preferences.budget === null || user.preferences.budget === undefined
          ? ""
          : String(user.preferences.budget)
      );
      setTravelStyle(user.preferences.travel_style || "");
      setOpenNow(user.preferences.open_now ? "true" : "");
      setInterests((user.preferences.interests || []).join(", "));
    }
  }, [user]);

  const handleSavePreferences = async (e) => {
    e.preventDefault();
    const payload = {
      budget: budget === "" ? null : Number(budget),
      travel_style: travelStyle || null,
      open_now: openNow === "true" ? true : null,
      interests: interests
        .split(",")
        .map((item) => item.trim())
        .filter(Boolean),
    };
    dispatch(updatePreferences(payload));
  };

  const handleLogout = async () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return null; // unauth will be redirected
  
  return (
    <div className="profile-container">
      <h2>Profile</h2>
  
      {user.avatar && (
        <img
          src={`http://127.0.0.1:8000${user.avatar}`}
          alt="profile"
          width={120}
        />
      )}
  
      <p>Email: {user.email}</p>
      <form onSubmit={handleSavePreferences} style={{ marginTop: 16 }}>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
          <input
            type="number"
            min="0"
            max="4"
            placeholder="Budget (0-4)"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
          />
          <input
            type="text"
            placeholder="Travel style (e.g. relax)"
            value={travelStyle}
            onChange={(e) => setTravelStyle(e.target.value)}
          />
          <select
            value={openNow}
            onChange={(e) => setOpenNow(e.target.value)}
          >
            <option value="">Open now preference</option>
            <option value="true">Open now only</option>
          </select>
          <input
            type="text"
            placeholder="Interests (comma separated)"
            value={interests}
            onChange={(e) => setInterests(e.target.value)}
          />
        </div>
        <button type="submit" style={{ marginTop: 12 }}>
          Save preferences
        </button>
      </form>
  
      <Link to={"/chat"} >plan your trip</Link>
      <button onClick={handleLogout}>Logout</button>


    </div>
  );
}
