import "../styles/Home.css";
import emailjs from "@emailjs/browser";
import previewImg from "../assets/preview.png";
import heartImg from "../assets/heart.png";
import calendarImg from "../assets/calendar.png";
import communityImg from "../assets/community.png";
import intmapImg from "../assets/intmap.png";
import iskorkiImg from "../assets/iskorki.png";
import safetyImg from "../assets/safety.png";
import messageImg from "../assets/message.svg";
import messageImg2 from "../assets/message2.svg";
import magicImg from "../assets/magic.svg";
import magicImg2 from "../assets/magic2.svg";
import planeImg from "../assets/plane.svg";
import planeImg2 from "../assets/plane2.svg";
import pointImg from "../assets/point.svg";
import howItWorksImg from "../assets/howItWorks.png";
import { Link } from "react-router-dom";
import { useHomeInspirations } from "../hooks/useHomeInspirations";
import { useRef, useState } from "react";
import { useTranslation } from "react-i18next";

export default function HomePage() {
  const { t } = useTranslation();
  const { 
    inspirationsRef, 
    inspirationCards, 
    testimonials 
  } = useHomeInspirations();

  const testimonialsRef = useRef(null);
  const [activeStep, setActiveStep] = useState(1);

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
            <img src={previewImg} alt={t("home.travel")} className="globe-img" />
          </div>

          <div className="home-right">
            <div className="chat-card">
              <div className="chat-header">
                <div className="ai-avatar">🤖</div>
                <div className="chat-header-info">
                  <div className="ai-name">{t("home.aiAssistant")}</div>
                  <div className="ai-status">{t("home.online")}</div>
                  <div className="ai-meta">
                    {t("home.kyotoJapan3Days")}
                  </div>
                </div>
                <div className="trip-preview">{t("home.kyoto3Days")}</div>
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
                <div className="chat-info">{t("home.apr")} 15–25 • {t("home.bestTime")}</div>
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
              <img src={iskorkiImg} alt={t("home.aiPlannerAlt")} className="feature-icon-iskorki" />
              <h3>{t("home.aiPlanner")}</h3>
              <button>{t("home.tryItOut")} →</button>
            </div>

            <div className="feature-card map-card">
              <img src={intmapImg} alt={t("home.mapAlt")} className="feature-icon" />
              <h4>{t("home.interactiveMap")}</h4>
              <p>{t("home.interactiveMapDescription")}</p>
            </div>

            <div className="feature-card">
              <img src={heartImg} alt={t("home.wishlistAlt")} className="feature-icon" />
              <h4>{t("home.wishlist")}</h4>
              <p>{t("home.wishlistDescription")}</p>
            </div>

            <div className="feature-card">
              <img src={safetyImg} alt={t("home.safetyAlt")} className="feature-icon" />
              <h4>{t("home.safetyInfo")}</h4>
              <p>{t("home.safetyInfoDescription")}</p>
            </div>

            <div className="feature-card">
              <img src={communityImg} alt={t("home.communityAlt")} className="feature-icon" />
              <h4>{t("home.community")}</h4>
              <p>{t("home.communityDescription")}</p>
            </div>

            <div className="feature-card wide">
              <img src={calendarImg} alt={t("home.eventsAlt")} className="feature-icon" />
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
            
            {/* LEFT */}
            <div className="how-steps">
              {[1,2,3].map((step) => (
                <div
  key={step}
  className={`step-card ${
    activeStep === step
      ? "active"
      : step < activeStep
      ? "inactive"
      : ""
  }`}
  onClick={() => setActiveStep(step)}
>
                  <div className="step-icon">
                    <img 
                        src={
                          step === 1
                            ? activeStep === 1 ? messageImg : messageImg2
                            : step === 2
                            ? activeStep === 2 ? magicImg2 : magicImg
                            : activeStep === 3 ? planeImg2 : planeImg
                            }
                          alt=""
                      />
                  </div>
                  <div>
                    <p className="step-number">{t(`home.step${step}`)}</p>
                    <h3>{t(`home.step${step}Title`)}</h3>
                    <p>{t(`home.step${step}Description`)}</p>
                  </div>
                </div>
              ))}
            </div>

            {/* RIGHT */}
            <div className="how-preview wide-preview">
              
              {/* CHAT */}
              <div className="how-chat">
                <div className="chat-row ai">
                  <div className="avatar-badge ai">{t("home.AI")}</div>
                  <div className="ai-bubble">{t("home.sampleChatGreeting")}</div>
                </div>
                <div className="chat-row user">
                  <div className="user-bubble">{t("home.sampleBeachRequest")}</div>
                </div>
                <div className="chat-row ai">
                  <div className="avatar-badge ai">{t("home.AI")}</div>
                  <div className="ai-bubble">{t("home.sampleBeachReply")}</div>
                </div>
                <div className="tags">
                  <span>{t("home.tagActive")}</span>
                  <span>{t("home.tagCultural")}</span>
                </div>
              </div>

              {/* STEP 2 */}
              <div className="steps-wrapper">
  {/* Эта часть видна всегда или по условию */}

  {/* Генерируем карточки шагов 2 и 3 в один поток */}
  {activeStep >= 2 && (
    <div className="trip-card">
       <h4>Final Trip</h4>
       <p><strong>Paris</strong></p>
       <p><b>Day 1:</b> Babylon Tours Paris, Tuileries Garden, Le Tout-Paris</p>
        <p><b>Day 2:</b> Le Ju', Notre-Dame Cathedral of Paris</p>
        <p><b>Day 3:</b> Montmartre, Pink Mamma</p>
    </div>
  )}

  {activeStep >= 2 && (
    <div className="map-card-preview">
      <img className="map-card-img" src={howItWorksImg} alt="preview" />
    </div>
  )}

  {activeStep >= 3 && (
    <div className="sources-card">
      <p>📚 Sources & Useful Links</p>
      <p>📍 Babylon Tours Paris</p>
      <p>📍 Tuileries Garden</p>
    </div>
  )}
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

      {/* CONTACT US SECTION */}
      <section className="contact-section">
        <div className="contact-container">
          <h2>Contact us.</h2>
          <p className="contact-subtitle">
            Need help, have an inquiry or want to share some feedback? 
            Fill out the form below and we'll be in touch soon.
          </p>

          <form
        className="contact-form"
        onSubmit={(e) => {
          e.preventDefault();

          emailjs
            .sendForm(
              "service_i28iina",
              "template_19csb3x",
              e.target,
              "ZwG_bsK2sFl2SUQUk"
            )
            .then(() => {
              alert("Message sent successfully!");
            })
            .catch((error) => {
              console.error(error);
              alert("Failed to send message");
            });

          e.target.reset();
        }}
      >
        <div className="contact-row">
          <input type="text" name="first_name" placeholder="First name" required />
          <input type="text" name="last_name" placeholder="Last name" required />
        </div>

        <input type="email" name="email" placeholder="Email" required />

        <textarea
          name="message"
          placeholder="Message"
          rows="5"
          required
        />

        <button type="submit" className="contact-btn">
          Send message →
        </button>
      </form>
        </div>
      </section>
      </div>
    </div>
  );
}