from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
import firebase_admin
from firebase_admin import credentials, auth
import os
import logging
from app.core.config import settings

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase Admin SDK
firebase_app = None
use_mock_auth = False  # Flag to control mock auth
try:
    if os.path.exists(settings.FIREBASE_CREDENTIALS):
        cred = credentials.Certificate(settings.FIREBASE_CREDENTIALS)
    else:
        # For development/testing, we might use an environment variable with JSON content
        import json
        cred_dict = json.loads(os.getenv("FIREBASE_CREDENTIALS_JSON", "{}"))
        if cred_dict:
            cred = credentials.Certificate(cred_dict)
        else:
            raise ValueError("Firebase credentials not found")
    
    firebase_app = firebase_admin.initialize_app(cred)
except (ValueError, firebase_admin.exceptions.FirebaseError) as e:
    logger.error(f"Firebase initialization error: {e}")
    # In development, we'll use mock authentication
    use_mock_auth = True
    logger.warning("Using mock authentication for development")

# Security scheme
security = HTTPBearer()

async def get_current_user(credentials: HTTPAuthorizationCredentials = Depends(security)):
    """
    Dependency that validates Firebase ID token and returns the user.
    """
    if use_mock_auth or not firebase_app:
        # For development without Firebase
        logger.info("Using mock user authentication")
        return {"uid": "sRm1nbqnwBNmrRZcSU21PvDgIbb2", "email": "mock@example.com"}
    
    token = credentials.credentials
    try:
        # Verify the ID token
        decoded_token = auth.verify_id_token(token)
        return decoded_token
    except Exception as e:
        logger.error(f"Authentication error: {str(e)}")
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid authentication credentials: {str(e)}",
            headers={"WWW-Authenticate": "Bearer"},
        ) 