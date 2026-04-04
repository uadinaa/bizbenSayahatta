import axios from "axios";
import {
  clearClientUserData,
  clearStoredTokens,
  getStoredRefreshToken,
  getValidAccessToken,
} from "../utils/sessionData";

const RAW_API_BASE =
  import.meta.env?.VITE_API_BASE || "http://127.0.0.1:8000/api/";
const NORMALIZED_BASE = RAW_API_BASE.replace(/\/+$/, "");
const API_BASE = NORMALIZED_BASE.endsWith("/api")
  ? `${NORMALIZED_BASE}/`
  : `${NORMALIZED_BASE}/api/`;

const api = axios.create({
  baseURL: API_BASE,
  withCredentials: true,
});

const PUBLIC_AUTH_PATHS = [
  "users/signup/",
  "users/login/",
  "token/",
  "token/refresh/",
];

function isPublicAuthEndpoint(url = "") {
  return PUBLIC_AUTH_PATHS.some((path) => url.includes(path));
}

function safeErrorMessage(status) {
  if (!status) return "Network error. Please check your connection.";
  if (status === 400) return "Invalid request. Please check your input.";
  if (status === 401) return "Your session expired. Please log in again.";
  if (status === 403) return "You do not have permission to perform this action.";
  if (status === 404) return "Requested resource was not found.";
  if (status === 429) return "Too many requests. Please try again shortly.";
  if (status >= 500) return "Server is temporarily unavailable. Please try again later.";
  return "Request failed. Please try again.";
}

let refreshRequest = null;

async function refreshAccessToken() {
  const refresh = getStoredRefreshToken();
  if (!refresh) {
    throw new Error("Missing refresh token");
  }

  if (!refreshRequest) {
    refreshRequest = api
      .post("token/refresh/", { refresh })
      .then((res) => {
        const newAccess = res.data?.access;
        if (!newAccess) {
          throw new Error("Refresh response did not include access token");
        }
        localStorage.setItem("access", newAccess);
        return newAccess;
      })
      .catch((error) => {
        clearClientUserData();
        clearStoredTokens();
        throw error;
      })
      .finally(() => {
        refreshRequest = null;
      });
  }

  return refreshRequest;
}

api.interceptors.request.use(async (config) => {
  if (isPublicAuthEndpoint(config.url || "")) {
    if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  }

  const validAccessToken = getValidAccessToken();
  if (validAccessToken) {
    config.headers.Authorization = `Bearer ${validAccessToken}`;
    return config;
  }

  if (!getStoredRefreshToken()) {
    clearClientUserData();
    clearStoredTokens();
    return config;
  }

  try {
    const refreshedAccessToken = await refreshAccessToken();
    config.headers.Authorization = `Bearer ${refreshedAccessToken}`;
  } catch (refreshError) {
    return Promise.reject(refreshError);
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const status = error.response?.status;
    const originalRequest = error.config;

    if (
      status === 401 &&
      !originalRequest?._retry &&
      !isPublicAuthEndpoint(originalRequest?.url)
    ) {
      originalRequest._retry = true;

      if (!getStoredRefreshToken()) {
        clearClientUserData();
        clearStoredTokens();
        return Promise.reject(error);
      }

      try {
        const newAccess = await refreshAccessToken();
        originalRequest.headers = {
          ...(originalRequest.headers || {}),
          Authorization: `Bearer ${newAccess}`,
        };
        return api(originalRequest);
      } catch (refreshError) {
        return Promise.reject(refreshError);
      }
    }

    error.userMessage = safeErrorMessage(status);

    // Let feature code (e.g. TripAdvisor checkout) surface errors in the UI instead of a full-page redirect.
    const url = originalRequest?.url || "";
    const skipGlobalErrorPage =
      url.includes("payments/") ||
      url.includes("marketplace/advisor/apply/");

    if (
      (!status || status >= 500) &&
      !skipGlobalErrorPage &&
      !window.location.pathname.startsWith("/error")
    ) {
      const nextStatus = status || 503;
      window.location.assign(`/error?status=${nextStatus}`);
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
