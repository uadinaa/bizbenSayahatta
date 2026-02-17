import React from "react";
import { Link } from "react-router-dom";
import "../styles/TripEmpty.css";
import earthPic from "../assets/earthpic.png";

export default function TripPage({ trips = [] }) {
  const hasTrips = trips.length > 0;

  return ( 
    <div className="trip-page">
      <header className="trip-header">
        <h1 className="trip-title">My Trips</h1>
        <p className="trip-subtitle">
          Track your adventures, relive memories, and plan your next journey
        </p>

        <div className="trip-tabs">
          <button className="trip-tab trip-tab--active">
            Active & Upcoming <span className="trip-badge">{trips.length}</span>
          </button>
          <button className="trip-tab">
            Trip Archive <span className="trip-badge">0</span>
          </button>
        </div>
      </header>

      {!hasTrips ? (
        <main className="trip-empty">
          <div className="trip-empty__left">
            <h2 className="trip-empty__title">
              You don’t have any
              <br />
              trips yet...
            </h2>

            {/* 🔗 Link вместо обычной кнопки */}
            <Link to="/planner-test" className="trip-cta">
              Create new trip <span className="trip-cta__arrow">→</span>
            </Link>
          </div>

          <div className="trip-empty__right">
            <img
              className="trip-illustration"
              src={earthPic}
              alt="Travel illustration"
            />
          </div>
        </main>
      ) : (
        <main className="trip-list">
          {trips.map((trip) => (
            <article className="trip-card" key={trip.id}>
              <h3 className="trip-card__title">{trip.title}</h3>
              <p className="trip-card__meta">{trip.dates}</p>
            </article>
          ))}
        </main>
      )}
    </div>
  );
}
