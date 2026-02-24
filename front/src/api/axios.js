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

    // Only attempt refresh for protected requests that failed with 401
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

    return Promise.reject(error);
  }
);

export default api;
