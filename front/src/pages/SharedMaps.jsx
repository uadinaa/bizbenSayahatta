import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import { getSharedMaps, getUserMap } from "../api/map";
import { useNavigate } from "react-router-dom";
import "../styles/SharedMaps.css";

export default function SharedMaps() {
  const navigate = useNavigate();

  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState(null);

  useEffect(() => {
    getSharedMaps()
      .then((data) => setUsers(data))
      .finally(() => setLoadingUsers(false));
  }, []);

  useEffect(() => {
    if (!selectedUser) return;
    setLoadingMap(true);
    setError(null);

    getUserMap(selectedUser.id)
      .then((data) => setMapData(data))
      .catch((err) => {
        if (err.response?.status === 403)
          setError("The user does not share the map");
        else if (err.response?.status === 404)
          setError("The user was not found");
        else setError("Error loading the map");
        setMapData(null);
      })
      .finally(() => setLoadingMap(false));
  }, [selectedUser]);

  if (loadingUsers) return <div>Loading users...</div>;
  if (!users.length) return <div>No users sharing maps</div>;

  return (
    <div className="shared-maps-container">
      {/* Back button */}
      <div className="back-button" onClick={() => navigate("/map")}>
        ← Back to map
      </div>

      {/* Users list */}
      <div className="users-panel">
        <h2>Public Maps</h2>
        {users.map((user) => (
          <div
            key={user.id}
            className="user-card"
            onClick={() => setSelectedUser(user)}
          >
            <img
              src={user.avatar}
              alt={user.username}
              className="user-avatar"
            />
            <span>{user.username}</span>
          </div>
        ))}
      </div>

      {/* Map section */}
      <div className="map-panel">
        {selectedUser && (
          <>
            <h3>{selectedUser.username} — map</h3>

            {loadingMap && <div>Loading the map...</div>}
            {error && <div className="error-text">{error}</div>}

            {mapData && mapData.map_places.length > 0 && (
              <MapContainer
  center={[
    mapData.map_places[0].lat,
    mapData.map_places[0].lon,
  ]}
  zoom={2}
  style={{ height: "500px", width: "100%" }}
>
  {/* ОСНОВНАЯ КАРТА */}
  <TileLayer
    url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
    attribution="&copy; OpenStreetMap &copy; CARTO"
  />

  {/* ЛЕЙБЛЫ ПОВЕРХ */}
  <TileLayer
    url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
    attribution="&copy; OpenStreetMap &copy; CARTO"
  />

  {mapData.map_places.map((place) => (
    <Marker
      key={place.id}
      position={[place.lat, place.lon]}
    />
  ))}
</MapContainer>
            )}

            {mapData && mapData.map_places.length === 0 && (
              <div>No places to display</div>
            )}
          </>
        )}

        {!selectedUser && (
          <div className="placeholder-text">
            Select a user to view their map
          </div>
        )}
      </div>
    </div>
  );
}
