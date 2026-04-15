import React, { useEffect, useState } from "react";
import api from "../api/axios";
import { useTranslation } from "react-i18next";

export default function AddTripModal({
  isOpen,
  onClose,
  tripCategories,
  onTripCreated,
}) {
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [submitSuccess, setSubmitSuccess] = useState("");
  const { t } = useTranslation(); 
  const [uploadPreview, setUploadPreview] = useState("");
  const [newTrip, setNewTrip] = useState({
    title: "",
    place: "",
    startDate: "",
    endDate: "",
    budget: "",
    comment: "",
    category_id: "",
    maxTravelers: 10,
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
      category_id: "",
      maxTravelers: 10,
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
        category_id: Number(newTrip.category_id),
        destination: newTrip.place.trim(),
        duration_days,
        available_dates,
        price: newTrip.budget === "" ? 0 : Number(newTrip.budget),
        itinerary_json: newTrip.comment ? { notes: newTrip.comment.trim() } : {},
        media_urls,
        visibility: "PUBLIC",
        max_travelers: newTrip.maxTravelers || 10,
      };

      const createRes = await api.post("marketplace/advisor/trips/", createPayload);
      const createdId = createRes.data?.id;

      console.log("CREATED:", createRes.data);

      const submitRes = await api.post(`marketplace/advisor/trips/${createdId}/submit/`);

      console.log("SUBMIT SUCCESS:", submitRes.data);
      setSubmitSuccess("Trip submitted for review. Status: PENDING.");
      resetForm();


    } catch (err) {
      const responseData = err?.response?.data;
      console.log("SUBMIT ERROR FULL:", err?.response?.data); // 🔥 ВОТ ЭТО ГЛАВНОЕ
      const detail = responseData?.detail || err?.userMessage || "Failed to submit trip.";
      console.log(
        "REAL ERROR:", err?.response?.data?.error?.details?.non_field_errors
      );
      setSubmitError(detail);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="modal-overlay" onClick={handleClose}>
      <div className="modal" onClick={(e) => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{t("inspiration.addNewTrip")}</h2>
          <span className="close-btn" onClick={handleClose}>✕</span>
        </div>

        <form onSubmit={handleAddTrip}>
          <div className="modal-body">
            <label>
                <span>{t("Image")}</span>
            <input type="file" accept="image/*" onChange={handleTripFileUpload} />
            </label>

            <label>
                <span>{t("advisorTrips.tripName")}</span>
            <input
              type="text"
              name="title"
              placeholder={t("advisorTrips.tripName")}
              value={newTrip.title}
              onChange={handleChange}
              required
            />
            </label>

              <label>
                <span>{t("advisorTrips.category")}</span>
                <select
                  name="category_id"
                  value={newTrip.category_id}
                  onChange={handleChange}
                  required
                >
                  <option value="">{t("advisorTrips.selectCategory")}</option>
                  {tripCategories.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>
            
            <label>
                <span>{t("advisorTrips.place")}</span>
            <input
              type="text"
              name="place"
              placeholder={t("advisorTrips.place")}
              value={newTrip.place}
              onChange={handleChange}
              required
            />
            </label>
            
            <label>
                <span>{t("Date")}</span>
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
            </label>
            
            <label>
                <span>{t("advisorTrips.budget")}</span>
            <input
              type="number"
              name="budget"
              placeholder={t("advisorTrips.budget")}
              value={newTrip.budget}
              onChange={handleChange}
            />
            </label>

            <label>
                <span>{t("advisorTrips.maxTravelers")}</span>
            <input
              type="number"
              name="maxTravelers"
              placeholder={t("advisorTrips.maxTravelers")}
              value={newTrip.maxTravelers}
              onChange={handleChange}
              min="1"
              max="100"
            />
            </label>

            <label>
                <span>{t("advisorTrips.additionalInformation")}</span>
            <textarea
              name="comment"
              placeholder={t("advisorTrips.additionalInformation")}
              rows={3}
              value={newTrip.comment}
              onChange={handleChange}
            />
            </label>
          </div>

          {submitError ? <div className="trip-form-error">{submitError}</div> : null}
          {submitSuccess ? <div className="trip-form-success">{submitSuccess}</div> : null}

          <div className="modal-actions">
            <button type="button" className="cancel-btn" onClick={handleClose}>
              {t("advisorTrips.cancel")}
            </button>
            <button type="submit" className="save-btn" disabled={submitting}>
              {submitting ? t("advisorTrips.submitting") : t("advisorTrips.addTrip")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}