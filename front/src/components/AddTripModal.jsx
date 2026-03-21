import React, { useEffect, useState } from "react";
import api from "../api/axios";

export default function AddTripModal({
  isOpen,
  onClose,
  tripCategories,
  onTripCreated,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const [uploadPreview, setUploadPreview] = useState("");
  const [newTrip, setNewTrip] = useState({
    title: "",
    place: "",
    startDate: "",
    endDate: "",
    budget: "",
    comment: "",
  });

  useEffect(() => {
    if (isOpen) {
      setSubmitting(false);
      setSubmitError("");
      setSubmitSuccess("");
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const resetForm = () => {
    setNewTrip({
      title: "",
      place: "",
      startDate: "",
      endDate: "",
      budget: "",
      comment: "",
    });
    setUploadPreview("");
  };

  const handleClose = () => {
    setSubmitting(false);
    setSubmitError("");
    setSubmitSuccess("");
    resetForm();
    onClose();
  };

  const handleChange = (e) => {
    setNewTrip((prev) => ({ ...prev, [e.target.name]: e.target.value }));
  };

  const handleTripFileUpload = (event) => {
    const file = event.target.files?.[0];
    if (!file) {
      setUploadPreview("");
      return;
    }
    const reader = new FileReader();
    reader.onload = () => {
      const result = typeof reader.result === "string" ? reader.result : "";
      setUploadPreview(result);
    };
    reader.readAsDataURL(file);
  };

  const computeDurationDays = (start, end) => {
    if (!start || !end) return 1;
    const startDate = new Date(start);
    const endDate = new Date(end);
    if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) return 1;
    const diffMs = endDate.getTime() - startDate.getTime();
    const days = Math.floor(diffMs / (1000 * 60 * 60 * 24)) + 1;
    return Math.max(1, days);
  };

  const handleAddTrip = async (e) => {
    e.preventDefault();
    if (!newTrip.title || !newTrip.place) return;

    const firstCategoryId = tripCategories?.[0]?.id;
    if (!firstCategoryId) {
      setSubmitError("No categories available. Please try again later.");
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    setSubmitSuccess("");

    const duration_days = computeDurationDays(newTrip.startDate, newTrip.endDate);
    const media_urls = uploadPreview ? [uploadPreview] : [];
    const available_dates = newTrip.startDate ? [newTrip.startDate] : [];

    try {
      const createPayload = {
        title: newTrip.title.trim(),
        category_id: Number(firstCategoryId),
        destination: newTrip.place.trim(),
        duration_days,
        available_dates,
        price: newTrip.budget === "" ? 0 : Number(newTrip.budget),
        itinerary_json: newTrip.comment ? { notes: newTrip.comment.trim() } : {},
        media_urls,
        visibility: "PUBLIC",
      };

      const createRes = await api.post("marketplace/advisor/trips/", createPayload);
      const createdId = createRes.data?.id;
      if (!createdId) throw new Error("Trip creation failed.");
      await api.post(`marketplace/advisor/trips/${createdId}/submit/`);

      setSubmitSuccess("Trip submitted for review. Status: PENDING.");
      resetForm();
      if (onTripCreated) await onTripCreated();
    } catch (err) {
      const responseData = err?.response?.data;
      const detail = responseData?.detail || err?.userMessage || "Failed to submit trip.";
      setSubmitError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>Add New Trip</h2>
          <span className="close-btn" onClick={handleClose}>✕</span>
        </div>

        <form onSubmit={handleAddTrip}>
          <div className="modal-body">
            <input type="file" accept="image/*" onChange={handleTripFileUpload} />

            <input
              type="text"
              name="title"
              placeholder="Trip Name"
              value={newTrip.title}
              onChange={handleChange}
              required
            />

            <input
              type="text"
              name="place"
              placeholder="Place"
              value={newTrip.place}
              onChange={handleChange}
              required
            />

            <div className="date-row">
              <input
                type="date"
                name="startDate"
                value={newTrip.startDate}
                onChange={handleChange}
              />
              <input
                type="date"
                name="endDate"
                value={newTrip.endDate}
                onChange={handleChange}
              />
            </div>

            <input
              type="number"
              name="budget"
              placeholder="Budget"
              value={newTrip.budget}
              onChange={handleChange}
            />

            <textarea
              name="comment"
              placeholder="Additional information"
              rows={3}
              value={newTrip.comment}
              onChange={handleChange}
            />
          </div>

          {submitError ? <div className="trip-form-error">{submitError}</div> : null}
          {submitSuccess ? <div className="trip-form-success">{submitSuccess}</div> : null}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              Cancel
            </button>
            <button type="submit" className="save-btn" disabled={submitting}>
              {submitting ? "Submitting..." : "Add Trip"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
