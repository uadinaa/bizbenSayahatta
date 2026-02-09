import { useState } from "react";
import api from "../api/axios";

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
        interests: interests
          .split(",")
          .map((item) => item.trim())
          .filter(Boolean),
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
    <div style={{ padding: 24, maxWidth: 900 }}>
      <h2>Trip Planner Test</h2>
      <p>
        This page uses your JWT token from localStorage (login first).
      </p>

      <section style={{ marginTop: 24 }}>
        <h3>Plan Trip</h3>
        <form onSubmit={handlePlanSubmit}>
          <div style={{ display: "flex", gap: 12, flexWrap: "wrap" }}>
            <input
              type="text"
              placeholder="City (e.g., Almaty)"
              value={city}
              onChange={(e) => setCity(e.target.value)}
              required
            />
            <input
              type="number"
              min="0"
              max="4"
              placeholder="Budget (0-4)"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
            />
            <input
              type="number"
              min="1"
              max="14"
              value={days}
              onChange={(e) => setDays(e.target.value)}
              required
            />
            <input
              type="text"
              placeholder="Interests (comma separated)"
              value={interests}
              onChange={(e) => setInterests(e.target.value)}
            />
            <select value={pace} onChange={(e) => setPace(e.target.value)}>
              <option value="slow">slow</option>
              <option value="medium">medium</option>
              <option value="fast">fast</option>
            </select>
          </div>
          <button type="submit" disabled={loadingPlan} style={{ marginTop: 12 }}>
            {loadingPlan ? "Planning..." : "Generate Plan"}
          </button>
        </form>

        {planError && <p style={{ color: "red" }}>{planError}</p>}
        {planResult && (
          <>
            <pre style={{ whiteSpace: "pre-wrap", marginTop: 12 }}>
              {JSON.stringify(planResult, null, 2)}
            </pre>
            <div style={{ marginTop: 16 }}>
              {planResult.itinerary?.map((day) => (
                <div key={day.day} style={{ marginBottom: 16 }}>
                  <h4>Day {day.day}</h4>
                  {day.stops?.map((stop) => (
                    <div
                      key={stop.id}
                      style={{
                        border: "1px solid #eee",
                        borderRadius: 12,
                        padding: 12,
                        marginBottom: 8,
                      }}
                    >
                      <div style={{ fontWeight: 600 }}>{stop.name}</div>
                      <div style={{ fontSize: 13, color: "#666" }}>
                        {stop.neighborhood ? `${stop.neighborhood}, ` : ""}
                        {stop.address}
                      </div>
                      <div style={{ fontSize: 13, color: "#444" }}>
                        Price: {stop.price_level || "n/a"} | Open now:{" "}
                        {stop.opening_hours?.openNow === undefined
                          ? "n/a"
                          : stop.opening_hours.openNow
                          ? "yes"
                          : "no"}{" "}
                        | Must visit: {stop.is_must_visit ? "yes" : "no"}
                      </div>
                      {stop.photo_url && (
                        <img
                          src={stop.photo_url}
                          alt={stop.name}
                          style={{
                            marginTop: 8,
                            width: "100%",
                            maxWidth: 320,
                            borderRadius: 10,
                          }}
                        />
                      )}
                    </div>
                  ))}
                </div>
              ))}
            </div>
          </>
        )}
      </section>

      <section style={{ marginTop: 40 }}>
        <h3>Chat Test</h3>
        <form onSubmit={handleChatSubmit}>
          <textarea
            rows="4"
            placeholder="Ask the travel AI..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            style={{ width: "100%" }}
            required
          />
          <button type="submit" disabled={loadingChat} style={{ marginTop: 12 }}>
            {loadingChat ? "Sending..." : "Send"}
          </button>
        </form>
        {chatResult && (
          <div style={{ marginTop: 12 }}>
            <strong>AI Response:</strong>
            <p>{chatResult}</p>
          </div>
        )}
      </section>
    </div>
  );
}
