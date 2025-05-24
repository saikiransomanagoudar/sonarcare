# Create this as app/services/streaming_chat_service.py

import os
import uuid
import asyncio
import logging
from datetime import datetime
from typing import Dict, List, Any, Optional, AsyncGenerator

from app.services.firebase_service import create_message, get_messages, get_sessions, get_session
from app.agents.langgraph_setup import process_with_langgraph_streaming, process_with_langgraph
from app.agents.sonar_agent import SonarAgent

# Configure logging
logger = logging.getLogger(__name__)

# Initialize the Sonar agent
sonar_agent = SonarAgent()

# Cache for session messages to reduce database calls
session_cache = {}
CACHE_EXPIRY_MINUTES = 10
MAX_CACHE_ENTRIES = 100

async def process_message_streaming(
    text: str, 
    session_id: str, 
    user_id: str
) -> AsyncGenerator[Dict[str, Any], None]:
    """
    Process a user message and generate a streaming response using the optimized LangGraph workflow.
    
    Args:
        text: The user's message text
        session_id: The ID of the chat session
        user_id: The ID of the user
        
    Yields:
        Dict containing streaming response chunks with keys:
        - type: "status", "start", "chunk", "end", "error"
        - data: The response text or status message
        - done: Boolean indicating if processing is complete
        - metadata: Optional metadata dictionary
        - message: Complete message object for "end" type
    """
    start_time = datetime.now()
    logger.info(f"Starting streaming message processing for user {user_id} in session {session_id}")
    
    try:
        # Yield initial status
        yield {
            "type": "status",
            "data": "Retrieving conversation history...",
            "done": False,
            "metadata": {}
        }
        
        # Get previous messages for context (optimized with caching)
        message_history = await get_session_messages_optimized(session_id, user_id, limit=10)
        
        logger.info(f"Retrieved {len(message_history)} messages from history")
        
        # Yield status update
        yield {
            "type": "status",
            "data": "Analyzing your question...",
            "done": False,
            "metadata": {}
        }
        
        # Process the message through LangGraph with streaming
        final_message = None
        processing_started = False
        
        async for chunk in process_with_langgraph_streaming(text, session_id, user_id, message_history):
            processing_started = True
            
            # Forward all chunks from the LangGraph processing
            if chunk["type"] == "end":
                final_message = chunk.get("message")
                
                # Add processing time to metadata
                processing_time = (datetime.now() - start_time).total_seconds()
                if final_message and "metadata" in final_message:
                    final_message["metadata"]["total_processing_time_seconds"] = processing_time
                
            yield chunk
        
        # Save the final message to database if we have one
        if final_message:
            try:
                await create_message(final_message)
                logger.info(f"Saved bot message {final_message['id']} to database")
                
                # Update session cache
                await _update_session_cache(session_id, final_message)
                
            except Exception as save_error:
                logger.error(f"Error saving message to database: {str(save_error)}")
                # Don't fail the entire process if saving fails
        
        processing_time = (datetime.now() - start_time).total_seconds()
        logger.info(f"Completed streaming message processing in {processing_time:.2f}s")
        
    except Exception as e:
        processing_time = (datetime.now() - start_time).total_seconds()
        logger.error(f"Error in streaming message processing after {processing_time:.2f}s: {str(e)}")
        
        yield {
            "type": "error",
            "data": "I'm sorry, I encountered an error while processing your request. Please try again.",
            "done": True,
            "metadata": {
                "error": str(e),
                "processing_time_seconds": processing_time
            }
        }

async def process_message(text: str, session_id: str, user_id: str) -> Dict[str, Any]:
    """
    Process a user message and generate a response using the LangGraph workflow (non-streaming version).
    This is maintained for compatibility with the REST API.
    
    Args:
        text: The user's message text
        session_id: The ID of the chat session
        user_id: The ID of the user
        
    Returns:
        Dict containing the bot's response message
    """
    logger.info(f"Processing non-streaming message for user {user_id} in session {session_id}")
    
    try:
        # Get previous messages for context
        message_history = await get_session_messages_optimized(session_id, user_id, limit=10)
        
        # Process the message through LangGraph
        bot_response = await process_with_langgraph(text, session_id, user_id, message_history)
        
        # Save the message
        if bot_response:
            await create_message(bot_response)
            await _update_session_cache(session_id, bot_response)
            
        return bot_response
        
    except Exception as e:
        logger.error(f"Error in non-streaming message processing: {str(e)}")
        
        # Create error response
        error_response = {
            "id": str(uuid.uuid4()),
            "text": "I'm sorry, I encountered an error while processing your request. Please try again.",
            "sender": "bot",
            "sessionId": session_id,
            "userId": user_id,
            "timestamp": datetime.now().isoformat(),
            "isError": True,
            "metadata": {"error": str(e)}
        }
        
        # Try to save error message
        try:
            await create_message(error_response)
        except:
            pass  # Don't fail if we can't save the error message
            
        return error_response

