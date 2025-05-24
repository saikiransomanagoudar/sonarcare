from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
import socketio
import uvicorn
from dotenv import load_dotenv
import uuid
from datetime import datetime
import logging
import asyncio

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.api.v1.endpoints import chat
from app.core.config import settings

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="SonarCare API",
    description="API for SonarCare Medical Chatbot with Streaming Support",
    version="0.2.0",
)

# Set up CORS - very permissive for development
origins = [
    "http://localhost:3000",
    "http://localhost",
    "http://127.0.0.1:3000",
    "http://127.0.0.1",
    "https://sonarcare.vercel.app",
    "*"
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=origins,
    allow_credentials=True,
    allow_methods=["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    allow_headers=["*"],
    expose_headers=["*"],
)

# Log all requests for debugging
@app.middleware("http")
async def log_requests(request: Request, call_next):
    logger.info(f"Request: {request.method} {request.url}")
    logger.info(f"Headers: {request.headers}")
    try:
        response = await call_next(request)
        logger.info(f"Response status: {response.status_code}")
        return response
    except Exception as e:
        logger.error(f"Request failed: {str(e)}")
        raise

# Create Socket.IO server with optimized settings
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=origins,
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    always_connect=True,
    max_http_buffer_size=1024 * 1024  # 1MB buffer for large responses
)
socket_app = socketio.ASGIApp(
    sio,
    socketio_path="socket.io",
    other_asgi_app=app
)

# Add a recently processed messages cache to avoid duplicates
recent_messages = {}
MAX_CACHE_SIZE = 1000
MAX_AGE_SECONDS = 300  # 5 minutes

# Helper function to clean up old cache entries
async def cleanup_message_cache():
    """Clean up old entries from the message cache to prevent memory leaks."""
    now = datetime.now().timestamp()
    keys_to_remove = []
    
    for key, data in recent_messages.items():
        if now - data["timestamp"] > MAX_AGE_SECONDS:
            keys_to_remove.append(key)
    
    for key in keys_to_remove:
        del recent_messages[key]
    
    # If still too many entries, remove oldest
    if len(recent_messages) > MAX_CACHE_SIZE:
        sorted_keys = sorted(recent_messages.keys(), 
                             key=lambda k: recent_messages[k]["timestamp"])
        for key in sorted_keys[:len(recent_messages) - MAX_CACHE_SIZE]:
            del recent_messages[key]

# Include routers
app.include_router(chat.router, prefix="/api/v1")

# Health check endpoint
@app.get("/health")
async def health_check():
    return {
        "status": "healthy",
        "version": "0.2.0",
        "features": ["streaming", "optimized_intent_detection", "caching"]
    }

# Socket.IO event handlers for streaming responses
@sio.event
async def connect(sid, environ, auth):
    """Handle client connection with authentication."""
    logger.info(f"Client attempting to connect: {sid}")
    
    if not auth or "userId" not in auth:
        logger.warning(f"Client {sid} connection rejected: missing auth")
        return False
    
    logger.info(f"Client connected successfully: {sid} for user: {auth['userId']}")
    await sio.emit("connected", {
        "status": "connected",
        "timestamp": datetime.now().isoformat()
    }, room=sid)
    return True

@sio.event
async def disconnect(sid):
    """Handle client disconnection."""
    logger.info(f"Client disconnected: {sid}")

@sio.event
async def join(sid, data):
    """Handle joining a chat session room."""
    if "sessionId" in data:
        session_id = data["sessionId"]
        logger.info(f"Client {sid} joining room: {session_id}")
        await sio.enter_room(sid, session_id)
        await sio.emit("joined", {
            "status": "joined", 
            "sessionId": session_id,
            "timestamp": datetime.now().isoformat()
        }, room=sid)
    else:
        logger.warning(f"Client {sid} join request missing sessionId")
        await sio.emit("error", {"message": "sessionId required"}, room=sid)

