export default function EditProfileModal({
  tempUsername, tempStyle, tempAvatar, defaultAvatar,
  setTempUsername, setTempStyle, setTempAvatar, setAvatarFile,
  onSave, onClose, fileToBase64,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>Edit profile</h3>

        <label>Username
          <input type="text" value={tempUsername} placeholder="username"
            onChange={(e) => setTempUsername(e.target.value)} />
        </label>

        <label>Travel style
          <select value={tempStyle} onChange={(e) => setTempStyle(e.target.value)}>
            {["Hiking", "City trips", "Beach", "Adventure", "Relax", "Cultural"].map((s) => (
              <option key={s} value={s}>{s}</option>
            ))}
          </select>
        </label>

        <label>Avatar
          <input type="file" accept="image/*" onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const preview = await fileToBase64(file);
            setTempAvatar(preview);
            setAvatarFile(file);
          }} />
        </label>

        <button type="button" className="remove-avatar" onClick={() => setTempAvatar(defaultAvatar)}>
          Remove avatar
        </button>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={onSave}>Save</button>
        </div>
      </div>
    </div>
  );
}