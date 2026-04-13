import React, { useCallback, useEffect, useMemo, useState } from "react";
import "../styles/TripStatus.css";
import api from "../api/axios";
import AddTripModal from "../components/AddTripModal";
import { useTranslation } from "react-i18next";

export default function TripStatus() {
  const { t } = useTranslation();
  const [activeFilter, setActiveFilter] = useState("PENDING");
  const [trips, setTrips] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [tripCategories, setTripCategories] = useState([]);

  const filteredTrips = useMemo(
    () => trips.filter((trip) => trip.status === activeFilter),
    [trips, activeFilter]
  );

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await api.get("marketplace/advisor/trips/?tab=my");
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setTrips(list);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.userMessage || t("tripStatus.failedToLoadTrips");
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    loadTrips();
  }, [loadTrips]);

  useEffect(() => {
    const loadCategories = async () => {
      try {
        const res = await api.get("marketplace/categories/");
        const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
        setTripCategories(list);
      } catch {
        setTripCategories([]);
      }
    };
    loadCategories();
  }, []);

  const closeModal = () => {
    setIsModalOpen(false);
  };
  
  const handleTripCreated = async () => {
    await loadTrips();
    setActiveFilter("PENDING");
  };

  return (
    <div className="trip-page">
      <div className="trip-header-row">
        <div>
          <h1 className="trip-title">{t("tripStatus.title")}</h1>

          <div className="trip-filters">
            <button
              className={activeFilter === "APPROVED" ? "approved active" : ""}
              onClick={() => setActiveFilter("APPROVED")}
            >
              {t("tripStatus.approved")}
            </button>

            <button
              className={activeFilter === "PENDING" ? "in-progress active" : ""}
              onClick={() => setActiveFilter("PENDING")}
            >
              {t("tripStatus.pending")}
            </button>

            <button
              className={activeFilter === "REJECTED" ? "rejected active" : ""}
              onClick={() => setActiveFilter("REJECTED")}
            >
              {t("tripStatus.rejected")}
            </button>
          </div>
        </div>

        <button className="add-trip-btn" onClick={() => setIsModalOpen(true)}>
          + {t("tripStatus.addNewTrip")}
        </button>
      </div>

      <div className="trip-grid">
        {loading && <div>{t("tripStatus.loadingTrips")}</div>}
        {!loading && error && <div>{error}</div>}
        {!loading && !error && filteredTrips.length === 0 && (
          <div>{t("tripStatus.noTripsInStatus")}</div>
        )}
        {!loading && !error && filteredTrips.map((trip) => (
          <div key={trip.id} className="trip-card-modern">
          <div className="trip-image-wrapper">
            <img
              src={trip.media_urls?.[0] || "https://source.unsplash.com/600x400/?travel"}
              alt={trip.title}
              className="trip-image-modern"
            />

            <div className="trip-overlay">
              <h2 className="trip-title-modern">{trip.title}</h2>
            </div>
          </div>

          <div className="trip-body">
            <div className="trip-info-row">
              <span className="trip-location-modern"> {trip.destination}</span>
            </div>

            <div className="trip-footer">
              <span className="trip-date-modern">
                {trip.available_dates?.[0] || t("tripStatus.dateNotSet")}
              </span>
            </div>
          </div>
        </div>
        ))}
      </div>

      <AddTripModal
        isOpen={isModalOpen}
        onClose={closeModal}
        tripCategories={tripCategories}
        onTripCreated={handleTripCreated}
      />
    </div>
  );
}
