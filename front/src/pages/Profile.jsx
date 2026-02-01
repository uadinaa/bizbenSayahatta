import { useEffect } from "react";
import { useDispatch, useSelector } from "react-redux";
import { useNavigate } from "react-router-dom";
import { logoutUser, fetchProfile } from "../slices/authSlice";

export default function Profile() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user, loading } = useSelector((state) => state.auth);

  useEffect(() => {
    dispatch(fetchProfile());
  }, [dispatch]);

  const handleLogout = async () => {
    dispatch(logoutUser());
    navigate("/login");
  };

  if (loading) return <p>Loading...</p>;
  if (!user) return <p>No user</p>;

  return (
    <div className="profile-container">
      <h2>Profile</h2>

      {user.avatar && (
        <img
          src={`http://127.0.0.1:8000${user.avatar}`}
          alt="profile"
          width={120}
        />
      )}

      <p>Email: {user.email}</p>

      <button onClick={handleLogout}>Logout</button>
    </div>
  );
}
