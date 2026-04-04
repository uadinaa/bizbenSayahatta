import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { useDispatch, useSelector } from "react-redux";
import ReactMarkdown from "react-markdown";
import TravelPlannerMap from "../components/TravelPlannerMap";
import DeleteChatModal from "../components/chat/DeleteChatModal";
import FinalTripPanel from "../components/chat/FinalTripPanel";
import {
  createChatThread,
  deleteChatThread,
  fetchChatMessages,
  fetchChats,
  fetchChatTrip,
  sendChatMessage,
  toggleChatArchive,
} from "../api/chats";
import { fetchProfile } from "../slices/authSlice";
import "../styles/PlannerTest.css";

const DAY_COLORS = ["#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE", "#805AD5"];

function applyDayColors(itinerary = []) {
  // Keep itinerary colors aligned with the map route palette.
  return itinerary.map((day, index) => ({
    ...day,
    color: day.color || DAY_COLORS[index % DAY_COLORS.length],
  }));
}

function decorateTripPayload(payload) {
  // Normalize trip payloads from both the trip endpoint and live AI responses.
  if (!payload) return null;

  const itinerary = applyDayColors(payload.itinerary || payload.plan_snapshot?.itinerary || []);
  const route = (payload.route || itinerary.map((day, index) => ({
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
  }))).map((day, index) => ({
    ...day,
    color: day.color || DAY_COLORS[index % DAY_COLORS.length],
  }));

  return {
    city: payload.city || payload.plan_snapshot?.city || "",
    country: payload.country || payload.plan_snapshot?.country || "",
    itinerary,
    route,
    response_markdown: payload.response_markdown || payload.plan_snapshot?.response_markdown || "",
  };
}

function combineThreads(activeThreads, archivedThreads) {
  // Build a quick lookup list for selected-thread resolution.
  return [...activeThreads, ...archivedThreads];
}

