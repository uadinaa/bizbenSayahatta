import { StrictMode } from "react";
import { Provider } from "react-redux";
import { createRoot } from "react-dom/client";
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import "./index.css";
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
import ErrorPage from "./pages/ErrorPage";
import RequireAuth from "./components/RequireAuth.jsx";
import { store } from "./store.js";

const router = createBrowserRouter([
  {
    path: "/",
    element: <App />,
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
      { path: "wishlist", element: <RequireAuth><Wishlist /></RequireAuth> },
      { path: "manager/advisors", element: <RequireAuth><ManagerAdvisorReview /></RequireAuth> },
      { path: "error", element: <ErrorPage /> },
      { path: "*", element: <ErrorPage /> },
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
