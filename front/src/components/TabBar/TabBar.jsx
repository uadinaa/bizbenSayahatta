import "./TabBar.css";

// Reusable pill-style tab navigation shared across pages.
export default function TabBar({ tabs, activeTab, onTabChange, className = "" }) {
  return (
    <div className={`tabs-container ${className}`.trim()}>
      {tabs.map((tab) => (
        <button
          key={tab.id}
          type="button"
          className={`tab-button ${activeTab === tab.id ? "active" : ""}`}
          onClick={() => onTabChange(tab.id)}
        >
          {tab.icon ? <span className="tab-button__icon">{tab.icon}</span> : null}
          <span>{tab.label}</span>
        </button>
      ))}
    </div>
  );
}
