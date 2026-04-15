import api from "./axios";

/**
 * Toggle a trip in the user's saved trips (wishlist).
 * @param {number} tripId - The trip ID
 * @param {boolean} isSaved - Current saved state (true = will remove, false = will save)
 * @returns {Promise<{trip_id: number, is_saved: boolean}>}
 */
export const toggleSavedTrip = async (tripId, isSaved) => {
  if (isSaved) {
    // Remove from saved
    const response = await api.delete(`marketplace/public/trips/${tripId}/save/`);
    return response.data;
  } else {
    // Save to wishlist
    const response = await api.post(`marketplace/public/trips/${tripId}/save/`);
    return response.data;
  }
};

/**
 * Book a trip.
 * @param {number} tripId - The trip ID
 * @param {number} numberOfTravelers - Number of travelers
 * @returns {Promise<object>} - Booking data
 */
export const bookTrip = async (tripId, numberOfTravelers = 1) => {
  const response = await api.post(`marketplace/public/trips/${tripId}/book/`, {
    number_of_travelers: numberOfTravelers,
  });
  return response.data;
};

/**
 * Cancel a booking.
 * @param {number} bookingId - The booking ID
 * @param {string} reason - Cancellation reason
 * @returns {Promise<object>} - Updated booking data
 */
export const cancelBooking = async (bookingId, reason = "") => {
  const response = await api.post(`marketplace/bookings/${bookingId}/cancel/`, {
    reason,
  });
  return response.data;
};

/**
 * Get user's bookings.
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} - List of bookings
 */
export const getMyBookings = async (status = null) => {
  const params = status ? { status } : {};
  const response = await api.get("marketplace/my-bookings/", { params });
  return response.data;
};

/**
 * Get bookings for a specific trip (for advisor).
 * @param {number} tripId - The trip ID
 * @param {string} status - Optional status filter
 * @returns {Promise<Array>} - List of bookings
 */
export const getTripBookings = async (tripId, status = null) => {
  const params = status ? { status } : {};
  const response = await api.get(`marketplace/public/trips/${tripId}/bookings/`, { params });
  return response.data;
};

/**
 * Confirm a booking (for advisor).
 * @param {number} bookingId - The booking ID
 * @returns {Promise<object>} - Updated booking data
 */
export const confirmBooking = async (bookingId) => {
  const response = await api.post(`marketplace/bookings/${bookingId}/confirm/`);
  return response.data;
};
