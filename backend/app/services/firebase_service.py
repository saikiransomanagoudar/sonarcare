import os
import json
import firebase_admin
from firebase_admin import credentials, firestore
from datetime import datetime
from typing import Dict, List, Any, Optional
import logging
import asyncio
from functools import wraps
import uuid
import copy

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

# Initialize Firebase
firebase_app = None
db = None

try:
    if os.path.exists(os.getenv("FIREBASE_CREDENTIALS", "")):
        cred = credentials.Certificate(os.getenv("FIREBASE_CREDENTIALS"))
    else:
        # For development/testing without a credentials file
        cred_json = os.getenv("FIREBASE_CREDENTIALS_JSON")
        if cred_json:
            cred_dict = json.loads(cred_json)
            cred = credentials.Certificate(cred_dict)
        else:
            # Create a dummy credential for development
            logger.warning("Using dummy Firebase credentials for development")
            cred = None
            
    if cred:
        # Initialize the app if not already initialized
        try:
            firebase_app = firebase_admin.get_app()
        except ValueError:
            firebase_app = firebase_admin.initialize_app(cred)
        
        # Get Firestore client
        db = firestore.client()
        logger.info("Firebase Firestore initialized successfully")
except Exception as e:
    logger.error(f"Error initializing Firebase: {str(e)}")
    # Continue without Firebase for development

# Helper function to convert Firestore document to dict
def doc_to_dict(doc):
    if not doc:
        return None
    
    data = doc.to_dict()
    if data:
        data['id'] = doc.id
        # Convert any datetime objects to ISO strings for consistent serialization
        for key, value in data.items():
            if isinstance(value, datetime):
                data[key] = value.isoformat()
    return data

# Helper function to convert Firestore timestamps to ISO strings
def convert_firebase_timestamps(data):
    """Convert Firebase DatetimeWithNanoseconds to ISO format strings."""
    if isinstance(data, dict):
        for key, value in list(data.items()):
            if hasattr(value, 'timestamp'):
                # This is a Firebase timestamp of some kind
                try:
                    # Convert to datetime first, then to ISO string
                    dt = datetime.fromtimestamp(value.timestamp())
                    data[key] = dt.isoformat()
                except (AttributeError, TypeError):
                    # If conversion fails, keep original
                    pass
            elif isinstance(value, datetime):
                # Convert regular datetime objects to ISO strings
                data[key] = value.isoformat()
            elif isinstance(value, (dict, list)):
                # Recursively process nested structures
                data[key] = convert_firebase_timestamps(value)
    elif isinstance(data, list):
        # Process each item in the list
        for i, item in enumerate(data):
            if hasattr(item, 'timestamp'):
                try:
                    dt = datetime.fromtimestamp(item.timestamp())
                    data[i] = dt.isoformat()
                except (AttributeError, TypeError):
                    pass
            elif isinstance(item, datetime):
                data[i] = item.isoformat()
            elif isinstance(item, (dict, list)):
                data[i] = convert_firebase_timestamps(item)
    return data

# CHAT SESSIONS OPERATIONS

async def create_session(session_id: str, user_id: str) -> Dict[str, Any]:
    """Create a new chat session"""
    if not db:
        # Mock implementation for development
        now_iso = datetime.now().isoformat()
        return {
            "id": session_id,
            "userId": user_id,
            "createdAt": now_iso,
            "lastActivityAt": now_iso,
            "title": "New Chat",
            "summary": None
        }
    
    now = datetime.now()
    session_data = {
        "userId": user_id,
        "createdAt": now,
        "lastActivityAt": now,
        "title": "New Chat",
    }
    
    # Firebase operations are not async, run them as is
    db.collection("chatSessions").document(session_id).set(session_data)
    
    # Convert datetime objects to ISO strings before returning
    session_data["id"] = session_id
    session_data["createdAt"] = now.isoformat()
    session_data["lastActivityAt"] = now.isoformat()
    return session_data

async def get_session(session_id: str) -> Optional[Dict[str, Any]]:
    """Get a chat session by ID"""
    if not db:
        # Mock implementation for development
        now_iso = datetime.now().isoformat()
        return {
            "id": session_id,
            "userId": "mock-user-id",
            "createdAt": now_iso,
            "lastActivityAt": now_iso,
            "title": "Mock Conversation",
            "summary": None
        }
    
    session_ref = db.collection("chatSessions").document(session_id)
    # Firestore get() is not async
    session_doc = session_ref.get()
    session_data = doc_to_dict(session_doc)
    # Convert any remaining datetime objects to ISO strings
    if session_data:
        session_data = convert_firebase_timestamps(session_data)
    return session_data