async def get_session_messages_optimized(
    session_id: str, 
    user_id: str, 
    limit: int = 10
) -> List[Dict[str, Any]]:
    """
    Get recent messages for a specific chat session with caching optimization.
    Verifies the user has access to the session.
    
    Args:
        session_id: The ID of the chat session
        user_id: The ID of the user
        limit: Maximum number of recent messages to retrieve
        
    Returns:
        List of recent message dictionaries
    """
    try:
        # Check cache first
        cache_key = f"{session_id}:{user_id}"
        current_time = datetime.now()
        
        if cache_key in session_cache:
            cached_data = session_cache[cache_key]
            cache_age = (current_time - cached_data["timestamp"]).total_seconds() / 60
            
            if cache_age < CACHE_EXPIRY_MINUTES:
                logger.debug(f"Using cached messages for session {session_id}")
                return cached_data["messages"][-limit:]  # Return most recent messages
        
        # Verify the user has access to this session
        session = await get_session(session_id)
        if not session:
            logger.warning(f"Session {session_id} not found")
            return []
        
        if session.get("userId") != user_id:
            logger.warning(f"User {user_id} does not have access to session {session_id}")
            return []
        
        # Get messages from database
        all_messages = await get_messages(session_id)
        
        if all_messages:
            # Sort messages by timestamp and take the most recent ones
            try:
                # Handle different timestamp formats
                def parse_timestamp(msg):
                    ts = msg.get("timestamp", "")
                    if isinstance(ts, str):
                        try:
                            return datetime.fromisoformat(ts.replace('Z', '+00:00'))
                        except:
                            return datetime.min
                    elif isinstance(ts, datetime):
                        return ts
                    else:
                        return datetime.min
                
                sorted_messages = sorted(all_messages, key=parse_timestamp)
                recent_messages = sorted_messages[-limit:] if len(sorted_messages) > limit else sorted_messages
                
                # Update cache
                session_cache[cache_key] = {
                    "messages": sorted_messages,  # Cache all messages
                    "timestamp": current_time
                }
                
                # Clean up cache if it gets too large
                if len(session_cache) > MAX_CACHE_ENTRIES:
                    await _cleanup_session_cache()
                
                logger.debug(f"Retrieved {len(recent_messages)} recent messages for session {session_id}")
                return recent_messages
                
            except Exception as sort_error:
                logger.error(f"Error sorting messages: {str(sort_error)}")
                # Return unsorted messages as fallback
                return all_messages[-limit:] if len(all_messages) > limit else all_messages
        
        return []
        
    except Exception as e:
        logger.error(f"Error getting optimized session messages for session {session_id}: {str(e)}")
        return []

async def get_user_sessions(user_id: str) -> List[Dict[str, Any]]:
    """
    Get all chat sessions for a specific user.
    
    Args:
        user_id: The ID of the user
        
    Returns:
        List of session dictionaries
    """
    try:
        sessions = await get_sessions(user_id)
        logger.info(f"Retrieved {len(sessions)} sessions for user {user_id}")
        return sessions
    except Exception as e:
        logger.error(f"Error getting user sessions for user {user_id}: {str(e)}")
        return []

async def _update_session_cache(session_id: str, new_message: Dict[str, Any]):
    """
    Update the session cache with a new message.
    
    Args:
        session_id: The session ID
        new_message: The new message to add to cache
    """
    try:
        user_id = new_message.get("userId")
        if not user_id:
            return
            
        cache_key = f"{session_id}:{user_id}"
        current_time = datetime.now()
        
        if cache_key in session_cache:
            # Add message to existing cache
            session_cache[cache_key]["messages"].append(new_message)
            session_cache[cache_key]["timestamp"] = current_time
        else:
            # Create new cache entry
            session_cache[cache_key] = {
                "messages": [new_message],
                "timestamp": current_time
            }
            
        logger.debug(f"Updated cache for session {session_id}")
        
    except Exception as e:
        logger.error(f"Error updating session cache: {str(e)}")

async def _cleanup_session_cache():
    """
    Clean up old entries from the session cache.
    """
    try:
        current_time = datetime.now()
        keys_to_remove = []
        
        for cache_key, cached_data in session_cache.items():
            cache_age = (current_time - cached_data["timestamp"]).total_seconds() / 60
            if cache_age > CACHE_EXPIRY_MINUTES:
                keys_to_remove.append(cache_key)
        
        # Remove expired entries
        for key in keys_to_remove:
            del session_cache[key]
        
        # If still too many entries, remove oldest
        if len(session_cache) > MAX_CACHE_ENTRIES:
            sorted_items = sorted(
                session_cache.items(), 
                key=lambda x: x[1]["timestamp"]
            )
            items_to_remove = len(session_cache) - MAX_CACHE_ENTRIES
            for key, _ in sorted_items[:items_to_remove]:
                del session_cache[key]
        
        logger.debug(f"Cache cleanup completed. Current cache size: {len(session_cache)}")
        
    except Exception as e:
        logger.error(f"Error cleaning up session cache: {str(e)}")

# Background task for periodic cache cleanup
async def periodic_cache_cleanup():
    """
    Periodic cleanup of the session cache.
    """
    while True:
        try:
            await _cleanup_session_cache()
            await asyncio.sleep(300)  # Clean up every 5 minutes
        except Exception as e:
            logger.error(f"Error in periodic cache cleanup: {str(e)}")
            await asyncio.sleep(60)  # Retry in 1 minute

# Function to start the cache cleanup task
def start_cache_cleanup_task():
    """
    Start the periodic cache cleanup task.
    Call this from your application startup.
    """
    asyncio.create_task(periodic_cache_cleanup())