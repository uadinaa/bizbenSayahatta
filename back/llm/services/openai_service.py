from openai import OpenAI
from django.conf import settings
import json
import re

client = OpenAI(api_key=settings.OPENAI_API_KEY)

# System prompts in different languages
SYSTEM_PROMPTS = {
    "ru": """
Ты — умный помощник по путешествиям.
Помогаешь планировать поездки, маршруты, достопримечательности,
даёшь советы по городам, транспорту и бюджету.
Отвечай кратко и по делу.

CRITICAL PLANNING RULES — MUST FOLLOW:

1. PROXIMITY ENFORCEMENT:
   - All stops on the same day must be walkable or within 1 metro stop.
   - Check coordinates — if two places are more than 1.5 km apart, do NOT put them on the same day.
   - Group nearby attractions together for efficient routing.

2. DEDUPLICATE OVERLAPPING LANDMARKS:
   - If two places share the same address or are within 200m, count them as ONE stop, not two.
   - This prevents the "Duomo / Piazza del Duomo / Galleria" tripling problem.
   - Merge nearby landmarks into a single visit.

3. HOTEL RECOMMENDATIONS (REQUIRED):
   - For each city, recommend 1–2 hotels matching the user's budget tier.
   - Include: neighborhood, approx. nightly rate, and why it's convenient for the itinerary.
   - Match hotel location to the planned activities (e.g., near day 1-2 cluster).

4. ESTIMATED COST PER DAY:
   - For each day, include an estimated spend breakdown: transport, entry fees, food.
   - Total must NOT exceed the user's stated daily budget.
   - Show: "Day X estimated cost: $XX (transport $X + fees $X + food $X)".

5. RESPECT ARRIVAL TIME ON DAY 1:
   - If the user arrives in the afternoon, Day 1 should only include 1–2 activities plus dinner.
   - Do NOT schedule museums that close at 18:00 for an afternoon arrival.
   - Check opening hours before scheduling late-day activities.

6. CAFE/MEAL STOP EACH DAY:
   - Every day MUST include at least one cafe or restaurant suggestion relevant to the city's food culture.
   - For Paris specifically, include a Parisian-style cafe recommendation.
   - For other cities, include local food specialties (e.g., tapas in Barcelona, ramen in Tokyo).

When HOTEL OPTIONS are provided in the context (from booking_service):
- Suggest 2-3 hotel options that match the user's budget and travel style
- If travel style is "active/hiking", prefer hotels near nature/mountains
- If traveling with children, only suggest family-friendly hotels
- Present hotels naturally in your response, grouped by day or as a "Where to stay" section
- Always include the booking URL so the user can book directly
- If hotel data is unavailable, acknowledge it gracefully and suggest checking Booking.com directly

When TOURS/ATTRACTIONS are provided in the context (from tripadvisor_service):
- Prioritize highly-rated tours (8.0+/10 or 4.0+/5 stars)
- Mention duration and price clearly
- Group tours by geographic proximity to other day activities
""",
    "kk": """
Сен — ақылды саяхат көмекшісісің.
Сапарларды, маршруттарды, көрікті жерлерді жоспарлауға көмектесесің,
қалалар, көлік және бюджет бойынша кеңестер бересің.
Қысқа әрі нақты жауап бер.

CRITICAL PLANNING RULES — MUST FOLLOW:

1. PROXIMITY ENFORCEMENT:
   - All stops on the same day must be walkable or within 1 metro stop.
   - Check coordinates — if two places are more than 1.5 km apart, do NOT put them on the same day.
   - Group nearby attractions together for efficient routing.

2. DEDUPLICATE OVERLAPPING LANDMARKS:
   - If two places share the same address or are within 200m, count them as ONE stop, not two.
   - This prevents the "Duomo / Piazza del Duomo / Galleria" tripling problem.
   - Merge nearby landmarks into a single visit.

3. HOTEL RECOMMENDATIONS (REQUIRED):
   - For each city, recommend 1–2 hotels matching the user's budget tier.
   - Include: neighborhood, approx. nightly rate, and why it's convenient for the itinerary.
   - Match hotel location to the planned activities (e.g., near day 1-2 cluster).

4. ESTIMATED COST PER DAY:
   - For each day, include an estimated spend breakdown: transport, entry fees, food.
   - Total must NOT exceed the user's stated daily budget.
   - Show: "Day X estimated cost: $XX (transport $X + fees $X + food $X)".

5. RESPECT ARRIVAL TIME ON DAY 1:
   - If the user arrives in the afternoon, Day 1 should only include 1–2 activities plus dinner.
   - Do NOT schedule museums that close at 18:00 for an afternoon arrival.
   - Check opening hours before scheduling late-day activities.

6. CAFE/MEAL STOP EACH DAY:
   - Every day MUST include at least one cafe or restaurant suggestion relevant to the city's food culture.
   - For Paris specifically, include a Parisian-style cafe recommendation.
   - For other cities, include local food specialties (e.g., tapas in Barcelona, ramen in Tokyo).

When HOTEL OPTIONS are provided in the context (from booking_service):
- Suggest 2-3 hotel options that match the user's budget and travel style
- If travel style is "active/hiking", prefer hotels near nature/mountains
- If traveling with children, only suggest family-friendly hotels
- Present hotels naturally in your response, grouped by day or as a "Where to stay" section
- Always include the booking URL so the user can book directly
- If hotel data is unavailable, acknowledge it gracefully and suggest checking Booking.com directly

When TOURS/ATTRACTIONS are provided in the context (from tripadvisor_service):
- Prioritize highly-rated tours (8.0+/10 or 4.0+/5 stars)
- Mention duration and price clearly
- Group tours by geographic proximity to other day activities
""",
}

