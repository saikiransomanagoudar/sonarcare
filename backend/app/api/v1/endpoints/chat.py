from fastapi import APIRouter, Depends, HTTPException, status, Request
from pydantic import BaseModel
from typing import List, Optional
import uuid
from datetime import datetime
import logging

from app.core.security import get_current_user
from app.services.chat_service import process_message, get_user_sessions, get_session_messages
from app.services.firebase_service import create_session, create_message, get_messages, get_sessions, delete_session, get_session

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

router = APIRouter(prefix="/chat", tags=["chat"])

# Request and response models
class ChatMessageRequest(BaseModel):
    message: str
    sessionId: Optional[str] = None
    userId: str

class ChatSessionRequest(BaseModel):
    userId: str

class ChatMessageResponse(BaseModel):
    id: str
    text: str
    sender: str
    sessionId: str
    userId: str
    timestamp: datetime
    metadata: Optional[dict] = None
    isError: Optional[bool] = None

class ChatSessionResponse(BaseModel):
    id: str
    userId: str
    createdAt: datetime
    lastActivityAt: datetime
    title: Optional[str] = None
    summary: Optional[str] = None

class ChatResponse(BaseModel):
    message: ChatMessageResponse
    sessionId: str

# Chat endpoints
@router.post("/message", response_model=ChatResponse)
async def send_message(request: ChatMessageRequest, user = Depends(get_current_user)):
    """
    Send a message to the chatbot and get a response.
    If sessionId is not provided, a new session will be created.
    """
    # Verify the user ID matches the authenticated user
    if user["uid"] != request.userId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match authenticated user",
        )
    
    # Get or create session
    session_id = request.sessionId
    if not session_id:
        # Create a new session
        session_id = str(uuid.uuid4())
        await create_session(session_id, request.userId)
    
    # Create user message
    user_message_id = str(uuid.uuid4())
    user_message = {
        "id": user_message_id,
        "text": request.message,
        "sender": "user",
        "sessionId": session_id,
        "userId": request.userId,
        "timestamp": datetime.now(),
    }
    await create_message(user_message)
    
    # Process the message with our chat service
    try:
        bot_response = await process_message(request.message, session_id, request.userId)
        return {
            "message": bot_response,
            "sessionId": session_id,
        }
    except Exception as e:
        # Create an error message
        error_message = {
            "id": str(uuid.uuid4()),
            "text": f"Sorry, there was an error processing your message: {str(e)}",
            "sender": "bot",
            "sessionId": session_id,
            "userId": request.userId,
            "timestamp": datetime.now(),
            "isError": True,
        }
        await create_message(error_message)
        return {
            "message": ChatMessageResponse(**error_message),
            "sessionId": session_id,
        }

@router.get("/messages", response_model=List[ChatMessageResponse])
async def get_chat_messages(sessionId: str, user = Depends(get_current_user)):
    """
    Get all messages for a specific chat session.
    """
    messages = await get_session_messages(sessionId, user["uid"])
    return messages

@router.get("/sessions", response_model=List[ChatSessionResponse])
async def get_chat_sessions(userId: str, user = Depends(get_current_user)):
    """
    Get all chat sessions for a specific user.
    """
    # Verify the user ID matches the authenticated user
    if user["uid"] != userId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match authenticated user",
        )
    
    sessions = await get_user_sessions(userId)
    return sessions

@router.post("/session", response_model=ChatSessionResponse)
async def create_chat_session(request: ChatSessionRequest, user = Depends(get_current_user)):
    """
    Create a new chat session.
    """
    # Debug logging
    logger.info(f"Create session request: {request}")
    logger.info(f"Authenticated user: {user}")
    
    # Verify the user ID matches the authenticated user
    if user["uid"] != request.userId:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="User ID does not match authenticated user",
        )
    
    session_id = str(uuid.uuid4())
    session = await create_session(session_id, request.userId)
    return session

@router.delete("/session/{sessionId}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_chat_session(sessionId: str, user = Depends(get_current_user)):
    """
    Delete a chat session and all its messages.
    """
    # Get the session first to verify ownership
    session = await get_session(sessionId)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Session not found",
        )
    
    # Verify the user ID matches the authenticated user
    if user["uid"] != session["userId"]:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You don't have permission to delete this session",
        )
    
    await delete_session(sessionId)
    return 