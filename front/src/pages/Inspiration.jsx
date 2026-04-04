import { useEffect, useMemo, useState } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate, useSearchParams } from "react-router-dom";
import AddTripModal from "../components/AddTripModal";
import PublicTripsSection from "../components/inspiration/PublicTripsSection";
import PlaceDetailModal from "../components/inspiration/PlaceDetailModal";
import PlaceCard from "../components/places/PlaceCard";
import PlaceFilters from "../components/places/PlaceFilters";
import { fetchProfile } from "../slices/authSlice";
import {
  closeTripModal,
  handleAddComment,
  handleCreateTrip,
  handleToggleMustVisit,
  loadComments,
  loadPlaces,
  loadPublicTrips,
  loadTripCategories,
  openTripModal,
} from "../service/placeService";
import { toggleMustVisit } from "../api/places";
import s from "../styles/Inspiration.module.css";

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

  const [comments, setComments] = useState([]);
  const [newComment, setNewComment] = useState("");
  const [loadingComments, setLoadingComments] = useState(false);
  const [publicTrips, setPublicTrips] = useState([]);
  const [loadingTrips, setLoadingTrips] = useState(false);

  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, isAuthenticated } = useSelector((state) => state.auth);
  const isAuthed = isAuthenticated;
  const isTripAdvisor = user?.role === "TRIPADVISOR" || user?.role === "ADMIN";

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

  useEffect(() => {
    loadPlaces({
      page,
      search,
      category,
      preferenceFilters,
      priceFilter,
      dateFrom,
      dateTo,
      setPlaces,
      setNext,
    });
  }, [page, search, category, preferenceFilters, priceFilter, dateFrom, dateTo]);

  useEffect(() => {
    loadPublicTrips({ setLoadingTrips, setPublicTrips });
  }, []);

  useEffect(() => {
    const token = localStorage.getItem("access");
    if (token && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (!isTripAdvisor || tripCategories.length > 0) return;
    loadTripCategories({ setTripCategories });
  }, [isTripAdvisor, tripCategories.length]);

  const handleSearchChange = (value) => {
    setPage(1);
    setSearch(value);
    const nextParams = new URLSearchParams(searchParams);
    if (value.trim()) {
      nextParams.set("q", value);
    } else {
      nextParams.delete("q");
    }
    setSearchParams(nextParams, { replace: true });
  };

  const openPlaceModal = (place) => {
    setSelectedPlace(place);
    setIsModalOpen(true);
    loadComments({
      placeId: place.id,
      setLoadingComments,
      setComments,
    });
  };

  const closePlaceModal = () => {
    setIsModalOpen(false);
  };

  const handleTripCreated = async () => {
    await loadPublicTrips({ setLoadingTrips, setPublicTrips });
  };

  // const handleToggleFavoriteInPlace = async (placeId) => {
  //   if (!isAuthed) {
  //     navigate("/login");
  //     return;
  //   }

  //   const place = places.find(p => p.id === placeId);
  //   if (!place) return;

  //   try {
  //     const data = await toggleMustVisit(placeId, !place.is_must_visit);
  //     // Update the places list to reflect the change
  //     setPlaces((prev) =>
  //       prev.map((p) =>
  //         p.id === placeId ? { ...p, is_must_visit: data.is_must_visit } : p
  //       )
  //     );
  //   } catch (err) {
  //     console.error("Failed to toggle favorite:", err);
  //   }
  // };
  const handleToggleFavoriteInPlace = async (placeId) => {
  if (!isAuthed) {
    navigate("/login");
    return;
  }

  const place = places.find((p) => p.id === placeId);
  if (!place) return;

  const newValue = !place.is_must_visit;

  // Optimistic update — react immediately, no waiting for API
  setPlaces((prev) =>
    prev.map((p) => p.id === placeId ? { ...p, is_must_visit: newValue } : p)
  );
  if (selectedPlace?.id === placeId) {
    setSelectedPlace((prev) => ({ ...prev, is_must_visit: newValue }));
  }

  try {
    await toggleMustVisit(placeId, newValue);
  } catch (err) {
    // Revert on failure
    setPlaces((prev) =>
      prev.map((p) => p.id === placeId ? { ...p, is_must_visit: !newValue } : p)
    );
    if (selectedPlace?.id === placeId) {
      setSelectedPlace((prev) => ({ ...prev, is_must_visit: !newValue }));
    }
    console.error("Failed to toggle favorite:", err);
  }
};

  return (
    <div className={s.page}>
      <h1 className={s.title}>Inspiration</h1>

      <div className={s.searchRow}>
        <input
          className={s.search}
          placeholder="Search destination..."
          value={search}
          onChange={(e) => handleSearchChange(e.target.value)}
        />

        {isTripAdvisor && (
          <button
            className="add-trip-btn"
            onClick={() =>
              openTripModal({
                isAuthed,
                isTripAdvisor,
                navigate,
                setIsTripModalOpen,
              })
            }
          >
            + Add New Trip
          </button>
        )}
      </div>

      <PlaceFilters
        styles={s}
        category={category}
        onCategoryChange={(value) => {
          setPage(1);
          setCategory(value);
        }}
        priceFilter={priceFilter}
        onPriceFilterChange={(value) => {
          setPage(1);
          setPriceFilter(value);
        }}
        dateFrom={dateFrom}
        onDateFromChange={(value) => {
          setPage(1);
          setDateFrom(value);
        }}
        dateTo={dateTo}
        onDateToChange={(value) => {
          setPage(1);
          setDateTo(value);
        }}
      />

      <PublicTripsSection styles={s} loadingTrips={loadingTrips} publicTrips={publicTrips} />

      <div className={s.grid}>
        {places.map((place) => (
          <PlaceCard
            key={place.id}
            place={place}
            variant="inspiration"
            isFavorited={place.is_must_visit}
            classes={{
              card: s.card,
              photo: s.photo,
              photoPlaceholder: s.photoPlaceholder,
              cardHeader: s.cardHeader,
              category: s.category,
              metaRow: s.metaRow,
              rating: s.rating,
              priceTag: s.priceTag,
              name: s.name,
              location: s.location,
              heartBtn: s.heartBtn,
              heartActive: s.heartActive,
              heartImg: s.heartImg,
            }}
            onOpen={() => openPlaceModal(place)}
            onToggleFavorite={() => handleToggleFavoriteInPlace(place.id)}
          />
        ))}
      </div>

      {next && (
        <button className={s.loadMore} onClick={() => setPage((prev) => prev + 1)}>
          Load more
        </button>
      )}

      {isModalOpen && selectedPlace ? (
        <PlaceDetailModal
          styles={s}
          place={selectedPlace}
          isAuthed={isAuthed}
          comments={comments}
          newComment={newComment}
          loadingComments={loadingComments}
          navigate={navigate}
          onClose={closePlaceModal}
          onToggleMustVisit={() =>
            handleToggleMustVisit({
              placeId: selectedPlace.id,
              currentValue: selectedPlace.is_must_visit,
              isAuthed,
              navigate,
              setPlaces,
              setSelectedPlace,
            })
          }
          onCreateTrip={() => handleCreateTrip({ isAuthed, navigate })}
          onCommentChange={setNewComment}
          onAddComment={() =>
            handleAddComment({
              placeId: selectedPlace.id,
              newComment,
              isAuthed,
              navigate,
              setComments,
              setNewComment,
            })
          }
        /> 
      ) : null}

      <AddTripModal
        isOpen={isTripModalOpen}
        onClose={() => closeTripModal({ setIsTripModalOpen })}
        tripCategories={tripCategories}
        onTripCreated={handleTripCreated}
      />
    </div>
  );
};

export default Inspiration;
