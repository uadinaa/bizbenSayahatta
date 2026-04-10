import api from "../api/axios";
import { fetchInspirationPlaces, toggleMustVisit } from "../api/places";
import {
  createPlaceComment,
  fetchPlaceComments,
  likePlaceComment,
  unlikePlaceComment,
} from "../api/comments";
import { filterByDate, filterByPrice } from "../filters/placeFilters";
import { computeDurationDays, toList } from "../utils/placeUtils";

export async function loadPlaces({
  page,
  search,
  category,
  preferenceFilters,
  priceFilter,
  dateFrom,
  dateTo,
  setPlaces,
  setNext,
}) {
  const data = await fetchInspirationPlaces(
    page,
    search.trim(),
    category,
    preferenceFilters
  );

  let filteredResults = filterByPrice(data.results, priceFilter);
  filteredResults = filterByDate(filteredResults, dateFrom, dateTo);

  setPlaces((prev) => (page === 1 ? filteredResults : [...prev, ...filteredResults]));
  setNext(data.next);
}

export async function loadPublicTrips({ setLoadingTrips, setPublicTrips }) {
  setLoadingTrips(true);
  try {
    const res = await api.get("marketplace/public/trips/");
    setPublicTrips(toList(res.data));
  } catch (err) {
    console.error("Failed to load trips", err);
    setPublicTrips([]);
  } finally {
    setLoadingTrips(false);
  }
}

export async function loadComments({
  placeId,
  setLoadingComments,
  setComments,
  setCommentsMeta,
}) {
  try {
    setLoadingComments(true);
    setComments([]);
    if (setCommentsMeta) {
      setCommentsMeta({ count: 0, hasMore: false });
    }
    const { results, count, next } = await fetchPlaceComments(placeId, {
      page: 1,
    });
    setComments(results);
    if (setCommentsMeta) {
      setCommentsMeta({ count, hasMore: Boolean(next) });
    }
  } catch (err) {
    console.error("Failed to load comments", err);
  } finally {
    setLoadingComments(false);
  }
}

export async function loadMoreComments({
  placeId,
  page,
  setLoadingMoreComments,
  setComments,
  setCommentsMeta,
  onSuccess,
}) {
  if (!page || page < 2) return;
  try {
    setLoadingMoreComments(true);
    const { results, count, next } = await fetchPlaceComments(placeId, {
      page,
    });
    setComments((prev) => [...prev, ...results]);
    if (setCommentsMeta) {
      setCommentsMeta({ count, hasMore: Boolean(next) });
    }
    onSuccess?.();
  } catch (err) {
    console.error("Failed to load more comments", err);
  } finally {
    setLoadingMoreComments(false);
  }
}

export async function handleAddComment({
  placeId,
  newComment,
  isAuthed,
  navigate,
  setComments,
  setNewComment,
  setLoadingComments,
  setCommentsMeta,
}) {
  if (!newComment.trim()) return;

  if (!isAuthed) {
    navigate("/login");
    return;
  }

  try {
    await createPlaceComment(placeId, newComment);
    setNewComment("");
    await loadComments({
      placeId,
      setLoadingComments,
      setComments,
      setCommentsMeta,
    });
  } catch (err) {
    console.error(err);
    alert("Failed to post comment. Please try again.");
  }
}

export async function handleToggleCommentLike({
  placeId,
  commentId,
  liked,
  isAuthed,
  navigate,
  setComments,
}) {
  if (!isAuthed) {
    navigate("/login");
    return;
  }

  try {
    const data = liked
      ? await unlikePlaceComment(placeId, commentId)
      : await likePlaceComment(placeId, commentId);
    setComments((prev) =>
      prev.map((c) =>
        c.id === commentId
          ? {
              ...c,
              likes_count: data.likes_count,
              liked_by_me: data.liked,
            }
          : c
      )
    );
  } catch (err) {
    console.error(err);
  }
}

export async function handleToggleMustVisit({
  placeId,
  currentValue,
  isAuthed,
  navigate,
  setPlaces,
  setSelectedPlace,
}) {
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

    setSelectedPlace((prev) =>
      prev && prev.id === placeId
        ? { ...prev, is_must_visit: data.is_must_visit }
        : prev
    );
  } catch (err) {
    console.error(err);
  }
}

export function handleCreateTrip({ isAuthed, navigate }) {
  if (!isAuthed) {
    navigate("/login");
    return;
  }
  navigate("/trip");
}

export function openTripModal({
  isAuthed,
  isTripAdvisor,
  navigate,
  setIsTripModalOpen,
}) {
  if (!isAuthed) {
    navigate("/login");
    return;
  }
  if (!isTripAdvisor) return;
  setIsTripModalOpen(true);
}

export function closeTripModal({ setIsTripModalOpen }) {
  setIsTripModalOpen(false);
}

export async function loadTripCategories({ setTripCategories }) {
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
}

export async function handleSubmitTrip({
  event,
  tripForm,
  tripCategories,
  tripUploadPreview,
  setTripSubmitting,
  setTripError,
  setTripSuccess,
  setTripForm,
  setTripUploadPreview,
}) {
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

    const durationDays = computeDurationDays(tripForm.start_date, tripForm.end_date, tripForm.duration_days);
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
    const detail = responseData?.detail || err?.userMessage || "Failed to submit trip.";
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
}

export function handleTripFileUpload(event, setTripUploadPreview) {
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
}
