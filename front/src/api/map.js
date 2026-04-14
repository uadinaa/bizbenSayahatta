import api from "./axios";

// Список всех пользователей с публичными мапами
export const getSharedMaps = async () => {
  const response = await api.get("places/users/shared-maps/");
  const payload = response.data;
  if (Array.isArray(payload)) return payload;
  if (Array.isArray(payload?.results)) return payload.results;
  return [];
};

// Получить конкретную публичную карту пользователя
export const getUserMap = async (userId, shareToken) => {
  const params = shareToken ? { share_token: shareToken } : {};
  const response = await api.get(`places/users/${userId}/map/`, { params });
  return response.data;
};

/**
 * @returns {Promise<Array<{ lat: number, lng: number, name: string, country: string }>>}
 */
export const getPublicMapMarkers = async (userId, shareToken) => {
  const params = shareToken ? { share_token: shareToken } : {};
  const response = await api.get(`places/users/${userId}/map/markers/`, { params });
  return Array.isArray(response.data) ? response.data : [];
};