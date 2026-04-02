import api from "./axios";

/** Fetch active or archived chats for the current user. */
export function fetchChats({ archived = false } = {}) {
  const suffix = archived ? "?archived=true" : "";
  return api.get(`llm/threads/${suffix}`);
}

/** Fetch chat messages for the selected chat. */
export function fetchChatMessages(threadId) {
  return api.get(`llm/threads/${threadId}/messages/`);
}

/** Create a fresh planner chat thread. */
export function createChatThread(payload) {
  return api.post("llm/threads/", payload);
}

/** Send a message to the selected chat. */
export function sendChatMessage(threadId, message) {
  return api.post(`llm/threads/${threadId}/messages/`, { message });
}

/** Request a planner trip build for the selected chat. */
export function generateChatPlan(threadId, payload) {
  return api.post(`llm/threads/${threadId}/plan/`, payload);
}

/** Fetch the persisted final trip for a chat. */
export function fetchChatTrip(threadId) {
  return api.get(`chats/${threadId}/trip/`);
}

/** Toggle the archived state of a chat. */
export function toggleChatArchive(threadId) {
  return api.patch(`llm/threads/${threadId}/archive/`);
}

/** Permanently delete a chat thread. */
export function deleteChatThread(threadId) {
  return api.delete(`llm/threads/${threadId}/`);
}

