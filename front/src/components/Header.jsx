import { useEffect, useRef, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { useTranslation } from "react-i18next";
import { fetchProfile } from "../slices/authSlice";
import { getStoredAccessToken } from "../utils/sessionData";
import logoImg from "../assets/logo.svg";
import "../styles/Header.css";

const LANGUAGE_OPTIONS = ["en", "ru", "kz"];

export default function Header() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { t, i18n } = useTranslation();
  const { user, token, isAuthenticated } = useSelector((state) => state.auth);
  const isAuth = Boolean(token || getStoredAccessToken() || isAuthenticated);
  const [isLanguageMenuOpen, setIsLanguageMenuOpen] = useState(false);
  const languageRef = useRef(null);

  useEffect(() => {
    if (isAuth && !user) dispatch(fetchProfile());
  }, [dispatch, isAuth, user]);

  useEffect(() => {
    const handleClickOutside = (event) => {
      if (!languageRef.current?.contains(event.target)) {
        setIsLanguageMenuOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const navigateProtected = (path) => {
    if (isAuth) return navigate(path);
    navigate("/login");
  };

  const currentLanguage = LANGUAGE_OPTIONS.includes(i18n.language)
    ? i18n.language
    : "en";
  const otherLanguages = LANGUAGE_OPTIONS.filter((language) => language !== currentLanguage);

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="home-link">
          <div className="brand-top">
            <img src={logoImg} alt={t("common.bizbenLogoAlt")} className="logo-img" />
          </div>
        </Link>
      </div>

      <nav className="header-nav">
        <Link to="/inspiration" className="header-link">{t("header.inspiration")}</Link>
        <button type="button" className="header-link" onClick={() => navigateProtected("/wishlist")}>{t("header.wishlist")}</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/chat")}>{t("header.chat")}</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/map")}>{t("header.map")}</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/trip")}>{t("header.trips")}</button>
        {(user?.role === "MANAGER" || user?.role === "ADMIN") ? (
          <button type="button" className="header-link" onClick={() => navigateProtected("/manager/advisors")}>{t("header.manager")}</button>
        ) : null}
        {user?.role === "TRIPADVISOR" && (
          <button type="button" className="header-link" onClick={() => navigateProtected("/tripstatus")}>{t("TripAdvisor")}</button>
        ) }

        <button className="profile-btn" onClick={() => navigateProtected("/profile")}>{t("header.profile")}</button>

        <div className="language-switcher" ref={languageRef}>
          <button
            type="button"
            className="language-trigger"
            onClick={() => setIsLanguageMenuOpen((prev) => !prev)}
            aria-haspopup="menu"
            aria-expanded={isLanguageMenuOpen}
          >
            {t(`language.${currentLanguage}`)}
            <span className={`language-caret ${isLanguageMenuOpen ? "open" : ""}`}>▾</span>
          </button>

          {isLanguageMenuOpen ? (
            <div className="language-menu" role="menu">
              {otherLanguages.map((language) => (
                <button
                  key={language}
                  type="button"
                  className="language-option"
                  onClick={() => {
                    i18n.changeLanguage(language);
                    setIsLanguageMenuOpen(false);
                  }}
                >
                  {t(`language.${language}`)}
                </button>
              ))}
            </div>
          ) : null}

        </div>
      </nav>
    </header>
  );
}
