import { Link } from "react-router-dom";
import { useTranslation } from "react-i18next";
import earthPic from "../../assets/earthpic.png";
import "../../styles/TripEmpty.css";

export default function TripEmpty() {
  const { t } = useTranslation();

  return (
    <main className="trip-empty">
      <div className="trip-empty__left">
        <h2 className="trip-empty__title">
          {t("trips.emptyTitleLine1")}
          <br />
          {t("trips.emptyTitleLine2")}
        </h2>
        <Link to="/chat" className="trip-cta">
          {t("trips.createNewTrip")} <span className="trip-cta__arrow">→</span>
        </Link>
      </div>
      <div className="trip-empty__right">
        <img className="trip-illustration" src={earthPic} alt={t("common.travelIllustration")} />
      </div>
    </main>
  );
}
