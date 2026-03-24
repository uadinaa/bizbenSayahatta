import cameraIcon from "../../assets/camera.svg";

export default function ProfileCover({ cover, onCoverChange }) {
  return (
    <div className="cover">
      {cover ? <img src={cover} alt="Cover" className="cover-img" /> : <div className="cover-bg" />}
      <img
        src={cameraIcon} alt="Edit Cover" className="cover-edit-icon"
        onClick={() => document.getElementById("coverInput").click()}
      />
      <input type="file" id="coverInput" accept="image/*" style={{ display: "none" }} onChange={onCoverChange} />
    </div>
  );
}