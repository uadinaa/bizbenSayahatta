import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchInspirationPlaces, toggleMustVisit } from "../api/places";
import { fetchPlaceComments, createPlaceComment } from "../api/comments";
import { fetchProfile } from "../slices/authSlice";
import s from "../styles/Inspiration.module.css";
import api from "../api/axios";

const categories = ["all", "restaurant", "museum", "tourist_attraction",
  "park",
  "theater",
  "shopping_mall",
  "hiking",
  "beach",
  "concert"
 ];

 

// Функции для работы с ценами
function normalizePriceTier(priceLevel) {
  if (priceLevel === null || priceLevel === undefined || priceLevel === "") {
    return "unknown";
  }

  const value = String(priceLevel).toUpperCase();
  if (value === "0" || value.includes("FREE")) return "free";
  if (value === "1" || value.includes("INEXPENSIVE")) return "budget";
  if (value === "2" || value.includes("MODERATE")) return "moderate";
  if (
    value === "3" ||
    value === "4" ||
    value.includes("EXPENSIVE") ||
    value.includes("VERY_EXPENSIVE")
  ) {
    return "premium";
  }
  return "unknown";
}

function priceTierLabel(priceLevel) {
  const tier = normalizePriceTier(priceLevel);
  if (tier === "free") return "🆓";
  if (tier === "budget") return "🪙";
  if (tier === "moderate") return "💸";
  if (tier === "premium") return "💰";
  return "🧐";
}

