import { categories } from "../../constants/inspoConstants";
import { formatCategory } from "../../utils/placeUtils";
import { useTranslation } from "react-i18next";

export default function PlaceFilters({
  styles,
  category,
  onCategoryChange,
  priceFilter,
  onPriceFilterChange,
  dateFrom,
  onDateFromChange,
  sourceType = "all",
  dateTo,
  onDateToChange,
}) {

  const { t } = useTranslation();
  
return (
    <div className={styles.controls}>
      <div className={styles.selectRowWithShadow}>
        <div className={styles.selectBlock}>
          <span className={styles.selectLabel}>{t("inspiration.filter.bySource")}</span>
          <select className={styles.select} value={sourceType} onChange={(e) => onSourceTypeChange(e.target.value)}>
            <option value="all">{t("inspiration.filter.all")}</option>
            <option value="places">{t("inspiration.filter.places")}</option>
            <option value="tours">{t("inspiration.filter.tours")}</option>
          </select>
        </div>

        <div className={styles.selectBlock}>
          <span className={styles.selectLabel}>{t("inspiration.filter.byPrice")}</span>
          <select className={styles.select} value={priceFilter} onChange={(e) => onPriceFilterChange(e.target.value)}>
            <option value="all">{t("inspiration.filter.allPrices")}</option>
            <option value="free">🆓 {t("inspiration.filter.free")}</option>
            <option value="budget">🪙 {t("inspiration.filter.budget")}</option>
            <option value="moderate">💸 {t("inspiration.filter.moderate")}</option>
            <option value="premium">💰 {t("inspiration.filter.premium")}</option>
          </select>
        </div>

        <div className={styles.selectBlock}>
          <span className={styles.selectLabel}>{t("inspiration.filter.fromDate")}</span>
          <input type="date" className={styles.select} value={dateFrom} onChange={(e) => onDateFromChange(e.target.value)} />
        </div>

        <div className={styles.selectBlock}>
          <span className={styles.selectLabel}>{t("inspiration.filter.toDate")}</span>
          <input type="date" className={styles.select} value={dateTo} onChange={(e) => onDateToChange(e.target.value)} />
        </div>
      </div>
    </div>
  );
}
