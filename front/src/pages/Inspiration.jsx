import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import { fetchInspirationPlaces, toggleMustVisit } from "../api/places";
import { fetchProfile } from "../slices/authSlice";
import s from "../styles/Inspiration.module.css";
import api from "../api/axios";


const categories = ["all", "restaurant", "museum", "tourist_attraction"];

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
  const [searchParams, setSearchParams] = useSearchParams();
  const [places, setPlaces] = useState([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(null);
  const [search, setSearch] = useState(searchParams.get("q") || "");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [selectedPlace, setSelectedPlace] = useState(null);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
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

  const filterByPrice = (places) => {
    if (priceFilter === "all") return places;
    return places.filter((p) => normalizePriceTier(p.price_level) === priceFilter);
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
      console.log("SERVER RESPONSE:", data);

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

  const loadPlaces = async () => {
    const data = await fetchInspirationPlaces(
      page,
      search.trim(),
      category,
      preferenceFilters
    );

    const filteredResults = filterByPrice(data.results);

    setPlaces((prev) =>
      page === 1 ? filteredResults : [...prev, ...filteredResults]
    );

    setNext(data.next);
  };

  useEffect(() => {
    setPage(1);
  }, [search, category, priceFilter]);

  useEffect(() => {
    const q = searchParams.get("q") || "";
    if (q !== search) {
      setSearch(q);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams]);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (token && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  useEffect(() => {
    loadPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, category, priceFilter, preferenceFilters]);

  /* ---------------------------
     RENDER
  --------------------------- */

  return (
    <div className={s.page}>
      <h1 className={s.title}>Inspiration</h1>

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
              <option value="all">All price levels</option>
              <option value="free">Free</option>
              <option value="budget">Budget</option>
              <option value="moderate">Moderate</option>
              <option value="premium">Premium</option>
              <option value="unknown">Unknown</option>
            </select>
          </div>
        </div>
      </div>

      <div className={s.grid}>
        {places.map((place) => (
          <div
            key={place.id}
            className={s.card}
            onClick={() => {
              setSelectedPlace(place);
              setIsModalOpen(true);
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
                <span className={s.priceTag}>{priceTierLabel(place.price_level)}</span>
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
    </div>
  );
};

export default Inspiration;
