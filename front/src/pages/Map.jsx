import "../styles/Map.css";
import "leaflet/dist/leaflet.css";
import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import { createMapPlace, deleteMapPlace, fetchMapPlaces, markPlaceAsVisited, fetchInspirationPlaces, updateMapPlace } from "../api/places";
import { LEVELS_LIST } from "../constants/mapConstants";
import MapSidebar from "../components/map/MapSidebar";
import MapView from "../components/map/MapView";
import AddPlaceModal from "../components/map/AddPlaceModal";

const now = new Date();
const currentYear = now.getFullYear();
const currentMonth = String(now.getMonth() + 1).padStart(2, "0");
const yearOptions = Array.from({ length: 81 }, (_, i) => String(currentYear - i));

export default function Map() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [places, setPlaces] = useState([]);
  const [countriesData, setCountriesData] = useState(null);
  const [loadingPlaces, setLoadingPlaces] = useState(true);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [newPlace, setNewPlace] = useState({ city: "", country: "", month: currentMonth, year: String(currentYear) });
  const [countriesCount, setCountriesCount] = useState(0);
  const [citiesCount, setCitiesCount] = useState(0);
  const [progress, setProgress] = useState(0);
  const [level, setLevel] = useState({ name: "Pathfinder", current: 0, needed: 5, index: 0 });
  const [isEditMode, setIsEditMode] = useState(false);
  const [editingPlace, setEditingPlace] = useState(null); 
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
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

  useEffect(() => {
    setCountriesCount(new Set(places.map((p) => p.country)).size);
    setCitiesCount(new Set(places.map((p) => p.city.toLowerCase())).size);
    setProgress(Math.min(100, (places.length / 1000) * 100).toFixed(1));

    let currentIndex = 0;
    let currentLevel = LEVELS_LIST[0];
    for (let i = 0; i < LEVELS_LIST.length; i++) {
      if (places.length >= LEVELS_LIST[i].min) { currentLevel = LEVELS_LIST[i]; currentIndex = i; }
    }
    setLevel(currentLevel.next
      ? { name: currentLevel.name, current: places.length - currentLevel.min, needed: currentLevel.next - currentLevel.min, index: currentIndex }
      : { name: currentLevel.name, current: "MAX", needed: "", index: currentIndex }
    );
  }, [places]);

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setNewPlace((prev) => ({ ...prev, [name]: value }));
  };

  const openEditPlace = (place) => {
    setEditingPlace({
      id: place.id,
      city: place.city,
      country: place.country,
      month: place.date?.split("-")[1] || currentMonth,
      year: place.date?.split("-")[0] || String(currentYear),
    });
    setIsEditModalOpen(true);
  };
  
  const saveEditPlace = async (e) => {
    e.preventDefault();
    if (!editingPlace.city || !editingPlace.country) return;
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/search?format=json&q=${editingPlace.city},${editingPlace.country}`
      );
      const data = await res.json();
      if (!data.length) { alert(t("map.cityNotFound")); return; }

      const updated = await updateMapPlace(editingPlace.id, {
        city: editingPlace.city,
        country: editingPlace.country,
        date: `${editingPlace.year}-${editingPlace.month}`,
        lat: parseFloat(data[0].lat),
        lon: parseFloat(data[0].lon),
      });

      setPlaces((prev) => prev.map((p) => (p.id === updated.id ? updated : p)));
      setIsEditModalOpen(false);
      setEditingPlace(null);
    } catch (err) {
      if (err?.response?.status === 401) { navigate("/login"); return; }
      alert(t("map.errorUpdatingLocation"));
    }
  };

  const addPlace = async (e) => {
  e.preventDefault();
  if (!newPlace.city || !newPlace.country) return;

  try {
    const searchRes = await fetchInspirationPlaces(1, newPlace.city);
    const foundPlace = searchRes.results?.find(
      (p) =>
        p.city?.toLowerCase() === newPlace.city.toLowerCase() ||
        p.country?.toLowerCase() === newPlace.country.toLowerCase()
    );

    
    let visitedResponse = null;
    if (foundPlace) {
      visitedResponse = await markPlaceAsVisited(foundPlace.id);
    }

  
    const res = await fetch(
      `https://nominatim.openstreetmap.org/search?format=json&q=${newPlace.city},${newPlace.country}`
    );
    const data = await res.json();

    if (!data.length) {
      alert(t("map.cityNotFound"));
      return;
    }

    
    const created = await createMapPlace({
      city: newPlace.city,
      country: newPlace.country,
      date: `${newPlace.year}-${newPlace.month}`,
      lat: parseFloat(data[0].lat),
      lon: parseFloat(data[0].lon),
    });

    
    setPlaces((prev) => [created, ...prev]);

  
    if (visitedResponse?.badges?.length) {
      alert(`🎉 ${t("map.newBadges")}: ${visitedResponse.badges.join(", ")}`);
    }

    setNewPlace({
      city: "",
      country: "",
      month: currentMonth,
      year: String(currentYear),
    });
    setIsModalOpen(false);

  } catch (err) {
    if (err?.response?.status === 401) {
      navigate("/login");
      return;
    }
    console.error(err);
    alert(t("map.errorAddingPlace"));
  }
};

  const removePlace = async (placeId) => {
    try {
      await deleteMapPlace(placeId);
      setPlaces((prev) => prev.filter((p) => p.id !== placeId));
    } catch (err) {
      console.error("Delete place error:", err);
    }
  };

  return (
    <div className="map-page">
      {/* <MapSidebar
        places={places} level={level}
        countriesCount={countriesCount} citiesCount={citiesCount}
        progress={progress} loadingPlaces={loadingPlaces}
        onOpenModal={() => setIsModalOpen(true)} onRemovePlace={removePlace}
        // isEditMode={isEditMode}
        onToggleEditMode={() => setIsEditMode((prev) => !prev)}
        // onRemovePlace={removePlace}
        onEditPlace={openEditPlace}
      /> */}
      <MapSidebar
        places={places} level={level}
        countriesCount={countriesCount} citiesCount={citiesCount}
        progress={progress} loadingPlaces={loadingPlaces}
        onOpenModal={() => setIsModalOpen(true)}
        onRemovePlace={removePlace}
        isEditMode={isEditMode}                              
        onToggleEditMode={() => setIsEditMode((prev) => !prev)}
        onEditPlace={openEditPlace}
      />
      <MapView places={places} countriesData={countriesData} onOpenModal={() => setIsModalOpen(true)} />

      {isModalOpen && (
        <AddPlaceModal
          newPlace={newPlace}
          yearOptions={yearOptions}
          onInputChange={handleInputChange}
          onAdd={addPlace}
          onClose={() => setIsModalOpen(false)}
          title={t("map.addPlaceTitle")}
          submitLabel={t("map.add")}
        />
      )}

      {isEditModalOpen && editingPlace && (
        <AddPlaceModal
          newPlace={editingPlace}
          yearOptions={yearOptions}
          onInputChange={(e) => {
            const { name, value } = e.target;
            setEditingPlace((prev) => ({ ...prev, [name]: value }));
          }}
          onAdd={saveEditPlace}
          onClose={() => { setIsEditModalOpen(false); setEditingPlace(null); }}
          title={t("map.editPlaceTitle")}
          submitLabel={t("map.save")}
        />
      )}
    </div>
  );
}
