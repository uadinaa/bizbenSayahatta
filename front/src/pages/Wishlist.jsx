import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import api from "../api/axios";
import { toggleMustVisit } from "../api/places";
import PlaceCard from "../components/places/PlaceCard";
import "../styles/Wishlist.css";

export default function Wishlist() {
  const navigate = useNavigate();
  const { t } = useTranslation();

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
          onClick={() => toggleFavorite(selectedPlace.id)}
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
