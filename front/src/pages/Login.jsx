import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { loginUser } from "../slices/authSlice";
import "../styles/Login.css";
import { formatAuthError } from "../utils/formatAuthError";

export default function Login() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
        <h2>{t("auth.title")}</h2>

        <div className="tabs-wrapper">
          <div className="tabs">
            <button
              type="button"
              className={activeTab === "login" ? "tab active" : "tab"}
              onClick={() => setActiveTab("login")}
            >
              {t("auth.login")}
            </button>
            <button
              type="button"
              className={activeTab === "signup" ? "tab active" : "tab"}
              onClick={() => navigate("/signup")}
            >
              {t("auth.signup")}
            </button>
          </div>
        </div>

        {error && <p className="error">{formatAuthError(error)}</p>}

        {loading && <p className="loading">{t("auth.loggingIn")}</p>}

        <input
          type="email"
          placeholder="your@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          required
        />

        <input
          type="password"
          placeholder={t("auth.password")}
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          required
        />

        <a href="#" className="forgot-password">{t("auth.forgotPassword")}</a>

        <button type="submit" className="login-btn" disabled={loading}>
          {t("auth.login")}
        </button>

      </form>
    </div>
  );
}