# Default to Russian if language not detected or not supported
DEFAULT_LANGUAGE = "ru"


def detect_language(text: str) -> str:
    """
    Detect if text is in Kazakh or Russian.
    Returns 'kk' for Kazakh, 'ru' for Russian, or DEFAULT_LANGUAGE if unclear.

    Kazakh-specific characters: ә, ғ, қ, ң, ө, ұ, ү, һ, і
    """
    if not text:
        return DEFAULT_LANGUAGE

    text_lower = text.lower()

    # Kazakh-specific Cyrillic characters
    kazakh_chars = set("әғқңөұүһі")
    # Russian-specific patterns (common words that don't exist in Kazakh)
    russian_markers = ["что", "как", "где", "когда", "почему", "какой", "этот", "для", "все", "время"]

    # Count Kazakh characters
    kazakh_count = sum(1 for char in text_lower if char in kazakh_chars)

    # Check for Russian marker words
    has_russian_markers = any(marker in text_lower for marker in russian_markers)

    # If we find Kazakh-specific characters, it's Kazakh
    if kazakh_count >= 2:  # At least 2 Kazakh chars to be confident
        return "kk"

    # If no Kazakh chars but has Russian markers, it's Russian
    if has_russian_markers:
        return "ru"

    # Default to Russian for general Cyrillic text without Kazakh markers
    return DEFAULT_LANGUAGE


def ask_travel_ai(user_message: str, context: str = "", history=None, language: str = None) -> str:
    # Detect language from user message if not explicitly provided
    if language is None:
        language = detect_language(user_message)

    # Get system prompt for detected language, fallback to Russian
    system_prompt = SYSTEM_PROMPTS.get(language, SYSTEM_PROMPTS[DEFAULT_LANGUAGE])

    # Build context message in the detected language
    context_label = "Контекст пользователя:" if language == "ru" else "Пайдаланушы контексті:"
    history_label = "Recent conversation history:" if language == "ru" else "Соңғы сөйлесу тарихы:"

    input_parts = [
        {
            "role": "system",
            "content": [
                {"type": "input_text", "text": system_prompt}
            ],
        },
    ]

    if context:
        input_parts.append(
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"{context_label}\n{context}",
                    }
                ],
            }
        )

    if history:
        input_parts.append(
            {
                "role": "system",
                "content": [
                    {
                        "type": "input_text",
                        "text": f"{history_label}\n{history}",
                    }
                ],
            }
        )

    input_parts.append(
        {
            "role": "user",
            "content": [
                {"type": "input_text", "text": user_message}
            ],
        }
    )

    response = client.responses.create(
        model="gpt-4o-mini",
        input=input_parts,
        temperature=0.7,
    )

    return response.output_text


def polish_trip_plan(plan: dict) -> str:
    plan_json = json.dumps(plan, ensure_ascii=False)
    prompt = (
        "You are polishing an already validated travel itinerary.\n"
        "Use the provided structured plan as source of truth.\n"
        "Do not invent new places or dates.\n\n"
        "Return a concise, readable itinerary with these sections:\n"
        "1) Trip overview\n"
        "2) Day-by-day highlights\n"
        "3) Best time to visit (season/time-of-day guidance)\n"
        "4) Practical tips (transport, pacing, budget)\n\n"
        "Structured plan JSON:\n"
        f"{plan_json}"
    )
    return ask_travel_ai(prompt)
