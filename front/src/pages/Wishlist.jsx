import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { toggleMustVisit } from "../api/places";
import "../styles/Wishlist.css";

export default function Wishlist() {
  const navigate = useNavigate();

  const [destinations, setDestinations] = useState([]);
  const [selectedCategory, setSelectedCategory] = useState("All");
  const [loading, setLoading] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const categories = ["All", "restaurant", "museum", "tourist_attraction"];

  const loadWishlist = async () => {
    setLoading(true);
    try {
      const response = await api.get("places/wishlist/");
      setDestinations(response.data);
    } catch (err) {
      console.error("Ошибка при загрузке wishlist:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWishlist();
  }, []);

  const toggleFavorite = async (id) => {
    try {
      await toggleMustVisit(id, false);
      setDestinations((prev) => prev.filter((d) => d.id !== id));
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


  const filteredDestinations =
    selectedCategory === "All"
      ? destinations
      : destinations.filter((dest) => dest.category === selectedCategory);

  return (
    <div className="wishlist-page">
      <div className="wishlist-header">
        <div className="wishlist-header-content">
          <div className="wishlist-title-section">
            <h1 className="wishlist-title">My Wishlist</h1>
            <p className="wishlist-subtitle">
              Dream destinations waiting to be explored
            </p>
          </div>

          <button
            className="add-destination-btn"
            onClick={() => navigate("/inspiration")}
          >
            + Add Destination
          </button>
        </div>
      </div>

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
              {category === "All" ? "All" : category.replace("_", " ")}
            </button>
          ))}
        </div>
      </div>

      {/* Grid */}
      <div className="destinations-grid">
        {loading && <p>Loading...</p>}

        {!loading && filteredDestinations.length === 0 && (
          <p>No saved destinations yet.</p>
        )}

        {!loading &&
          filteredDestinations.map((destination) => (
            <div key={destination.id} className="destination-card">
              <div className="destination-image-container">
                <img
                  src={destination.photo_url}
                  alt={destination.name}
                  className="destination-image"
                />

                {/* Remove from wishlist */}
                <button
                  className="favorite-btn active"
                  onClick={() => toggleFavorite(destination.id)}
                >
                  <svg
                    width="24"
                    height="24"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                  >
                    <defs>
                      <linearGradient
                        id="heartGradient"
                        x1="0%"
                        y1="0%"
                        x2="100%"
                        y2="100%"
                      >
                        <stop offset="0%" stopColor="#ff6b6b" />
                        <stop offset="100%" stopColor="#ee5a6f" />
                      </linearGradient>
                    </defs>
                    <path
                      d="M20.84 4.61a5.5 5.5 0 0 0-7.78 0L12 5.67l-1.06-1.06a5.5 5.5 0 0 0-7.78 7.78l1.06 1.06L12 21.23l7.78-7.78 1.06-1.06a5.5 5.5 0 0 0 0-7.78z"
                      fill="url(#heartGradient)"
                    />
                  </svg>
                </button>

                <div className="destination-tags">
                  <span
                    className={`destination-tag tag-${destination.category}`}
                  >
                    {destination.category.replace("_", " ")}
                  </span>
                </div>
              </div>

              <div className="destination-content">
                <h3 className="destination-name">{destination.name}</h3>

                <p className="destination-location">
                  {destination.city}, {destination.country}
                </p>

                {destination.rating && (
                  <div className="destination-meta-row">
                    ⭐ {destination.rating}
                  </div>
                )}

                <a
                  href="#"
                  className="view-details-link"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedPlace(destination);
                    setIsModalOpen(true);
                  }}
                >
                  View Details →
                </a>
              </div>
            </div>
          ))}
      </div>

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
          <strong>Category:</strong>{" "}
          {selectedPlace.category.replace("_", " ")}
        </p>

        {selectedPlace.rating && (
          <p>
            <strong>Rating:</strong> {selectedPlace.rating}
          </p>
        )}

        <p>
          <strong>Location:</strong> {selectedPlace.city},{" "}
          {selectedPlace.country}
        </p>

        <p>
          {selectedPlace.description || "No description available"}
        </p>
      </div>

      <button
        className="lightActionBtn"
        onClick={handleCreateTrip}
      >
        ✈️ Add to trip
      </button>

      <button
        className="modalClose"
        onClick={() => setIsModalOpen(false)}
      >
        Close
      </button>
    </div>
  </div>
)}
    </div>
  );
}
