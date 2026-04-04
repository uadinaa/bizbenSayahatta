import cameraIcon from "../../assets/camera.svg";
import { useTranslation } from "react-i18next";

export default function ProfileCover({ cover, onCoverChange }) {
  const { t } = useTranslation();

  return (
    <div className="cover">
      {cover ? <img src={cover} alt={t("profile.cover")} className="cover-img" /> : <div className="cover-bg" />}
      <img
        src={cameraIcon} alt={t("profile.editCover")} className="cover-edit-icon"
        onClick={() => document.getElementById("coverInput").click()}
      />
      <input type="file" id="coverInput" accept="image/*" style={{ display: "none" }} onChange={onCoverChange} />
    </div>
  );
}
