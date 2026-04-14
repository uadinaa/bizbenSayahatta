import s from "../../styles/Trips.module.css";
import { useTranslation } from "react-i18next";

export default function TripTabs({ tab, onTabChange, activeCount, pastCount }) {
  const { t } = useTranslation();

  return (
    <div className={s.tabs}>
      <button
        className={`${s.tab} ${tab === "active" ? s.tabActive : ""}`}
        onClick={() => onTabChange("active")}
      >
        {t("trips.activeUpcoming")} <span className={s.badge}>{activeCount}</span>
      </button>
      <button
        className={`${s.tab} ${tab === "past" ? s.tabActive : ""}`}
        onClick={() => onTabChange("past")}
      >
        {t("trips.tripArchive")} <span className={s.badge}>{pastCount}</span>
      </button>
    </div>
  );
}