@sio.event
async def leave(sid, data):
    """Handle leaving a chat session room."""
    if "sessionId" in data:
        session_id = data["sessionId"]
        logger.info(f"Client {sid} leaving room: {session_id}")
        await sio.leave_room(sid, session_id)
        await sio.emit("left", {
            "status": "left", 
            "sessionId": session_id
        }, room=sid)

@sio.event
async def message(sid, data):
    """Handle incoming messages with streaming response support."""
    if not all(key in data for key in ["text", "sessionId", "userId"]):
        logger.warning(f"Message from {sid} missing required fields: {data}")
        await sio.emit("error", {
            "message": "Missing required fields: text, sessionId, userId"
        }, room=sid)
        return
    
    # Extract message data
    message_text = data["text"].strip()
    session_id = data["sessionId"]
    user_id = data["userId"]
    
    if not message_text:
        logger.warning(f"Empty message from {sid}")
        return
    
    # Create a message deduplication key
    message_key = f"{user_id}:{session_id}:{message_text}"
    
    # Check if this is a duplicate message (sent on page refresh)
    if message_key in recent_messages:
        logger.info(f"Detected duplicate message from {sid}: {message_text[:30]}...")
        return
    
    # Add to recently processed messages
    recent_messages[message_key] = {
        "timestamp": datetime.now().timestamp(),
        "processed": True,
        "sid": sid
    }
    
    # Clean up cache occasionally
    if len(recent_messages) % 10 == 0:
        await cleanup_message_cache()
    
    # Create and emit the user message to all clients in the room
    user_message = {
        "id": str(uuid.uuid4()),
        "text": message_text,
        "sender": "user",
        "sessionId": session_id,
        "userId": user_id,
        "timestamp": datetime.now().isoformat(),
        "metadata": {}
    }
    
    # Save the user message to the database (IMPORTANT: This was missing!)
    try:
        from app.services.firebase_service import create_message
        await create_message(user_message)
        logger.info(f"Saved user message {user_message['id']} to database")
    except Exception as save_error:
        logger.error(f"Error saving user message to database: {str(save_error)}")
        # Continue processing even if save fails
    
    logger.info(f"Processing message from {sid} in session {session_id}: {message_text[:50]}...")
    await sio.emit("message", user_message, room=session_id)
    
    # Create a unique message ID for the bot response
    bot_message_id = str(uuid.uuid4())
    
    try:
        # Import the streaming chat service
        from app.services.streaming_chat_service import process_message_streaming
        
        # Emit typing indicator
        await sio.emit("typing", {
            "sessionId": session_id,
            "typing": True,
            "timestamp": datetime.now().isoformat()
        }, room=session_id)
        
        # Process the message with streaming
        message_started = False
        final_message = None
        
        async for chunk in process_message_streaming(message_text, session_id, user_id):
            try:
                if chunk["type"] == "status":
                    # Emit status updates (analyzing, generating, etc.)
                    await sio.emit("status", {
                        "sessionId": session_id,
                        "status": chunk["data"],
                        "timestamp": datetime.now().isoformat()
                    }, room=session_id)
                    
                elif chunk["type"] == "start":
                    # Emit the start of the bot response
                    bot_message_start = {
                        "id": bot_message_id,
                        "text": "",
                        "sender": "bot",
                        "sessionId": session_id,
                        "userId": user_id,
                        "timestamp": datetime.now().isoformat(),
                        "metadata": chunk.get("metadata", {}),
                        "streaming": True,
                        "done": False
                    }
                    await sio.emit("message_start", bot_message_start, room=session_id)
                    message_started = True
                    
                elif chunk["type"] == "chunk":
                    # Emit incremental updates
                    if message_started:
                        await sio.emit("message_chunk", {
                            "id": bot_message_id,
                            "text": chunk["data"],
                            "sessionId": session_id,
                            "done": False,
                            "timestamp": datetime.now().isoformat()
                        }, room=session_id)
                    
                elif chunk["type"] == "end":
                    # Emit the final complete message
                    final_bot_message = {
                        "id": bot_message_id,
                        "text": chunk["data"],
                        "sender": "bot",
                        "sessionId": session_id,
                        "userId": user_id,
                        "timestamp": datetime.now().isoformat(),
                        "metadata": chunk.get("metadata", {}),
                        "streaming": False,
                        "done": True
                    }
                    
                    await sio.emit("message_complete", final_bot_message, room=session_id)
                    final_message = chunk.get("message", final_bot_message)
                    
                    # Stop typing indicator
                    await sio.emit("typing", {
                        "sessionId": session_id,
                        "typing": False,
                        "timestamp": datetime.now().isoformat()
                    }, room=session_id)
                    
                elif chunk["type"] == "error":
                    # Handle streaming errors
                    error_message = {
                        "id": bot_message_id,
                        "text": chunk["data"],
                        "sender": "bot",
                        "sessionId": session_id,
                        "userId": user_id,
                        "timestamp": datetime.now().isoformat(),
                        "isError": True,
                        "streaming": False,
                        "done": True,
                        "metadata": chunk.get("metadata", {})
                    }
                    await sio.emit("message_complete", error_message, room=session_id)
                    
                    # Stop typing indicator
                    await sio.emit("typing", {
                        "sessionId": session_id,
                        "typing": False
                    }, room=session_id)
                    break
                    
            except Exception as emit_error:
                logger.error(f"Error emitting chunk: {str(emit_error)}")
                continue
        
        logger.info(f"Completed processing message from {sid}")
        
    except Exception as e:
        logger.error(f"Error processing streaming message from {sid}: {str(e)}")
        
        # Stop typing indicator
        await sio.emit("typing", {
            "sessionId": session_id,
            "typing": False
        }, room=session_id)
        
        # Emit an error message if processing fails
        error_message = {
            "id": bot_message_id,
            "text": "I'm sorry, I encountered an error while processing your request. Please try again in a moment.",
            "sender": "bot",
            "sessionId": session_id,
            "userId": user_id,
            "timestamp": datetime.now().isoformat(),
            "isError": True,
            "streaming": False,
            "done": True,
            "metadata": {"error": str(e)}
        }
        await sio.emit("message_complete", error_message, room=session_id)

