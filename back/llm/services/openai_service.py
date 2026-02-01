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
    messages = [
        {"role": "system", "content": SYSTEM_PROMPT},
    ]

    if context:
        messages.append({
            "role": "system",
            "content": f"Контекст пользователя:\n{context}"
        })

    messages.append({"role": "user", "content": user_message})

    response = client.chat.completions.create(
        model="gpt-4o-mini",
        messages=messages,
        temperature=0.7,
    )

    return response.choices[0].message.content
