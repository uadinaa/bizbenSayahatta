import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchInspirationPlaces, toggleMustVisit } from "../api/places";
import { fetchPlaceComments, createPlaceComment } from "../api/comments";
import { fetchProfile } from "../slices/authSlice";
import s from "../styles/Inspiration.module.css";
import api from "../api/axios";
import AddTripModal from "../components/AddTripModal";

// категории для фильтрации
const categories = [
  "all",
  "restaurant",
  "museum",
  "tourist_attraction",
  "park",
  "theater",
  "shopping_mall",
  "hiking",
  "beach",
  "concert",
];
// функция что б сделать лист 
function toList(data) {
  if (Array.isArray(data)) return data;
  if (Array.isArray(data?.results)) return data.results;
  return [];
}
// нормализирует для фильтрации цены
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
// наименование для цен
function priceTierLabel(priceLevel) {
  const tier = normalizePriceTier(priceLevel);
  if (tier === "free") return "🆓";
  if (tier === "budget") return "🪙";
  if (tier === "moderate") return "💸";
  if (tier === "premium") return "💰";
  return "Unknown";
}

const Inspiration = () => {
  const [searchParams, setSearchParams] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(null);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");
  const [dateFrom, setDateFrom] = useState("");
  const [dateTo, setDateTo] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isTripModalOpen, setIsTripModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);
  const [tripCategories, setTripCategories] = useState([]);
  const [tripForm, setTripForm] = useState({
    title: "",
    category_id: "",
    destination: "",
    start_date: "",
    end_date: "",
    duration_days: 1,
    budget: "",
    additional_info: "",
    photo_url: "",
  });
  const [tripUploadPreview, setTripUploadPreview] = useState("");
  const [tripSubmitting, setTripSubmitting] = useState(false);
  const [tripError, setTripError] = useState("");
  const [tripSuccess, setTripSuccess] = useState("");

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [publicTrips, setPublicTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const handleTripCreated = async () => {
    // await loadTrips(); ориг
    // await loadingTrips();
    await loadPublicTrips();
    setActiveFilter("PENDING");
  };

    const closeModal = () => {
    setIsModalOpen(false);
  };

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const isAuthed = Boolean(localStorage.getItem("access"));
  const isTripAdvisor = user?.role === "TRIPADVISOR" || user?.role === "ADMIN";

  // фильтр
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
  // форматирование категории 
  const formatCategory = (categoryValue) => {
    if (!categoryValue) return "";
    return categoryValue
      .replace("_", " ")
      .replace(/\b\w/g, (l) => l.toUpperCase());
  };
  // оценочные звезды 
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
  // форматирование локации 
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
  // фильтрация по ценам
  const filterByPrice = (list) => {
    if (priceFilter === "all") return list;
    return list.filter((p) => normalizePriceTier(p.price_level) === priceFilter);
  };
  // фильтрация по датам
  const filterByDate = (list) => {
    if (!dateFrom && !dateTo) return list;

    return list.filter((p) => {
      if (!p.created_at) return true;
      const placeDate = new Date(p.created_at);
      if (dateFrom && placeDate < new Date(dateFrom)) return false;
      if (dateTo && placeDate > new Date(dateTo)) return false;
      return true;
    });
  };
  // 
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
  // пока дизейблд, но в будущем должен направлять в чат  
  const handleCreateTrip = () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    navigate("/trip");
  };
  // коменты грузят
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
  // добавление коментов 
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
  // от
  const openTripModal = () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    if (!isTripAdvisor) return;
    // setTripError("");
    // setTripSuccess("");
    setIsTripModalOpen(true);
  };

  const closeTripModal = () => {
    setIsTripModalOpen(false);
    // setTripError("");
    // setTripSuccess("");
    setTripSubmitting(false);
  };

  const updateTripForm = (patch) => {
    setTripForm((prev) => ({ ...prev, ...patch }));
  };

  const computeDurationDays = (start, end) => {
    if (!start || !end) return Number(tripForm.duration_days) || 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
      return Number(tripForm.duration_days) || 1;
    }
    const diffMs = endDate.getTime() - startDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  };

  const handleTripFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setTripUploadPreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setTripUploadPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitTrip = async (event) => {
    event.preventDefault();
    if (!tripForm.title || !tripForm.destination) {
      setTripError("Please fill trip name and place.");
      return;
    }

    setTripSubmitting(true);
    setTripError("");
    setTripSuccess("");

    const availableDates = tripForm.start_date ? [tripForm.start_date] : [];
    const mediaUrls = [];
    if (tripUploadPreview) mediaUrls.push(tripUploadPreview);
    if (tripForm.photo_url) mediaUrls.push(tripForm.photo_url);

    try {
      const resolvedCategoryId =
        tripForm.category_id || (tripCategories[0]?.id ? String(tripCategories[0].id) : "");
      if (!resolvedCategoryId) {
        setTripError("No available category. Please try again later.");
        setTripSubmitting(false);
        return;
      }

      const durationDays = computeDurationDays(tripForm.start_date, tripForm.end_date);
      const createPayload = {
        title: tripForm.title.trim(),
        category_id: Number(resolvedCategoryId),
        destination: tripForm.destination.trim(),
        duration_days: durationDays,
        available_dates: availableDates,
        price: tripForm.budget === "" ? 0 : Number(tripForm.budget),
        itinerary_json: tripForm.additional_info
          ? { notes: tripForm.additional_info.trim() }
          : {},
        media_urls: mediaUrls,
        visibility: "PUBLIC",
      };

      const createRes = await api.post("marketplace/advisor/trips/", createPayload);
      const createdId = createRes.data?.id;
      if (!createdId) {
        throw new Error("Trip creation failed.");
      }

      await api.post(`marketplace/advisor/trips/${createdId}/submit/`);

      setTripSuccess("Trip submitted for review. Status: PENDING.");
      setTripForm({
        title: "",
        category_id: "",
        destination: "",
        start_date: "",
        end_date: "",
        duration_days: 1,
        budget: "",
        additional_info: "",
        photo_url: "",
      });
      setTripUploadPreview("");
    } catch (err) {
      const responseData = err?.response?.data;
      const detail =
        responseData?.detail || err?.userMessage || "Failed to submit trip.";
      const errorFields = Array.isArray(responseData?.errors)
        ? ` Check: ${responseData.errors.join(", ")}.`
        : "";
      const errorId = responseData?.error_id
        ? ` (error_id: ${responseData.error_id})`
        : "";
      setTripError(`${detail}${errorFields}${errorId}`);
    } finally {
      setTripSubmitting(false);
    }
  };

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

  const loadPublicTrips = async () => {
    setLoadingTrips(true);
    try {
      const res = await api.get("marketplace/public/trips/");
      const list = Array.isArray(res.data) ? res.data : res.data?.results || [];
      setPublicTrips(list);
    } catch (err) {
      console.error("Failed to load trips", err);
      setPublicTrips([]);
    } finally {
      setLoadingTrips(false);
    }
  };

  useEffect(() => {
    setPage(1);
  }, [search, category, priceFilter, dateFrom, dateTo]);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q !== search) {
      setSearch(q);
    }
  }, [searchParams, search]);

  useEffect(() => {
    loadPlaces();
  }, [page, search, category, priceFilter, preferenceFilters, dateFrom, dateTo]);

  useEffect(() => {
    loadPublicTrips();
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (token && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (!isTripAdvisor || tripCategories.length > 0) return;

    const loadCategories = async () => {
      try {
        const profileRes = await api.get("marketplace/advisor/profile/");
        const profileCats = toList(profileRes.data?.categories);
        if (profileCats.length > 0) {
          setTripCategories(profileCats);
          return;
        }
      } catch (err) {
        console.error(err);
      }

      try {
        const res = await api.get("marketplace/categories/");
        setTripCategories(toList(res.data));
      } catch (err) {
        console.error(err);
        setTripCategories([]);
      }
    };

    loadCategories();
  }, [isTripAdvisor, tripCategories.length]);

  useEffect(() => {
    if (!isTripModalOpen) return;
    if (!tripCategories.length) return;

    const allowedIds = new Set(tripCategories.map((c) => String(c.id)));
    if (!allowedIds.has(String(tripForm.category_id))) {
      updateTripForm({ category_id: String(tripCategories[0].id) });
    }
  }, [isTripModalOpen, tripCategories, tripForm.category_id]);

  return (
    <div className={s.page}>
      <h1 className={s.title}>Inspiration</h1>

      <div className={s.searchRow}>
        <input
          className={s.search}
          placeholder="Search destination..."
          value={search}
          onChange={(e) => {
            const value = e.target.value;
            setSearch(value);
            const nextParams = new URLSearchParams(searchParams);
            if (value.trim()) {
              nextParams.set("q", value);
            } else {
              nextParams.delete("q");
            }
            setSearchParams(nextParams, { replace: true });
          }}
        />

        {isTripAdvisor && (
          // <button className={s.addTripBtn} onClick={openTripModal}>
          //   + Add Trip
          // </button>
          <button className="add-trip-btn" onClick={openTripModal}>
            + Add New Trip
          </button>
        )}
      </div>

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
                  {c === "all" ? "All categories" : formatCategory(c)}
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

      <div className={s.sectionHeader}>
        <h2>TripAdvisor Trips</h2>
        <span>Verified trips from TripAdvisors</span>
      </div>

      {loadingTrips && <div className={s.sectionNote}>Loading trips...</div>}
      {!loadingTrips && publicTrips.length === 0 && (
        <div className={s.sectionNote}>No approved trips yet.</div>
      )}

      {!loadingTrips && publicTrips.length > 0 && (
        <div className={s.tripGrid}>
          {publicTrips.map((trip) => (
            <div key={trip.id} className={s.tripCard}>
              {trip.media_urls?.[0] ? (
                <img
                  className={s.tripPhoto}
                  src={trip.media_urls[0]}
                  alt={trip.title}
                  loading="lazy"
                />
              ) : (
                <div className={s.tripPhotoPlaceholder} />
              )}
              <div className={s.tripMeta}>
                <span className={s.tripBadge}>TripAdvisor</span>
                <span className={s.tripCategory}>{trip.category?.name || "Trip"}</span>
              </div>
              <h3 className={s.tripTitle}>{trip.title}</h3>
              <p className={s.tripDestination}>{trip.destination}</p>
              <div className={s.tripFooter}>
                <span>{trip.duration_days} days</span>
                <span>{trip.price ? `$${trip.price}` : "Contact"}</span>
              </div>
            </div>
          ))}
        </div>
      )}

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

      {next && (
        <button
          className={s.loadMore}
          onClick={() => setPage((p) => p + 1)}
        >
          Load more
        </button>
      )}

      {isModalOpen && selectedPlace && (
        <div className={s.modalOverlay} onClick={() => setIsModalOpen(false)}>
          <div className={s.modal} onClick={(e) => e.stopPropagation()}>
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

              <p>{selectedPlace.description || "No description available"}</p>

              <p>
                <strong>Location:</strong>{" "}
                {formatLocation(selectedPlace)}
              </p>

              {selectedPlace.opening_hours?.openNow !== undefined && (
                <p>
                  <strong>Status:</strong>{" "}
                  {selectedPlace.opening_hours.openNow ? "Open now" : "Closed"}
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

                <button className={s.lightActionBtn} onClick={handleCreateTrip}>
                  ✈️ Add to trip
                </button>
              </div>

              <div className={s.commentsSection}>
                <h3>
                  Comments
                  {comments.length > 0 && (
                    <span className={s.commentCount}>
                      {comments.length}
                    </span>
                  )}
                </h3>

                <div className={s.commentsContainer}>
                  {loadingComments && (
                    <div className={s.loadingComments}>Loading comments...</div>
                  )}

                  {!loadingComments && comments.length === 0 && (
                    <div className={s.emptyComments}>
                      <svg
                        viewBox="0 0 24 24"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                      >
                        <circle
                          cx="12"
                          cy="12"
                          r="10"
                          stroke="currentColor"
                          strokeWidth="1.5"
                        />
                        <path
                          d="M8 12h8M8 8h8M8 16h4"
                          stroke="currentColor"
                          strokeWidth="1.5"
                          strokeLinecap="round"
                        />
                      </svg>
                      <span>No comments yet</span>
                      <span style={{ fontSize: "12px", marginTop: "4px" }}>
                        Be the first to share your thoughts!
                      </span>
                    </div>
                  )}

                  {!loadingComments &&
                    comments.map((comment) => (
                      <div key={comment.id} className={s.comment}>
                        <div className={s.commentHeader}>
                          <div className={s.userAvatar}>
                            {comment.username?.charAt(0).toUpperCase() || "U"}
                          </div>
                          <strong>{comment.username || "Anonymous"}</strong>
                          {comment.is_trip_advisor && (
                            <span className={s.tripAdvisorBadge}>
                              ✓ TripAdvisor
                            </span>
                          )}
                        </div>
                        <p>{comment.comment_text}</p>
                        {comment.created_at && (
                          <small className={s.commentDate}>
                            {new Date(comment.created_at).toLocaleDateString(
                              "en-US",
                              {
                                year: "numeric",
                                month: "short",
                                day: "numeric",
                                hour: "2-digit",
                                minute: "2-digit",
                              }
                            )}
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
                    </button>{" "}
                    to join the conversation
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

      <AddTripModal
        isOpen={isTripModalOpen}
        onClose={closeTripModal}
        tripCategories={tripCategories}
        onTripCreated={handleTripCreated}
      />
    </div>
  );
};

export default Inspiration;


      {/* {isTripModalOpen && (
        <div className={s.modalOverlay} onClick={closeTripModal}>
          <div className={s.tripModal} onClick={(e) => e.stopPropagation()}>
            <div className={s.tripModalHeader}>
              <h2>Add New Trip</h2>
              <p>Fill in the details and submit for manager review.</p>
            </div>

            <form className={s.tripForm} onSubmit={handleSubmitTrip}>
              <label className={s.tripField}>
                <span>Category</span>
                <select
                  value={tripForm.category_id}
                  onChange={(e) =>
                    updateTripForm({ category_id: e.target.value })
                  }
                  required
                >
                  <option value="">Select category</option>
                  {tripCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

              <label className={s.tripField}>
                <span>Trip Name</span>
                <input
                  type="text"
                  value={tripForm.title}
                  onChange={(e) => updateTripForm({ title: e.target.value })}
                  placeholder="Hiking weekend in Almaty"
                  required
                />
              </label>

              <label className={s.tripField}>
                <span>Place or places</span>
                <input
                  type="text"
                  value={tripForm.destination}
                  onChange={(e) =>
                    updateTripForm({ destination: e.target.value })
                  }
                  placeholder="Big Almaty Lake, Kok-Tobe"
                  required
                />
              </label>

              <div className={s.tripFieldRow}>
                <label className={s.tripField}>
                  <span>Start date</span>
                  <input
                    type="date"
                    value={tripForm.start_date}
                    onChange={(e) =>
                      updateTripForm({ start_date: e.target.value })
                    }
                  />
                </label>

                <label className={s.tripField}>
                  <span>Duration (days)</span>
                  <input
                    type="number"
                    min="1"
                    value={tripForm.duration_days}
                    onChange={(e) =>
                      updateTripForm({ duration_days: e.target.value })
                    }
                  />
                </label>
              </div>

              <label className={s.tripField}>
                <span>Budget (USD)</span>
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={tripForm.budget}
                  onChange={(e) => updateTripForm({ budget: e.target.value })}
                  placeholder="250"
                />
              </label>

              <label className={s.tripField}>
                <span>Photo URL (optional)</span>
                <input
                  type="url"
                  value={tripForm.photo_url}
                  onChange={(e) => updateTripForm({ photo_url: e.target.value })}
                  placeholder="https://..."
                />
              </label>

              <label className={s.tripField}>
                <span>Upload photo (optional)</span>
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleTripFileUpload}
                />
                {tripUploadPreview && (
                  <img
                    className={s.tripPreview}
                    src={tripUploadPreview}
                    alt="Trip preview"
                  />
                )}
              </label>

              <label className={s.tripField}>
                <span>Additional information</span>
                <textarea
                  rows="4"
                  value={tripForm.additional_info}
                  onChange={(e) =>
                    updateTripForm({ additional_info: e.target.value })
                  }
                  placeholder="Describe your plan, what is included, and any notes."
                />
              </label>

              {tripError && <div className={s.tripError}>{tripError}</div>}
              {tripSuccess && <div className={s.tripSuccess}>{tripSuccess}</div>}

              <div className={s.tripActions}>
                <button
                  type="button"
                  className={s.secondaryActionBtn}
                  onClick={closeTripModal}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className={s.primaryActionBtn}
                  disabled={tripSubmitting}
                >
                  {tripSubmitting ? "Submitting..." : "Add Trip"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )} */}