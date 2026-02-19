import "../styles/Map.css";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  MapContainer,
  TileLayer,
  Popup,
  CircleMarker,
  GeoJSON,
} from "react-leaflet";

export default function Map() {
  const navigate = useNavigate();
  const isAuthed = Boolean(localStorage.getItem("access"));

  const [places, setPlaces] = useState(() => {
    const saved = localStorage.getItem("travelPlaces");
    return saved ? JSON.parse(saved) : [];
  });

  const [countriesData, setCountriesData] = useState(null);
  const [isModalOpen, setIsModalOpen] = useState(false);

  const [newPlace, setNewPlace] = useState({
    city: "",
    country: "",
    date: "",
  });

  // ================= LOCAL STORAGE =================
  useEffect(() => {
    localStorage.setItem("travelPlaces", JSON.stringify(places));
  }, [places]);

  // ================= LOAD GEOJSON =================
  useEffect(() => {
    fetch("/data/countries.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCountriesData(data))
      .catch((err) => console.error("GeoJSON load error:", err));
  }, []);

  // ================= СТАТИСТИКА И УРОВНИ =================
  const [countriesCount, setCountriesCount] = useState(0);
  const [citiesCount, setCitiesCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState({
    name: "Pathfinder",
    current: 0,
    needed: 5,
    index: 0
  });

  // Уровни для бейджей
  const levelsList = [
    { name: "Pathfinder", min: 0, next: 5 },
    { name: "Explorer", min: 5, next: 10 },
    { name: "Adventurer", min: 10, next: 20 },
    { name: "Voyager", min: 20, next: 35 },
    { name: "Globetrotter", min: 35, next: 50 },
    { name: "Legendary Nomad", min: 50, next: null }
  ];

  useEffect(() => {
    const uniqueCountries = new Set(places.map(p => p.country));
    setCountriesCount(uniqueCountries.size);

    const uniqueCities = new Set(places.map(p => p.city.toLowerCase()));
    setCitiesCount(uniqueCities.size);

    const worldCities = 1000;
    setProgress(Math.min(100, (places.length / worldCities) * 100).toFixed(1));

    let currentLevel = levelsList[0];
    let currentIndex = 0;

    for (let i = 0; i < levelsList.length; i++) {
      if (places.length >= levelsList[i].min) {
        currentLevel = levelsList[i];
        currentIndex = i;
      }
    }

    if (currentLevel.next) {
      setLevel({
        name: currentLevel.name,
        current: places.length - currentLevel.min,
        needed: currentLevel.next - currentLevel.min,
        index: currentIndex
      });
    } else {
      setLevel({
        name: currentLevel.name,
        current: "MAX",
        needed: "",
        index: currentIndex
      });
    }

  }, [places]);

  // Доступные бейджи (для горизонтального скролла)
  const visibleBadges = levelsList.filter(
    lvl => places.length >= lvl.min
  );

  // ================= INPUT =================
  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPlace((prev) => ({ ...prev, [name]: value }));
  };

  // ================= ADD PLACE =================
  const addPlace = async (e) => {
    e.preventDefault();

    if (!isAuthed) {
      navigate("/login");
      return;
    }

    if (!newPlace.city || !newPlace.country || !newPlace.date) return;

    try {
      const response = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${newPlace.city},${newPlace.country}`
      );
      const data = await response.json();

      if (!data.length) {
        alert("City not found");
        return;
      }

      const lat = parseFloat(data[0].lat);
      const lon = parseFloat(data[0].lon);

      setPlaces((prev) => [
        ...prev,
        { ...newPlace, lat, lon },
      ]);

      setNewPlace({ city: "", country: "", date: "" });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error fetching location");
    }
  };

  // ================= DELETE PLACE =================
  const deletePlace = (index) => {
    setPlaces((prev) => prev.filter((_, i) => i !== index));
  };

  // ================= MODAL =================
  const openAddModal = () => {
    if (!isAuthed) {
      navigate("/login");
      return;
    }
    setIsModalOpen(true);
  };

  const closeModal = () => {
    setIsModalOpen(false);
  };

  // ================= COUNTRY COLOR =================
  const visitedCountries = places.map((p) =>
    p.country.toLowerCase().trim()
  );

  const countryStyle = (feature) => {
    const name = String(
      feature.properties?.name || feature.properties?.ADMIN || ""
    )
      .toLowerCase()
      .trim();

    const isVisited = visitedCountries.includes(name);

    return {
      fillColor: isVisited ? "#FDD835" : "#E0E0E0",
      weight: 1,
      color: "#FFF",
      fillOpacity: 0.8,
    };
  };

  return (
    <div className="map-page">
      {/* ================= SIDEBAR ================= */}
      <aside className="map-sidebar">
        <div className="sidebar-top">
  <div className="sidebar-progress-line"></div>
  <h3 className="sidebar-title">Traveler Level</h3>

  {/* Горизонтальные бейджи */}
  <div className="badge-scroll">
    {visibleBadges.map((lvl, i) => {
      const isCurrent = lvl.name === level.name;
      const progressPercent = lvl.next
        ? ((places.length - lvl.min) / (lvl.next - lvl.min)) * 100
        : 100;

      return (
        <div
          key={i}
          className={`badge-card ${isCurrent ? "current" : "completed"}`}
        >
          <div className="badge-icon">🧭</div>
          <strong>{lvl.name}</strong>
          {lvl.next ? (
            <div className="mini-progress">
              <div
                className="mini-bar"
                style={{ width: `${Math.min(progressPercent, 100)}%` }}
              ></div>
            </div>
          ) : (
            <span className="max-label">MAX</span>
          )}
        </div>
      );
    })}
  </div>

  {/* Level dots */}
  <div className="level-dots">
    {[...Array(levelsList.length)].map((_, i) => (
      <div key={i} className={`level-dot ${i <= level.index ? "active" : ""}`}>
        {i + 1}
      </div>
    ))}
  </div>

  {/* Статистика */}
  <section className="stats">
    <h4>Your Statistics</h4>
    <div className="stats-row">
      <div className="stat-card">🌍 <strong>{countriesCount}</strong> <span>Countries</span></div>
      <div className="stat-card">📍 <strong>{citiesCount}</strong> <span>Cities</span></div>
    </div>
    <div className="world-progress">{progress}% of the world explored</div>
  </section>
</div>

{/* Список посещённых городов */}
<div className="visited-scroll">
  <div className="visited-header">
    <h4>Visited Places</h4>
    <button className="add-btn" onClick={openAddModal}>+ Add</button>
  </div>
  <div className="visited-list">
    {places.map((p, i) => (
      <div className="place" key={i}>
        <div className="place-info">
          <strong>{p.city}</strong>
          <span>{p.country}</span>
          <span className="date">{p.date}</span>
        </div>
        <button className="delete-btn" onClick={() => deletePlace(i)}>✕</button>
      </div>
    ))}
  </div>
</div>

      </aside>

      {/* ================= MAP ================= */}
      <main className="map-area">
        <MapContainer
          center={[20, 0]}
          zoom={2}
          style={{ height: "100%", width: "100%" }}
        >
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution="&copy; Stadia Maps"
          />

          {countriesData && (
            <GeoJSON
              data={countriesData}
              style={countryStyle}
            />
          )}

          {places.map(
            (place, i) =>
              place.lat &&
              place.lon && (
                <CircleMarker
                  key={i}
                  center={[place.lat, place.lon]}
                  radius={5}
                  color="#1e88e5"
                >
                  <Popup>
                    {place.city}, {place.country}
                    <br />
                    {place.date}
                  </Popup>
                </CircleMarker>
              )
          )}
        </MapContainer>

        <button className="add-place-btn" onClick={openAddModal}>
          + Add Place
        </button>
      </main>

      {/* ================= MODAL ================= */}
      {isModalOpen && (
        <div className="modal-overlay" onClick={closeModal}>
          <div
            className="modal"
            onClick={(e) => e.stopPropagation()}
          >
            <h3>Add New Place</h3>

            <input
              type="text"
              name="city"
              placeholder="City"
              value={newPlace.city}
              onChange={handleInputChange}
            />

            <input
              type="text"
              name="country"
              placeholder="Country"
              value={newPlace.country}
              onChange={handleInputChange}
            />

            <input
              type="month"
              name="date"
              value={newPlace.date}
              onChange={handleInputChange}
            />

            <div className="modal-actions">
              <button onClick={addPlace}>Add</button>
              <button onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}