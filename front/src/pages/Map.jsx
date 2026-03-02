import "../styles/Map.css";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Popup, CircleMarker, GeoJSON, Pane } from "react-leaflet";
import { createMapPlace, deleteMapPlace, fetchMapPlaces } from "../api/places";

export default function Map() {
  const navigate = useNavigate();
  const now = new Date();
  const currentYear = now.getFullYear();
  const currentMonth = String(now.getMonth() + 1).padStart(2, "0");

  const monthOptions = [
    { value: "01", label: "January" },
    { value: "02", label: "February" },
    { value: "03", label: "March" },
    { value: "04", label: "April" },
    { value: "05", label: "May" },
    { value: "06", label: "June" },
    { value: "07", label: "July" },
    { value: "08", label: "August" },
    { value: "09", label: "September" },
    { value: "10", label: "October" },
    { value: "11", label: "November" },
    { value: "12", label: "December" },
  ];

  const yearOptions = Array.from({ length: 81 }, (_, i) => String(currentYear - i));

  const [places, setPlaces] = useState([]);
  const [countriesData, setCountriesData] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlace, setNewPlace] = useState({
    city: "",
    country: "",
    month: currentMonth,
    year: String(currentYear),
  });

  const levelsList = [
    { name: "Pathfinder", min: 0, next: 5 },
    { name: "Explorer", min: 5, next: 10 },
    { name: "Adventurer", min: 10, next: 20 },
    { name: "Voyager", min: 20, next: 35 },
    { name: "Globetrotter", min: 35, next: 50 },
    { name: "Legendary Nomad", min: 50, next: null },
  ];

  useEffect(() => {
    const loadPlaces = async () => {
      setLoadingPlaces(true);
      try {
        const data = await fetchMapPlaces();
        setPlaces(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.response?.status === 401) navigate("/login");
      } finally {
        setLoadingPlaces(false);
      }
    };

    loadPlaces();
  }, [navigate]);

  useEffect(() => {
    fetch("/data/countries.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => data && setCountriesData(data))
      .catch((err) => console.error("GeoJSON load error:", err));
  }, []);

  const [countriesCount, setCountriesCount] = useState(0);
  const [citiesCount, setCitiesCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState({
    name: "Pathfinder",
    current: 0,
    needed: 5,
    index: 0,
  });

  useEffect(() => {
    const uniqueCountries = new Set(places.map((p) => p.country));
    setCountriesCount(uniqueCountries.size);

    const uniqueCities = new Set(places.map((p) => p.city.toLowerCase()));
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
        index: currentIndex,
      });
    } else {
      setLevel({
        name: currentLevel.name,
        current: "MAX",
        needed: "",
        index: currentIndex,
      });
    }
  }, [places]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPlace((prev) => ({ ...prev, [name]: value }));
  };

  const addPlace = async (e) => {
    e.preventDefault();

    if (!newPlace.city || !newPlace.country || !newPlace.month || !newPlace.year) return;

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

      const created = await createMapPlace({
        city: newPlace.city,
        country: newPlace.country,
        date: `${newPlace.year}-${newPlace.month}`,
        lat,
        lon,
      });

      setPlaces((prev) => [created, ...prev]);
      setNewPlace({
        city: "",
        country: "",
        month: currentMonth,
        year: String(currentYear),
      });
      setIsModalOpen(false);
    } catch (err) {
      console.error(err);
      alert("Error fetching or saving location");
    }
  };

  const removePlace = async (placeId) => {
    try {
      await deleteMapPlace(placeId);
      setPlaces((prev) => prev.filter((place) => place.id !== placeId));
    } catch (err) {
      console.error("Delete place error:", err);
    }
  };

  const openAddModal = () => setIsModalOpen(true);
  const closeModal = () => setIsModalOpen(false);

  const visitedCountries = places.map((p) => p.country.toLowerCase().trim());

  const countryStyle = (feature) => {
    const name = String(feature.properties?.name || feature.properties?.ADMIN || "")
      .toLowerCase()
      .trim();

    const isVisited = visitedCountries.includes(name);

    return {
      fillColor: isVisited ? "#FDD835" : "#E0E0E0",
      weight: 0.8,
      color: "#FFFFFF",
      fillOpacity: isVisited ? 0.32 : 0.08,
    };
  };

  return (
    <div className="map-page">
      <aside className="map-sidebar">
        <h3 className="sidebar-title">Traveler Level</h3>

        <div className="badge-scroll">
          {levelsList
            .filter((lvl) => places.length >= lvl.min)
            .map((lvl, i) => {
              const isCurrent = lvl.name === level.name;
              const progressPercent = lvl.next
                ? ((places.length - lvl.min) / (lvl.next - lvl.min)) * 100
                : 100;

              return (
                <div key={i} className={`badge-card ${isCurrent ? "current" : "completed"}`}>
                  <div className="badge-icon">🧭</div>
                  <strong>{lvl.name}</strong>

                  {lvl.next ? (
                    <div className="mini-progress">
                      <div className="mini-bar" style={{ width: `${Math.min(progressPercent, 100)}%` }}></div>
                    </div>
                  ) : (
                    <span className="max-label">MAX</span>
                  )}
                </div>
              );
            })}
        </div>

        <div className="level-dots">
          {[...Array(levelsList.length)].map((_, i) => (
            <div key={i} className={`level-dot ${i <= level.index ? "active" : ""}`}>
              {i + 1}
            </div>
          ))}
        </div>

        <section className="stats">
          <h4>Your Statistics</h4>
          <div className="stats-row">
            <div className="stat-card">🌍 <strong>{countriesCount}</strong> Countries</div>
            <div className="stat-card">📍 <strong>{citiesCount}</strong> Cities</div>
          </div>
          <div className="world-progress">{progress}% of the world explored</div>
        </section>

        <section className="visited">
          <div className="visited-header">
            <h4>Visited Places</h4>
            <button className="add-btn" onClick={openAddModal}>+ Add</button>
          </div>

          {loadingPlaces && <p>Loading...</p>}

          <div className="visited-list">
            {places.map((p) => (
              <div className="place" key={p.id}>
                <div className="place-icon">📍</div>
                <div className="place-info">
                  <strong>{p.city}</strong>
                  <span>{p.country}</span>
                </div>
                <div className="place-side">
                  <span className="date">{p.date}</span>
                  <button type="button" className="remove-place-btn" onClick={() => removePlace(p.id)}>
                    Remove
                  </button>
                </div>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="map-area">
        <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://{s}.basemaps.cartocdn.com/light_nolabels/{z}/{x}/{y}{r}.png"
            attribution="&copy; OpenStreetMap &copy; CARTO"
          />

          {countriesData && <GeoJSON data={countriesData} style={countryStyle} interactive={false} />}

          <Pane name="labels" style={{ zIndex: 650, pointerEvents: "none" }}>
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/light_only_labels/{z}/{x}/{y}{r}.png"
              attribution="&copy; OpenStreetMap &copy; CARTO"
              pane="labels"
            />
          </Pane>

          {places.map((place) => (
            <CircleMarker key={place.id} center={[place.lat, place.lon]} radius={5} color="#1e88e5">
              <Popup>
                {place.city}, {place.country}
                <br />
                {place.date}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <button className="add-place-btn" onClick={openAddModal}>+ Add Place</button>
      </main>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New Place</h3>

            <input type="text" name="city" placeholder="City" value={newPlace.city} onChange={handleInputChange} />
            <input type="text" name="country" placeholder="Country" value={newPlace.country} onChange={handleInputChange} />

            <div className="month-year-row">
              <select name="month" value={newPlace.month} onChange={handleInputChange}>
                {monthOptions.map((m) => (
                  <option key={m.value} value={m.value}>{m.label}</option>
                ))}
              </select>

              <select name="year" value={newPlace.year} onChange={handleInputChange}>
                {yearOptions.map((y) => (
                  <option key={y} value={y}>{y}</option>
                ))}
              </select>
            </div>

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
