import api from "./axios";

const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const fetchInspirationPlaces = async (
  page = 1,
  search = "",
  category = "all",
  options = {}
) => {
  try {
    const params = new URLSearchParams();
    params.append("page", page);

    if (search) {
      params.append("search", search);
    }

    if (category && category !== "all") {
      params.append("category", category);
    }

    if (options.budget !== undefined && options.budget !== null && options.budget !== "") {
      params.append("budget", options.budget);
    }

    if (options.open_now !== undefined && options.open_now !== null && options.open_now !== "") {
      params.append("open_now", options.open_now);
    }

    const response = await fetch(
      `${API_BASE}/api/places/inspiration/?${params.toString()}`
    );

    if (!response.ok) {
      throw new Error("Failed to fetch places");
    }

    const data = await response.json();

    // если API возвращает массив — приводим к одному формату
    return Array.isArray(data)
      ? { results: data, next: null, previous: null }
      : data;
  } catch (err) {
    console.error(err);
    return { results: [], next: null, previous: null };
  }
};

export const toggleMustVisit = async (placeId, isMustVisit) => {
  const payload =
    typeof isMustVisit === "boolean" ? { is_must_visit: isMustVisit } : {};
  const response = await api.post(`places/${placeId}/must-visit/`, payload);
  return response.data;
};
