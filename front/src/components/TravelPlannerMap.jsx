import { useEffect, useMemo, useRef, useState } from "react";

const GOOGLE_MAPS_API_KEY = import.meta.env.VITE_GOOGLE_MAPS_API_KEY || "";

let googleMapsPromise = null;

function loadGoogleMapsScript() {
  if (window.google?.maps) {
    return Promise.resolve(window.google.maps);
  }

  if (googleMapsPromise) {
    return googleMapsPromise;
  }

  googleMapsPromise = new Promise((resolve, reject) => {
    if (!GOOGLE_MAPS_API_KEY) {
      reject(new Error("Missing Google Maps API key"));
      return;
    }

    const script = document.createElement("script");
    script.src = `https://maps.googleapis.com/maps/api/js?key=${GOOGLE_MAPS_API_KEY}`;
    script.async = true;
    script.defer = true;
    script.onload = () => resolve(window.google.maps);
    script.onerror = () => reject(new Error("Google Maps failed to load"));
    document.head.appendChild(script);
  });

  return googleMapsPromise;
}

function getValidStops(plan) {
  return (plan?.itinerary || []).flatMap((day) =>
    (day.stops || []).filter(
      (stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)
    )
  );
}

export default function TravelPlannerMap({ plan, isOpen }) {
  const mapRef = useRef(null);
  const [error, setError] = useState("");
  const missingPlanError = !plan?.itinerary?.length
    ? "Map unavailable, but your route is listed below."
    : "";

  const validStops = useMemo(() => getValidStops(plan), [plan]);
  const textDirections = useMemo(
    () =>
      (plan?.itinerary || []).map((day) => ({
        day: day.day,
        color: day.color,
        stops: (day.stops || []).map((stop) => stop.name),
      })),
    [plan]
  );

  useEffect(() => {
    if (!isOpen) return undefined;
    if (!plan?.itinerary?.length) {
      return undefined;
    }

    let markers = [];
    let polylines = [];
    let cancelled = false;

    loadGoogleMapsScript()
      .then((maps) => {
        if (cancelled || !mapRef.current) return;

        if (!validStops.length) {
          setError("Map unavailable, but your route is listed below.");
          return;
        }

        setError("");

        const map = new maps.Map(mapRef.current, {
          center: { lat: validStops[0].lat, lng: validStops[0].lng },
          zoom: 12,
          mapTypeControl: false,
          streetViewControl: false,
          fullscreenControl: false,
        });

        const bounds = new maps.LatLngBounds();

        (plan.itinerary || []).forEach((day) => {
          const dayStops = (day.stops || []).filter(
            (stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng)
          );

          if (!dayStops.length) {
            return;
          }

          const path = dayStops.map((stop) => {
            const point = { lat: stop.lat, lng: stop.lng };
            bounds.extend(point);
            const marker = new maps.Marker({
              position: point,
              map,
              title: `${stop.name} (Day ${day.day})`,
              label: `${day.day}`,
            });
            markers.push(marker);
            return point;
          });

          const polyline = new maps.Polyline({
            path,
            geodesic: true,
            strokeColor: day.color || "#d92d20",
            strokeOpacity: 0.92,
            strokeWeight: 5,
            map,
          });
          polylines.push(polyline);
        });

        if (!bounds.isEmpty()) {
          map.fitBounds(bounds, 40);
        }
      })
      .catch(() => {
        if (!cancelled) {
          setError("Map unavailable, but your route is listed below.");
        }
      });

    return () => {
      cancelled = true;
      markers.forEach((marker) => marker.setMap(null));
      polylines.forEach((polyline) => polyline.setMap(null));
      markers = [];
      polylines = [];
    };
  }, [isOpen, plan, validStops]);

  return (
    <div className="trip-map-shell">
      {!error && !missingPlanError ? <div ref={mapRef} className="trip-map-canvas" /> : null}
      {error || missingPlanError ? <p className="map-fallback">{error || missingPlanError}</p> : null}
      {error || missingPlanError ? (
        <div className="text-directions">
          {textDirections.map((day) => (
            <div key={day.day} className="text-direction-day">
              <span
                className="day-dot"
                style={{ backgroundColor: day.color || "#d92d20" }}
              />
              <strong>Day {day.day}</strong>
              <span>{day.stops.join(" -> ")}</span>
            </div>
          ))}
        </div>
      ) : null}
    </div>
  );
}
