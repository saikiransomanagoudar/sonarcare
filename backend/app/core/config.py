import os
from typing import List
from dotenv import load_dotenv
from pydantic import BaseModel

load_dotenv()

class Settings(BaseModel):
    # API Settings
    API_VERSION: str = "v1"
    
    # CORS settings
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",  # Next.js frontend in development
        "https://sonarcare.vercel.app",  # Example production domain
        "*",  # Allow all origins for debugging
    ]
    
    # Firebase settings
    FIREBASE_CREDENTIALS: str = os.getenv("FIREBASE_CREDENTIALS", "firebase-credentials.json")
    
    # Perplexity API settings
    PERPLEXITY_API_KEY: str = os.getenv("PERPLEXITY_API_KEY", "")
    PERPLEXITY_MODEL: str = os.getenv("PERPLEXITY_MODEL", "sonar-medium-online")  # Using Sonar Pro as the default model
    
    # Server settings
    HOST: str = os.getenv("HOST", "0.0.0.0")
    PORT: int = int(os.getenv("PORT", "8000"))
    
    # JWT settings
    JWT_SECRET_KEY: str = os.getenv("JWT_SECRET_KEY", "your-secret-key")
    JWT_ALGORITHM: str = "HS256"
    JWT_EXPIRATION_MINUTES: int = 60 * 24  # 24 hours

# Initialize settings
settings = Settings() 