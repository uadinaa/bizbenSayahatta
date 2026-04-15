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
  const [selectedTrip, setSelectedTrip] = useState(null);
  const [tripBookings, setTripBookings] = useState([]);
  const [isBookingsModalOpen, setIsBookingsModalOpen] = useState(false);
  const [loadingBookings, setLoadingBookings] = useState(false);

  const filteredTrips = useMemo(() => {
    if (activeFilter === "BOOKED") {
      // Show trips that have bookings (current_bookings > 0)
      return trips.filter((trip) => trip.current_bookings > 0);
    }
    return trips.filter((trip) => trip.status === activeFilter);
  }, [trips, activeFilter]);

  const loadTrips = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      // Use "booked" tab when BOOKED filter is active, otherwise use "my" tab
      const tab = activeFilter === "BOOKED" ? "booked" : "my";
      const res = await api.get(`marketplace/advisor/trips/?tab=${tab}`);
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setTrips(list);
    } catch (err) {
      const detail = err?.response?.data?.detail || err?.userMessage || t("tripStatus.failedToLoadTrips");
      setError(detail);
    } finally {
      setLoading(false);
    }
  }, [activeFilter, t]);

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

  const loadTripBookings = async (trip) => {
    setLoadingBookings(true);
    try {
      const response = await api.get(`marketplace/public/trips/${trip.id}/bookings/`);
      setTripBookings(Array.isArray(response.data) ? response.data : []);
      setSelectedTrip(trip);
      setIsBookingsModalOpen(true);
    } catch (err) {
      console.error("Error loading bookings:", err);
      alert(t("tripStatus.failedToLoadBookings") || "Failed to load bookings");
    } finally {
      setLoadingBookings(false);
    }
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

            <button
              className={activeFilter === "BOOKED" ? "booked active" : ""}
              onClick={() => setActiveFilter("BOOKED")}
            >
              {t("tripStatus.booked") || "Booked"}
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

            {/* Spots info */}
            <div className="trip-info-row">
              <span className="trip-spots">
                {trip.current_bookings || 0}/{trip.max_travelers || 10} {t("tripStatus.spotsBooked")}
              </span>
              {trip.max_travelers && trip.current_bookings !== undefined && (
                <span className={`trip-spots-left ${trip.current_bookings >= trip.max_travelers ? "full" : ""}`}>
                  {trip.current_bookings >= trip.max_travelers
                    ? t("tripStatus.tripFull")
                    : `${trip.max_travelers - trip.current_bookings} ${t("tripStatus.spotsLeft")}`}
                </span>
              )}
            </div>

            <div className="trip-footer">
              <span className="trip-date-modern">
                {trip.available_dates?.[0] || t("tripStatus.dateNotSet")}
              </span>
            </div>

            {/* View bookings button */}
            {(trip.current_bookings || 0) > 0 && (
              <button
                className="view-bookings-btn"
                onClick={() => loadTripBookings(trip)}
              >
                {t("tripStatus.viewBookings") || "View Bookings"}
              </button>
            )}
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

      {/* Bookings Modal */}
      {isBookingsModalOpen && selectedTrip && (
        <div className="modal-overlay" onClick={() => setIsBookingsModalOpen(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="modal-header">
              <h2>{t("tripStatus.bookingsFor")} "{selectedTrip.title}"</h2>
              <button className="modal-close" onClick={() => setIsBookingsModalOpen(false)}>
                &times;
              </button>
            </div>

            <div className="modal-body">
              {loadingBookings ? (
                <p>{t("tripStatus.loadingBookings") || "Loading bookings..."}</p>
              ) : tripBookings.length === 0 ? (
                <p>{t("tripStatus.noBookings") || "No bookings yet"}</p>
              ) : (
                <table className="bookings-table">
                  <thead>
                    <tr>
                      <th>{t("tripStatus.guest") || "Guest"}</th>
                      <th>{t("tripStatus.email") || "Email"}</th>
                      <th>{t("tripStatus.travelers") || "Travelers"}</th>
                      <th>{t("tripStatus.bookedAt") || "Booked At"}</th>
                      <th>{t("tripStatus.status") || "Status"}</th>
                      <th>{t("tripStatus.actions") || "Actions"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {tripBookings.map((booking) => (
                      <tr key={booking.id}>
                        <td>{booking.user_username || booking.user_id}</td>
                        <td>{booking.user_email || "-"}</td>
                        <td>{booking.number_of_travelers}</td>
                        <td>{new Date(booking.booked_at).toLocaleDateString()}</td>
                        <td>
                          <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                            {booking.status}
                          </span>
                        </td>
                        <td>
                          {booking.status === "PENDING" && (
                            <div style={{ display: "flex", gap: "6px" }}>
                              <button
                                className="confirm-btn"
                                onClick={async () => {
                                  try {
                                    await api.post(`marketplace/bookings/${booking.id}/confirm/`);
                                    setTripBookings((prev) =>
                                      prev.map((b) =>
                                        b.id === booking.id ? { ...b, status: "CONFIRMED" } : b
                                      )
                                    );
                                    // Reload trips to update counts
                                    await loadTrips();
                                  } catch (err) {
                                    console.error("Error confirming booking:", err);
                                    alert(t("tripStatus.confirmBookingError") || "Failed to confirm");
                                  }
                                }}
                              >
                                {t("tripStatus.confirm") || "Confirm"}
                              </button>
                              <button
                                className="cancel-btn"
                                onClick={async () => {
                                  if (window.confirm(t("tripStatus.confirmCancelBooking") || "Are you sure?")) {
                                    try {
                                      await api.post(`marketplace/bookings/${booking.id}/cancel/`, {
                                        reason: "Cancelled by advisor",
                                      });
                                      setTripBookings((prev) =>
                                        prev.map((b) =>
                                          b.id === booking.id ? { ...b, status: "CANCELLED" } : b
                                        )
                                      );
                                      // Reload trips to update counts
                                      await loadTrips();
                                    } catch (err) {
                                      console.error("Error cancelling booking:", err);
                                      alert(t("tripStatus.cancelBookingError") || "Failed to cancel");
                                    }
                                  }
                                }}
                              >
                                {t("tripStatus.cancel") || "Cancel"}
                              </button>
                            </div>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
