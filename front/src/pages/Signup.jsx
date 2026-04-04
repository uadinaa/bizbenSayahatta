import { useState } from "react";
import { useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { signUpUser, loginUser } from "../slices/authSlice";
import { clearClientUserData } from "../utils/sessionData";
import "../styles/Login.css"; 
import { formatAuthError } from "../utils/formatAuthError";

export default function Signup() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { t } = useTranslation();
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
      signUpUser({ email, username: "", password, password2: repeatPassword })
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
        <h2>{t("auth.title")}</h2>

        {/* Вкладки Login / Sign Up */}
        <div className="tabs-wrapper">
          <div className="tabs">
            <button
              type="button"
              className={activeTab === "login" ? "tab active" : "tab"}
              onClick={() => navigate("/login")}
            >
              {t("auth.login")}
            </button>
            <button
              type="button"
              className={activeTab === "signup" ? "tab active" : "tab"}
              onClick={() => setActiveTab("signup")}
            >
              {t("auth.signup")}
            </button>
          </div>
        </div>

        {error && <p className="error">{formatAuthError(error)}</p>}
        {loading && <p className="loading">{t("auth.signingUp")}</p>}

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
        <input
          type="password"
          placeholder={t("auth.repeatPassword")}
          value={repeatPassword}
          onChange={(e) => setRepeatPassword(e.target.value)}
          required
        />

        <button type="submit" className="login-btn" disabled={loading}>
          {t("auth.signUpCta")}
        </button>
        
      </form>
    </div>
  );
}
