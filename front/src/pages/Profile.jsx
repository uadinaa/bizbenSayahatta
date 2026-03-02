import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile, logoutUser } from "../slices/authSlice";
import api from "../api/axios";
import "../styles/ProfileCard.css";
import profileIcon from "../assets/profile.svg";
import editIcon from "../assets/edit.svg";
import cupIcon from "../assets/cup.svg";
import cameraIcon from "../assets/camera.svg";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

function resolveMediaUrl(url, fallback) {
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://")) return url;
  return `${API_BASE}${url}`;
}

const STATUS_LABELS = {
  PENDING: "Pending review",
  APPROVED: "Approved",
  REJECTED: "Rejected",
  MORE_INFO: "More info required",
};

function toList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}

export default function ProfileCard() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const defaultAvatar = profileIcon;

  const [username, setUsername] = useState("Username");
  const [avatar, setAvatar] = useState(defaultAvatar);
  const [cover, setCover] = useState(null);
  const [email, setEmail] = useState("user@email.com");
  const [travelStyle, setTravelStyle] = useState("Not set");

  const [tempUsername, setTempUsername] = useState(username);
  const [tempAvatar, setTempAvatar] = useState(avatar);
  const [tempStyle, setTempStyle] = useState(travelStyle);
  const [avatarFile, setAvatarFile] = useState(null);

  const [isEditOpen, setIsEditOpen] = useState(false);

  const [categories, setCategories] = useState([]);
  const [applications, setApplications] = useState([]);
  const [advisorModalOpen, setAdvisorModalOpen] = useState(false);
  const [advisorLoading, setAdvisorLoading] = useState(false);
  const [advisorError, setAdvisorError] = useState("");
  const [advisorForm, setAdvisorForm] = useState({
    subscriptionPlan: "monthly",
    paymentReference: "",
    instagram: "",
    notes: "",
    portfolioText: "",
    categoryIds: [],
    contractAccepted: false,
    termsAccepted: false,
    cvFile: null,
  });

  useEffect(() => {
    if (localStorage.getItem("access")) {
      dispatch(fetchProfile());
    }
  }, [dispatch]);

  useEffect(() => {
    if (!user) return;
    setEmail(user.email || "user@email.com");
    setUsername(user.username || "Username");
    setTravelStyle(user.preferences?.travel_style || "Not set");

    const resolvedAvatar = resolveMediaUrl(user.avatar, defaultAvatar);
    setAvatar(resolvedAvatar);
    setTempAvatar(resolvedAvatar);

    const resolvedCover = resolveMediaUrl(user.cover, null);
    setCover(resolvedCover);
  }, [user]);

  useEffect(() => {
    if (!localStorage.getItem("access")) return;

    const loadAdvisorData = async () => {
      try {
        const [categoriesRes, applicationsRes] = await Promise.all([
          api.get("marketplace/categories/"),
          api.get("marketplace/advisor/applications/"),
        ]);
        setCategories(toList(categoriesRes.data));
        setApplications(toList(applicationsRes.data));
      } catch (err) {
        console.error("Failed to load advisor metadata", err);
      }
    };

    loadAdvisorData();
  }, []);

  const latestApplication = useMemo(() => {
    if (!applications.length) return null;
    return [...applications].sort((a, b) => b.id - a.id)[0];
  }, [applications]);

  const advisorStatus = useMemo(() => {
    if (user?.role === "TRIPADVISOR") return { code: "APPROVED", label: "Active TripAdvisor" };
    if (latestApplication?.status) return { code: latestApplication.status, label: STATUS_LABELS[latestApplication.status] || latestApplication.status };
    return { code: "NONE", label: "Not applied" };
  }, [user, latestApplication]);

  const fileToBase64 = (file) =>
    new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });

  const openModal = () => {
    setTempUsername(username);
    setTempAvatar(avatar);
    setTempStyle(travelStyle);
    setAvatarFile(null);
    setIsEditOpen(true);
  };

  const saveChanges = async () => {
    try {
      const profileRes = await api.put("users/profile/", {
        username: tempUsername,
        travel_style: tempStyle === "Not set" ? null : tempStyle,
      });
      let updatedUserData = profileRes.data;
      if (avatarFile) {
        const formData = new FormData();
        formData.append("avatar", avatarFile);
        const avatarRes = await api.patch("users/profile/", formData);
        updatedUserData = avatarRes.data;
      }

      const resolvedAvatar = resolveMediaUrl(updatedUserData.avatar, defaultAvatar);
      setUsername(updatedUserData.username || "Username");
      setTravelStyle(updatedUserData.preferences?.travel_style || "Not set");
      setAvatar(resolvedAvatar);
      setAvatarFile(null);
      setIsEditOpen(false);
    } catch (err) {
      const backendError = err?.response?.data;
      alert(typeof backendError === "string" ? backendError : JSON.stringify(backendError || "Failed to save profile"));
    }
  };

  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await api.patch("users/profile/", formData);
      setCover(resolveMediaUrl(res.data.cover, null));
    } catch (err) {
      console.error("Failed to upload cover", err);
    }
  };

  const toggleCategory = (categoryId) => {
    setAdvisorForm((prev) => (
      prev.categoryIds.includes(categoryId)
        ? { ...prev, categoryIds: prev.categoryIds.filter((id) => id !== categoryId) }
        : { ...prev, categoryIds: [...prev.categoryIds, categoryId] }
    ));
  };

  const submitAdvisorApplication = async () => {
    setAdvisorError("");
    setAdvisorLoading(true);
    try {
      const links = advisorForm.portfolioText
        .split("\n")
        .map((line) => line.trim())
        .filter(Boolean);
      if (advisorForm.instagram.trim()) links.unshift(advisorForm.instagram.trim());

      const formData = new FormData();
      formData.append("contract_accepted", String(advisorForm.contractAccepted));
      formData.append("terms_accepted", String(advisorForm.termsAccepted));
      formData.append("subscription_plan", advisorForm.subscriptionPlan);
      formData.append("payment_reference", advisorForm.paymentReference);
      formData.append("notes", advisorForm.notes);
      advisorForm.categoryIds.forEach((id) => formData.append("category_ids", String(id)));
      formData.append("portfolio_links", JSON.stringify(links));
      if (advisorForm.cvFile) formData.append("cv_file", advisorForm.cvFile);

      await api.post("marketplace/advisor/apply/", formData);
      const applicationsRes = await api.get("marketplace/advisor/applications/");
      setApplications(toList(applicationsRes.data));
      setAdvisorModalOpen(false);
      alert("Application sent. Status is now Pending review.");
    } catch (err) {
      const backend = err?.response?.data;
      setAdvisorError(typeof backend === "string" ? backend : JSON.stringify(backend || "Failed to send application"));
    } finally {
      setAdvisorLoading(false);
    }
  };

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  return (
    <div className="profile-wrapper">
      <div className="cover">
        {!cover && <div className="cover-bg" />}
        {cover && <img src={cover} alt="Cover" className="cover-img" />}
        <img src={cameraIcon} alt="Edit Cover" className="cover-edit-icon" onClick={() => document.getElementById("coverInput").click()} />
        <input type="file" id="coverInput" accept="image/*" style={{ display: "none" }} onChange={handleCoverChange} />
      </div>

      <div className="profile-content">
        <div className="avatar" style={{ background: avatar === defaultAvatar ? "#9ccbd3" : "transparent" }}>
          <img src={avatar} alt="Avatar" />
        </div>

        <div className="info">
          <span className="email">{email}</span>
          <span className="username">{username}</span>

          <div className="style"><span>Travel style:</span><strong>{travelStyle}</strong></div>
          <div className="style"><span>Role:</span><strong>{user?.role || "USER"}</strong></div>
          <div className="style"><span>TripAdvisor status:</span><strong className={`advisor-status status-${advisorStatus.code.toLowerCase()}`}>{advisorStatus.label}</strong></div>

          {latestApplication?.review_reason ? <p className="advisor-note">Manager note: {latestApplication.review_reason}</p> : null}

          {user?.role !== "TRIPADVISOR" ? (
            <button className="advisor-cta" disabled={advisorStatus.code === "PENDING"} onClick={() => setAdvisorModalOpen(true)}>
              {advisorStatus.code === "PENDING" ? "Application pending" : "Become TripAdvisor"}
            </button>
          ) : (
            <div className="advisor-panel">
              <strong>TripAdvisor tools are active</strong>
              <Link to="/trip">My trips</Link>
              <Link to="/chat">Create trip in chat</Link>
              <p>Now you can create and publish TripAdvisor packages.</p>
            </div>
          )}

          {(user?.role === "MANAGER" || user?.role === "ADMIN") ? <Link className="plan-link" to="/manager/advisors">Open manager approvals</Link> : null}

          <div className="level"><span>Level of the user</span><button>Upgrade Level</button><img src={cupIcon} alt="Cup" /></div>
          <Link className="plan-link" to="/chat">plan your trip</Link>
          <button className="logout" onClick={handleLogout}>Logout</button>
        </div>

        <div className="edit" onClick={openModal}><img src={editIcon} alt="Edit" width="28" height="28" /></div>
      </div>

      {isEditOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit profile</h3>
            <label>Username<input type="text" value={tempUsername} onChange={(e) => setTempUsername(e.target.value)} placeholder="username" /></label>
            <label>Travel style<select value={tempStyle} onChange={(e) => setTempStyle(e.target.value)}><option value="Hiking">Hiking</option><option value="City trips">City trips</option><option value="Beach">Beach</option><option value="Adventure">Adventure</option><option value="Relax">Relax</option><option value="Cultural">Cultural</option></select></label>
            <label>Avatar<input type="file" accept="image/*" onChange={async (e) => {
              const file = e.target.files[0];
              if (!file) return;
              const preview = await fileToBase64(file);
              setTempAvatar(preview);
              setAvatarFile(file);
            }} /></label>
            <button type="button" className="remove-avatar" onClick={() => setTempAvatar(defaultAvatar)}>Remove avatar</button>
            <div className="modal-actions"><button onClick={saveChanges}>Save</button><button className="cancel" onClick={() => setIsEditOpen(false)}>Cancel</button></div>
          </div>
        </div>
      )}

      {advisorModalOpen && (
        <div className="modal-overlay">
          <div className="modal advisor-modal">
            <h3>Become TripAdvisor</h3>
            <p className="advisor-rules">Read rules, fill the form, and send application to manager review.</p>

            <label>Advisor type / categories
              <div className="chips-wrap">
                {categories.map((cat) => (
                  <button key={cat.id} type="button" className={`chip ${advisorForm.categoryIds.includes(cat.id) ? "chip-selected" : ""}`} onClick={() => toggleCategory(cat.id)}>{cat.name}</button>
                ))}
              </div>
            </label>

            <label>Subscription plan
              <select value={advisorForm.subscriptionPlan} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, subscriptionPlan: e.target.value }))}>
                <option value="monthly">Monthly</option>
                <option value="quarterly">Quarterly</option>
              </select>
            </label>

            <label>Payment reference
              <input type="text" placeholder="Transaction/Invoice ID" value={advisorForm.paymentReference} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, paymentReference: e.target.value }))} />
            </label>

            <label>Instagram / social
              <input type="text" placeholder="https://instagram.com/..." value={advisorForm.instagram} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, instagram: e.target.value }))} />
            </label>

            <label>Portfolio / trip links (one per line)
              <textarea rows={4} placeholder="https://..." value={advisorForm.portfolioText} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, portfolioText: e.target.value }))} />
            </label>

            <label>About your trips
              <textarea rows={3} placeholder="What kind of trips you create" value={advisorForm.notes} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, notes: e.target.value }))} />
            </label>

            <label>CV (optional)
              <input type="file" onChange={(e) => setAdvisorForm((prev) => ({ ...prev, cvFile: e.target.files?.[0] || null }))} />
            </label>

            <label className="check-row"><input type="checkbox" checked={advisorForm.contractAccepted} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, contractAccepted: e.target.checked }))} />I accept contract</label>
            <label className="check-row"><input type="checkbox" checked={advisorForm.termsAccepted} onChange={(e) => setAdvisorForm((prev) => ({ ...prev, termsAccepted: e.target.checked }))} />I accept terms</label>

            {advisorError ? <p className="advisor-error">{advisorError}</p> : null}

            <div className="modal-actions">
              <button onClick={submitAdvisorApplication} disabled={advisorLoading || !advisorForm.contractAccepted || !advisorForm.termsAccepted}>
                {advisorLoading ? "Sending..." : "Submit for review"}
              </button>
              <button className="cancel" onClick={() => setAdvisorModalOpen(false)}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
