const API_BASE = import.meta.env.VITE_API_BASE || "http://127.0.0.1:8000";

export const fetchInspirationPlaces = async (page = 1) => {
  try {
    const response = await fetch(`${API_BASE}/api/places/inspiration/?page=${page}`);
    if (!response.ok) throw new Error("Failed to fetch places");
    const data = await response.json();
    // If API returns a raw array, wrap it in results
    return Array.isArray(data) ? { results: data, next: null, previous: null } : data;
  } catch (err) {
    console.error(err);
    return { results: [], next: null, previous: null };
  }
};
