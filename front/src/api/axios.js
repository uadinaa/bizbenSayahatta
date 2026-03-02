import axios from "axios";
import { clearClientUserData } from "../utils/sessionData";

const API_BASE =
  import.meta.env?.VITE_API_BASE || "http://127.0.0.1:8000/api/";

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

api.interceptors.request.use((config) => {
  if (isPublicAuthEndpoint(config.url || "")) {
    if (config.headers?.Authorization) {
      delete config.headers.Authorization;
    }
    return config;
  }

  const token = localStorage.getItem("access");
  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
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

      const refresh = localStorage.getItem("refresh");
      if (!refresh) {
        clearClientUserData();
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        return Promise.reject(error);
      }

      try {
        const res = await api.post("token/refresh/", { refresh });
        const newAccess = res.data?.access;
        if (newAccess) {
          localStorage.setItem("access", newAccess);
          originalRequest.headers = {
            ...(originalRequest.headers || {}),
            Authorization: `Bearer ${newAccess}`,
          };
          return api(originalRequest);
        }
      } catch (refreshError) {
        clearClientUserData();
        localStorage.removeItem("access");
        localStorage.removeItem("refresh");
        return Promise.reject(refreshError);
      }
    }

    error.userMessage = safeErrorMessage(status);

    if ((!status || status >= 500) && !window.location.pathname.startsWith("/error")) {
      const nextStatus = status || 503;
      window.location.assign(`/error?status=${nextStatus}`);
      return Promise.reject(error);
    }

    return Promise.reject(error);
  }
);

export default api;
