// src/pages/SharedMaps.jsx
import { useEffect, useState } from "react";
import { MapContainer, TileLayer, Marker } from "react-leaflet";
import api from "../api/axios";

export default function SharedMaps() {
  const [users, setUsers] = useState([]);
  const [loadingUsers, setLoadingUsers] = useState(true);
  const [selectedUser, setSelectedUser] = useState(null);
  const [mapData, setMapData] = useState(null);
  const [loadingMap, setLoadingMap] = useState(false);
  const [error, setError] = useState(null);

  // Загрузка списка пользователей с публичными мапами
  useEffect(() => {
    api.get("places/users/shared-maps/")
      .then(res => setUsers(res.data))
      .finally(() => setLoadingUsers(false));
  }, []);

  // Загрузка карты выбранного пользователя
  useEffect(() => {
    if (!selectedUser) return;
    setLoadingMap(true);
    setError(null);
    api.get(`places/users/${selectedUser.id}/map/`)
      .then(res => setMapData(res.data))
      .catch(err => {
        if (err.response?.status === 403) setError("Пользователь не делится картой");
        else if (err.response?.status === 404) setError("Пользователь не найден");
        else setError("Ошибка загрузки карты");
        setMapData(null);
      })
      .finally(() => setLoadingMap(false));
  }, [selectedUser]);

  if (loadingUsers) return <div>Загрузка пользователей...</div>;
  if (!users.length) return <div>Нет пользователей, делящихся картой</div>;

  return (
    <div style={{ display: "flex", gap: "20px" }}>
      {/* Список пользователей */}
      <div style={{ width: "250px" }}>
        <h2>Публичные мапы</h2>
        {users.map(user => (
          <div
            key={user.id}
            style={{ cursor: "pointer", marginBottom: "10px", display: "flex", alignItems: "center" }}
            onClick={() => setSelectedUser(user)}
          >
            <img src={user.avatar} alt={user.username} style={{ width: "40px", height: "40px", borderRadius: "50%", marginRight: "10px" }} />
            <span>{user.username}</span>
          </div>
        ))}
      </div>

      {/* Карта выбранного пользователя */}
      <div style={{ flex: 1 }}>
        {selectedUser && (
          <>
            <h3>{selectedUser.username} — карта</h3>
            {loadingMap && <div>Загрузка карты...</div>}
            {error && <div style={{ color: "red" }}>{error}</div>}
            {mapData && mapData.map_places.length > 0 && (
              <MapContainer
                center={[mapData.map_places[0].lat, mapData.map_places[0].lng]}
                zoom={2}
                style={{ height: "500px", width: "100%" }}
              >
                <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
                {mapData.map_places.map(place => (
                  <Marker key={place.id} position={[place.lat, place.lng]} />
                ))}
              </MapContainer>
            )}
            {mapData && mapData.map_places.length === 0 && <div>Нет точек для отображения</div>}
          </>
        )}
        {!selectedUser && <div>Выберите пользователя, чтобы посмотреть карту</div>}
      </div>
    </div>
  );
}