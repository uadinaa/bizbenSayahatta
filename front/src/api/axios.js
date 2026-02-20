import axios from "axios";

const api = axios.create({
  baseURL: "http://127.0.0.1:8000/api/", 
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

export default api;
