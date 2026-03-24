import { MONTH_OPTIONS } from "../../constants/mapConstants";

export default function AddPlaceModal({ newPlace, yearOptions, onInputChange, onAdd, onClose, title = "Add New Place",
  submitLabel = "Add", }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>

        <input type="text" name="city" placeholder="City"
          value={newPlace.city} onChange={onInputChange} />
        <input type="text" name="country" placeholder="Country"
          value={newPlace.country} onChange={onInputChange} />

        <div className="month-year-row">
          <select name="month" value={newPlace.month} onChange={onInputChange}>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{m.label}</option>
            ))}
          </select>
          <select name="year" value={newPlace.year} onChange={onInputChange}>
            {yearOptions.map((y) => (
              <option key={y} value={y}>{y}</option>
            ))}
          </select>
        </div>

        <div className="modal-actions">
          <button onClick={onAdd}>{submitLabel}</button>
          <button onClick={onClose}>Cancel</button>
        </div>
      </div>
    </div>
  );
}