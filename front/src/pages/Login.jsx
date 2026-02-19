import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { loginUser } from "../slices/authSlice";
import "../styles/Login.css";

function formatAuthError(error) {
  if (!error) return "";
  if (typeof error === "string") return error;

  if (Array.isArray(error)) {
    return error.map(formatAuthError).filter(Boolean).join(" ");
  }

  if (typeof error === "object") {
    if (typeof error.detail === "string") return error.detail;

    if (Array.isArray(error.messages)) {
      return error.messages
        .map((msg) => {
          if (typeof msg === "string") return msg;
          if (msg && typeof msg === "object") {
            return msg.message || msg.detail || Object.values(msg).join(" ");
          }
          return "";
        })
        .filter(Boolean)
        .join(" ");
    }

    const fieldErrors = Object.values(error)
      .map((value) => {
        if (typeof value === "string") return value;
        if (Array.isArray(value)) return value.join(", ");
        return "";
      })
      .filter(Boolean);

    if (fieldErrors.length > 0) return fieldErrors.join(" ");
  }

  return "Login failed";
}

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [activeTab, setActiveTab] = useState("login");

  const handleLogin = async (e) => {
    e.preventDefault();
    const res = await dispatch(loginUser({ email, password }));
    if (res.meta.requestStatus === "fulfilled") {
      navigate("/profile");
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleLogin}>
        <h2>Let the journey begin!</h2>

        <div className="tabs-wrapper">
          <div className="tabs">
            <button
              type="button"
              className={activeTab === "login" ? "tab active" : "tab"}
              onClick={() => setActiveTab("login")}
            >
              Login
            </button>
            <button
              type="button"
              className={activeTab === "signup" ? "tab active" : "tab"}
              onClick={() => navigate("/signup")}
            >
              Sign Up
            </button>
          </div>
        </div>

        {error && <p className="error">{formatAuthError(error)}</p>}

        {loading && <p className="loading">Logging in...</p>}

        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <a href="#" className="forgot-password">Forgot password?</a>

        <button type="submit" className="login-btn" disabled={loading}>
          Login
        </button>

        {activeTab === "signup" && (
          <p className="signup-text">
            Already have an account? <Link to="/login">Login</Link>
          </p>
        )}
      </form>
    </div>
  );
}
