import { useEffect, useState } from "react";
import {
  MapContainer,
  TileLayer,
  CircleMarker,
  Popup,
} from "react-leaflet";
import { getSharedMaps, getUserMap } from "../api/map";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import "../styles/SharedMaps.css";

export default function SharedMaps() {
  const { t } = useTranslation();
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
          setError(t("sharedMaps.userDoesNotShare"));
        else if (err.response?.status === 404)
          setError(t("sharedMaps.userNotFound"));
        else setError(t("sharedMaps.errorLoadingMap"));
        setMapData(null);
      })
      .finally(() => setLoadingMap(false));
  }, [selectedUser, t]);

  if (loadingUsers) return <div className="shared-maps-page">{t("sharedMaps.loadingUsers")}</div>;
  if (!users.length) return <div className="shared-maps-page">{t("sharedMaps.noUsers")}</div>;

  return (
    <div className="shared-maps-page">
      <div className="shared-maps-container">
        <header className="shared-maps-header">
          <button
            type="button"
            className="shared-maps-back"
            onClick={() => navigate("/map")}
          >
            ← {t("sharedMaps.backToMap")}
          </button>
          <h1 className="shared-maps-title">{t("sharedMaps.publicMaps")}</h1>
        </header>

        <div className="shared-maps-body">
          <aside className="users-panel">
            {users.map((user) => (
              <div
                key={user.id}
                className={`user-card ${selectedUser?.id === user.id ? "user-card--active" : ""}`}
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
          </aside>

          <div className="map-panel">
            {selectedUser && (
              <>
                <h2 className="map-panel__heading">
                  {selectedUser.username} — {t("sharedMaps.map")}
                </h2>

                {loadingMap && <div className="map-panel__status">{t("sharedMaps.loadingMap")}</div>}
                {error && <div className="error-text">{error}</div>}

                {mapData && mapData.map_places.length > 0 && (
                  <MapContainer
                    center={[
                      mapData.map_places[0].lat,
                      mapData.map_places[0].lon,
                    ]}
                    zoom={2}
                    className="shared-maps-leaflet"
                    style={{ height: "500px", width: "100%" }}
                  >
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
                      attribution="&copy; OpenStreetMap &copy; CARTO"
                    />
                    <TileLayer
                      url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
                      attribution="&copy; OpenStreetMap &copy; CARTO"
                    />

                    {mapData.map_places.map((place) => (
                      <CircleMarker
                        key={place.id}
                        center={[place.lat, place.lon]}
                        radius={5}
                        color="#1e88e5"
                      >
                        <Popup>
                          {place.city && place.country && (
                            <>
                              {place.city}, {place.country}
                              <br />
                            </>
                          )}
                          {place.date && <>{place.date}</>}
                        </Popup>
                      </CircleMarker>
                    ))}
                  </MapContainer>
                )}

                {mapData && mapData.map_places.length === 0 && (
                  <div className="map-panel__empty">{t("sharedMaps.noPlaces")}</div>
                )}
              </>
            )}

            {!selectedUser && (
              <div className="placeholder-text">
                {t("sharedMaps.selectUser")}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
