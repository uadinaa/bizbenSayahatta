import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile, logoutUser } from "../slices/authSlice";
import api from "../api/axios";
import "../styles/ProfileCard.css";
import profileIcon from "../assets/profile.svg";
import editIcon from "../assets/edit.svg";
import cupIcon from "../assets/cup.svg";
import cameraIcon from "../assets/camera.svg";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";

function resolveMediaUrl(url, fallback) {
  if (!url) return fallback;
  if (url.startsWith("http://") || url.startsWith("https://")) {
    return url;
  }
  return `${API_BASE}${url}`;
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

  // Временные данные для модалки
  const [tempUsername, setTempUsername] = useState(username);
  const [tempAvatar, setTempAvatar] = useState(avatar);
  const [tempStyle, setTempStyle] = useState(travelStyle);
  const [avatarFile, setAvatarFile] = useState(null);

  const [isEditOpen, setIsEditOpen] = useState(false);

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

  // Конвертация файла в base64
  const fileToBase64 = (file) => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.readAsDataURL(file);
      reader.onload = () => resolve(reader.result);
      reader.onerror = (error) => reject(error);
    });
  };

  // Модалка
  const openModal = () => {
    setTempUsername(username);
    setTempAvatar(avatar);
    setTempStyle(travelStyle);
    setAvatarFile(null);
    setIsEditOpen(true);
  };

  const closeModal = () => setIsEditOpen(false);

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
      console.error("Failed to save profile", backendError || err);
      if (backendError) {
        alert(
          typeof backendError === "string"
            ? backendError
            : JSON.stringify(backendError)
        );
      } else {
        alert("Failed to save profile. Please try again.");
      }
    }
  };

  // Аватар
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const preview = await fileToBase64(file);
      setTempAvatar(preview);
      setAvatarFile(file);
    }
  };

  const removeAvatar = () => setTempAvatar(defaultAvatar);

  const handleLogout = () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  // Cover
  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (!file) return;

    try {
      const formData = new FormData();
      formData.append("cover", file);
      const res = await api.patch("users/profile/", formData);
      const resolvedCover = resolveMediaUrl(res.data.cover, null);
      setCover(resolvedCover);
    } catch (err) {
      console.error("Failed to upload cover", err);
    }
  };

  return (
    <div className="profile-wrapper">
      <div className="cover">
        {!cover && <div className="cover-bg"></div>}
        {cover && <img src={cover} alt="Cover" className="cover-img" />}

        <img
          src={cameraIcon}
          alt="Edit Cover"
          className="cover-edit-icon"
          onClick={() => document.getElementById("coverInput").click()}
        />
        <input
          type="file"
          id="coverInput"
          accept="image/*"
          style={{ display: "none" }}
          onChange={handleCoverChange}
        />
      </div>

      <div className="profile-content">
        <div
          className="avatar"
          style={{
            background: avatar === defaultAvatar ? "#9ccbd3" : "transparent",
          }}
        >
          <img src={avatar} alt="Avatar" />
        </div>

        <div className="info">
          <span className="email">{email}</span>
          <span className="username">{username}</span>

          <div className="style">
            <span>Travel style:</span>
            <strong>{travelStyle}</strong>
          </div>

          <div className="level">
            <span>Level of the user</span>
            <button>Upgrade Level</button>
            <img src={cupIcon} alt="Cup" />
          </div>

          <Link className="plan-link" to="/chat">
            plan your trip
          </Link>

          <button className="logout" onClick={handleLogout}>Logout</button>
        </div>

        <div className="edit" onClick={openModal}>
          <img src={editIcon} alt="Edit" width="28" height="28" />
        </div>
      </div>

      {/* МОДАЛКА */}
      {isEditOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Edit profile</h3>

            <label>
              Username
              <input
                type="text"
                value={tempUsername}
                onChange={(e) => setTempUsername(e.target.value)}
                placeholder="username"
              />
            </label>

            <label>
              Travel style
              <select value={tempStyle} onChange={(e) => setTempStyle(e.target.value)}>
                <option value="Hiking">🏔 Hiking</option>
                <option value="City trips">🏙 City trips</option>
                <option value="Beach">🏖 Beach</option>
                <option value="Adventure">🧗 Adventure</option>
                <option value="Relax">🌿 Relax</option>
                <option value="Cultural">🏛 Cultural</option>
              </select>
            </label>

            <label>
              Avatar
              <input type="file" accept="image/*" onChange={handleAvatarChange} />
            </label>

            <button type="button" className="remove-avatar" onClick={removeAvatar}>
              Remove avatar
            </button>

            <div className="modal-actions">
              <button onClick={saveChanges}>Save</button>
              <button className="cancel" onClick={closeModal}>
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