@sio.event
async def ping(sid, data):
    """Handle ping requests for connection health checking."""
    await sio.emit("pong", {
        "timestamp": datetime.now().isoformat()
    }, room=sid)

# Background task to clean up message cache periodically
async def periodic_cleanup():
    """Periodic cleanup of message cache and other resources."""
    while True:
        try:
            await cleanup_message_cache()
            logger.debug(f"Cache cleanup completed. Current cache size: {len(recent_messages)}")
            await asyncio.sleep(300)  # Clean up every 5 minutes
        except Exception as e:
            logger.error(f"Error in periodic cleanup: {str(e)}")
            await asyncio.sleep(60)  # Retry in 1 minute if there's an error

# Start the cleanup task when the app starts
@app.on_event("startup")
async def startup_event():
    """Application startup event handler."""
    logger.info("SonarCare API starting up...")
    # Start the periodic cleanup task
    asyncio.create_task(periodic_cleanup())
    logger.info("SonarCare API startup complete")

@app.on_event("shutdown")
async def shutdown_event():
    """Application shutdown event handler."""
    logger.info("SonarCare API shutting down...")
    # Clean up any remaining resources
    recent_messages.clear()
    logger.info("SonarCare API shutdown complete")

# Mount the Socket.IO app
app.mount("/", socket_app)

if __name__ == "__main__":
    # Run the app with uvicorn
    uvicorn.run(
        "app.main:app", 
        host=settings.HOST, 
        port=settings.PORT, 
        reload=True,
        log_level="info"
    )