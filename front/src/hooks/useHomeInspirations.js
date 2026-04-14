import { useRef, useEffect, useMemo } from "react";
import { useTranslation } from "react-i18next";

const baseCards = [
  {
    title: "Kyoto",
    country: "Japan",
    trips: "2.3K",
    categoryKeys: ["culture", "temples", "cherryBlossom"],
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Iceland",
    country: "Iceland",
    trips: "1.8K",
    categoryKeys: ["nature", "geysers", "waterfalls"],
    image:
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Cinque Terre",
    country: "Italy",
    trips: "3.1K",
    categoryKeys: ["sea", "food", "romance"],
    image:
      "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Bali",
    country: "Indonesia",
    trips: "2.6K",
    categoryKeys: ["beach", "surf", "wellness"],
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Marrakech",
    country: "Morocco",
    trips: "1.4K",
    categoryKeys: ["markets", "architecture", "desert"],
    image:
      "https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Santorini",
    country: "Greece",
    trips: "2.9K",
    categoryKeys: ["sunset", "sea", "romance"],
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80",
  },
];

// 🔥 Дублируем для бесконечности
const testimonialsBase = [
  {
    textKey: "david",
    name: "David Chen",
    roleKey: "entrepreneur",
    location: "Singapore",
    tripKey: "japan14",
  },
  {
    textKey: "sofia",
    name: "Sofia Martinez",
    roleKey: "freelanceDesigner",
    location: "Spain",
    tripKey: "europe10",
  },
  {
    textKey: "ethanLily",
    name: "Ethan & Lily Carter",
    roleKey: "newlyweds",
    location: "USA",
    tripKey: "maldives7",
  },
  {
    textKey: "arjun",
    name: "Arjun Patel",
    roleKey: "consultant",
    location: "India",
    tripKey: "germany5",
  },
  {
    textKey: "emily",
    name: "Emily Nguyen",
    roleKey: "student",
    location: "Vietnam",
    tripKey: "southKorea8",
  },
  {
    textKey: "lucas",
    name: "Lucas Ribeiro",
    roleKey: "photographer",
    location: "Brazil",
    tripKey: "italy9",
  },
  {
    textKey: "amina",
    name: "Amina Hassan",
    roleKey: "contentCreator",
    location: "UAE",
    tripKey: "morocco6",
  },
];

export function useHomeInspirations() {
  const { t } = useTranslation();
  const inspirationsRef = useRef(null);

  const inspirationCards = useMemo(
    () =>
      [...baseCards, ...baseCards].map((card) => ({
        ...card,
        categories: card.categoryKeys.map((key) =>
          t(`home.cardCategories.${key}`)
        ),
      })),
    [t]
  );

  const testimonials = useMemo(
    () =>
      testimonialsBase.map((testimonial) => ({
        text: t(`home.testimonials.text.${testimonial.textKey}`),
        name: testimonial.name,
        role: t(`home.testimonials.roles.${testimonial.roleKey}`),
        location: testimonial.location,
        trip: t(`home.testimonials.trips.${testimonial.tripKey}`),
      })),
    [t]
  );

  const scrollInspirations = (direction) => {
    const track = inspirationsRef.current;
    if (!track) return;

    const firstCard = track.querySelector(".inspiration-card");
    if (!firstCard) return;

    const gapValue = window.getComputedStyle(track).gap || "0";
    const gap = Number.parseFloat(gapValue) || 0;
    const step = firstCard.getBoundingClientRect().width + gap;

    track.scrollBy({
      left: direction * step,
      behavior: "smooth",
    });
  };

  // 🚀 АВТОСКРОЛЛ + БЕСКОНЕЧНОСТЬ
  useEffect(() => {
    const track = inspirationsRef.current;
    if (!track) return;

    const speed = 0.5; // скорость движения

    const interval = setInterval(() => {
      if (!track) return;

      track.scrollLeft += speed;

      const maxScroll = track.scrollWidth / 2;

      // 🔁 когда дошли до середины — возвращаемся
      if (track.scrollLeft >= maxScroll) {
        track.scrollLeft = 0;
      }
    }, 10);

    return () => clearInterval(interval);
  }, []);

  return {
    inspirationsRef,
    inspirationCards,
    testimonials,
    scrollInspirations,
  };
}
