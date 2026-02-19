import "../styles/Map.css";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { MapContainer, TileLayer, Popup, CircleMarker, GeoJSON } from "react-leaflet";
import { createMapPlace, deleteMapPlace, fetchMapPlaces } from "../api/places";

export default function Map() {
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [countriesData, setCountriesData] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(true);

  useEffect(() => {
    const loadPlaces = async () => {
      setLoadingPlaces(true);
      try {
        const data = await fetchMapPlaces();
        setPlaces(Array.isArray(data) ? data : []);
      } catch (err) {
        if (err?.response?.status === 401) {
          navigate("/login");
        }
      } finally {
        setLoadingPlaces(false);
      }
    };

    loadPlaces();
  }, [navigate]);

  useEffect(() => {
    fetch("/data/countries.geojson")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data) setCountriesData(data);
      })
      .catch((err) => console.error("GeoJSON load error:", err));
  }, []);

  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlace, setNewPlace] = useState({
    city: "",
    country: "",
    date: "",
  });

  const visitedCountries = places.map((p) => p.country.toLowerCase());

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

    const levels = [
      { name: "Pathfinder", min: 0, next: 5 },
      { name: "Explorer", min: 5, next: 10 },
      { name: "Adventurer", min: 10, next: 20 },
      { name: "Voyager", min: 20, next: 35 },
      { name: "Globetrotter", min: 35, next: 50 },
      { name: "Legendary Nomad", min: 50, next: null },
    ];

    let currentLevel = levels[0];
    let currentIndex = 0;

    for (let i = 0; i < levels.length; i += 1) {
      if (places.length >= levels[i].min) {
        currentLevel = levels[i];
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

    if (newPlace.city && newPlace.country && newPlace.date) {
      try {
        const response = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${newPlace.city},${newPlace.country}`
        );
        const data = await response.json();
        if (data.length === 0) {
          alert("City not found");
          return;
        }

        const lat = parseFloat(data[0].lat);
        const lon = parseFloat(data[0].lon);
        const address = data[0].address || {};
        const normalizedCity =
          address.city || address.town || address.village || newPlace.city;
        const normalizedCountry = address.country || newPlace.country;

        const created = await createMapPlace({
          city: normalizedCity,
          country: normalizedCountry,
          date: newPlace.date,
          lat,
          lon,
        });

        setPlaces((prev) => [created, ...prev]);
        setNewPlace({ city: "", country: "", date: "" });
        setIsModalOpen(false);
      } catch (err) {
        console.error("Geocoding or save error:", err);
        alert("Error fetching or saving location");
      }
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

  const closeModal = () => {
    setIsModalOpen(false);
    setNewPlace({ city: "", country: "", date: "" });
  };

  const openAddModal = () => {
    setIsModalOpen(true);
  };

  const countryStyle = (feature) => {
    const raw = feature.properties?.name ?? feature.properties?.ADMIN ?? "";
    const name = String(raw).toLowerCase().trim();
    const isVisited = visitedCountries.some((c) => c.toLowerCase().trim() === name);
    return {
      fillColor: isVisited ? "#FDD835" : "#E0E0E0",
      weight: 1,
      color: "#FFF",
      fillOpacity: 0.8,
    };
  };

  return (
    <div className="map-page">
      <aside className="map-sidebar">
        <div className="sidebar-progress-line"></div>
        <h3 className="sidebar-title">Traveler Level</h3>
        <div className="level-card">
          <div className="badge-icon">🧭</div>
          <div className="level-info">
            <strong>{level.name}</strong>
            <span className="badge-name">Compass Badge</span>
            <div className="level-progress-text">
              {level.current === "MAX"
                ? "Max level reached"
                : `${level.current}/${level.needed} to next level`}
            </div>
          </div>
        </div>
        <div className="level-dots">
          {[1, 2, 3, 4, 5, 6].map((num, i) => (
            <div key={num} className={`level-dot ${i <= level.index ? "active" : ""}`}>
              {num}
            </div>
          ))}
        </div>

        <section className="stats">
          <h4>Your Statistics</h4>
          <div className="stats-row">
            <div className="stat-card">
              🌍 <strong>{countriesCount}</strong> <span>Countries</span>{" "}
            </div>
            <div className="stat-card">
              📍 <strong>{citiesCount}</strong> <span>Cities</span>{" "}
            </div>
          </div>
          <div className="world-progress">{progress}% of the world explored</div>
        </section>

        <section className="visited">
          <div className="visited-header">
            <h4>Visited Places</h4>
            <button className="add-btn" onClick={openAddModal}>+ Add</button>
          </div>
          {loadingPlaces ? <p>Loading...</p> : null}
          <div className="visited-list">
            {places.map((p) => (
              <div className="place" key={p.id}>
                <div className="place-icon">📍</div>
                <div className="place-info">
                  <strong>{p.city}</strong>
                  <span>{p.country}</span>
                </div>
                <span className="date">{p.date}</span>
                <button type="button" className="add-btn" onClick={() => removePlace(p.id)}>
                  Remove
                </button>
              </div>
            ))}
          </div>
        </section>
      </aside>

      <main className="map-area">
        <MapContainer center={[20, 0]} zoom={2} style={{ height: "100%", width: "100%" }}>
          <TileLayer
            url="https://tiles.stadiamaps.com/tiles/alidade_smooth/{z}/{x}/{y}{r}.png"
            attribution='&copy; <a href="https://stadiamaps.com/">Stadia Maps</a> contributors'
          />

          {countriesData && (
            <GeoJSON
              key={places.length + (places[0]?.country ?? "")}
              data={countriesData}
              style={countryStyle}
            />
          )}

          {places.map((place) => (
            <CircleMarker
              key={place.id}
              center={[place.lat, place.lon]}
              radius={5}
              color="#1e88e5"
              pathOptions={{ pane: "markerPane" }}
            >
              <Popup>
                {place.city}, {place.country} <br /> {place.date}
              </Popup>
            </CircleMarker>
          ))}
        </MapContainer>

        <div className="legend">
          <strong>Legend</strong>
          <div><span className="visited-country"></span> Visited Countries</div>
          <div><span className="gray"></span> Unexplored</div>
          <div><span className="dot"></span> City Visited</div>
        </div>

        <button className="add-place-btn" onClick={openAddModal}>+ Add Place</button>
      </main>

      {isModalOpen && (
        <div className="modal-overlay">
          <div className="modal">
            <h3>Add New Place</h3>
            <label>
              City
              <input
                type="text"
                name="city"
                value={newPlace.city}
                onChange={handleInputChange}
                placeholder="e.g., Rome"
              />
            </label>
            <label>
              Country
              <input
                type="text"
                name="country"
                value={newPlace.country}
                onChange={handleInputChange}
                placeholder="e.g., Italy"
              />
            </label>
            <label>
              Date
              <input type="month" name="date" value={newPlace.date} onChange={handleInputChange} />
            </label>
            <div className="modal-actions">
              <button className="submit-btn" onClick={addPlace}>Add</button>
              <button className="cancel-btn" onClick={closeModal}>Cancel</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
