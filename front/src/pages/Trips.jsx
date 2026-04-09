import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import s from "../styles/Trips.module.css";
import "../styles/TripEmpty.css";
import earthPic from "../assets/earthpic.png";

function formatDateRange(startDate, endDate, t) {
  if (!startDate && !endDate) return t("trips.datesNotSet");
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  return startDate || endDate;
}

function buildTripCard(thread, t, isArchived = false) {
  const itinerary = thread.plan_json?.itinerary || [];
  const firstStop = itinerary[0]?.stops?.[0];
  const daysGenerated = thread.plan_json?.days_generated || itinerary.length || 0;
  const stopsCount = itinerary.reduce((acc, day) => acc + (day.stops?.length || 0), 0);
  const status = isArchived ? "past" : "active";

  return {
    id: thread.id,
    title:
      thread.title ||
      (thread.city ? `${thread.city} ${t("trips.tripSuffix")}` : t("trips.untitledTrip")),
    city: thread.city || thread.plan_json?.city || t("trips.unknownCity"),
    dateRange: formatDateRange(thread.start_date, thread.end_date, t),
    daysGenerated,
    stopsCount,
    status,
    photoUrl: firstStop?.photo_url || null,
    summary: itinerary[0]?.summary || t("trips.tripPlanReady"),
  };
}

export default function TripPage() {
  const { t } = useTranslation();
  const [trips, setTrips] = useState([]);
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
  const loadTrips = async () => {
    setLoading(true);
    setError("");
    try {
      const resActive = await api.get("llm/threads/");
      const activeDetails = await Promise.all(
        resActive.data.map(thread => api.get(`llm/threads/${thread.id}/`))
      );
      const activeTrips = activeDetails
        .map(detail => detail.data)
        .filter(thread => thread.plan_json) // только созданные
        .map(thread => buildTripCard(thread, t, false))
        .sort((a, b) => b.id - a.id);

      const resArchived = await api.get("llm/threads/?archived=true");
      const archivedDetails = await Promise.all(
        resArchived.data.map(thread => api.get(`llm/threads/${thread.id}/`))
      );
      const pastTrips = archivedDetails
        .map(detail => detail.data)
        .filter(thread => thread.plan_json) // только созданные
        .map(thread => buildTripCard(thread, t, true))
        .sort((a, b) => b.id - a.id);

      setTrips([...activeTrips, ...pastTrips]);
    } catch (err) {
      setError(err.response?.data?.detail || err.userMessage || t("trips.failedLoad"));
    } finally {
      setLoading(false);
    }
  };

  loadTrips();
}, [t]);

  const activeTrips = useMemo(() => trips.filter(trip => trip.status === "active"), [trips]);
  const pastTrips = useMemo(() => trips.filter(trip => trip.status === "past"), [trips]);
  const visibleTrips = tab === "active" ? activeTrips : pastTrips;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>{t("trips.myTrips")}</h1>
        <p className={s.subtitle}>{t("trips.subtitle")}</p>

        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab === "active" ? s.tabActive : ""}`}
            onClick={() => setTab("active")}
          >
            {t("trips.activeUpcoming")} <span className={s.badge}>{activeTrips.length}</span>
          </button>
          <button
            className={`${s.tab} ${tab === "past" ? s.tabActive : ""}`}
            onClick={() => setTab("past")}
          >
            {t("trips.tripArchive")} <span className={s.badge}>{pastTrips.length}</span>
          </button>
        </div>
      </header>

      {loading && <p className={s.meta}>{t("trips.loading")}</p>}
      {error && <p className={s.error}>{error}</p>}

      {!loading && !error && visibleTrips.length === 0 ? (
        <main className="trip-empty">
          <div className="trip-empty__left">
            <h2 className="trip-empty__title">
              {t("trips.emptyTitleLine1")}
              <br />
              {t("trips.emptyTitleLine2")}
            </h2>
            <Link to="/chat" className="trip-cta">
              {t("trips.createNewTrip")} <span className="trip-cta__arrow">→</span>
            </Link>
          </div>
          <div className="trip-empty__right">
            <img
              className="trip-illustration"
              src={earthPic}
              alt={t("common.travelIllustration")}
            />
          </div>
        </main>
      ) : null}

      {!loading && !error && visibleTrips.length > 0 && (
        <main className={s.grid}>
          {visibleTrips.map(trip => (
            <article className={s.card} key={trip.id}>
              <div className={s.photoWrapper}>
                {trip.photoUrl ? (
                  <img className={s.photo} src={trip.photoUrl} alt={trip.title} />
                ) : (
                  <div className={s.photoPlaceholder} />
                )}
                <span
                  className={`${s.statusBadge} ${
                    trip.status === "active" ? s.statusActive : s.statusUpcoming
                  }`}
                >
                  {trip.status === "active" ? t("trips.activeNow") : t("trips.upcoming")}
                </span>
              </div>

              <div className={s.cardContent}>
                
                <p className={s.tripLocation}>{trip.city}</p>

                <div className={s.tripInfo}>
                  <span>{trip.dateRange}</span>
                  <span>
                    {trip.stopsCount} {t("trips.travelers")}
                  </span>
                </div>

                <div className={s.budget}>
                  <label>{t("trips.budget")}</label>
                  <div className={s.budgetBar}>
                    <div
                      className={s.budgetProgress}
                      style={{ width: `${(trip.daysGenerated / 10) * 100}%` }}
                    ></div>
                  </div>
                  <span>${trip.daysGenerated * 1000} / $4,000</span>
                </div>

                <div className={s.chipContainer}>
                  {trip.summary.split(",").map((stop, idx) => (
                    <span className={s.chip} key={idx}>
                      {stop.trim()}
                    </span>
                  ))}
                </div>

                <Link className={s.viewTrip} to={`/chat?thread=${trip.id}`}>
                  {t("trips.viewYourTrip")} →
                </Link>
              </div>
            </article>
          ))}
        </main>
      )}
    </div>
  );
}





