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
export const getUserMap = async (userId) => {
  const response = await api.get(`places/users/${userId}/map/`);
  return response.data;
};