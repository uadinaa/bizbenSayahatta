import { StrictMode, useEffect } from "react";
import { Provider, useDispatch, useSelector } from "react-redux";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
import "./i18n";
import App from "./App.jsx";
import HomePage from "./pages/Home";
import Signup from "./pages/Signup";
import Login from "./pages/Login";
import Profile from "./pages/Profile";
import Inspiration from "./pages/Inspiration";
import PlannerTest from "./pages/PlannerTest";
import Trip from "./pages/Trips";
import Map from "./pages/Map";
import Wishlist from "./pages/Wishlist";
import ManagerAdvisorReview from "./pages/ManagerAdvisorReview";
import TripStatus from "./pages/TripStatus";
import SharedMaps from "./pages/SharedMaps";
import PublicTravelMap from "./pages/PublicTravelMap";
import ErrorPage from "./pages/ErrorPage";
import RequireAuth from "./components/RequireAuth.jsx";
import { store } from "./store.js";
import { fetchProfile } from "./slices/authSlice.jsx";
import { getStoredAccessToken } from "./utils/sessionData.js";
import { SpeedInsights } from "@vercel/speed-insights/react"

// AuthInitializer component to verify token and fetch user on app load
function AuthInitializer({ children }) {
  const dispatch = useDispatch();
  const { isAuthenticated, token, user } = useSelector((state) => state.auth);
  const storedToken = getStoredAccessToken();
  const hasSession = Boolean(token || storedToken || isAuthenticated);

  useEffect(() => {
    if (hasSession && !user) {
      dispatch(fetchProfile())
        .unwrap()
        .catch((err) => {
          console.error("Failed to fetch profile:", err);
        });
    }
  }, [dispatch, hasSession, user]);

  return children;
}

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <AuthInitializer>
        <App />
      </AuthInitializer>
    ),
    errorElement: <ErrorPage />,
    children: [
      { index: true, element: <HomePage /> },
      { path: "signup", element: <Signup /> },
      { path: "login", element: <Login /> },
      { path: "profile", element: <RequireAuth><Profile /></RequireAuth> },
      { path: "inspiration", element: <Inspiration /> },
      { path: "planner-test", element: <RequireAuth><PlannerTest /></RequireAuth> },
      { path: "trip", element: <RequireAuth><Trip /></RequireAuth> },
      { path: "chat", element: <RequireAuth><PlannerTest /></RequireAuth> },
      { path: "map", element: <RequireAuth><Map /></RequireAuth> },
      { path: "shared-maps", element: <SharedMaps /> },
      { path: "map/u/:userId", element: <PublicTravelMap /> },
      { path: "wishlist", element: <RequireAuth><Wishlist /></RequireAuth> },
      { path: "manager/advisors", element: <RequireAuth><ManagerAdvisorReview /></RequireAuth> },
      { path: "error", element: <ErrorPage />,},
      { path: "*", element: <ErrorPage /> },
      { path: "tripstatus", element: <TripStatus />,}
    ],
  },
]);

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>
);
