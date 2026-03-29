export default function AdvisorModal({
  advisorForm,
  setAdvisorForm,
  advisorLoading,
  advisorError,
  onSubmit,
  onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal advisor-modal">
        <div className="advisor-modal-header">
          <h3>Become TripAdvisor</h3>
          <p className="advisor-rules">
            Fill in your details. After you submit, you will be redirected to secure Stripe checkout
            to complete payment.
          </p>
        </div>

        <div className="advisor-form-stack">
          <label>
            Instagram / social
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
            Portfolio / trip links (one per line)
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
            About your trips
            <textarea
              rows={3}
              placeholder="What kind of trips you create"
              value={advisorForm.notes}
              onChange={(e) =>
                setAdvisorForm((prev) => ({ ...prev, notes: e.target.value }))
              }
            />
          </label>

          <label className="advisor-cv-label">
            CV (optional)
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
              I accept contract
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
              I accept terms
            </label>
          </div>
        </div>

        {advisorError && <p className="advisor-error">{advisorError}</p>}

        <div className="modal-actions">
          <button type="button" className="cancel-btn" onClick={onClose}>
            Cancel
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
            {advisorLoading ? "Redirecting…" : "Continue to payment"}
          </button>
        </div>
      </div>
    </div>
  );
}
