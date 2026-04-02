import { Fragment, useEffect, useMemo } from "react";
import { MapContainer, Marker, Popup, Polyline, TileLayer, useMap } from "react-leaflet";
import L from "leaflet";

const fallbackCenter = [48.8566, 2.3522];

const defaultMarker = new L.Icon({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
  iconSize: [25, 41],
  iconAnchor: [12, 41],
  popupAnchor: [1, -34],
  shadowSize: [41, 41],
});

function FitRouteBounds({ points }) {
  const map = useMap();

  useEffect(() => {
    if (points.length) {
      const bounds = L.latLngBounds(points.map(([lat, lng]) => L.latLng(lat, lng)));
      map.fitBounds(bounds, { padding: [28, 28] });
    } else {
      map.setView(fallbackCenter, 12);
    }
  }, [map, points]);

  return null;
}

export default function TravelPlannerMap({ plan, isOpen }) {
  const route = useMemo(() => plan?.route || [], [plan]);

  const hasRoute = route.some((day) => (day.places || []).length > 0);

  const preparedRoute = useMemo(() => {
    try {
      return route.map((day) => ({
        ...day,
        places: (day.places || []).filter((place) => {
          const valid = Number.isFinite(place.lat) && Number.isFinite(place.lng);
          if (!valid) {
            console.error("MAP ERROR:", new Error(`Invalid coordinates for ${place.name || "unknown place"}`));
          }
          return valid;
        }),
      }));
    } catch (e) {
      console.error("MAP ERROR:", e);
      return [];
    }
  }, [route]);

  const allPoints = useMemo(
    () =>
      preparedRoute.flatMap((day) =>
        (day.places || []).map((place) => [place.lat, place.lng])
      ),
    [preparedRoute]
  );

  if (!isOpen || !hasRoute) {
    return (
      <div className="trip-map-shell">
        {isOpen ? (
          <>
            <p className="map-fallback">Map unavailable</p>
            <div className="text-directions">
              {(plan?.itinerary || []).map((day) => (
                <div key={day.day} className="text-direction-day">
                  <span className="day-dot" style={{ backgroundColor: day.color || "#E53E3E" }} />
                  <strong>Day {day.day}</strong>
                  <span>{(day.stops || []).map((stop) => stop.name).join(" -> ")}</span>
                </div>
              ))}
            </div>
          </>
        ) : null}
      </div>
    );
  }

  return (
    <div className="trip-map-shell">
      <MapContainer
        center={allPoints[0] || fallbackCenter}
        zoom={13}
        scrollWheelZoom={false}
        className="trip-map-canvas"
      >
        <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" />
        <FitRouteBounds points={allPoints} />

        {preparedRoute.map((day) => {
          const positions = day.places.map((place) => [place.lat, place.lng]);
          return (
            <Fragment key={`day-${day.day}`}>
              <Polyline positions={positions} pathOptions={{ color: day.color, weight: 4 }} />
              {day.places.map((place, index) => (
                <Marker
                  key={`${day.day}-${index}-${place.name}`}
                  position={[place.lat, place.lng]}
                  icon={defaultMarker}
                >
                  <Popup>{place.name}</Popup>
                </Marker>
              ))}
            </Fragment>
          );
        })}
      </MapContainer>
    </div>
  );
}
