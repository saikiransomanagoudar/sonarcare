import os
import uuid
from datetime import datetime
from typing import Dict, List, Any, Optional

from app.services.firebase_service import create_message, get_messages, get_sessions, get_session
from app.agents.langgraph_setup import process_with_langgraph
from app.agents.sonar_agent import SonarAgent

# Initialize the Sonar agent
sonar_agent = SonarAgent()

async def process_message(text: str, session_id: str, user_id: str) -> Dict[str, Any]:
    """
    Process a user message and generate a response using the LangGraph workflow.
    
    Args:
        text: The user's message text
        session_id: The ID of the chat session
        user_id: The ID of the user
        
    Returns:
        Dict containing the bot's response message
    """
    # Get previous messages for context
    message_history = await get_session_messages(session_id, user_id)
    
    # Process the message through LangGraph
    try:
        bot_response = await process_with_langgraph(text, session_id, user_id, message_history)
        
        # Save the message
        await create_message(bot_response)
        return bot_response
        
    except Exception as e:
        # Re-raise to be handled by the API endpoint
        raise e

async def get_session_messages(session_id: str, user_id: str) -> List[Dict[str, Any]]:
    """
    Get all messages for a specific chat session.
    Verifies the user has access to the session.
    
    Args:
        session_id: The ID of the chat session
        user_id: The ID of the user
        
    Returns:
        List of message dictionaries
    """
    # Verify the user has access to this session
    session = await get_session(session_id)
    if not session:
        return []
    
    if session.get("userId") != user_id:
        return []
    
    # Get messages
    messages = await get_messages(session_id)
    return messages

async def get_user_sessions(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all chat sessions for a specific user.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        List of session dictionaries
    """
    sessions = await get_sessions(user_id)
    return sessions 