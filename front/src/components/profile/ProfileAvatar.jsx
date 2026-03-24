export default function ProfileAvatar({ avatar, defaultAvatar }) {
  return (
    <div className="avatar" style={{ background: avatar === defaultAvatar ? "#9ccbd3" : "transparent" }}>
      <img src={avatar} alt="Avatar" />
    </div>
  );
}