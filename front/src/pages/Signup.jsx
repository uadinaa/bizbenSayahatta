import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { signUpUser, loginUser } from "../slices/authSlice";
import { clearClientUserData } from "../utils/sessionData";
import "../styles/Login.css"; // используем тот же файл стилей

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

    const fieldErrors = Object.entries(error)
      .map(([field, value]) => {
        if (typeof value === "string") return `${field}: ${value}`;
        if (Array.isArray(value)) return `${field}: ${value.join(", ")}`;
        return "";
      })
      .filter(Boolean);

    if (fieldErrors.length > 0) return fieldErrors.join(" ");
  }

  return "Signup failed";
}

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { loading, error } = useSelector((state) => state.auth);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [repeatPassword, setRepeatPassword] = useState("");
  const [activeTab, setActiveTab] = useState("signup"); // для вкладок

  const handleSignup = async (e) => {
    e.preventDefault();
    if (password !== repeatPassword) return;

    clearClientUserData();
    localStorage.removeItem("access");
    localStorage.removeItem("refresh");

    const res = await dispatch(
      signUpUser({ email, password, password2: repeatPassword })
    );

    if (res.meta.requestStatus === "fulfilled") {
      const loginRes = await dispatch(loginUser({ email, password }));
      if (loginRes.meta.requestStatus === "fulfilled") {
        navigate("/profile");
      }
    }
  };

  return (
    <div className="login-page">
      <form className="login-form" onSubmit={handleSignup}>
        <h2>Let the journey begin!</h2>

        {/* Вкладки Login / Sign Up */}
        <div className="tabs-wrapper">
          <div className="tabs">
            <button
              type="button"
              className={activeTab === "login" ? "tab active" : "tab"}
              onClick={() => navigate("/login")}
            >
              Login
            </button>
            <button
              type="button"
              className={activeTab === "signup" ? "tab active" : "tab"}
              onClick={() => setActiveTab("signup")}
            >
              Sign Up
            </button>
          </div>
        </div>

        {error && <p className="error">{formatAuthError(error)}</p>}
        {loading && <p className="loading">Signing up...</p>}

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
        <input
          type="password"
          placeholder="repeat password"
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          required
        />

        <button type="submit" className="login-btn" disabled={loading}>
          Sign up
        </button>

      </form>
    </div>
  );
}
