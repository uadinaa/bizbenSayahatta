import { Link, useNavigate } from "react-router-dom";
import "../styles/Header.css";

export default function Header({ isAuth }) {
  const navigate = useNavigate();

  const handleProfileClick = () => {
    if (!isAuth) {
      navigate("/login");
    } else {
      navigate("/profile");
    }
  };

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="home-link">
          <h1 className="header-title">BS BizbenSayahat</h1>
        </Link>
      </div>

      <nav className="header-nav">
        <Link to="/inspiration" className="header-link">Inspiration</Link>
        <Link to="/wishlist" className="header-link">Wishlist</Link>
        <Link to="/chat" className="header-link">Chat</Link>
        <Link to="/planner-test" className="header-link">Map</Link>
        <Link to="/trip" className="header-link">Trip</Link>

        <button className="profile-btn" onClick={handleProfileClick}>
          Profile
        </button>
      </nav>
    </header>
  );
}
