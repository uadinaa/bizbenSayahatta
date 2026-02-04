from rest_framework import serializers
from .models import User
from django.contrib.auth.password_validation import validate_password
from .models import UserPreferences

class RegisterSerializer(serializers.ModelSerializer):
    password = serializers.CharField(write_only=True)
    password2 = serializers.CharField(write_only=True)

    class Meta: 
        model = User
        fields = ('email', 'username', 'password', 'password2', 'avatar')
    
    def validate(self, attrs):
        if attrs['password'] != attrs['password2']:
            raise serializers.ValidationError("Passwords do not match")
        return attrs
    
    def validate_password(self, value):
        validate_password(value)
        return value
    
    def create(self, validated_data):
        validated_data.pop('password2')
        user = User.objects.create_user(**validated_data)
        UserPreferences.objects.create(user=user)
        return user 


class UserPreferencesSerializer(serializers.ModelSerializer):
    class Meta:
        model = UserPreferences
        fields = ('budget', 'travel_style', 'interests')

class UserSerializer(serializers.ModelSerializer):
    preferences = UserPreferencesSerializer(read_only=True)

    class Meta:
        model = User
        fields = ('email', 'avatar', 'username', 'preferences')