function ArchiveIcon() {
  // Render the subtle archive action icon.
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3 4.5a1.5 1.5 0 0 1 1.5-1.5h11A1.5 1.5 0 0 1 17 4.5v2A1.5 1.5 0 0 1 15.5 8H4.5A1.5 1.5 0 0 1 3 6.5zm1.5 4.5h11v5.5A1.5 1.5 0 0 1 14 16H6a1.5 1.5 0 0 1-1.5-1.5zM8 11h4"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function DeleteIcon() {
  // Render the subtle delete action icon.
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M5.5 6.5h9m-7.5 0V5a1 1 0 0 1 1-1h4a1 1 0 0 1 1 1v1.5m-6 0v8a1 1 0 0 0 1 1h4a1 1 0 0 0 1-1v-8m-4 2.5v3m2-3v3M4 6.5h12"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

function MapIcon() {
  // Render the map toggle icon.
  return (
    <svg viewBox="0 0 20 20" aria-hidden="true">
      <path
        d="M3.5 5.5 8 4l4 1.5L16.5 4v10.5L12 16l-4-1.5-4.5 1.5zm4.5-1.5v10.5m4-9v10.5"
        fill="none"
        stroke="currentColor"
        strokeWidth="1.6"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export default function PlannerTest() {
  const dispatch = useDispatch();
  const navigate = useNavigate();
  const { user } = useSelector((state) => state.auth);
  const [searchParams] = useSearchParams();
  const threadFromUrl = searchParams.get("thread");

  const [threads, setThreads] = useState([]);
  const [archivedThreads, setArchivedThreads] = useState([]);
  const [selectedId, setSelectedId] = useState(null);
  const [messages, setMessages] = useState([]);
  const [chatMessage, setChatMessage] = useState("");
  const [loadingThreads, setLoadingThreads] = useState(false);
  const [loadingMessages, setLoadingMessages] = useState(false);
  const [loadingTrip, setLoadingTrip] = useState(false);
  const [sendingMessage, setSendingMessage] = useState(false);
  const [deletingChatId, setDeletingChatId] = useState(null);
  const [tripCache, setTripCache] = useState({});
  const [currentTrip, setCurrentTrip] = useState(null);
  const [error, setError] = useState("");
  const [mapOpen, setMapOpen] = useState(false);
  const [showArchived, setShowArchived] = useState(true);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

  const messageRequestRef = useRef(0);
  const tripRequestRef = useRef(0);

  const allThreads = useMemo(
    () => combineThreads(threads, archivedThreads),
    [threads, archivedThreads]
  );
  const selectedThread = useMemo(
    () => allThreads.find((thread) => thread.id === selectedId) || null,
    [allThreads, selectedId]
  );

  const filteredThreads = useMemo(() => {
  if (!searchQuery.trim()) return threads;

  return threads.filter((thread) =>
    (thread.title || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );
}, [threads, searchQuery]);

const filteredArchivedThreads = useMemo(() => {
  if (!searchQuery.trim()) return archivedThreads;

  return archivedThreads.filter((thread) =>
    (thread.title || "")
      .toLowerCase()
      .includes(searchQuery.toLowerCase())
  );
}, [archivedThreads, searchQuery]);

  useEffect(() => {
    if (localStorage.getItem("access") && !user) {
      dispatch(fetchProfile());
    }
  }, [dispatch, user]);

  const resolveNextSelection = useCallback((activeThreads, archivedList) => {
    // Pick the next visible chat after archive/delete actions.
    const requestedId = Number(threadFromUrl);
    const combined = combineThreads(activeThreads, archivedList);
    if (selectedId && combined.some((thread) => thread.id === selectedId)) {
      return selectedId;
    }
    if (requestedId && combined.some((thread) => thread.id === requestedId)) {
      return requestedId;
    }
    return activeThreads[0]?.id || archivedList[0]?.id || null;
  }, [selectedId, threadFromUrl]);

  const loadThreads = useCallback(async () => {
    // Load active and archived chats so the sidebar can move items instantly.
    setLoadingThreads(true);
    setError("");
    try {
      const [activeResponse, archivedResponse] = await Promise.all([
        fetchChats(),
        fetchChats({ archived: true }),
      ]);
      const nextThreads = activeResponse.data || [];
      const nextArchived = archivedResponse.data || [];
      setThreads(nextThreads);
      setArchivedThreads(nextArchived);
      setSelectedId(resolveNextSelection(nextThreads, nextArchived));
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Failed to load chats");
    } finally {
      setLoadingThreads(false);
    }
  }, [resolveNextSelection]);

  useEffect(() => {
    loadThreads();
  }, [loadThreads]);

  useEffect(() => {
    // Keep the URL in sync with the currently open chat.
    if (selectedId) {
      navigate(`/chat?thread=${selectedId}`, { replace: true });
    } else {
      navigate("/chat", { replace: true });
    }
  }, [navigate, selectedId]);

  useEffect(() => {
    // Load messages for the active chat without flashing the previous thread.
    if (!selectedId) {
      setMessages([]);
      return undefined;
    }

    let cancelled = false;
    const requestId = messageRequestRef.current + 1;
    messageRequestRef.current = requestId;
    setMessages([]);
    setLoadingMessages(true);

    fetchChatMessages(selectedId)
      .then((response) => {
        if (cancelled || messageRequestRef.current !== requestId) return;
        setMessages(response.data || []);
      })
      .catch((requestError) => {
        if (cancelled || messageRequestRef.current !== requestId) return;
        setError(requestError.response?.data?.detail || "Failed to load messages");
      })
      .finally(() => {
        if (cancelled || messageRequestRef.current !== requestId) return;
        setLoadingMessages(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId]);

  useEffect(() => {
    // Load the selected chat's persisted trip with cache-aware behavior.
    if (!selectedId) {
      setCurrentTrip(null);
      setLoadingTrip(false);
      setMapOpen(false);
      return undefined;
    }

    if (Object.prototype.hasOwnProperty.call(tripCache, selectedId)) {
      setCurrentTrip(tripCache[selectedId]);
      setLoadingTrip(false);
      return undefined;
    }

    let cancelled = false;
    const requestId = tripRequestRef.current + 1;
    tripRequestRef.current = requestId;
    setCurrentTrip(null);
    setLoadingTrip(true);

    fetchChatTrip(selectedId)
      .then((response) => {
        if (cancelled || tripRequestRef.current !== requestId) return;
        const trip = decorateTripPayload(response.data);
        setTripCache((previous) => ({ ...previous, [selectedId]: trip }));
        setCurrentTrip(trip);
      })
      .catch((requestError) => {
        if (cancelled || tripRequestRef.current !== requestId) return;
        setError(requestError.response?.data?.detail || "Failed to load trip");
      })
      .finally(() => {
        if (cancelled || tripRequestRef.current !== requestId) return;
        setLoadingTrip(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectedId, tripCache]);

  const handleCreateThread = async () => {
    // Create a new planner chat and focus it immediately.
    try {
      const response = await createChatThread({
        title: "New trip",
        kind: "planner",
      });
      const nextThread = response.data;
      setThreads((previous) => [nextThread, ...previous]);
      setSelectedId(nextThread.id);
      setMessages([]);
      setCurrentTrip(null);
      setMapOpen(false);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Failed to create chat");
    }
  };

  const handleToggleArchive = async (thread) => {
    // Optimistically move chats between the active and archived sections.
    const wasArchived = thread.is_archived;
    const previousThreads = threads;
    const previousArchived = archivedThreads;

    if (wasArchived) {
      const unarchivedThread = { ...thread, is_archived: false };
      setArchivedThreads((previous) => previous.filter((item) => item.id !== thread.id));
      setThreads((previous) => [unarchivedThread, ...previous]);
    } else {
      const archivedThread = { ...thread, is_archived: true };
      setThreads((previous) => previous.filter((item) => item.id !== thread.id));
      setArchivedThreads((previous) => [archivedThread, ...previous]);
      if (thread.id === selectedId) {
        const remaining = threads.filter((item) => item.id !== thread.id);
        setSelectedId(remaining[0]?.id || null);
      }
    }

    try {
      await toggleChatArchive(thread.id);
      setError("");
    } catch (requestError) {
      setThreads(previousThreads);
      setArchivedThreads(previousArchived);
      if (thread.id === selectedId && !wasArchived) {
        setSelectedId(thread.id);
      }
      setError(requestError.response?.data?.detail || "Failed to update archive");
    }
  };

  const handleDeleteThread = async () => {
    // Remove a chat permanently after confirmation.
    if (!deleteTarget) return;

    const targetId = deleteTarget.id;
    setDeletingChatId(targetId);
    try {
      await deleteChatThread(targetId);
      const nextThreads = threads.filter((thread) => thread.id !== targetId);
      const nextArchived = archivedThreads.filter((thread) => thread.id !== targetId);
      setThreads(nextThreads);
      setArchivedThreads(nextArchived);
      setTripCache((previous) => {
        const nextCache = { ...previous };
        delete nextCache[targetId];
        return nextCache;
      });
      if (selectedId === targetId) {
        setSelectedId(nextThreads[0]?.id || nextArchived[0]?.id || null);
        setMessages([]);
        setCurrentTrip(null);
        setMapOpen(false);
      }
      setDeleteTarget(null);
      setError("");
    } catch (requestError) {
      setError(requestError.response?.data?.detail || "Failed to delete chat");
    } finally {
      setDeletingChatId(null);
    }
  };

  const handleSendMessage = async (event) => {
    // Send a message and refresh the visible trip cache from the response.
    event.preventDefault();
    if (!selectedId || !chatMessage.trim()) return;

    const content = chatMessage.trim();
    setChatMessage("");
    setSendingMessage(true);
    setError("");

    const tempMessage = {
      id: `temp-${Date.now()}`,
      role: "user",
      content,
    };
    setMessages((previous) => [...previous, tempMessage]);

    try {
      const response = await sendChatMessage(selectedId, content);
      setMessages((previous) => [
        ...previous,
        {
          id: `assistant-${Date.now()}`,
          role: "assistant",
          content: response.data.response || "",
        },
      ]);

      if (response.data.plan) {
        const nextTrip = decorateTripPayload(response.data.plan);
        setTripCache((previous) => ({ ...previous, [selectedId]: nextTrip }));
        setCurrentTrip(nextTrip);
      }

      setThreads((previous) => previous.map((thread) => (
        thread.id === selectedId
          ? { ...thread, updated_at: new Date().toISOString() }
          : thread
      )));
    } catch (requestError) {
      setMessages((previous) => previous.filter((message) => message.id !== tempMessage.id));
      setError(requestError.response?.data?.detail || "Message failed");
    } finally {
      setSendingMessage(false);
    }
  };

  const renderThreadList = (items, emptyLabel) => {
    // Render one sidebar section of chat rows with actions.
    if (!items.length) {
      return <p className="thread-empty">{emptyLabel}</p>;
    }

    return items.map((thread) => (
      <div key={thread.id} className={`thread-row ${selectedId === thread.id ? "is-selected" : ""}`}>
        <button
          type="button"
          className={`thread-item ${selectedId === thread.id ? "active" : ""}`}
          onClick={() => setSelectedId(thread.id)}
        >
          <span className="thread-title">{thread.title || "Untitled"}</span>
          <span className="thread-meta">{thread.city || "Planner chat"}</span>
        </button>

        <div className="thread-actions">
          <button
            type="button"
            className="thread-action-btn"
            onClick={() => handleToggleArchive(thread)}
            aria-label={thread.is_archived ? "Unarchive chat" : "Archive chat"}
            title={thread.is_archived ? "Unarchive" : "Archive"}
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 7h18" />
              <path d="M5 7l1 14h12l1-14" />
              <path d="M9 11h6" />
            </svg>
                    
          </button>
          <button
            type="button"
            className="thread-action-btn thread-action-btn--danger"
            onClick={() => setDeleteTarget(thread)}
            aria-label="Delete chat"
            title="Delete"
          >
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
              <path d="M3 6h18" />
              <path d="M8 6V4h8v2" />
              <path d="M6 6l1 14h10l1-14" />
              <path d="M10 11v6M14 11v6" />
            </svg>
          </button>
        </div>
      </div>
    ));
  };

  return (
    <div className="planner-shell">
      <aside className="planner-sidebar">
        <div className="chat-search">
          <input
            type="text"
            placeholder="Search chats..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>
        <div className="sidebar-header">
          <div>
            <h2 className="sidebar-label">Travel Chat</h2>
          </div>
          <button type="button" className="add-btn" onClick={handleCreateThread}>
            ＋
          </button>
        </div>

        {loadingThreads ? <p className="sidebar-note">Loading chats...</p> : null}

        <div className="thread-section">
          <div className="thread-section-header">
            
          </div>
          <div className="thread-list">
            {renderThreadList(filteredThreads, "No chats found.")}
          </div>
        </div>

        <div className="thread-section">
          <button
            type="button"
            className="thread-section-toggle"
            onClick={() => setShowArchived((previous) => !previous)}
          >
            <div className="section-left">
              <span className="section-title">Archived</span>
              <span className="section-count">{archivedThreads.length}</span>
            </div>
            <span>{showArchived ? "−" : "+"}</span>
          </button>
          {showArchived ? (
            <div className="thread-list archived-thread-list">
              {renderThreadList(filteredArchivedThreads, "No chats found.")}
            </div>
          ) : null}
        </div>
      </aside>

      <section className="chat-panel">
        <div className="chat-header">
          <div>
            <p className="chat-header-label">Current chat</p>
            <h1>{selectedThread?.title || "Choose a chat"}</h1>
          </div>
          {selectedThread?.is_archived ? (
            <span className="archived-pill">Archived</span>
          ) : null}
        </div>

        <div className="chat-messages">
          {!selectedThread ? (
            <div className="chat-empty-state">
              Pick a chat from the sidebar or create a new one to start planning.
            </div>
          ) : null}

          {selectedThread && loadingMessages ? (
            <div className="chat-empty-state">Loading messages...</div>
          ) : null}

          {selectedThread && !loadingMessages && messages.length === 0 ? (
            <div className="chat-empty-state">
              Start the conversation and your trip summary will build on the right.
            </div>
          ) : null}

          {messages.map((message) => (
            <div key={message.id} className={`message ${message.role}`}>
              {message.role === "assistant" ? (
                <ReactMarkdown>{message.content || ""}</ReactMarkdown>
              ) : (
                <p>{message.content}</p>
              )}
            </div>
          ))}
        </div>

        <form className="chat-input" onSubmit={handleSendMessage}>
          <textarea
            value={chatMessage}
            onChange={(event) => setChatMessage(event.target.value)}
            placeholder={selectedThread ? "Write message..." : "Select a chat to start messaging"}
            disabled={!selectedThread || sendingMessage}
          />
          <button type="submit" disabled={!selectedThread || sendingMessage}>
            {sendingMessage ? "…" : "➤"}
          </button>
        </form>
      </section>

      <aside className="right-panel">
        <div className="right-panel-toolbar">
          <div>
            <p className="right-panel-label">Trip tools</p>
            <h2>{selectedThread ? "This chat's plan" : "Trip preview"}</h2>
          </div>
        </div>

        {mapOpen && selectedThread ? (
          <div className="map-box map-box--open">
            <div className="map-box-header">
              <span></span>
              <button type="button" className="map-close-btn" onClick={() => setMapOpen(false)}>
                ×
              </button>
            </div>
            <TravelPlannerMap plan={currentTrip} isOpen />
          </div>
        ) : null}

        <div className={`final-box ${mapOpen ? "final-box--split" : ""}`}>

        {selectedThread ? (
            <button
              type="button"
              className="map-toggle-btn"
              onClick={() => setMapOpen((previous) => !previous)}
            >
              <MapIcon />
              <span>{mapOpen ? "Hide Map" : "Show Map"}</span>
            </button>
          ) : null}

          {!selectedThread ? (
            <div className="trip-empty-card">
              Open a chat to view its trip summary and route.
            </div>
          ) : (
            <FinalTripPanel trip={currentTrip} loading={loadingTrip} />
          )}
        </div>

        {error ? <div className="planner-error-banner">{error}</div> : null}
      </aside>

      {deleteTarget ? (
        <DeleteChatModal
          threadTitle={deleteTarget.title}
          onClose={() => setDeleteTarget(null)}
          onConfirm={handleDeleteThread}
          deleting={deletingChatId === deleteTarget.id}
        />
      ) : null}
    </div>
  );
}
