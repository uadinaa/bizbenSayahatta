import { useEffect, useState } from "react";
import { fetchInspirationPlaces } from "../api/places";

export const Inspiration = () => {
  const [places, setPlaces] = useState([]);
  const [page, setPage] = useState(1);
  const [next, setNext] = useState(null);

  const loadPlaces = async () => {
    const data = await fetchInspirationPlaces(page);
    setPlaces(prev => [...prev, ...data.results]);
    setNext(data.next);
  };

  useEffect(() => {
    loadPlaces();
  }, [page]);

  return (
    <div>
      <h1>Inspiration Places</h1>
      <div style={{ display: "flex", flexWrap: "wrap" }}>
        {places.map(place => (
          <div
            key={place.id}
            style={{
              border: "1px solid #ccc",
              borderRadius: "6px",
              padding: "12px",
              margin: "10px",
              width: "200px"
            }}
          >
            <h3>{place.name}</h3>
            <p>{place.category}</p>
            <p>{place.city}, {place.country}</p>
            <p>Rating: {place.rating ?? "N/A"}</p>
            <p>Status: {place.status ?? "Hidden"}</p>
            <p>Saves: {place.saves_count}</p>
          </div>
        ))}
      </div>

      {next && (
        <button
          onClick={() => setPage(prev => prev + 1)}
          style={{ marginTop: "20px", padding: "10px 20px" }}
        >
          Load more
        </button>
      )}
    </div>
  );
};
export default Inspiration;