export default function AdvisorModal({
  advisorForm, setAdvisorForm, categories,
  advisorLoading, advisorError, advisorSuccess,
  toggleCategory, onSubmit, onClose,
}) {
  return (
    <div className="modal-overlay">
      <div className="modal advisor-modal">
        <h3>Become TripAdvisor</h3>
        <p className="advisor-rules">Read rules, fill the form, and send application to manager review.</p>

        <label>Advisor type / categories
          <div className="chips-wrap">
            {categories.map((cat) => (
              <button key={cat.id} type="button"
                className={`chip ${advisorForm.categoryIds.includes(cat.id) ? "chip-selected" : ""}`}
                onClick={() => toggleCategory(cat.id)}>
                {cat.name}
              </button>
            ))}
          </div>
        </label>

        <label>Subscription plan
          <select value={advisorForm.subscriptionPlan}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, subscriptionPlan: e.target.value }))}>
            <option value="monthly">Monthly</option>
            <option value="quarterly">Quarterly</option>
          </select>
        </label>

        <label>Payment reference
          <input type="text" placeholder="Transaction/Invoice ID" value={advisorForm.paymentReference}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, paymentReference: e.target.value }))} />
        </label>

        <label>Instagram / social
          <input type="text" placeholder="https://instagram.com/..." value={advisorForm.instagram}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, instagram: e.target.value }))} />
        </label>

        <label>Portfolio / trip links (one per line)
          <textarea rows={4} placeholder="https://..." value={advisorForm.portfolioText}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, portfolioText: e.target.value }))} />
        </label>

        <label>About your trips
          <textarea rows={3} placeholder="What kind of trips you create" value={advisorForm.notes}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, notes: e.target.value }))} />
        </label>

        <label>CV (optional)
          <input type="file"
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, cvFile: e.target.files?.[0] || null }))} />
        </label>

        <label className="check-row">
          <input type="checkbox" checked={advisorForm.contractAccepted}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, contractAccepted: e.target.checked }))} />
          I accept contract
        </label>

        <label className="check-row">
          <input type="checkbox" checked={advisorForm.termsAccepted}
            onChange={(e) => setAdvisorForm((prev) => ({ ...prev, termsAccepted: e.target.checked }))} />
          I accept terms
        </label>

        {advisorError && <p className="advisor-error">{advisorError}</p>}
        {advisorSuccess && <p className="advisor-success">{advisorSuccess}</p>}

        <div className="modal-actions">
          <button className="cancel-btn" onClick={onClose}>Cancel</button>
          <button className="save-btn" onClick={onSubmit}
            disabled={advisorLoading || !advisorForm.contractAccepted || !advisorForm.termsAccepted}>
            {advisorLoading ? "Sending..." : "Submit"}
          </button>
        </div>
      </div>
    </div>
  );
}