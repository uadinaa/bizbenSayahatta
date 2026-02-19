import { useEffect, useState } from "react";
import api from "../api/axios";

export default function Wishlist() {
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setError("");
      try {
        const res = await api.get("places/wishlist/");
        setItems(res.data || []);
      } catch (err) {
        setError(err.response?.data?.detail || "Failed to load wishlist");
      } finally {
        setLoading(false);
      }
    };

    load();
  }, []);

  return (
    <div>
      <h1>Wishlist</h1>
      {loading && <p>Loading...</p>}
      {error && <p className="error">{error}</p>}
      {!loading && !error && items.length === 0 && <p>No saved places yet.</p>}
      {!loading && !error && items.length > 0 && (
        <ul>
          {items.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong> - {item.city}, {item.country}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
