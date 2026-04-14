import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import s from "../../styles/Trips.module.css";

export default function TripCard({ trip }) {
  const { t } = useTranslation();

  return (
    <article className={s.card}>
      <div className={s.photoWrapper}>
        {trip.photoUrl
          ? <img className={s.photo} src={trip.photoUrl} alt={trip.title} />
          : <div className={s.photoPlaceholder} />
        }

         <div className={s.overlay}>
          <h3 className={s.overlayTitle}>{trip.title}</h3>
          <p className={s.overlayLocation}>{trip.city}</p>
        </div>

        <span className={`${s.statusBadge} ${trip.status === "active" ? s.statusActive : s.statusUpcoming}`}>
          {trip.status === "active" ? t("trips.activeNow") : t("trips.upcoming")}
        </span>
      </div>

      <div className={s.cardContent}>
        <div className={s.tripInfo}>
          <span>{trip.dateRange}</span>
          <span>{trip.stopsCount} {t("trips.travelers")}</span>
        </div>

        <div className={s.budget}>
          <label>{t("trips.budget")}</label>
          <div className={s.budgetBar}>
            <div
              className={s.budgetProgress}
              style={{ width: `${(trip.daysGenerated / 10) * 100}%` }}
            />
          </div>
          <span>${trip.daysGenerated * 1000} / $4,000</span>
        </div>

        <div className={s.chipContainer}>
          {trip.summary.split(",").map((stop, idx) => (
            <span className={s.chip} key={idx}>{stop.trim()}</span>
          ))}
        </div>

        <Link className={s.viewTrip} to={`/chat?thread=${trip.id}`}>
          {t("trips.viewYourTrip")} →
        </Link>
      </div>
    </article>
  );
}
