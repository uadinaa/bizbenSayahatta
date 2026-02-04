import { StrictMode } from "react";
import { Provider } from "react-redux";
import { createRoot } from 'react-dom/client'
import { createBrowserRouter, RouterProvider } from "react-router-dom";
import './index.css'
import App from './App.jsx'
import Signup from './pages/Signup';
import Login from './pages/Login';
import Profile from './pages/Profile';
import Inspiration from './pages/Inspiration';
import { store } from "./store.js";

const router = createBrowserRouter([
  {path: "/", element: <App />},
  {path: "/signup", element: <Signup />},
  {path: "/login", element: <Login />},
  {path: "/profile", element: <Profile />},
  {path: "/inspiration", element: <Inspiration />},

])

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <Provider store={store}>
      <RouterProvider router={router} />
    </Provider>
  </StrictMode>
)
