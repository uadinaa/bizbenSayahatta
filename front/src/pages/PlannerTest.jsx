import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";
import api from "../api/axios";
import TravelPlannerMap from "../components/TravelPlannerMap";
import { fetchProfile } from "../slices/authSlice";
import "../styles/PlannerTest.css";

const DAY_COLORS = ["#d92d20", "#f79009", "#facc15", "#16a34a", "#2563eb", "#9333ea"];

function decoratePlan(plan) {
  if (!plan?.itinerary) return plan;
  return {
    ...plan,
    itinerary: plan.itinerary.map((day, index) => ({
      ...day,
      color: day.color || DAY_COLORS[index % DAY_COLORS.length],
    })),
  };
}

function profileHasHistory(user) {
  return Boolean(user?.history_summary?.trip_count);
}

export default function PlannerTest() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
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
  const [showSlowMessage, setShowSlowMessage] = useState(false);
  const [mapOpen, setMapOpen] = useState(false);
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
  const hasHistory = useMemo(() => profileHasHistory(user), [user]);
  const visibleBadges = useMemo(() => user?.badges || [], [user]);

  useEffect(() => {
    if (localStorage.getItem("access") && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  useEffect(() => {
    if (!sendingMessage && !generatingPlan) {
      setShowSlowMessage(false);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setShowSlowMessage(true);
    }, 6000);

    return () => window.clearTimeout(timer);
  }, [sendingMessage, generatingPlan]);

  const loadThreads = useCallback(async () => {
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
  }, [selectedId, threadFromUrl]);

  const loadThreadDetail = useCallback(async (threadId) => {
    if (!threadId) return;
    setLoadingMessages(true);
    try {
      const [detailRes, messagesRes] = await Promise.all([
        api.get(`llm/threads/${threadId}/`),
        api.get(`llm/threads/${threadId}/messages/`),
      ]);
      setSelectedThread(detailRes.data);
      setPlanResult(decoratePlan(detailRes.data.plan_json || null));
      setMessages(messagesRes.data);
      setError("");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to load chat");
    } finally {
      setLoadingMessages(false);
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    loadThreadDetail(selectedId);
  }, [loadThreadDetail, selectedId]);

  useEffect(() => {
    if (!planResult?.itinerary?.length) {
      setMapOpen(false);
    }
  }, [planResult]);

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
    setError("");

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
      if (res.data.plan) {
        const decorated = decoratePlan(res.data.plan);
        setPlanResult(decorated);
        setSelectedThread((prev) => (
          prev ? { ...prev, plan_json: decorated } : prev
        ));
      }
      await loadThreads();
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
          .map((item) => item.trim())
          .filter(Boolean),
        pace,
      };
      const res = await api.post(`llm/threads/${selectedId}/plan/`, payload);
      const decorated = decoratePlan(res.data);
      setPlanResult(decorated);
      setSelectedThread((prev) => (
        prev ? { ...prev, plan_json: decorated, city: decorated.city } : prev
      ));
      await loadThreads();
    } catch (err) {
      setError(err.response?.data?.detail || "Plan failed");
    } finally {
      setGeneratingPlan(false);
    }
  };

  return (
    <div className="planner-shell">
      <aside className="planner-sidebar">
        <div className="sidebar-card">
          <div className="threads-header">
            <h2>Travel Chat</h2>
            <span className="muted">Planner + AI</span>
          </div>

          {hasHistory ? (
            <div className="profile-level">
              <div className="level-pill">
                <span>{user.traveler_level?.icon}</span>
                <strong>{user.traveler_level?.name}</strong>
              </div>
              <p className="muted">
                {user.history_summary?.trip_count} trips across {user.history_summary?.country_count} countries
              </p>
              {visibleBadges.length ? (
                <div className="badge-row">
                  {visibleBadges.map((badge) => (
                    <span key={badge.code} className="badge-chip">
                      {badge.icon} {badge.label}
                    </span>
                  ))}
                </div>
              ) : null}
            </div>
          ) : null}

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
              <input type="date" value={newStart} onChange={(e) => setNewStart(e.target.value)} />
              <input type="date" value={newEnd} onChange={(e) => setNewEnd(e.target.value)} />
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

        <div className="sidebar-card">
          <h3>Quick Planner</h3>
          {selectedKind === "planner" ? (
            <form onSubmit={handlePlanSubmit} className="plan-form">
              <input placeholder="City (e.g. Milan)" value={city} onChange={(e) => setCity(e.target.value)} required />
              <div className="row">
                <input type="number" min="1" max="14" value={days} onChange={(e) => setDays(e.target.value)} />
                <input type="number" min="0" placeholder="Budget" value={budget} onChange={(e) => setBudget(e.target.value)} />
              </div>
              <input placeholder="Interests (shopping, art...)" value={interests} onChange={(e) => setInterests(e.target.value)} />
              <select value={pace} onChange={(e) => setPace(e.target.value)}>
                <option value="slow">slow</option>
                <option value="medium">medium</option>
                <option value="fast">fast</option>
              </select>
              <button type="submit" disabled={generatingPlan}>
                {generatingPlan ? "Planning..." : "Generate Plan"}
              </button>
            </form>
          ) : (
            <p className="muted">Switch to a planner chat to use the quick plan form.</p>
          )}
        </div>
      </aside>

      <section className="chat-panel">
        <div className="chat-header">
          <div>
            <h2>{selectedThread?.title || "Chat"}</h2>
            {selectedThread?.city ? <span className="muted">{selectedThread.city}</span> : null}
          </div>
        </div>

        <div className="chat-messages">
          {loadingMessages ? (
            <p className="muted">Loading messages...</p>
          ) : (
            messages.map((msg) => (
              <div key={msg.id} className={`chat-bubble ${msg.role}`}>
                <div className="chat-role">{msg.role === "user" ? "You" : "AI"}</div>
                {msg.role === "assistant" ? (
                  <ReactMarkdown>{msg.content}</ReactMarkdown>
                ) : (
                  <p>{msg.content}</p>
                )}
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

        {showSlowMessage ? (
          <p className="slow-message">Taking longer than usual... still working on your trip 🔄</p>
        ) : null}
        {error ? <p className="error">{error}</p> : null}
      </section>

      <aside className="right-panel">
        <div className="right-panel-controls">
          <button
            type="button"
            className="map-toggle"
            disabled={!planResult?.itinerary?.length}
            onClick={() => setMapOpen((prev) => !prev)}
          >
            {mapOpen ? "Map" : "Map"}
          </button>
          {mapOpen ? (
            <button type="button" className="map-close" onClick={() => setMapOpen(false)}>
              X
            </button>
          ) : (
            <span className="muted panel-hint">Final trip stays visible below</span>
          )}
        </div>

        <div className={`map-overlay ${mapOpen ? "open" : ""}`}>
          {mapOpen ? <TravelPlannerMap plan={planResult} isOpen={mapOpen} /> : null}
        </div>

        <div className={`final-trip-card ${mapOpen ? "with-map" : ""}`}>
          <h3>Final Trip</h3>
          {!planResult?.itinerary?.length ? (
            <div className="trip-placeholder">Your trip will appear here</div>
          ) : (
            <>
              {planResult.family_note ? (
                <div className="family-note">{planResult.family_note}</div>
              ) : null}

              <div className="final-trip-days">
                {planResult.itinerary.map((day) => (
                  <div key={day.day} className="final-day-card">
                    <div className="final-day-header">
                      <span className="day-dot" style={{ backgroundColor: day.color }} />
                      <strong>Day {day.day}</strong>
                    </div>
                    <p>{day.summary}</p>
                    <div className="day-stop-list">
                      {(day.stops || []).map((stop) => (
                        <span key={`${day.day}-${stop.id || stop.name}`} className="day-stop-chip">
                          {stop.name}
                        </span>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {planResult.sources ? (
                <div className="sources-card">
                  <h4>📚 Sources & Useful Links</h4>
                  <div className="sources-divider" />
                  {(planResult.sources.items || []).map((item) => (
                    <a
                      key={`${item.label}-${item.url}`}
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                    >
                      📍 {item.label} — {item.provider}
                    </a>
                  ))}

                  {planResult.sources.visa?.status === "required" ? (
                    <a
                      href={planResult.sources.visa.url}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                    >
                      🛂 {planResult.sources.visa.label} → link
                    </a>
                  ) : null}

                  {planResult.sources.visa?.status === "not_required" ? (
                    <div className="source-link static-link">
                      ✅ {planResult.sources.visa.label}
                    </div>
                  ) : null}

                  {planResult.sources.visa?.status === "citizenship_needed" ? (
                    <div className="source-link static-link">
                      🛂 {planResult.sources.visa.label}
                    </div>
                  ) : null}

                  {planResult.sources.visa?.status === "unknown" ? (
                    <a
                      href={planResult.sources.visa.url}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                    >
                      🛂 {planResult.sources.visa.label} → link
                    </a>
                  ) : null}

                  {planResult.sources.advisory ? (
                    <a
                      href={planResult.sources.advisory.url}
                      target="_blank"
                      rel="noreferrer"
                      className="source-link"
                    >
                      📋 {planResult.sources.advisory.label}
                    </a>
                  ) : null}
                </div>
              ) : null}

              {planResult.safety_tips?.length ? (
                <div className="safety-card">
                  <h4>⚠️ Safety Tips for {planResult.city}</h4>
                  <div className="sources-divider" />
                  {planResult.safety_tips.map((tip) => (
                    <p key={tip} className="safety-tip">• {tip}</p>
                  ))}
                </div>
              ) : null}
            </>
          )}
        </div>
      </aside>
    </div>
  );
}
