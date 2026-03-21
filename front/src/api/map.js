import api from "./axios";

// Список всех пользователей с публичными мапами
export const getSharedMaps = async () => {
  const response = await api.get("places/users/shared-maps/");
  return response.data;
};

// Получить конкретную публичную карту пользователя
export const getUserMap = async (userId) => {
  const response = await api.get(`places/users/${userId}/map/`);
  return response.data;
};