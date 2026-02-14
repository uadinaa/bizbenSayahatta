import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { fetchInspirationPlaces, toggleMustVisit } from "../api/places";
import { fetchProfile } from "../slices/authSlice";
import s from "../styles/Inspiration.module.css";

const categories = ["all", "restaurant", "museum", "tourist_attraction"];

const Inspiration = () => {
  const [places, setPlaces] = useState([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(null);
  const [search, setSearch] = useState("");
  const [category, setCategory] = useState("all");
  const [priceFilter, setPriceFilter] = useState("all");

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

  const formatPriceLevel = (priceLevel) => {
    if (!priceLevel) return null;
    const mapping = {
      PRICE_LEVEL_FREE: 0,
      PRICE_LEVEL_INEXPENSIVE: 1,
      PRICE_LEVEL_MODERATE: 2,
      PRICE_LEVEL_EXPENSIVE: 3,
      PRICE_LEVEL_VERY_EXPENSIVE: 4,
    };
    const count = mapping[priceLevel];
    if (count === 0) return "Free";
    if (count > 0) return "$".repeat(count);
    return null;
  };

  const filterByPrice = (places) => {
    if (priceFilter === "all") return places;

    if (priceFilter === "free") {
      return places.filter(
        (p) => p.price_level === "PRICE_LEVEL_FREE"
      );
    }

    if (priceFilter === "paid") {
      return places.filter(
        (p) =>
          p.price_level &&
          p.price_level !== "PRICE_LEVEL_FREE"
      );
    }

    return places;
  };

  const handleToggleMustVisit = async (placeId, currentValue) => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    try {
      const data = await toggleMustVisit(placeId, !currentValue);
      setPlaces((prev) =>
        prev.map((place) =>
          place.id === placeId
            ? { ...place, is_must_visit: data.is_must_visit }
            : place
        )
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
      search,
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
    const token = localStorage.getItem("access");
    if (token && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  useEffect(() => {
    loadPlaces();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, search, category, priceFilter, preferenceFilters]);

  return (
    <div className={s.page}>
      <h1 className={s.title}>Inspiration</h1>

      {/* Search */}
      <input
        className={s.search}
        placeholder="Search destination..."
        value={search}
        onChange={(e) => setSearch(e.target.value)}
      />

{/* Filters under search */}
<div className={s.controls}>
  <div className={s.selectRowWithShadow}>
    <div className={s.selectBlock}>
      <span className={s.selectLabel}>By event</span>
      <select
        className={s.select}
        value={category}
        onChange={(e) => setCategory(e.target.value)}
      >
        {categories.map((c) => (
          <option key={c} value={c}>
            {c === "all" ? "All categories" : c.replace("_", " ")}
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
        <option value="free">Free</option>
        <option value="paid">Paid</option>
      </select>
    </div>
  </div>
</div>


      {/* Cards */}
      <div className={s.grid}>
        {places.map((place) => (
          <div key={place.id} className={s.card}>
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
              <span className={s.category}>{place.category}</span>
              <div className={s.metaRow}>
                {place.is_must_visit && (
                  <span className={s.mustVisit}>Must visit</span>
                )}
                {place.rating && (
                  <span className={s.rating}>★ {place.rating}</span>
                )}
              </div>
            </div>

            <h3 className={s.name}>{place.name}</h3>

            <p className={s.location}>
              {place.neighborhood ? `${place.neighborhood}, ` : ""}
              {place.city}, {place.country}
            </p>

            <div className={s.badges}>
              {formatPriceLevel(place.price_level) && (
                <span className={s.badge}>
                  {formatPriceLevel(place.price_level)}
                </span>
              )}
              {place.opening_hours?.openNow !== undefined && (
                <span className={s.badge}>
                  {place.opening_hours.openNow ? "Open now" : "Closed"}
                </span>
              )}
            </div>

            <div className={s.actions}>
              <button className={s.action} onClick={handleCreateTrip}>
                Create your trip →
              </button>
              <button
                type="button"
                className={s.mustVisitToggle}
                onClick={() =>
                  handleToggleMustVisit(place.id, place.is_must_visit)
                }
              >
                {place.is_must_visit ? "Unmark" : "Mark must visit"}
              </button>
            </div>
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
    </div>
  );
};

export default Inspiration;
