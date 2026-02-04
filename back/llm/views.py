# from rest_framework.views import APIView
# from rest_framework.permissions import IsAuthenticated
# from rest_framework.response import Response
# from rest_framework import status

# from .serializers import ChatRequestSerializer
# from .models import ChatMessage
# from .services.openai_service import ask_travel_ai


# class TravelChatView(APIView):
#     permission_classes = [IsAuthenticated]

#     def post(self, request):
#         serializer = ChatRequestSerializer(data=request.data)
#         if not serializer.is_valid():
#             return Response(serializer.errors, status=400)

#         user_message = serializer.validated_data["message"]

#         # ⬇️ тут ПОТОМ добавим данные из БД (поездки, города)
#         context = ""

#         ai_response = ask_travel_ai(
#             user_message=user_message,
#             context=context
#         )

#         ChatMessage.objects.create(
#             user=request.user,
#             user_message=user_message,
#             ai_response=ai_response
#         )

#         return Response(
#             {"response": ai_response},
#             status=status.HTTP_200_OK
#         )
