from django.db import models
from django.contrib.auth import get_user_model

User = get_user_model()

class ChatThread(models.Model):
    KIND_CHOICES = [
        ("planner", "Planner"),
        ("ai", "AI"),
    ]

    user = models.ForeignKey(
        User,
        on_delete=models.CASCADE,
        related_name="chat_threads",
    )
    kind = models.CharField(max_length=20, choices=KIND_CHOICES)
    title = models.CharField(max_length=255, blank=True)
    city = models.CharField(max_length=100, blank=True)
    start_date = models.DateField(null=True, blank=True)
    end_date = models.DateField(null=True, blank=True)
    plan_json = models.JSONField(null=True, blank=True)
    is_archived = models.BooleanField(default=False, db_index=True)
    created_at = models.DateTimeField(auto_now_add=True)
    updated_at = models.DateTimeField(auto_now=True)

    def __str__(self):
        return f"{self.kind} chat {self.id} ({self.user})"


class ChatEntry(models.Model):
    ROLE_CHOICES = [
        ("user", "User"),
        ("assistant", "Assistant"),
        ("system", "System"),
    ]

    thread = models.ForeignKey(
        ChatThread,
        on_delete=models.CASCADE,
        related_name="messages",
    )
    role = models.CharField(max_length=20, choices=ROLE_CHOICES)
    content = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    class Meta:
        ordering = ["created_at"]

    def __str__(self):
        return f"{self.role} message {self.id} in thread {self.thread_id}"


class ChatMessage(models.Model):
    user = models.ForeignKey(User, on_delete=models.CASCADE)
    user_message = models.TextField()
    ai_response = models.TextField()
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"ChatMessage {self.id} by {self.user}"


class FinalTrip(models.Model):
    thread = models.OneToOneField(
        ChatThread,
        on_delete=models.CASCADE,
        related_name="final_trip",
    )
    city = models.CharField(max_length=100, blank=True)
    country = models.CharField(max_length=100, blank=True)
    itinerary = models.JSONField(default=list, blank=True)
    route = models.JSONField(default=list, blank=True)
    plan_snapshot = models.JSONField(default=dict, blank=True)
    response_markdown = models.TextField(blank=True)
    updated_at = models.DateTimeField(auto_now=True)
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"FinalTrip for thread {self.thread_id}"
