from openai import OpenAI
from django.conf import settings

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
