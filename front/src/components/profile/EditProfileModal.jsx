import { useTranslation } from "react-i18next";

export default function EditProfileModal({
  tempUsername, tempStyle, tempAvatar, defaultAvatar,
  setTempUsername, setTempStyle, setTempAvatar, setAvatarFile,
  onSave, onClose, fileToBase64,
}) {
  const { t } = useTranslation();
  const styleOptions = [
    { value: "Hiking", label: t("profile.styles.hiking") },
    { value: "City trips", label: t("profile.styles.cityTrips") },
    { value: "Beach", label: t("profile.styles.beach") },
    { value: "Adventure", label: t("profile.styles.adventure") },
    { value: "Relax", label: t("profile.styles.relax") },
    { value: "Cultural", label: t("profile.styles.cultural") },
  ];

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{t("profile.editProfile")}</h3>

        <label>{t("profile.username")}
          <input type="text" value={tempUsername} placeholder={t("profile.username").toLowerCase()}
            onChange={(e) => setTempUsername(e.target.value)} />
        </label>

        <label>{t("profile.travelStyle")}
          <select value={tempStyle} onChange={(e) => setTempStyle(e.target.value)}>
            {styleOptions.map((option) => (
              <option key={option.value} value={option.value}>{option.label}</option>
            ))}
          </select>
        </label>

        <label>{t("profile.avatar")}
          <input type="file" accept="image/*" onChange={async (e) => {
            const file = e.target.files[0];
            if (!file) return;
            const preview = await fileToBase64(file);
            setTempAvatar(preview);
            setAvatarFile(file);
          }} />
        </label>

        <button type="button" className="remove-avatar" onClick={() => setTempAvatar(defaultAvatar)}>
          {t("profile.removeAvatar")}
        </button>

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>{t("profile.cancel")}</button>
          <button className="save-btn" onClick={onSave}>{t("profile.save")}</button>
        </div>
      </div>
    </div>
  );
}