async def get_sessions(user_id: str) -> List[Dict[str, Any]]:
    """Get all chat sessions for a user"""
    if not db:
        # Mock implementation for development
        now_iso = datetime.now().isoformat()
        return [{
            "id": f"mock-session-{i}",
            "userId": user_id,
            "createdAt": now_iso,
            "lastActivityAt": now_iso,
            "title": f"Mock Conversation {i}",
            "summary": None
        } for i in range(3)]
    
    logger.info(f"Getting sessions for user: {user_id}")
    sessions = []
    try:
        # Firebase query operations are not async
        sessions_ref = db.collection("chatSessions").where("userId", "==", user_id)
        session_docs = sessions_ref.get()  # Remove await
        
        for doc in session_docs:
            session = doc_to_dict(doc)
            if session:
                # Ensure all timestamps are converted to ISO strings
                session = convert_firebase_timestamps(session)
                sessions.append(session)
        
        logger.info(f"Retrieved {len(sessions)} sessions")
        return sessions
    except Exception as e:
        logger.error(f"Error getting sessions: {str(e)}")
        # Return empty list in case of error
        return []

async def update_session(session_id: str, data: Dict[str, Any]) -> None:
    """Update a chat session"""
    if not db:
        # Mock implementation for development
        logger.info(f"Mock: Updating session {session_id} with data: {data}")
        return
    
    try:
        logger.info(f"Updating session {session_id} with data: {data}")
        
        # Firebase operations are not async
        db.collection("chatSessions").document(session_id).update(data)
        
        logger.info(f"Successfully updated session {session_id}")
    except Exception as e:
        logger.error(f"Error updating session {session_id}: {str(e)}")
        raise e  # Re-raise the exception to be handled by the API

async def delete_session(session_id: str) -> None:
    """Delete a chat session and its messages"""
    if not db:
        # Mock implementation for development
        return
    
    try:
        logger.info(f"Deleting session {session_id}")
        
        # Delete all messages in the session first
        message_refs = db.collection("chatMessages").where("sessionId", "==", session_id).get()
        for message_doc in message_refs:
            try:
                message_doc.reference.delete()
            except Exception as e:
                logger.error(f"Error deleting message {message_doc.id}: {str(e)}")
        
        # Delete the session last - Firebase operations are not async
        db.collection("chatSessions").document(session_id).delete()
        
        logger.info(f"Successfully deleted session {session_id}")
    except Exception as e:
        logger.error(f"Error deleting session {session_id}: {str(e)}")
        raise e  # Re-raise the exception to be handled by the API

# CHAT MESSAGES OPERATIONS

async def create_message(message_data: Dict[str, Any]) -> Dict[str, Any]:
    """Create a new chat message"""
    if not db:
        # Mock implementation for development
        return message_data
    
    try:
        # Make a copy of the data to avoid modifying the original
        firebase_data = copy.deepcopy(message_data)
        
        # Convert any DatetimeWithNanoseconds objects to regular datetime objects
        firebase_data = convert_firebase_timestamps(firebase_data)
        
        # Set an ID if it doesn't exist
        if 'id' not in firebase_data:
            firebase_data['id'] = str(uuid.uuid4())
        
        # Update session lastActivityAt
        await update_session(firebase_data["sessionId"], {"lastActivityAt": datetime.now().isoformat()})
        
        # Create document with the ID we've generated
        doc_ref = db.collection("chatMessages").document(firebase_data['id'])
        doc_ref.set(firebase_data)
        
        return firebase_data
    except Exception as e:
        logger.error(f"Error creating message: {str(e)}")
        # If message creation fails, still return a message with a UUID
        if "id" not in message_data:
            message_data["id"] = str(uuid.uuid4())
        return message_data

async def get_messages(session_id: str) -> List[Dict[str, Any]]:
    """Get all messages for a chat session"""
    if not db:
        # Mock implementation for development
        return [{
            "id": f"mock-message-{i}",
            "sessionId": session_id,
            "userId": "mock-user-id",
            "sender": "user" if i % 2 == 0 else "bot",
            "text": f"This is mock message {i}",
            "timestamp": datetime.now(),
            "metadata": {"sonar_model_used": "mock-model"} if i % 2 == 1 else None,
            "isError": False
        } for i in range(10)]
    
    messages = []
    try:
        # Just query by sessionId without the order_by to avoid index requirement
        message_refs = db.collection("chatMessages").where("sessionId", "==", session_id)
        # Firebase operations are not async
        message_docs = message_refs.get()
        
        for doc in message_docs:
            message = doc_to_dict(doc)
            # Convert any Firebase timestamps to Python datetimes
            if message:
                message = convert_firebase_timestamps(message)
            messages.append(message)
        
        # Sort messages by timestamp after fetching them
        if messages:
            # First normalize all timestamps to be strings if they aren't already
            for msg in messages:
                if "timestamp" in msg and not isinstance(msg["timestamp"], str):
                    try:
                        # Convert any datetime objects to strings
                        if isinstance(msg["timestamp"], datetime):
                            msg["timestamp"] = msg["timestamp"].isoformat()
                    except Exception as e:
                        logger.warning(f"Failed to convert timestamp: {e}")
                        # Set a fallback timestamp
                        msg["timestamp"] = datetime.now().isoformat()
            
            # Sort by the string timestamp
            messages.sort(key=lambda x: x.get("timestamp", ""))
        
        return messages
    except Exception as e:
        logger.error(f"Error getting messages for session {session_id}: {str(e)}")
        return [] 