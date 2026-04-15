import api from "./axios";

const API_BASE_RAW = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000/api";
const API_BASE = API_BASE_RAW.replace(/\/+$/, "");
const API_PREFIX = API_BASE.endsWith("/api") ? API_BASE : `${API_BASE}/api`;

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
      // Also send as explicit city hint for TripAdvisor tour fetching
      params.append("city", search);
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

    // Use authenticated api instance to include auth headers
    const response = await api.get(`places/inspiration/?${params.toString()}`);

    const data = response.data;

    // Handle new format with places and tours
    if (data && typeof data === "object") {
      return {
        places: data.places || [],
        tours: data.tours || [],
        events: data.events || [],
        next: data.next || null,
        previous: data.previous || null,
      };
    }

    // Fallback for old array format
    return Array.isArray(data)
      ? { places: data, tours: [], events: [], next: null, previous: null }
      : { places: [], tours: [], events: [], next: null, previous: null };
  } catch (err) {
    console.error(err);
    return { places: [], tours: [], events: [], next: null, previous: null };
  }
};

    // если API возвращает массив — приводим к одному формату
//     return Array.isArray(data)
//       ? { results: data, next: null, previous: null }
//       : data;
//   } catch (err) {
//     console.error(err);
//     return { results: [], next: null, previous: null };
//   }
// };

export const toggleMustVisit = async (placeId, isMustVisit) => {
  const payload =
    typeof isMustVisit === "boolean" ? { is_must_visit: isMustVisit } : {};
  const response = await api.post(`places/${placeId}/must-visit/`, payload);
  return response.data;
};

export const toggleExternalMustVisit = async (payload) => {
  const response = await api.post("places/external/must-visit/", payload);
  return response.data;
};


export const fetchMapPlaces = async () => {
  const response = await api.get("places/map-places/");
  return response.data;
};

export const createMapPlace = async (payload) => {
  const response = await api.post("places/map-places/", payload);
  return response.data;
};

export const updateMapPlace = async (placeId, payload) => {
  const response = await api.patch(`places/map-places/${placeId}/`, payload);
  return response.data;
};

export const deleteMapPlace = async (placeId) => {
  await api.delete(`places/map-places/${placeId}/`);
};

export const markPlaceAsVisited = async (placeId) => {
  const response = await api.post(
    `${placeId}/visited/`,
    {}
  );
  return response.data;
};