const Inspiration = () => {
  const [places, setPlaces] = useState([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

   const [newTrip, setNewTrip] = useState({
    title: "",
    place: "",
    startDate: "",
    endDate: "",
    budget: "",
    comment: "",
    image: null,
  });

  const handleChange = (e) => {
    const { name, value } = e.target;
    setNewTrip((prev) => ({ ...prev, [name]: value }));
  };

  const handleAddTrip = () => {
  console.log("Trip data:", newTrip);

  // Получаем существующие трипы из localStorage
  const savedTrips = JSON.parse(localStorage.getItem("trips") || "[]");

  // Добавляем новый трип с статусом "in-progress"
  savedTrips.push({ ...newTrip, status: "in-progress", id: Date.now() });

  // Сохраняем обратно
  localStorage.setItem("trips", JSON.stringify(savedTrips));

  // Сбрасываем форму и закрываем модалку
  setNewTrip({
    title: "",
    place: "",
    startDate: "",
    endDate: "",
    budget: "",
    comment: "",
    image: null,
  });
  setIsTripModalOpen(false);
};

  /* COMMENTS STATE */
  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isTripAdvisor = user?.role === "TRIPADVISOR";
  const isAuthed = Boolean(localStorage.getItem("access"));

  const preferenceFilters = useMemo(() => {
    const prefs = user?.preferences || {};
    return {
      budget: prefs.budget ?? "",
      open_now:
        prefs.open_now === null || prefs.open_now === undefined
          ? ""
          : prefs.open_now,
    };
  }, [user]);

  /* ---------------------------
     HELPERS
  --------------------------- */

  const formatCategory = (category) => {
    if (!category) return "";
    return category
      .replace("_", " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };

  const renderStars = (rating) => {
    if (!rating) return null;
    const fullStars = Math.floor(rating);
    const emptyStars = 5 - fullStars;

    return (
      <span>
        {"★".repeat(fullStars)}
        {"☆".repeat(emptyStars)}
        <span style={{ marginLeft: 6, fontWeight: 500 }}>
          {rating}
        </span>
      </span>
    );
  };

  const formatLocation = (place) => {
    const city = (place.city || "").trim();
    let country = (place.country || "").trim();

    if (!country || country.toLowerCase() === city.toLowerCase()) {
      const address = (place.address || "").trim();
      const parts = address.split(",").map((p) => p.trim()).filter(Boolean);
      const maybeCountry = parts[parts.length - 1];
      if (maybeCountry && maybeCountry.toLowerCase() !== city.toLowerCase()) {
        country = maybeCountry;
      }
    }

    if (city && country) return `${city}, ${country}`;
    return city || country || "";
  };

  // Функция фильтрации по цене (использует normalizePriceTier)
  const filterByPrice = (places) => {
    if (priceFilter === "all") return places;
    return places.filter((p) => normalizePriceTier(p.price_level) === priceFilter);
  };

  const filterByDate = (places) => {
  if (!dateFrom && !dateTo) return places;

  return places.filter((p) => {
    if (!p.created_at) return true;

    const placeDate = new Date(p.created_at);

    if (dateFrom && placeDate < new Date(dateFrom)) return false;
    if (dateTo && placeDate > new Date(dateTo)) return false;

    return true;
  });
};

  /* ---------------------------
     LOAD PLACES
  --------------------------- */

  const loadPlaces = async () => {
    const data = await fetchInspirationPlaces(
      page,
      search.trim(),
      category,
      preferenceFilters
    );

    let filteredResults = filterByPrice(data.results);
    filteredResults = filterByDate(filteredResults);

    setPlaces((prev) =>
      page === 1 ? filteredResults : [...prev, ...filteredResults]
    );

    setNext(data.next);
  };

  /* ---------------------------
     COMMENTS
  --------------------------- */

  const loadComments = async (placeId) => {
    try {
      setLoadingComments(true);
      setComments([]);
      const data = await fetchPlaceComments(placeId);
      setComments(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Failed to load comments", err);
    } finally {
      setLoadingComments(false);
    }
  };

  const handleAddComment = async () => {
    if (!newComment.trim()) return;

    if (!isAuthed) {
      navigate("/login");
      return;
    }

    try {
      const created = await createPlaceComment(selectedPlace.id, newComment);
      setComments((prev) => [created, ...prev]);
      setNewComment("");
    } catch (err) {
      console.error(err);
      alert("Failed to post comment. Please try again.");
    }
  };

  /* ---------------------------
     ACTIONS
  --------------------------- */

  const handleToggleMustVisit = async (placeId, currentValue) => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }

    try {
      const data = await toggleMustVisit(placeId, !currentValue);
      await api.post(`places/places/${placeId}/save/`);

      setPlaces((prev) =>
        prev.map((place) =>
          place.id === placeId
            ? { ...place, is_must_visit: data.is_must_visit }
            : place
        )
      );

      setSelectedPlace((prev) =>
        prev && prev.id === placeId
          ? { ...prev, is_must_visit: data.is_must_visit }
          : prev
      );
    } catch (err) {
      console.error(err);
    }
  };

  const handleCreateTrip = () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    navigate("/trip");
  };

  /* ---------------------------
     EFFECTS
  --------------------------- */

  useEffect(() => {
    setPage(1);
  }, [search, category, priceFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadPlaces();
  }, [page, search, category, priceFilter, preferenceFilters]);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (token && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  /* ---------------------------
     RENDER
  --------------------------- */

  return (
    <div className={s.page}>
      <h1 className={s.title}>Inspiration</h1>
          

      {/* Search Input */}
      <div className={s.searchRow}>
  <input
    className={s.search}
    placeholder="Search destination..."
    value={search}
    onChange={(e) => setSearch(e.target.value)}
  />

  {isTripAdvisor && (
    <button
      className={s.addTripBtn}
      onClick={() => setIsTripModalOpen(true)}
    >
      + Add Trip
    </button>
  )}
</div>

      {/* Filters */}
      <div className={s.controls}>
        <div className={s.selectRowWithShadow}>
          <div className={s.selectBlock}>
            <span className={s.selectLabel}>By category</span>
            <select
              className={s.select}
              value={category}
              onChange={(e) => setCategory(e.target.value)}
            >
              {categories.map((c) => (
                <option key={c} value={c}>
                  {c === "all"
                    ? "All categories"
                    : formatCategory(c)}
                </option>
              ))}
            </select>
          </div>

          <div className={s.selectBlock}>
            <span className={s.selectLabel}>By price</span>
            <select
              className={s.select}
              value={priceFilter}
              onChange={(e) => setPriceFilter(e.target.value)}
            >
              <option value="all">All prices</option>
              <option value="free">🆓 Free</option>
              <option value="budget">🪙 Budget</option>
              <option value="moderate">💸 Moderate</option>
              <option value="premium">💰 Premium</option>
            </select>
          </div>

          <div className={s.selectBlock}>
          <span className={s.selectLabel}>From date</span>
          <input
            type="date"
            className={s.select}
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
          />
        </div>

        <div className={s.selectBlock}>
          <span className={s.selectLabel}>To date</span>
          <input
            type="date"
            className={s.select}
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
          />
        </div>

        </div>
      </div>

      {/* Places Grid */}
      <div className={s.grid}>
        {places.map((place) => (
          <div
            key={place.id}
            className={s.card}
            onClick={() => {
              setSelectedPlace(place);
              setIsModalOpen(true);
              loadComments(place.id);
            }}
          >
            {place.photo_url ? (
              <img
                className={s.photo}
                src={place.photo_url}
                alt={place.name}
                loading="lazy"
              />
            ) : (
              <div className={s.photoPlaceholder} />
            )}

            <div className={s.cardHeader}>
              <span className={s.category}>
                {formatCategory(place.category)}
              </span>
              <div className={s.metaRow}>
                {place.rating && (
                  <span className={s.rating}>
                    ★ {place.rating}
                  </span>
                )}
                <span className={s.priceTag}>
                  {priceTierLabel(place.price_level)}
                </span>
              </div>
            </div>

            <h3 className={s.name}>{place.name}</h3>
            <p className={s.location}>{formatLocation(place)}</p>
          </div>
        ))}
      </div>

      {/* Load More Button */}
      {next && (
        <button
          className={s.loadMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Load more
        </button>
      )}

      

      {/* Modal */}
      {isModalOpen && selectedPlace && (
        <div
          className={s.modalOverlay}
          onClick={() => setIsModalOpen(false)}
        >
          <div
            className={s.modal}
            onClick={(e) => e.stopPropagation()}
          >
            {selectedPlace.photo_url && (
              <img
                className={s.modalPhoto}
                src={selectedPlace.photo_url}
                alt={selectedPlace.name}
              />
            )}

            <div className={s.modalContent}>
              <h2>{selectedPlace.name}</h2>

              <p>
                <strong>Category:</strong>{" "}
                {formatCategory(selectedPlace.category)}
              </p>

              {selectedPlace.rating && (
                <p>
                  <strong>Rating:</strong>{" "}
                  {renderStars(selectedPlace.rating)}
                </p>
              )}

              <p>
                <strong>Price level:</strong>{" "}
                {priceTierLabel(selectedPlace.price_level)}
              </p>

              <p>
                {selectedPlace.description ||
                  "No description available"}
              </p>

              <p>
                <strong>Location:</strong>{" "}
                {formatLocation(selectedPlace)}
              </p>

              {selectedPlace.opening_hours?.openNow !==
                undefined && (
                <p>
                  <strong>Status:</strong>{" "}
                  {selectedPlace.opening_hours.openNow
                    ? "Open now"
                    : "Closed"}
                </p>
              )}

              <div className={s.modalActions}>
                <button
                  className={s.lightActionBtn}
                  onClick={() =>
                    handleToggleMustVisit(
                      selectedPlace.id,
                      selectedPlace.is_must_visit
                    )
                  }
                >
                  {selectedPlace.is_must_visit
                    ? "💚 Added to wishlist"
                    : "❤️ Add to wishlist"}
                </button>

                <button
                  className={s.lightActionBtn}
                  onClick={handleCreateTrip}
                >
                  ✈️ Add to trip
                </button>
              </div>

              {/* COMMENTS — ОБНОВЛЕННАЯ ВЕРСИЯ */}
<div className={s.commentsSection}>
  <h3>
    Comments
    {comments.length > 0 && (
      <span className={s.commentCount}>{comments.length}</span>
    )}
  </h3>
  
  <div className={s.commentsContainer}>
    {loadingComments && (
      <div className={s.loadingComments}>
        Loading comments...
      </div>
    )}
    
    {!loadingComments && comments.length === 0 && (
      <div className={s.emptyComments}>
        <svg viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
          <circle cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="1.5"/>
          <path d="M8 12h8M8 8h8M8 16h4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/>
        </svg>
        <span>No comments yet</span>
        <span style={{ fontSize: '12px', marginTop: '4px' }}>Be the first to share your thoughts!</span>
      </div>
    )}
    
    {!loadingComments && comments.map((comment) => (
      <div key={comment.id} className={s.comment}>
        <div className={s.commentHeader}>
          <div className={s.userAvatar}>
            {comment.username?.charAt(0).toUpperCase() || 'U'}
          </div>
          <strong>{comment.username || 'Anonymous'}</strong>
          {comment.is_trip_advisor && (
            <span className={s.tripAdvisorBadge}>
              ✓ TripAdvisor
            </span>
          )}
        </div>
        <p>{comment.comment_text}</p>
        {comment.created_at && (
          <small className={s.commentDate}>
            {new Date(comment.created_at).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'short',
              day: 'numeric',
              hour: '2-digit',
              minute: '2-digit'
            })}
          </small>
        )}
      </div>
    ))}
  </div>
  
  {isAuthed ? (
    <div className={s.addComment}>
      <textarea
        placeholder="Share your experience... 💭"
        value={newComment}
        onChange={(e) => setNewComment(e.target.value)}
        rows="3"
      />
      <button
        className={s.commentBtn}
        onClick={handleAddComment}
        disabled={!newComment.trim()}
      >
        Post Comment
      </button>
    </div>
  ) : (
    <div className={s.loginHint}>
      <button 
        className={s.loginLink}
        onClick={() => navigate("/login")}
      >
        Sign in
      </button> to join the conversation
    </div>
  )}
</div>
            </div>

            <button
              className={s.modalClose}
              onClick={() => setIsModalOpen(false)}
            >
              Close
            </button>
          </div>
        </div>
      )}

      {isTripModalOpen && (
  <div className="modal-overlay" onClick={() => setIsTripModalOpen(false)}>
    <div className="modal" onClick={(e) => e.stopPropagation()}>
      
      <div className="modal-header">
        <h2>Add New Trip</h2>
        <span
          className="close-btn"
          onClick={() => setIsTripModalOpen(false)}
        >
          ✕
        </span>
      </div>

      <div className="modal-body">

        <input
          type="file"
          onChange={(e) =>
            setNewTrip({ ...newTrip, image: e.target.files[0] })
          }
        />

        <input
          type="text"
          name="title"
          placeholder="Trip Name"
          value={newTrip.title}
          onChange={handleChange}
        />

        <input
          type="text"
          name="place"
          placeholder="Place"
          value={newTrip.place}
          onChange={handleChange}
        />

        <div className="date-row">
          <input
            type="date"
            name="startDate"
            value={newTrip.startDate}
            onChange={handleChange}
          />

          <input
            type="date"
            name="endDate"
            value={newTrip.endDate}
            onChange={handleChange}
          />
        </div>

        <input
          type="text"
          name="budget"
          placeholder="Budget"
          value={newTrip.budget}
          onChange={handleChange}
        />

        <textarea
          name="comment"
          placeholder="Additional information"
          rows={3}
          value={newTrip.comment}
          onChange={handleChange}
        />

      </div>

      <div className="modal-actions">
        <button
          className="cancel-btn"
          onClick={() => setIsTripModalOpen(false)}
        >
          Cancel
        </button>

        <button
          className="save-btn"
          onClick={handleAddTrip}
        >
          Add Trip
        </button>
      </div>

    </div>
  </div>
)}

    </div>
  );
};

export default Inspiration;