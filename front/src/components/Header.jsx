import { useEffect } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import { fetchProfile } from "../slices/authSlice";
import "../styles/Header.css";

export default function Header() {
  const navigate = useNavigate();
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const isAuth = Boolean(localStorage.getItem("access"));

  useEffect(() => {
    if (isAuth && !user) dispatch(fetchProfile());
  }, [dispatch, isAuth, user]);

  const navigateProtected = (path) => {
    if (isAuth) return navigate(path);
    navigate("/login");
  };

  return (
    <header className="header">
      <div className="header-left">
        <Link to="/" className="home-link">
          <div className="brand-top">
            <div className="logo"><span>BS</span></div>
            <h3>Bizben<br />Sayahat</h3>
          </div>
        </Link>
      </div>

      <nav className="header-nav">
        <Link to="/inspiration" className="header-link">Inspiration</Link>
        <button type="button" className="header-link" onClick={() => navigateProtected("/wishlist")}>Wishlist</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/chat")}>Chat</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/map")}>Map</button>
        <button type="button" className="header-link" onClick={() => navigateProtected("/trip")}>Trips</button>
        {(user?.role === "MANAGER" || user?.role === "ADMIN") ? (
          <button type="button" className="header-link" onClick={() => navigateProtected("/manager/advisors")}>Manager</button>
        ) : null}
        <button className="profile-btn" onClick={() => navigateProtected("/profile")}>Profile</button>
      </nav>
    </header>
  );
}
