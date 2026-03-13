import api from "./axios";

// Пробуем разные варианты URL
export const fetchPlaceComments = async (placeId) => {
  try {
    // Вариант 1: С /api/ префиксом (самый вероятный)
    const response = await api.get(`/api/places/${placeId}/comments/`);
    return response.data;
  } catch (error) {
    console.error("Error fetching comments (attempt 1):", error);
    
    try {
      // Вариант 2: Без /api/ префикса
      const response = await api.get(`/places/${placeId}/comments/`);
      return response.data;
    } catch (error2) {
      console.error("Error fetching comments (attempt 2):", error2);
      
      try {
        // Вариант 3: С review или другим именем
        const response = await api.get(`/api/places/${placeId}/reviews/`);
        return response.data;
      } catch (error3) {
        console.error("All attempts failed:", error3);
        throw error;
      }
    }
  }
};

export const createPlaceComment = async (placeId, commentText) => {
  try {
    // Вариант 1: С /api/ префиксом
    const response = await api.post(`/api/places/${placeId}/comments/`, {
      comment_text: commentText,
    });
    return response.data;
  } catch (error) {
    console.error("Error creating comment (attempt 1):", error);
    
    try {
      // Вариант 2: Без /api/ префикса
      const response = await api.post(`/places/${placeId}/comments/`, {
        comment_text: commentText,
      });
      return response.data;
    } catch (error2) {
      console.error("Error creating comment (attempt 2):", error2);
      
      try {
        // Вариант 3: С review вместо comment
        const response = await api.post(`/api/places/${placeId}/reviews/`, {
          comment_text: commentText,
        });
        return response.data;
      } catch (error3) {
        console.error("All attempts failed:", error3);
        throw error;
      }
    }
  }
};