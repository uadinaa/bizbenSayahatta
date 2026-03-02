// Header.jsx
import { Link, useNavigate } from "react-router-dom";
import "../styles/Header.css";

export default function Header() {
  const navigate = useNavigate();

  const navigateProtected = (path) => {
    const hasToken = Boolean(localStorage.getItem("access"));
    if (hasToken) {
      navigate(path);
      return;
    }
    navigate("/login");
  };

  const handleProfileClick = () => {
    navigateProtected("/profile");
  };

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="home-link">
          <div className="brand-top">
            <div className="logo">
              <span>BS</span>
            </div>
            <h3>
              Bizben<br />
              Sayahat
            </h3>
          </div>
        </Link>
      </div>

      <nav className="header-nav">
        <Link to="/inspiration" className="header-link">Inspiration</Link>
        <button type="button" className="header-link" onClick={() => navigateProtected("/wishlist")}>Wishlist</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/chat")}>Chat</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/map")}>Map</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/trip")}>Trips</button>

        <button className="profile-btn" onClick={handleProfileClick}>
          Profile
        </button>
      </nav>
    </header>
  );
}
