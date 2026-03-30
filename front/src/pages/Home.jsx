import "../styles/Home.css";
import previewImg from "../assets/preview.png";
import heartImg from "../assets/heart.png";
import calendarImg from "../assets/calendar.png";
import communityImg from "../assets/community.png";
import intmapImg from "../assets/intmap.png";
import iskorkiImg from "../assets/iskorki.png";
import safetyImg from "../assets/safety.png";
import messageImg from "../assets/message.svg";
import magicImg from "../assets/magic.svg";
import planeImg from "../assets/plane.svg";
import pointImg from "../assets/point.svg";
import { Link } from "react-router-dom";
import { useHomeInspirations } from "../hooks/useHomeInspirations";
import { useRef } from "react";

export default function HomePage() {
  const { 
    inspirationsRef, 
    inspirationCards, 
    scrollInspirations, 
    testimonials 
  } = useHomeInspirations();

  const testimonialsRef = useRef(null);

  return (
    <div className="home-page">
      <div className="home-wrapper">
        
        {/* HERO SECTION */}
        <div className="home-content">
          <div className="home-left">
            <h1>
              Journeys<br />
              crafted for you
            </h1>
            <p>
              Our intelligent assistant analyzes your preferences and creates
              perfect itineraries based on your budget, weather, and local events.
            </p>
            <Link to="/chat">
              <button className="create-trip-btn">Create Trip →</button>
            </Link>
          </div>

          <div className="home-center">
            <img src={previewImg} alt="Travel" className="globe-img" />
          </div>

          <div className="home-right">
            <div className="chat-card">
              <div className="chat-header">
                <div className="ai-avatar">🤖</div>
                <div className="chat-header-info">
                  <div className="ai-name">AI Assistant</div>
                  <div className="ai-status">Online</div>
                  <div className="ai-meta">
                    📍 Kyoto, Japan • 🗓️ 3 days
                  </div>
                </div>
                <div className="trip-preview">Kyoto • 3 days</div>
              </div>

              <div className="chat-body">
                <div className="user-msg">
                  I want to visit Japan for 10 days, budget $3000
                </div>
                <div className="ai-msg">
                  Great choice! I have prepared an itinerary for you:
                  Tokyo (4 days) — Kyoto (3 days) — Osaka (3 days).
                </div>
              </div>

              <div className="chat-footer">
                <div className="chat-info">Apr 15–25 • Best time</div>
                <div className="chat-actions">
                  <button>Show on map</button>
                  <button>Add to wishlist</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURES SECTION */}
        <div className="features-section">
          <p className="features-label">FEATURES</p>
          <h2>Everything for the perfect trip</h2>
          <p className="features-sub">
            We combine cutting-edge technology and expertise to make every journey unforgettable.
          </p>

          <div className="features-grid">
            <div className="feature-card big">
              <img src={iskorkiImg} alt="AI Planner" className="feature-icon-iskorki" />
              <h3>AI Planner</h3>
              <button>Try it out →</button>
            </div>

            <div className="feature-card map-card">
              <img src={intmapImg} alt="Map" className="feature-icon" />
              <h4>Interactive Map</h4>
              <p>Visualize your route, mark visited places, and plan your next adventures.</p>
            </div>

            <div className="feature-card">
              <img src={heartImg} alt="Wishlist" className="feature-icon" />
              <h4>Wishlist</h4>
              <p>Save favorite places and get notified about great deals.</p>
            </div>

            <div className="feature-card">
              <img src={safetyImg} alt="Safety" className="feature-icon" />
              <h4>Safety Info</h4>
              <p>Up-to-date information on visas, vaccinations, and local restrictions.</p>
            </div>

            <div className="feature-card">
              <img src={communityImg} alt="Community" className="feature-icon" />
              <h4>Community</h4>
              <p>Share experiences with other travelers and find travel companions.</p>
            </div>

            <div className="feature-card wide">
              <img src={calendarImg} alt="Events" className="feature-icon" />
              <h4>Events & Weather</h4>
              <p>Learn about festivals, concerts, and weather conditions on your travel dates.</p>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS SECTION */}
        <div className="how-section">
          <p className="how-label">HOW IT WORKS</p>
          <h2>From idea to adventure in 3 steps</h2>

          <div className="how-content">
            <div className="how-steps">
              <div className="step-card active">
                <div className="step-icon"><img src={messageImg} alt="message" /></div>
                <div>
                  <p className="step-number">STEP 1</p>
                  <h3>Tell us your dream</h3>
                  <p>Describe your ideal trip: destination, dates, budget, and interests.</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon"><img src={magicImg} alt="magic" /></div>
                <div>
                  <p className="step-number">STEP 2</p>
                  <h3>Get your itinerary</h3>
                  <p>In seconds, AI creates a detailed plan considering weather and logistics.</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon"><img src={planeImg} alt="plane" /></div>
                <div>
                  <p className="step-number">STEP 3</p>
                  <h3>Book and fly</h3>
                  <p>Book everything in one click or customize the plan. Get real-time help.</p>
                </div>
              </div>
            </div>

            <div className="how-preview wide-preview">
              <div className="how-chat">
                <div className="chat-row ai">
                  <div className="avatar-badge ai">AI</div>
                  <div className="ai-bubble">Hi! Where would you like to travel?</div>
                </div>
                <div className="chat-row user">
                  <div className="user-bubble">I want a beach vacation in February, budget up to $2000</div>
                </div>
                <div className="chat-row ai">
                  <div className="avatar-badge ai">AI</div>
                  <div className="ai-bubble">Great choice! Thailand or Sri Lanka would be perfect.</div>
                </div>
                <div className="tags">
                  <span>Beach</span><span>Active</span><span>Cultural</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INSPIRATIONS SECTION */}
        <section className="inspiration-section">
          <div className="inspiration-head">
            <div>
              <p className="inspiration-label">INSPIRATIONS</p>
              <h2>Where to next?</h2>
              <p className="inspiration-sub">Popular destinations chosen by our community.</p>
            </div>
          </div>

          <div className="inspiration-carousel">
            <div className="inspiration-track" ref={inspirationsRef}>
              {inspirationCards.map((card, index) => (
                <article className="inspiration-card" key={card.title + index}>
                  <img src={card.image} alt={card.title} />
                  <div className="inspiration-card-body">
                    <div>
                      <h3>{card.title}</h3>
                      <p className="inspiration-country">
                        <img src={pointImg} alt="" aria-hidden="true" />
                        {card.country}
                      </p>
                    </div>
                    <div className="inspiration-trips">
                      <span>Trips</span>
                      <strong>{card.trips}</strong>
                    </div>
                  </div>
                  <div className="inspiration-categories">
                    {card.categories.map((category) => (
                      <span key={category}>{category}</span>
                    ))}
                  </div>
                  <button type="button" className="inspiration-card-btn">
                    Create your trip <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
          <Link to="/inspiration" className="view-all-destinations-btn">
            View all destinations <span>→</span>
          </Link>
        </section>

        {/* TESTIMONIALS SECTION */}
<section className="testimonials-section">
  <div className="testimonials-container">
    <button
      className="testimonial-btn"
      onClick={() => {
        if (testimonialsRef.current) {
          testimonialsRef.current.scrollBy({
            left: -testimonialsRef.current.offsetWidth,
            behavior: "smooth",
          });
        }
      }}
    >
      ←
    </button>

    <div className="testimonials-track" ref={testimonialsRef}>
      {testimonials && testimonials.map((t, index) => (
        <div className="testimonial-card" key={index}>
          {/* Главный акцент внутри карточки */}
          <div className="testimonial-header-label">Stories from our travelers</div>
          
          <p className="testimonial-text">“{t.text}”</p>
          
          <div className="testimonial-user">
            <h4>{t.name}</h4>
            <div className="user-info-row">
              <span>{t.role}</span> • <span>{t.location}</span>
            </div>
            <p className="trip">{t.trip}</p>
          </div>
        </div>
      ))}
    </div>

    <button
      className="testimonial-btn"
      onClick={() => {
        if (testimonialsRef.current) {
          testimonialsRef.current.scrollBy({
            left: testimonialsRef.current.offsetWidth,
            behavior: "smooth",
          });
        }
      }}
    >
      →
    </button>
  </div>
</section>
      </div>
    </div>
  );
}