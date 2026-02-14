import { useState } from "react";
import api from "../api/axios";
import "../styles/PlannerTest.css";

export default function PlannerTest() {
  const [city, setCity] = useState("");
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState("");
  const [pace, setPace] = useState("medium");
  const [planResult, setPlanResult] = useState(null);
  const [planError, setPlanError] = useState("");
  const [chatMessage, setChatMessage] = useState("");
  const [chatResult, setChatResult] = useState("");
  const [loadingPlan, setLoadingPlan] = useState(false);
  const [loadingChat, setLoadingChat] = useState(false);

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    setPlanError("");
    setPlanResult(null);
    setLoadingPlan(true);

    try {
      const payload = {
        city,
        days: Number(days),
        budget: budget === "" ? null : Number(budget),
        interests: interests.split(",").map(i => i.trim()).filter(Boolean),
        pace,
      };

      const res = await api.post("llm/plan/", payload);
      setPlanResult(res.data);
    } catch (err) {
      setPlanError(err.response?.data?.detail || "Request failed");
    } finally {
      setLoadingPlan(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    setChatResult("");
    setLoadingChat(true);

    try {
      const res = await api.post("llm/chat/", { message: chatMessage });
      setChatResult(res.data.response);
    } catch (err) {
      setChatResult(err.response?.data?.detail || "Request failed");
    } finally {
      setLoadingChat(false);
    }
  };

  return (
    <div className="planner-page">
      <h2>✈️ Trip Planner</h2>

      <section className="card">
        <h3>Plan your trip</h3>
        <form onSubmit={handlePlanSubmit} className="form-grid">
          <input placeholder="City (e.g. Milan)" value={city} onChange={e => setCity(e.target.value)} required />
          <input type="number" min="1" max="14" value={days} onChange={e => setDays(e.target.value)} />
          <input type="number" min="0" max="4" placeholder="Budget (0–4)" value={budget} onChange={e => setBudget(e.target.value)} />
          <input placeholder="Interests (shopping, art...)" value={interests} onChange={e => setInterests(e.target.value)} />
          <select value={pace} onChange={e => setPace(e.target.value)}>
            <option value="slow">slow</option>
            <option value="medium">medium</option>
            <option value="fast">fast</option>
          </select>

          <button type="submit" disabled={loadingPlan}>
            {loadingPlan ? "Planning..." : "Generate Plan"}
          </button>
        </form>

        {planError && <p className="error">{planError}</p>}
      </section>

      {planResult && (
        <section className="result">
          <h3>{planResult.city} · {planResult.days_generated} days</h3>

          {planResult.itinerary?.map(day => (
            <div key={day.day} className="day-block">
              <h4>Day {day.day}</h4>
              <p className="summary">{day.summary}</p>

              {day.stops?.map(stop => (
                <div key={stop.id} className="stop-card">
                  {stop.photo_url && <img src={stop.photo_url} alt={stop.name} />}
                  <div>
                    <strong>{stop.name}</strong>
                    <p>📍 {stop.address}</p>
                    <p>⭐ {stop.rating || "n/a"} · {stop.category}</p>
                  </div>
                </div>
              ))}
            </div>
          ))}
        </section>
      )}

     <section className="chat">
  <h3>💬 Travel AI Chat</h3>

  <form onSubmit={handleChatSubmit} className="chat-form">
    <textarea
      rows="4"
      placeholder="Ask something like: shopping in Milan..."
      value={chatMessage}
      onChange={(e) => setChatMessage(e.target.value)}
      required
    />
    <button type="submit" disabled={loadingChat}>
      {loadingChat ? "Thinking..." : "Send"}
    </button>
  </form>

  {chatResult && (
    <div className="chat-bubble ai">
      <div className="ai-avatar">🤖</div>
      <div className="ai-message">
        <div className="ai-label">Travel AI</div>
        <p>{chatResult}</p>
      </div>
    </div>
  )}
</section>

    </div>
  );
}
