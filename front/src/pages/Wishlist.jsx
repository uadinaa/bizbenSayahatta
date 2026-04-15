import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { toggleExternalMustVisit, toggleMustVisit } from "../api/places";
import { toggleSavedTrip, cancelBooking } from "../api/trips";
import PlaceCard from "../components/places/PlaceCard";
import "../styles/Wishlist.css";

export default function Wishlist() {
  const navigate = useNavigate();
  const { t } = useTranslation();

  // Tab state: "places" | "trips" | "booked"
  const [activeTab, setActiveTab] = useState("places");

  const [destinations, setDestinations] = useState([]);
  const [bookedTrips, setBookedTrips] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const categories = ["All", "restaurant", "museum", "tourist_attraction", "park",
  "theater",
  "shopping_mall",
  "hiking",
  "beach",
  "concert",];

  const loadWishlist = async () => {
    setLoading(true);
    try {
      // Load Google Places + external places (TripAdvisor/Ticketmaster)
      const placesResponse = await api.get("places/wishlist/");
      const placesData = placesResponse.data || [];

      // Load saved marketplace trips
      const tripsResponse = await api.get("marketplace/public/trips/?saved=true");
      const tripsData = (tripsResponse.data?.results || tripsResponse.data || [])
        .filter((trip) => trip.is_saved)
        .map((trip) => ({
          ...trip,
          id: `saved-trip-${trip.id}`,
          source: "marketplace_trip",
          category: trip.category?.name || "trip",
          name: trip.title,
          description: trip.itinerary_json?.notes || "",
          city: trip.destination,
          country: "",
          photo_url: trip.media_urls?.[0] || "",
          rating: trip.rating,
          price_level: trip.price ? (trip.price < 50 ? "PRICE_LEVEL_INEXPENSIVE" : trip.price < 150 ? "PRICE_LEVEL_MODERATE" : "PRICE_LEVEL_EXPENSIVE") : null,
        }));

      setDestinations([...placesData, ...tripsData]);
    } catch (err) {
      console.error("Ошибка при загрузке wishlist:", err);
    } finally {
      setLoading(false);
    }
  };

  const loadBookedTrips = async () => {
    try {
      const bookingsResponse = await api.get("marketplace/my-bookings/");
      console.log("Bookings response:", bookingsResponse);
      console.log("Bookings data:", bookingsResponse.data);
      // Handle both array and object with results property
      let bookingsData = [];
      if (Array.isArray(bookingsResponse.data)) {
        bookingsData = bookingsResponse.data;
      } else if (bookingsResponse.data?.results && Array.isArray(bookingsResponse.data.results)) {
        bookingsData = bookingsResponse.data.results;
      } else if (bookingsResponse.data?.bookings && Array.isArray(bookingsResponse.data.bookings)) {
        bookingsData = bookingsResponse.data.bookings;
      }
      console.log("Processed bookings data:", bookingsData);
      setBookedTrips(bookingsData.map((booking) => ({
        ...booking,
        trip_id: booking.trip_id,
        trip_title: booking.trip_title,
        trip_destination: booking.trip_destination,
        status: booking.status,
        booked_at: booking.booked_at,
        number_of_travelers: booking.number_of_travelers,
      })));
    } catch (err) {
      console.error("Error loading booked trips:", err);
      console.error("Error response:", err.response?.data);
    }
  };

  useEffect(() => {
    if (activeTab === "places") {
      loadWishlist();
    } else if (activeTab === "booked") {
      loadBookedTrips();
    }
  }, [activeTab]);

  const toggleFavorite = async (destination) => {
    try {
      if (destination.source === "tripadvisor" || destination.source === "ticketmaster") {
        await toggleExternalMustVisit({
          source: destination.source,
          external_id: destination.external_id,
          is_must_visit: false,
          name: destination.name,
        });
      } else if (destination.source === "marketplace_trip") {
        // Extract the original trip ID from the prefixed id
        const originalTripId = destination.id.replace("saved-trip-", "");
        await toggleSavedTrip(parseInt(originalTripId), true);
      } else {
        await toggleMustVisit(destination.id, false);
      }
      setDestinations((prev) => prev.filter((d) => d.id !== destination.id));
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTrip = () => {
  const isAuthed = Boolean(localStorage.getItem("access"));
  if (!isAuthed) {
    navigate("/login");
    return;
  }
  navigate("/trip");
};

  const handleCancelBooking = async (booking) => {
    if (!window.confirm(t("wishlist.cancelBookingConfirm"))) {
      return;
    }
    try {
      await cancelBooking(booking.id, "");
      setBookedTrips((prev) => prev.filter((b) => b.id !== booking.id));
    } catch (err) {
      console.error("Error cancelling booking:", err);
      alert(t("wishlist.cancelBookingError"));
    }
  };

  const filteredDestinations =
    selectedCategory === "All"
      ? destinations
      : destinations.filter((dest) => dest.category === selectedCategory);

  return (
    <div className="wishlist-page">
      <div className="wishlist-header">
        <div className="wishlist-header-content">
          <div className="wishlist-title-section">
            <h1 className="wishlist-title">{t("wishlist.title")}</h1>
            <p className="wishlist-subtitle">
              {t("wishlist.subtitle")}
            </p>
          </div>

          <button
            className="add-destination-btn"
            onClick={() => navigate("/inspiration")}
          >
            + {t("wishlist.addDestination")}
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="wishlist-tabs">
        <button
          className={`wishlist-tab ${activeTab === "places" ? "active" : ""}`}
          onClick={() => setActiveTab("places")}
        >
          {t("wishlist.tabs.places")}
        </button>
        <button
          className={`wishlist-tab ${activeTab === "trips" ? "active" : ""}`}
          onClick={() => setActiveTab("trips")}
        >
          {t("wishlist.tabs.trips")}
        </button>
        <button
          className={`wishlist-tab ${activeTab === "booked" ? "active" : ""}`}
          onClick={() => setActiveTab("booked")}
        >
          {t("wishlist.tabs.booked")}
        </button>
      </div>

      {/* Places Tab Content */}
      {activeTab === "places" && (
        <>
          {/* Filters */}
          <div className="wishlist-filters">
            <div className="filter-scroll-container">
              {categories.map((category) => (
                <button
                  key={category}
                  className={`filter-btn ${
                    selectedCategory === category ? "active" : ""
                  }`}
                  onClick={() => setSelectedCategory(category)}
                >
                  {category === "All"
                    ? t("wishlist.all")
                    : t(`wishlist.categories.${category}`, {
                        defaultValue: category.replaceAll("_", " "),
                      })}
                </button>
              ))}
            </div>
          </div>

          {/* Grid */}
          <div className="destinations-grid">
            {loading && <p>{t("wishlist.loading")}</p>}

            {!loading && filteredDestinations.length === 0 && (
              <p>{t("wishlist.empty")}</p>
            )}

            {!loading &&
              filteredDestinations.map((destination) => (
                <PlaceCard
                  key={destination.id}
                  place={destination}
                  variant="wishlist"
                  isFavorited={true}
                  onOpen={() => {
                    setSelectedPlace(destination);
                    setIsModalOpen(true);
                  }}
                  onToggleFavorite={() => toggleFavorite(destination)}
                />
              ))}
          </div>
        </>
      )}

      {/* Trips Tab Content - placeholder, can be expanded later */}
      {activeTab === "trips" && (
        <div className="destinations-grid">
          <p>{t("wishlist.savedTripsComingSoon")}</p>
        </div>
      )}

      {/* Booked Trips Tab Content */}
      {activeTab === "booked" && (
        <div className="booked-trips-list">
          {bookedTrips.length === 0 ? (
            <p>{t("wishlist.noBookedTrips")}</p>
          ) : (
            bookedTrips.map((booking) => (
              <div key={booking.id} className="booked-trip-card">
                <div className="booked-trip-info">
                  <h3>{booking.trip_title}</h3>
                  <p>📍 {booking.trip_destination}</p>
                  <p>👥 {t("wishlist.travelers")}: {booking.number_of_travelers}</p>
                  <p>📅 {t("wishlist.bookedAt")}: {new Date(booking.booked_at).toLocaleDateString()}</p>
                  <p>
                    {t("wishlist.status")}:{" "}
                    <span className={`status-badge status-${booking.status.toLowerCase()}`}>
                      {t(`wishlist.bookingStatus.${booking.status.toLowerCase()}`, { defaultValue: booking.status })}
                    </span>
                  </p>
                </div>
                <div className="booked-trip-actions">
                  {booking.status === "PENDING" && (
                    <button
                      className="lightActionBtn"
                      onClick={() => handleCancelBooking(booking)}
                    >
                      {t("wishlist.cancelBooking")}
                    </button>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {isModalOpen && selectedPlace && (
  <div className="modalOverlay" onClick={() => setIsModalOpen(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      {selectedPlace.photo_url && (
        <img
          className="modalPhoto"
          src={selectedPlace.photo_url}
          alt={selectedPlace.name}
        />
      )}

      <div className="modalContent">
        <h2>{selectedPlace.name}</h2>

        <p>
          <strong>{t("wishlist.category")}:</strong>{" "}
          {t(`wishlist.categories.${selectedPlace.category}`, {
            defaultValue: selectedPlace.category.replaceAll("_", " "),
          })}
        </p>

        {selectedPlace.rating && (
          <p>
            <strong>{t("wishlist.rating")}:</strong> {selectedPlace.rating}
          </p>
        )}

        <p>
          <strong>{t("wishlist.location")}:</strong> {selectedPlace.city},{" "}
          {selectedPlace.country}
        </p>

        <p>
          {selectedPlace.description || t("wishlist.noDescription")}
        </p>
      </div>

      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          className="lightActionBtn"
          onClick={() => toggleFavorite(selectedPlace)}
        >
          💚 {t("wishlist.addedToWishlist")}
        </button>

        <button
          className="lightActionBtn"
          onClick={handleCreateTrip}
        >
          ✈️ {t("wishlist.addToTrip")}
        </button>
      </div>

      <button
        className="modalClose"
        onClick={() => setIsModalOpen(false)}
      >
        {t("wishlist.close")}
      </button>
    </div>
  </div>
)}
    </div>
  );
}
