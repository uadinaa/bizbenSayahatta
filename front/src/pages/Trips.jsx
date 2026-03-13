import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import api from "../api/axios";
import s from "../styles/Trips.module.css";
import "../styles/TripEmpty.css";
import earthPic from "../assets/earthpic.png";

function formatDateRange(startDate, endDate) {
  if (!startDate && !endDate) return "Dates not set";
  if (startDate && endDate) return `${startDate} - ${endDate}`;
  return startDate || endDate;
}

function getTripStatus(endDate) {
  if (!endDate) return "active";
  const today = new Date().toISOString().slice(0, 10);
  return endDate >= today ? "active" : "past";
}

function buildTripCard(thread) {
  const itinerary = thread.plan_json?.itinerary || [];
  const firstStop = itinerary[0]?.stops?.[0];
  const daysGenerated = thread.plan_json?.days_generated || itinerary.length || 0;
  const stopsCount = itinerary.reduce((acc, day) => acc + (day.stops?.length || 0), 0);
  const status = getTripStatus(thread.end_date);

  return {
    id: thread.id,
    title: thread.title || (thread.city ? `${thread.city} trip` : "Untitled trip"),
    city: thread.city || thread.plan_json?.city || "Unknown city",
    dateRange: formatDateRange(thread.start_date, thread.end_date),
    daysGenerated,
    stopsCount,
    status,
    photoUrl: firstStop?.photo_url || null,
    summary: itinerary[0]?.summary || "Trip plan is ready",
  };
}

export default function TripPage() {
  const [trips, setTrips] = useState([]);
  const [tab, setTab] = useState("active");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTrips = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("llm/threads/");
        const plannerThreads = (res.data || []).filter((thread) => thread.kind === "planner");
        const detailRequests = plannerThreads.map((thread) =>
          api.get(`llm/threads/${thread.id}/`)
        );
        const details = await Promise.all(detailRequests);
        const cards = details
          .map((detail) => buildTripCard(detail.data))
          .sort((a, b) => b.id - a.id);
        setTrips(cards);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load trips");
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, []);

  const activeTrips = useMemo(
    () => trips.filter((trip) => trip.status === "active"),
    [trips]
  );
  const pastTrips = useMemo(
    () => trips.filter((trip) => trip.status === "past"),
    [trips]
  );
  const visibleTrips = tab === "active" ? activeTrips : pastTrips;

  return (
    <div className={s.page}>
      <header className={s.header}>
        <h1 className={s.title}>My Trips</h1>
        <p className={s.subtitle}>
          Active and completed journeys in one place
        </p>

        <div className={s.tabs}>
          <button
            className={`${s.tab} ${tab === "active" ? s.tabActive : ""}`}
            onClick={() => setTab("active")}
          >
            Active & Upcoming <span className={s.badge}>{activeTrips.length}</span>
          </button>
          <button
            className={`${s.tab} ${tab === "past" ? s.tabActive : ""}`}
            onClick={() => setTab("past")}
          >
            Trip Archive <span className={s.badge}>{pastTrips.length}</span>
          </button>
        </div>
      </header>

      {loading && <p className={s.meta}>Loading trips...</p>}
      {error && <p className={s.error}>{error}</p>}

      {!loading && !error && visibleTrips.length === 0 ? (
        <main className="trip-empty">
          <div className="trip-empty__left">
            <h2 className="trip-empty__title">
              You don&apos;t have any
              <br />
              trips yet...
            </h2>
            <Link to="/chat" className="trip-cta">
              Create new trip <span className="trip-cta__arrow">→</span>
            </Link>
          </div>
          <div className="trip-empty__right">
            <img className="trip-illustration" src={earthPic} alt="Travel illustration" />
          </div>
        </main>
      ) : null}

      {!loading && !error && visibleTrips.length > 0 ? (
        <main className={s.grid}>
  {visibleTrips.map((trip) => (
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
          {trip.status === "active" ? "Active Now" : "Upcoming"}
        </span>
      </div>

      <div className={s.cardContent}>
        <h3 className={s.tripTitle}>{trip.title}</h3>
        <p className={s.tripLocation}>{trip.city}</p>

        <div className={s.tripInfo}>
          <span>{trip.dateRange}</span>
          <span>{trip.stopsCount} travelers</span>
        </div>

        <div className={s.budget}>
          <label>Budget</label>
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
          View your trip →
        </Link>
      </div>
    </article>
  ))}
</main>
      ) : null}
    </div>
  );
}
