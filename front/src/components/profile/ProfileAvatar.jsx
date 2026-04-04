import { useTranslation } from "react-i18next";

export default function ProfileAvatar({ avatar, defaultAvatar }) {
  const { t } = useTranslation();

  return (
    <div className="avatar" style={{ background: avatar === defaultAvatar ? "#9ccbd3" : "transparent" }}>
      <img src={avatar} alt={t("common.avatarAlt")} />
    </div>
  );
}
