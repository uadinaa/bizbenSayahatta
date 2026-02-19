import { useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import api from "../api/axios";
import "../styles/PlannerTest.css";

export default function PlannerTest() {
  const [searchParams] = useSearchParams();
  const threadFromUrl = searchParams.get("thread");
  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [selectedThread, setSelectedThread] = useState(null);
  const [messages, setMessages] = useState([]);
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [generatingPlan, setGeneratingPlan] = useState(false);
  const [error, setError] = useState("");

  const [newKind, setNewKind] = useState("planner");
  const [newTitle, setNewTitle] = useState("");
  const [newCity, setNewCity] = useState("");
  const [newStart, setNewStart] = useState("");
  const [newEnd, setNewEnd] = useState("");

  const [city, setCity] = useState("");
  const [days, setDays] = useState(3);
  const [budget, setBudget] = useState("");
  const [interests, setInterests] = useState("");
  const [pace, setPace] = useState("medium");
  const [planResult, setPlanResult] = useState(null);

  const [chatMessage, setChatMessage] = useState("");

  const selectedKind = useMemo(() => selectedThread?.kind, [selectedThread]);

  const loadThreads = async () => {
    setLoadingThreads(true);
    try {
      const res = await api.get("llm/threads/");
      setThreads(res.data);
      if (threadFromUrl) {
        const fromUrlId = Number(threadFromUrl);
        const exists = res.data.some((thread) => thread.id === fromUrlId);
        if (exists) {
          setSelectedId(fromUrlId);
          return;
        }
      }
      if (!selectedId && res.data.length > 0) {
        setSelectedId(res.data[0].id);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load chats");
    } finally {
      setLoadingThreads(false);
    }
  };

  const loadThreadDetail = async (threadId) => {
    if (!threadId) return;
    setLoadingMessages(true);
    try {
      const [detailRes, messagesRes] = await Promise.all([
        api.get(`llm/threads/${threadId}/`),
        api.get(`llm/threads/${threadId}/messages/`),
      ]);
      setSelectedThread(detailRes.data);
      setPlanResult(detailRes.data.plan_json || null);
      setMessages(messagesRes.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load chat");
    } finally {
      setLoadingMessages(false);
    }
  };

  useEffect(() => {
    loadThreads();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [threadFromUrl]);

  useEffect(() => {
    loadThreadDetail(selectedId);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedId]);

  const handleCreateThread = async () => {
    setError("");
    try {
      const res = await api.post("llm/threads/", {
        kind: newKind,
        title: newTitle,
        city: newCity,
        start_date: newStart || null,
        end_date: newEnd || null,
      });
      setThreads((prev) => [res.data, ...prev]);
      setSelectedId(res.data.id);
      setNewTitle("");
      setNewCity("");
      setNewStart("");
      setNewEnd("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create chat");
    }
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedId || !chatMessage.trim()) return;
    const content = chatMessage.trim();
    setChatMessage("");
    setSendingMessage(true);

    const tempUserMsg = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
      created_at: new Date().toISOString(),
    };
    setMessages((prev) => [...prev, tempUserMsg]);

    try {
      const res = await api.post(`llm/threads/${selectedId}/messages/`, {
        message: content,
      });
      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: res.data.response,
          created_at: new Date().toISOString(),
        },
      ]);
    } catch (err) {
      setError(err.response?.data?.detail || "Message failed");
    } finally {
      setSendingMessage(false);
    }
  };

  const handlePlanSubmit = async (e) => {
    e.preventDefault();
    if (!selectedId) return;
    setGeneratingPlan(true);
    setError("");
    try {
      const payload = {
        city,
        days: Number(days),
        budget: budget === "" ? null : Number(budget),
        interests: interests
          .split(",")
          .map((i) => i.trim())
          .filter(Boolean),
        pace,
      };
      const res = await api.post(`llm/threads/${selectedId}/plan/`, payload);
      setPlanResult(res.data);
      await loadThreads();
    } catch (err) {
      setError(err.response?.data?.detail || "Plan failed");
    } finally {
      setGeneratingPlan(false);
    }
  };

  return (
    <div className="planner-shell">
      <div className="left-column">
        <div className="threads-panel">
          <div className="threads-header">
            <h2>Chats</h2>
            <span className="muted">Planner + AI</span>
          </div>

          <div className="new-thread">
            <div className="row">
              <select value={newKind} onChange={(e) => setNewKind(e.target.value)}>
                <option value="planner">Planner chat</option>
                <option value="ai">AI chat</option>
              </select>
              <button type="button" onClick={handleCreateThread}>New</button>
            </div>
            <input
              placeholder="Title (optional)"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
            />
            <input
              placeholder="City (optional)"
              value={newCity}
              onChange={(e) => setNewCity(e.target.value)}
            />
            <div className="row">
              <input
                type="date"
                value={newStart}
                onChange={(e) => setNewStart(e.target.value)}
              />
              <input
                type="date"
                value={newEnd}
                onChange={(e) => setNewEnd(e.target.value)}
              />
            </div>
          </div>

          {loadingThreads ? (
            <p className="muted">Loading chats...</p>
          ) : (
            <div className="thread-list">
              {threads.map((thread) => (
                <button
                  key={thread.id}
                  className={`thread-item ${selectedId === thread.id ? "active" : ""}`}
                  onClick={() => setSelectedId(thread.id)}
                >
                  <div className="thread-title">{thread.title || "Untitled"}</div>
                  <div className="thread-meta">
                    {thread.kind}
                    {thread.city ? ` · ${thread.city}` : ""}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        <div className="plan-panel">
          <h3>Trip Plan</h3>
          {selectedKind === "planner" ? (
            <>
              <form onSubmit={handlePlanSubmit} className="plan-form">
                <input
                  placeholder="City (e.g. Milan)"
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  required
                />
                <div className="row">
                  <input
                    type="number"
                    min="1"
                    max="14"
                    value={days}
                    onChange={(e) => setDays(e.target.value)}
                  />
                  <input
                    type="number"
                    min="0"
                    max="4"
                    placeholder="Budget (0–4)"
                    value={budget}
                    onChange={(e) => setBudget(e.target.value)}
                  />
                </div>
                <input
                  placeholder="Interests (shopping, art...)"
                  value={interests}
                  onChange={(e) => setInterests(e.target.value)}
                />
                <select value={pace} onChange={(e) => setPace(e.target.value)}>
                  <option value="slow">slow</option>
                  <option value="medium">medium</option>
                  <option value="fast">fast</option>
                </select>
                <button type="submit" disabled={generatingPlan}>
                  {generatingPlan ? "Planning..." : "Generate Plan"}
                </button>
              </form>

              {planResult && (
                <div className="plan-result">
                  <h4>
                    {planResult.city} · {planResult.days_generated} days
                  </h4>
                  {planResult.itinerary?.map((day) => (
                    <div key={day.day} className="day-block">
                      <h5>Day {day.day}</h5>
                      {day.summary && <p className="summary">{day.summary}</p>}
                      <div className="stops-list">
                        {day.stops?.map((stop) => (
                          <div key={stop.id} className="stop-card">
                            {stop.photo_url ? (
                              <img src={stop.photo_url} alt={stop.name} />
                            ) : (
                              <div className="stop-photo-placeholder" />
                            )}
                            <div className="stop-content">
                              <strong>{stop.name}</strong>
                              <p>{stop.address}</p>
                              <p>
                                {stop.rating ? `★ ${stop.rating}` : "★ n/a"} · {stop.category}
                              </p>
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          ) : (
            <p className="muted">Planner output appears here for planner chats.</p>
          )}
        </div>
      </div>

      <div className="chat-panel">
        <div className="chat-header">
          <h2>{selectedThread?.title || "Chat"}</h2>
          {selectedThread?.city && (
            <span className="muted">{selectedThread.city}</span>
          )}
        </div>

        <div className="chat-messages">
          {loadingMessages ? (
            <p className="muted">Loading messages...</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="chat-role">{msg.role === "user" ? "You" : "AI"}</div>
                <p>{msg.content}</p>
              </div>
            ))
          )}
        </div>

        <form className="chat-input" onSubmit={handleSendMessage}>
          <textarea
            rows="3"
            placeholder="Ask anything about your trip..."
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            required
          />
          <button type="submit" disabled={sendingMessage || !selectedId}>
            {sendingMessage ? "Sending..." : "Send"}
          </button>
        </form>

        {error && <p className="error">{error}</p>}
      </div>
    </div>
  );
}
