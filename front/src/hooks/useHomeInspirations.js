import { useRef, useEffect } from "react";

const baseCards = [
  {
    title: "Kyoto",
    country: "Japan",
    trips: "2.3K",
    categories: ["Culture", "Temples", "Cherry Blossom"],
    image:
      "https://images.unsplash.com/photo-1493976040374-85c8e12f0c0e?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Iceland",
    country: "Iceland",
    trips: "1.8K",
    categories: ["Nature", "Geysers", "Waterfalls"],
    image:
      "https://images.unsplash.com/photo-1531366936337-7c912a4589a7?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Cinque Terre",
    country: "Italy",
    trips: "3.1K",
    categories: ["Sea", "Food", "Romance"],
    image:
      "https://images.unsplash.com/photo-1533105079780-92b9be482077?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Bali",
    country: "Indonesia",
    trips: "2.6K",
    categories: ["Beach", "Surf", "Wellness"],
    image:
      "https://images.unsplash.com/photo-1537996194471-e657df975ab4?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Marrakech",
    country: "Morocco",
    trips: "1.4K",
    categories: ["Markets", "Architecture", "Desert"],
    image:
      "https://images.unsplash.com/photo-1597212618440-806262de4f6b?auto=format&fit=crop&w=1200&q=80",
  },
  {
    title: "Santorini",
    country: "Greece",
    trips: "2.9K",
    categories: ["Sunset", "Sea", "Romance"],
    image:
      "https://images.unsplash.com/photo-1570077188670-e3a8d69ac5ff?auto=format&fit=crop&w=1200&q=80",
  },
];

// 🔥 Дублируем для бесконечности
const inspirationCards = [...baseCards, ...baseCards];

const testimonials = [
  {
    text: "Saved hours on planning...",
    name: "David Chen",
    role: "Entrepreneur",
    location: "Singapore",
    trip: "Japan, 14 days",
  },
  {
    text: "Finally a trip that felt truly personal...",
    name: "Sofia Martinez",
    role: "Freelance Designer",
    location: "Spain",
    trip: "Europe, 10 days",
  },
  {
    text: "Planning a honeymoon was stressful...",
    name: "Ethan & Lily Carter",
    role: "Newlyweds",
    location: "USA",
    trip: "Maldives, 7 days",
  },
  {
    text: "I travel a lot for work...",
    name: "Arjun Patel",
    role: "Consultant",
    location: "India",
    trip: "Germany, 5 days",
  },
  {
    text: "As a student on a budget...",
    name: "Emily Nguyen",
    role: "Student",
    location: "Vietnam",
    trip: "South Korea, 8 days",
  },
  {
    text: "Traveling with friends can be chaotic...",
    name: "Lucas Ribeiro",
    role: "Photographer",
    location: "Brazil",
    trip: "Italy, 9 days",
  },
  {
    text: "I wanted something adventurous...",
    name: "Amina Hassan",
    role: "Content Creator",
    location: "UAE",
    trip: "Morocco, 6 days",
  },
];

export function useHomeInspirations() {
  const inspirationsRef = useRef(null);

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