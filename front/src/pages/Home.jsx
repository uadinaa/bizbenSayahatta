import "../styles/Home.css";
import previewImg from "../assets/preview.png"; // импорт картинки
import { Link, Navigate } from "react-router-dom";

export default function HomePage() {
  return (
    <div className="home-page">
      <div className="home-content">
        {/* Левый блок */}
        <div className="home-left">
          <h1>
            Journeys<br />
            crafted for you
          </h1>
          <p>
            Our intelligent assistant analyzes your preferences and creates
            perfect itineraries based on your budget, weather, and local events.
          </p>
          <Link to="/chat">
            <button className="create-trip-btn">Create Trip →</button>
          </Link>
        </div>

        {/* Центральная иллюстрация */}
        <div className="home-center">
          <img
            src={previewImg}  // используем импорт
            alt="Travel Globe"
            className="globe-img"
          />
        </div>

        {/* Правый блок чата */}
        <div className="home-right">
  <div className="chat-card">
    <div className="chat-header">
      <div className="ai-avatar">🤖</div>
      <div className="chat-header-info">
        <div className="ai-name">AI Assistant</div>
        <div className="ai-status">Online</div>
        <div className="ai-meta">📍 Kyoto, Japan • 🗓️ 3 days</div>
      </div>
      <div className="trip-preview">Kyoto, Japan • 3 days</div>
    </div>

    <div className="chat-body">
      <div className="user-msg">I want to visit Japan for 10 days, budget $3000</div>
      <div className="ai-msg">
        Great choice! I have prepared an itinerary for you: Tokyo (4 days) — Kyoto (3 days) — Osaka (3 days). Includes accommodation, transport, and top attractions.
      </div>
    </div>

    <div className="chat-footer">
      <div className="chat-info">Apr 15–25, 2026 • Best time to visit</div>
      <div className="chat-actions">
        <button>Show on map</button>
        <button>Add to wishlist</button>
      </div>
    </div>
  </div>
</div>

      </div>
    </div>
  );
}
