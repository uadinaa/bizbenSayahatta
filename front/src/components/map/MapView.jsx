import { MapContainer, TileLayer, Popup, CircleMarker, GeoJSON, Pane } from "react-leaflet";

export default function MapView({ places, countriesData, onOpenModal }) {
  const visitedCountries = places.map((p) => p.country.toLowerCase().trim());

  const countryStyle = (feature) => {
    const name = String(feature.properties?.name || feature.properties?.ADMIN || "")
      .toLowerCase().trim();
    const isVisited = visitedCountries.includes(name);
    return {
      fillColor: isVisited ? "#FDD835" : "#E0E0E0",
      weight: 0.8,
      color: "#FFFFFF",
      fillOpacity: isVisited ? 0.32 : 0.08,
    };
  };

  return (
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
            <Popup>{place.city}, {place.country}<br />{place.date}</Popup>
          </CircleMarker>
        ))}
      </MapContainer>
      <button className="add-place-btn" onClick={onOpenModal}>+ Add Visited Place</button>
    </main>
  );
}