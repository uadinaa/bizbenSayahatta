import { useCallback, useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";
import api from "../api/axios";
import TravelPlannerMap from "../components/TravelPlannerMap";
import { fetchProfile } from "../slices/authSlice";
import "../styles/PlannerTest.css";

const DAY_COLORS = ["#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE", "#805AD5"];


function decoratePlan(plan) {
  if (!plan?.itinerary) return plan;
  return {
    ...plan,
    itinerary: plan.itinerary.map((day, index) => ({
      ...day,
      color: day.color || DAY_COLORS[index % DAY_COLORS.length],
    })),
    route: plan.route || plan.itinerary.map((day, index) => ({
      day: day.day,
      color: day.color || DAY_COLORS[index % DAY_COLORS.length],
      places: (day.stops || [])
        .filter((stop) => Number.isFinite(stop.lat) && Number.isFinite(stop.lng))
        .map((stop) => ({
          name: stop.name,
          lat: stop.lat,
          lng: stop.lng,
          address: stop.address,
        })),
    })),
  };
}

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
    const decorated = decoratePlan(res.data);

    setPlanResult(decorated);
    setSelectedThread((prev) =>
      prev ? { ...prev, plan_json: decorated, city: decorated.city } : prev
    );
    await loadThreads();
    setMapOpen(true);
  } catch (err) {
    setError(err.response?.data?.detail || "Plan generation failed");
  } finally {
    setGeneratingPlan(false);
  }
};

export default function PlannerTest() {
  const dispatch = useDispatch();
  const { user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const threadFromUrl = searchParams.get("thread");

  const [threads, setThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [planResult, setPlanResult] = useState(null);

  const [chatMessage, setChatMessage] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);

  
  useEffect(() => {
    if (localStorage.getItem("access") && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);


  const loadThreads = useCallback(async () => {
    setLoadingThreads(true);
    try {
      const res = await api.get("llm/threads/");
      setThreads(res.data);

      if (threadFromUrl) {
        setSelectedId(Number(threadFromUrl));
      } else if (!selectedId && res.data.length > 0) {
        setSelectedId(res.data[0].id);
      }
    } catch {
      setError("Failed to load chats");
    } finally {
      setLoadingThreads(false);
    }
  }, [selectedId, threadFromUrl]);


  const loadMessages = useCallback(async (threadId) => {
    if (!threadId) return;
    try {
      const res = await api.get(`llm/threads/${threadId}/messages/`);
      setMessages(res.data || []);
    } catch {
      setError("Failed to load messages");
    }
  }, []);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    if (selectedId) {
      loadMessages(selectedId);
    }
  }, [selectedId, loadMessages]);


  const handleCreateThread = async () => {
    try {
      const res = await api.post("llm/threads/", {
        title: "New trip",
        kind: "planner",
      });
      setThreads((prev) => [res.data, ...prev]);
      setSelectedId(res.data.id);
      setMessages([]);
    } catch {
      setError("Failed to create chat");
    }
  };

  
  const handleDeleteThread = async (id) => {
    try {
      await api.delete(`llm/threads/${id}/`);
      const updated = threads.filter((t) => t.id !== id);
      setThreads(updated);

      if (id === selectedId) {
        setSelectedId(updated[0]?.id || null);
        setMessages([]);
      }
    } catch {
      setError("Failed to delete chat");
    }
  };

  
  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!selectedId || !chatMessage.trim()) return;

    const content = chatMessage.trim();
    setChatMessage("");
    setSendingMessage(true);

    const tempMsg = {
      id: Date.now(),
      role: "user",
      content,
    };
    setMessages((prev) => [...prev, tempMsg]);

    try {
      const res = await api.post(`llm/threads/${selectedId}/messages/`, {
        message: content,
      });

      setMessages((prev) => [
        ...prev,
        {
          id: `ai-${Date.now()}`,
          role: "assistant",
          content: res.data.response || "",
        },
      ]);

      if (res.data.plan) {
        const decorated = decoratePlan(res.data.plan);
        setPlanResult(decorated);
        setMapOpen(true);
      }
    } catch {
      setError("Message failed");
    } finally {
      setSendingMessage(false);
    }
  };

  return (
    <div className="planner-shell">
      
      {/* SIDEBAR */}
      <aside className="planner-sidebar">
        <div className="sidebar-header">
          <h2>Travel Chat</h2>
          <button className="add-btn" onClick={handleCreateThread}>＋</button>
        </div>

        <div className="thread-list">
          {threads.map((thread) => (
            <div key={thread.id} className="thread-row">
              <button
                className={`thread-item ${selectedId === thread.id ? "active" : ""}`}
                onClick={() => setSelectedId(thread.id)}
              >
                {thread.title || "Untitled"}
              </button>
              {/* <span onClick={() => handleDeleteThread(thread.id)}>✕</span> */}
            </div>
          ))}
        </div>
      </aside>

      {/* CHAT */}
      <section className="chat-panel">
        <div className="chat-messages">
          {messages.map((msg) => (
            <div key={msg.id} className={`message ${msg.role}`}>
              {msg.role === "assistant" ? (
                <ReactMarkdown>{msg.content || ""}</ReactMarkdown>
              ) : (
                <p>{msg.content}</p>
              )}
            </div>
          ))}
        </div>

        <form className="chat-input" onSubmit={handleSendMessage}>
          <textarea
            value={chatMessage}
            onChange={(e) => setChatMessage(e.target.value)}
            placeholder="Write message..."
          />
          <button type="submit">➤</button>
        </form>
      </section>

      {/* RIGHT PANEL */}
      <aside className="right-panel">
        <div className="map-box">
          {mapOpen && <TravelPlannerMap plan={planResult} />}
        </div>

        <div className="final-box">
          <h3>Final Trip:</h3>
          {planResult?.itinerary?.map((day) => (
            <p key={day.day}>
              <strong>Day {day.day}</strong> — {day.summary}
            </p>
          ))}
        </div>
      </aside>

      {error && <div className="error">{error}</div>}
    </div>
  );
}