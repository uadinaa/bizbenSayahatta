import { MONTH_OPTIONS } from "../../constants/mapConstants";

const capitalizeFirstLetter = (str) => {
  if (!str) return "";
  return str.charAt(0).toUpperCase() + str.slice(1).toLowerCase();
};

export default function AddPlaceModal({ newPlace, yearOptions, onInputChange, onAdd, onClose, title = "Add New Place",
  submitLabel = "Add", }) {
  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>

        <input
          type="text"
          name="city"
          placeholder="City"
          value={newPlace.city}
          onChange={(e) => {
            const { name, value } = e.target;
            const formattedValue =
              name === "city" || name === "country"
                ? capitalizeFirstLetter(value)
                : value;

            onInputChange({ target: { name, value: formattedValue } });
          }}
        />

        <input
          type="text"
          name="country"
          placeholder="Country"
          value={newPlace.country}
          onChange={(e) => {
            const { name, value } = e.target;
            const formattedValue =
              name === "city" || name === "country"
                ? capitalizeFirstLetter(value)
                : value;

            onInputChange({ target: { name, value: formattedValue } });
          }}
        />

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