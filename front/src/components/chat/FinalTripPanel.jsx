const FALLBACK_DAY_COLORS = ["#E53E3E", "#DD6B20", "#D69E2E", "#38A169", "#3182CE", "#805AD5"];

function getDayColor(day, index) {
  return day.color || FALLBACK_DAY_COLORS[index % FALLBACK_DAY_COLORS.length];
}

/** Render the persisted per-chat itinerary grouped by day. */
export default function FinalTripPanel({ trip, loading }) {
  if (loading) {
    return (
      <div className="final-trip-placeholder">
        <p className="right-panel-label">Final Trip</p>
        <div className="trip-loading-card">Loading this chat&apos;s trip...</div>
      </div>
    );
  }

  if (!trip?.itinerary?.length) {
    return (
      <div className="final-trip-placeholder">
        <p className="right-panel-label">Final Trip</p>
        <div className="trip-empty-card">
          Your trip summary will appear here as we plan it
        </div>
      </div>
    );
  }

  return (
    <section className="final-trip-section">
      <div className="right-panel-heading">
        <div>
          <p className="right-panel-label">Final Trip</p>
          <h3>{trip.city || "Planned route"}</h3>
        </div>
      </div>

      <div className="final-trip-days">
        {trip.itinerary.map((day, index) => (
          <details key={`day-${day.day}`} className="trip-day-card" open={index === 0}>
            <summary className="trip-day-summary">
              <span className="trip-day-label">
                <span
                  className="day-dot"
                  style={{ backgroundColor: getDayColor(day, index) }}
                />
                Day {day.day}
              </span>
              <span className="trip-day-title">{day.summary || "Plan in progress"}</span>
            </summary>
            <div className="trip-day-stops">
              {(day.stops || []).map((stop, stopIndex) => (
                <div key={`${day.day}-${stopIndex}-${stop.name}`} className="trip-stop-row">
                  <div>
                    <strong>{stop.name}</strong>
                    <p>{stop.address || stop.category || "Details coming soon"}</p>
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

