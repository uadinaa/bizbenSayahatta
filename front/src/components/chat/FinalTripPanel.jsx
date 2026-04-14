import { useTranslation } from "react-i18next";

const FALLBACK_DAY_COLORS = ["#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE", "#805AD5"];

function getDayColor(day, index) {
  return day.color || FALLBACK_DAY_COLORS[index % FALLBACK_DAY_COLORS.length];
}

/** Calculate total budget from daily budget and trip duration */
function calculateTotalBudget(trip) {
  if (!trip.daily_budget || !trip.start_date || !trip.end_date) return null;
  const start = new Date(trip.start_date);
  const end = new Date(trip.end_date);
  const days = Math.max(1, Math.round((end - start) / (1000 * 60 * 60 * 24)) + 1);
  return trip.daily_budget * days;
}

/** Calculate current estimate based on itinerary stops */
function calculateCurrentEstimate(trip) {
  if (!trip.daily_budget || !trip.itinerary?.length) return null;
  const totalStops = trip.itinerary.reduce((sum, day) => sum + (day.stops?.length || 0), 0);
  // Estimate: average cost per stop based on daily budget
  const avgCostPerStop = trip.daily_budget / 4; // Assuming ~4 activities per day
  return Math.round(totalStops * avgCostPerStop);
}

/** Format sources object into displayable array */
function formatSources(sources) {
  if (!sources) return [];
  if (Array.isArray(sources)) return sources;
  if (sources.items && Array.isArray(sources.items)) {
    return sources.items.map(item => item.label || item.name || JSON.stringify(item));
  }
  if (typeof sources === 'object') {
    return Object.entries(sources).map(([key, value]) =>
      `${key}: ${typeof value === 'string' ? value : JSON.stringify(value)}`
    );
  }
  return [];
}

/** Render the persisted per-chat itinerary grouped by day with full trip details. */
export default function FinalTripPanel({ trip, loading }) {
  const { t } = useTranslation();

  if (loading) {
    return (
      <div className="final-trip-placeholder">
        <p className="right-panel-label">{t("chat.finalTrip")}</p>
        <div className="trip-loading-card">{t("chat.loadingThisChatSTrip")}</div>
      </div>
    );
  }

  if (!trip?.itinerary?.length) {
    return (
      <div className="final-trip-placeholder">
        <p className="right-panel-label">{t("chat.finalTrip")}</p>
        <div className="trip-empty-card">
          {t("chat.yourTripSummaryWillAppearHereAsWePlanIt")}
        </div>
      </div>
    );
  }

  const totalBudget = calculateTotalBudget(trip);
  const currentEstimate = calculateCurrentEstimate(trip);
  const sources = formatSources(trip.sources);

  return (
    <section className="final-trip-section">
      <div className="right-panel-heading">
        <div>
          <p className="right-panel-label">{t("chat.finalTrip")}</p>
          <h3>{trip.city || t("chat.plannedRoute")}</h3>
        </div>
      </div>

      {/* Trip Overview Stats */}
      <div className="trip-overview-stats">
        {(trip.travelers || trip.travelers === 0) && (
          <div className="trip-stat">
            <span className="stat-icon">👥</span>
            <div className="stat-content">
              <span className="stat-label">{t("chat.travelers")}</span>
              <span className="stat-value">{trip.travelers}</span>
            </div>
          </div>
        )}

        {trip.daily_budget && (
          <div className="trip-stat">
            <span className="stat-icon">💰</span>
            <div className="stat-content">
              <span className="stat-label">{t("chat.dailyBudget")}</span>
              <span className="stat-value">${trip.daily_budget}</span>
            </div>
          </div>
        )}

        {totalBudget && (
          <div className="trip-stat">
            <span className="stat-icon">📊</span>
            <div className="stat-content">
              <span className="stat-label">{t("chat.totalBudget")}</span>
              <span className="stat-value">${totalBudget}</span>
            </div>
          </div>
        )}

        {currentEstimate && (
          <div className="trip-stat">
            <span className="stat-icon">💵</span>
            <div className="stat-content">
              <span className="stat-label">{t("chat.currentEstimate")}</span>
              <span className="stat-value">${currentEstimate}</span>
            </div>
          </div>
        )}
      </div>

      {/* Safety Tips */}
      {trip.safety_tips && trip.safety_tips.length > 0 && (
        <div className="trip-safety-tips">
          <h4 className="trip-section-title">
            <span>⚠️</span> {t("chat.safetyTips")}
          </h4>
          <ul className="safety-list">
            {trip.safety_tips.map((tip, index) => (
              <li key={index} className="safety-item">{tip}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Sources */}
      {sources && sources.length > 0 && (
        <div className="trip-sources">
          <h4 className="trip-section-title">
            <span>📚</span> {t("chat.sources")}
          </h4>
          <ul className="sources-list">
            {sources.map((source, index) => (
              <li key={index} className="source-item">{source}</li>
            ))}
          </ul>
        </div>
      )}

      {/* Itinerary */}
      <div className="final-trip-days">
        {trip.itinerary.map((day, index) => (
          <details key={`day-${day.day}`} className="trip-day-card" open={index === 0}>
            <summary className="trip-day-summary">
              <span className="trip-day-label">
                <span
                  className="day-dot"
                  style={{ backgroundColor: getDayColor(day, index) }}
                />
                {t("chat.day")} {day.day}
              </span>
              <span className="trip-day-title">{day.summary || t("chat.planInProgress")}</span>
            </summary>
            <div className="trip-day-stops">
              {(day.stops || []).map((stop, stopIndex) => (
                <div key={`${day.day}-${stopIndex}-${stop.name}`} className="trip-stop-row">
                  <div>
                    <strong>{stop.name}</strong>
                    <p>{stop.address || stop.category || t("chat.detailsComingSoon")}</p>
                  </div>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>
    </section>
  );
}
