import { useTranslation } from "react-i18next";

export default function AdvisorModal({
  advisorForm,
  setAdvisorForm,
  advisorLoading,
  advisorError,
  onSubmit,
  onClose,
  tripCategories = [],
}) {
  const { t } = useTranslation();
  console.log("tripCategories in AdvisorModal:", tripCategories);


  return (
    <div className="modal-overlay">
      <div className="modal advisor-modal">
        <div className="advisor-modal-header">
          <h3>{t("profile.advisorTitle")}</h3>
          <p className="advisor-rules">
            {t("profile.advisorDescription")}
          </p>
        </div>

        <div className="advisor-form-stack">          
              <label>
                <span>{t("advisorTrips.category")}</span>
                <select
                  name="category_id"
                  value={advisorForm.category_id} 
                  onChange={(e) => setAdvisorForm((prev) => ({ ...prev, category_id: e.target.value }))
              }
                  required
                >
                  
                  <option value="">{t("advisorTrips.selectCategory")}</option>
                  {tripCategories?.map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name}
                    </option>
                  ))}
                </select>
              </label>

          <label>
            {t("profile.instagram")}
            <input
              type="text"
              placeholder="https://instagram.com/..."
              value={advisorForm.instagram}
              onChange={(e) =>
                setAdvisorForm((prev) => ({ ...prev, instagram: e.target.value }))
              }
            />
          </label>

          <label>
            {t("profile.portfolio")}
            <textarea
              rows={4}
              placeholder="https://..."
              value={advisorForm.portfolioText}
              onChange={(e) =>
                setAdvisorForm((prev) => ({ ...prev, portfolioText: e.target.value }))
              }
            />
          </label>

          <label>
            {t("profile.aboutTrips")}
            <textarea
              rows={3}
              placeholder={t("profile.aboutTripsPlaceholder")}
              value={advisorForm.notes}
              onChange={(e) =>
                setAdvisorForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </label>

          <label className="advisor-cv-label">
            {t("profile.cvOptional")}
            <input
              type="file"
              onChange={(e) =>
                setAdvisorForm((prev) => ({
                  ...prev,
                  cvFile: e.target.files?.[0] || null,
                }))
              }
            />
          </label>

          <div className="advisor-checks">
            <label className="check-row">
              <input
                type="checkbox"
                checked={advisorForm.contractAccepted}
                onChange={(e) =>
                  setAdvisorForm((prev) => ({
                    ...prev,
                    contractAccepted: e.target.checked,
                  }))
                }
              />
              {t("profile.acceptContract")}
            </label>

            <label className="check-row">
              <input
                type="checkbox"
                checked={advisorForm.termsAccepted}
                onChange={(e) =>
                  setAdvisorForm((prev) => ({
                    ...prev,
                    termsAccepted: e.target.checked,
                  }))
                }
              />
              {t("profile.acceptTerms")}
            </label>
          </div>
        </div>

        {advisorError && <p className="advisor-error">{advisorError}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            {t("profile.cancel")}
          </button>
          <button
            type="button"
            className="save-btn"
            onClick={onSubmit}
            disabled={
              advisorLoading ||
              !advisorForm.contractAccepted ||
              !advisorForm.termsAccepted
            }
          >
            {advisorLoading ? t("profile.redirecting") : t("profile.continueToPayment")}
          </button>
        </div>
      </div>
    </div>
  );
}
