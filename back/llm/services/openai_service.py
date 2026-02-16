from openai import OpenAI
from django.conf import settings
import json

client = OpenAI(api_key=settings.OPENAI_API_KEY)

SYSTEM_PROMPT = """
Ты — умный помощник по путешествиям.
Помогаешь планировать поездки, маршруты, достопримечательности,
даёшь советы по городам, транспорту и бюджету.
Отвечай кратко и по делу.
"""


def ask_travel_ai(user_message: str, context: str = "") -> str:
    input_parts = [
        {
            "role": "system",
            "content": [
                {"type": "input_text", "text": SYSTEM_PROMPT}
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
                        "text": f"Контекст пользователя:\n{context}",
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
