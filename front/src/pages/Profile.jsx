import { useState, useEffect } from "react";
import "../styles/ProfileCard.css";

export default function ProfileCard() {
  const defaultAvatar = "/avatar.svg";

  // Инициализация данных из localStorage
  const [username, setUsername] = useState(localStorage.getItem("username") || "Username");
  const [avatar, setAvatar] = useState(localStorage.getItem("avatar") || defaultAvatar);
  const [cover, setCover] = useState(localStorage.getItem("cover") || null);
  const [email] = useState(localStorage.getItem("email") || "user@email.com");
  const [travelStyle, setTravelStyle] = useState(localStorage.getItem("travelStyle") || "Hiking");

  // Временные данные для модалки
  const [tempUsername, setTempUsername] = useState(username);
  const [tempAvatar, setTempAvatar] = useState(avatar);
  const [tempStyle, setTempStyle] = useState(travelStyle);

  const [isEditOpen, setIsEditOpen] = useState(false);

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
    setIsEditOpen(true);
  };

  const closeModal = () => setIsEditOpen(false);

  const saveChanges = () => {
    setUsername(tempUsername);
    setAvatar(tempAvatar);
    setTravelStyle(tempStyle);

    localStorage.setItem("username", tempUsername);
    localStorage.setItem("avatar", tempAvatar);
    localStorage.setItem("travelStyle", tempStyle);

    setIsEditOpen(false);
  };

  // Аватар
  const handleAvatarChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setTempAvatar(base64);
    }
  };

  const removeAvatar = () => setTempAvatar(defaultAvatar);

  // Cover
  const handleCoverChange = async (e) => {
    const file = e.target.files[0];
    if (file) {
      const base64 = await fileToBase64(file);
      setCover(base64);
      localStorage.setItem(base64);
    }
  };

  return (
    <div className="profile-wrapper">
      <div className="cover">
        {!cover && <div className="cover-bg"></div>}
        {cover && <img src={cover} alt="Cover" className="cover-img" />}

        <img
          src="/camera.svg"
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
            <img src="/cup.svg" alt="Cup" />
          </div>

          <button className="logout">Logout</button>
        </div>

        <div className="edit" onClick={openModal}>
          <img src="/edit.svg" alt="Edit" width="28" height="28" />
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
