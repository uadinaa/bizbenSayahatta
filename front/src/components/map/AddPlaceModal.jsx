import { MONTH_OPTIONS } from "../../constants/mapConstants";
import { useTranslation } from "react-i18next";

export default function AddPlaceModal({ newPlace, yearOptions, onInputChange, onAdd, onClose, title = "Add New Place",
  submitLabel = "Add", }) {
  const { t } = useTranslation();

  return (
    <div className="modal-overlay">
      <div className="modal">
        <h3>{title}</h3>

        <input type="text" name="city" placeholder={t("map.city")}
          value={newPlace.city} onChange={onInputChange} />
        <input type="text" name="country" placeholder={t("map.country")}
          value={newPlace.country} onChange={onInputChange} />

        <div className="month-year-row">
          <select name="month" value={newPlace.month} onChange={onInputChange}>
            {MONTH_OPTIONS.map((m) => (
              <option key={m.value} value={m.value}>{t(`map.months.${m.value}`, { defaultValue: m.label })}</option>
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
          <button onClick={onClose}>{t("map.cancel")}</button>
        </div>
      </div>
    </div>
  );
}
