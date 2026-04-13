import { useLocation } from "react-router-dom";
import "../styles/Footer.css";
import footerLogoImg from "../assets/footerLogo.svg";
import { useTranslation } from "react-i18next";


export default function Footer() {
  const location = useLocation();
  const { t } = useTranslation(); 

  // если путь /chat → не рендерим футер
  if (location.pathname === "/chat") {
    return null;
  }

  if (location.pathname === "/map") {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div className="brand-top">
            <img
              src={footerLogoImg}
              alt={t("common.bizbenLogoAlt")}
              className="footer-logo-img"
            />
          </div>

          <p>{t("footer.description")}</p>
        </div>

        <div className="footer-links">
          <div>
            <a href="#">{t("footer.features")}</a>
            <a href="#">{t("footer.pricing")}</a>
            <a href="#">{t("footer.api")}</a>
          </div>

          <div>
            <a href="#">{t("footer.aboutUs")}</a>
            <a href="#">{t("footer.blog")}</a>
            <a href="#">{t("footer.careers")}</a>
            <a href="#">{t("footer.press")}</a>
          </div>

          <div>
            <a href="#">{t("footer.helpCenter")}</a>
            <a href="#">{t("footer.community")}</a>
            <a href="#">{t("footer.guides")}</a>
            <a href="#">{t("footer.partners")}</a>
          </div>

          <div>
            <a href="#">{t("footer.privacy")}</a>
            <a href="#">{t("footer.terms")}</a>
            <a href="#">{t("footer.cookies")}</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>{t("footer.rights")}</span>
        <span>{t("footer.madeWithLove")}</span>
      </div>
    </footer>
  );
}