import React, { useEffect, useState } from "react";
import "../styles/TripStatus.css";
import api from "../api/axios";

export default function TripStatus() {
  const [activeFilter, setActiveFilter] = useState("PENDING");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadTrips = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("marketplace/advisor/trips/?tab=my");
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setTrips(list);
      } catch (err) {
        const detail = err?.response?.data?.detail || err?.userMessage || "Failed to load trips.";
        setError(detail);
      } finally {
        setLoading(false);
      }
    };

    loadTrips();
  }, []);

  const filteredTrips = trips.filter((trip) => trip.status === activeFilter);

  return (
    <div className="trip-page">
      <div className="trip-header-row">
        <div>
          <h1 className="trip-title">Trips Status</h1>

          <div className="trip-filters">
            <button
              className={activeFilter === "APPROVED" ? "approved active" : ""}
              onClick={() => setActiveFilter("APPROVED")}
            >
              Approved
            </button>

            <button
              className={activeFilter === "PENDING" ? "in-progress active" : ""}
              onClick={() => setActiveFilter("PENDING")}
            >
              Pending
            </button>

            <button
              className={activeFilter === "REJECTED" ? "rejected active" : ""}
              onClick={() => setActiveFilter("REJECTED")}
            >
              Rejected
            </button>
          </div>
        </div>
      </div>

      <div className="trip-grid">
        {loading && <div>Loading trips...</div>}
        {!loading && error && <div>{error}</div>}
        {!loading && !error && filteredTrips.length === 0 && (
          <div>No trips in this status yet.</div>
        )}
        {!loading && !error && filteredTrips.map((trip) => (
          <div key={trip.id} className="trip-card">
            <div className="trip-image-container">
              <img
                src={trip.media_urls?.[0] || "https://source.unsplash.com/600x400/?travel"}
                alt={trip.title}
                className="trip-image"
              />
            </div>

            <div className="trip-content">
              <h2 className="trip-name">{trip.title}</h2>
              <p className="trip-location">{trip.destination}</p>
              <p className="trip-date">
                {trip.available_dates?.[0] || "Date not set"}
              </p>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
