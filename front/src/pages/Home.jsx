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
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();
  const { 
    inspirationsRef, 
    inspirationCards, 
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
              {t("home.heroTitleLine1")}<br />
              {t("home.heroTitleLine2")}
            </h1>
            <p>
              {t("home.heroDescription")}
            </p>
            <Link to="/chat">
              <button className="create-trip-btn">{t("home.createTrip")} →</button>
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
                  <div className="ai-name">{t("home.aiAssistant")}</div>
                  <div className="ai-status">{t("home.online")}</div>
                  <div className="ai-meta">
                    📍 Kyoto, Japan • 🗓️ 3 days
                  </div>
                </div>
                <div className="trip-preview">Kyoto • 3 days</div>
              </div>

              <div className="chat-body">
                <div className="user-msg">
                  {t("home.sampleUserMessage")}
                </div>
                <div className="ai-msg">
                  {t("home.sampleAiMessage")}
                </div>
              </div>

              <div className="chat-footer">
                <div className="chat-info">Apr 15–25 • {t("home.bestTime")}</div>
                <div className="chat-actions">
                  <button>{t("home.showOnMap")}</button>
                  <button>{t("home.addToWishlist")}</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* FEATURES SECTION */}
        <div className="features-section">
          <p className="features-label">{t("home.featuresLabel")}</p>
          <h2>{t("home.featuresTitle")}</h2>
          <p className="features-sub">
            {t("home.featuresSubtitle")}
          </p>

          <div className="features-grid">
            <div className="feature-card big">
              <img src={iskorkiImg} alt="AI Planner" className="feature-icon-iskorki" />
              <h3>{t("home.aiPlanner")}</h3>
              <button>{t("home.tryItOut")} →</button>
            </div>

            <div className="feature-card map-card">
              <img src={intmapImg} alt="Map" className="feature-icon" />
              <h4>{t("home.interactiveMap")}</h4>
              <p>{t("home.interactiveMapDescription")}</p>
            </div>

            <div className="feature-card">
              <img src={heartImg} alt="Wishlist" className="feature-icon" />
              <h4>{t("home.wishlist")}</h4>
              <p>{t("home.wishlistDescription")}</p>
            </div>

            <div className="feature-card">
              <img src={safetyImg} alt="Safety" className="feature-icon" />
              <h4>{t("home.safetyInfo")}</h4>
              <p>{t("home.safetyInfoDescription")}</p>
            </div>

            <div className="feature-card">
              <img src={communityImg} alt="Community" className="feature-icon" />
              <h4>{t("home.community")}</h4>
              <p>{t("home.communityDescription")}</p>
            </div>

            <div className="feature-card wide">
              <img src={calendarImg} alt="Events" className="feature-icon" />
              <h4>{t("home.eventsWeather")}</h4>
              <p>{t("home.eventsWeatherDescription")}</p>
            </div>
          </div>
        </div>

        {/* HOW IT WORKS SECTION */}
        <div className="how-section">
          <p className="how-label">{t("home.howLabel")}</p>
          <h2>{t("home.howTitle")}</h2>

          <div className="how-content">
            <div className="how-steps">
              <div className="step-card active">
                <div className="step-icon"><img src={messageImg} alt="message" /></div>
                <div>
                  <p className="step-number">{t("home.step1")}</p>
                  <h3>{t("home.step1Title")}</h3>
                  <p>{t("home.step1Description")}</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon"><img src={magicImg} alt="magic" /></div>
                <div>
                  <p className="step-number">{t("home.step2")}</p>
                  <h3>{t("home.step2Title")}</h3>
                  <p>{t("home.step2Description")}</p>
                </div>
              </div>

              <div className="step-card">
                <div className="step-icon"><img src={planeImg} alt="plane" /></div>
                <div>
                  <p className="step-number">{t("home.step3")}</p>
                  <h3>{t("home.step3Title")}</h3>
                  <p>{t("home.step3Description")}</p>
                </div>
              </div>
            </div>

            <div className="how-preview wide-preview">
              <div className="how-chat">
                <div className="chat-row ai">
                  <div className="avatar-badge ai">AI</div>
                  <div className="ai-bubble">{t("home.sampleChatGreeting")}</div>
                </div>
                <div className="chat-row user">
                  <div className="user-bubble">{t("home.sampleBeachRequest")}</div>
                </div>
                <div className="chat-row ai">
                  <div className="avatar-badge ai">AI</div>
                  <div className="ai-bubble">{t("home.sampleBeachReply")}</div>
                </div>
                <div className="tags">
                  <span>{t("home.tagBeach")}</span>
                  <span>{t("home.tagActive")}</span>
                  <span>{t("home.tagCultural")}</span>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* INSPIRATIONS SECTION */}
        <section className="inspiration-section">
          <div className="inspiration-head">
            <div>
              <p className="inspiration-label">{t("home.inspirationLabel")}</p>
              <h2>{t("home.inspirationTitle")}</h2>
              <p className="inspiration-sub">{t("home.inspirationSubtitle")}</p>
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
                      <span>{t("home.tripsLabel")}</span>
                      <strong>{card.trips}</strong>
                    </div>
                  </div>
                  <div className="inspiration-categories">
                    {card.categories.map((category) => (
                      <span key={category}>{category}</span>
                    ))}
                  </div>
                  <button type="button" className="inspiration-card-btn">
                    {t("home.createYourTrip")} <span>→</span>
                  </button>
                </article>
              ))}
            </div>
          </div>
          <Link to="/inspiration" className="view-all-destinations-btn">
            {t("home.viewAllDestinations")} <span>→</span>
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
      {testimonials && testimonials.map((testimonial, index) => (
        <div className="testimonial-card" key={index}>
          {/* Главный акцент внутри карточки */}
          <div className="testimonial-header-label">{t("home.storiesFromTravelers")}</div>
          
          <p className="testimonial-text">“{testimonial.text}”</p>
          
          <div className="testimonial-user">
            <h4>{testimonial.name}</h4>
            <div className="user-info-row">
              <span>{testimonial.role}</span> , <span>{testimonial.location}</span> | <span>{testimonial.trip}</span>
            </div>
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
