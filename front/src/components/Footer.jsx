import { useLocation } from "react-router-dom";
import "../styles/Footer.css";
import footerLogoImg from "../assets/footerLogo.svg";

export default function Footer() {
  const location = useLocation();

  // если путь /chat → не рендерим футер
  if (location.pathname === "/chat") {
    return null;
  }

  return (
    <footer className="footer">
      <div className="footer-container">
        <div className="footer-brand">
          <div className="brand-top">
            <img
              src={footerLogoImg}
              alt="Bizben Sayahat logo"
              className="footer-logo-img"
            />
          </div>

          <p>
            Intelligent travel planning
            <br />
            platform with AI-powered
            <br />
            assistant.
          </p>
        </div>

        <div className="footer-links">
          <div>
            <a href="#">Features</a>
            <a href="#">Pricing</a>
            <a href="#">API</a>
          </div>

          <div>
            <a href="#">About Us</a>
            <a href="#">Blog</a>
            <a href="#">Careers</a>
            <a href="#">Press</a>
          </div>

          <div>
            <a href="#">Help Center</a>
            <a href="#">Community</a>
            <a href="#">Guides</a>
            <a href="#">Partners</a>
          </div>

          <div>
            <a href="#">Privacy</a>
            <a href="#">Terms</a>
            <a href="#">Cookies</a>
          </div>
        </div>
      </div>

      <div className="footer-bottom">
        <span>All rights reserved</span>
        <span>Made with love</span>
      </div>
    </footer>
  );
}