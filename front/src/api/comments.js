import api from "./axios";

function normalizeCommentsPayload(data) {
  if (Array.isArray(data)) {
    return { results: data, count: data.length, next: null, previous: null };
  }
  if (data && Array.isArray(data.results)) {
    return {
      results: data.results,
      count: data.count ?? data.results.length,
      next: data.next ?? null,
      previous: data.previous ?? null,
    };
  }
  return { results: [], count: 0, next: null, previous: null };
}

export async function fetchPlaceComments(placeId, { page = 1, pageSize } = {}) {
  const params = { page };
  if (pageSize != null) params.page_size = pageSize;
  const response = await api.get(`places/${placeId}/comments/`, { params });
  return normalizeCommentsPayload(response.data);
}

export async function createPlaceComment(placeId, commentText) {
  const response = await api.post(`places/${placeId}/comments/`, {
    comment_text: commentText,
  });
  return response.data;
}

export async function likePlaceComment(placeId, commentId) {
  const response = await api.post(
    `places/${placeId}/comments/${commentId}/like/`
  );
  return response.data;
}

export async function unlikePlaceComment(placeId, commentId) {
  const response = await api.delete(
    `places/${placeId}/comments/${commentId}/like/`
  );
  return response.data;
}
