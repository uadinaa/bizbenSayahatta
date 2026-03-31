import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../api/axios";
import { toggleMustVisit } from "../api/places";
import PlaceCard from "../components/places/PlaceCard";
import cardStyles from "../styles/Inspiration.module.css";
import "../styles/Wishlist.css";

export default function Wishlist() {
  const navigate = useNavigate();

  const [destinations, setDestinations] = useState([]);
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
            <PlaceCard
              key={destination.id}
              place={destination}
              variant="wishlist"
              isFavorited={true}
              classes={{
                card: cardStyles.card,
                photo: cardStyles.photo,
                photoPlaceholder: cardStyles.photoPlaceholder,
                cardHeader: cardStyles.cardHeader,
                category: cardStyles.category,
                metaRow: cardStyles.metaRow,
                rating: cardStyles.rating,
                priceTag: cardStyles.priceTag,
                name: cardStyles.name,
                location: cardStyles.location,
                heartBtn: cardStyles.heartBtn,
                heartActive: cardStyles.heartActive,
                heartImg: cardStyles.heartImg,
              }}
              onOpen={() => {
                setSelectedPlace(destination);
                setIsModalOpen(true);
              }}
              onToggleFavorite={() => toggleFavorite(destination.id)}
            />
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

      <div style={{ display: "flex", gap: "10px", justifyContent: "center", flexWrap: "wrap" }}>
        <button
          className="lightActionBtn"
          onClick={() => toggleFavorite(selectedPlace.id)}
        >
          💚 Added to wishlist
        </button>

        <button
          className="lightActionBtn"
          onClick={handleCreateTrip}
        >
          ✈️ Add to trip
        </button>
      </div>

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
