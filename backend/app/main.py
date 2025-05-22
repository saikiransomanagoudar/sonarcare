from fastapi import FastAPI, Depends, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
import socketio
import uvicorn
import os
from dotenv import load_dotenv
import uuid
from datetime import datetime
import logging

# Configure logging
logging.basicConfig(level=logging.INFO)
logger = logging.getLogger(__name__)

from app.api.v1.endpoints import chat
from app.core.config import settings
from app.core.security import get_current_user

# Load environment variables
load_dotenv()

# Create FastAPI app
app = FastAPI(
    title="SonarCare API",
    description="API for SonarCare Medical Chatbot",
    version="0.1.0",
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

# Create Socket.IO server
sio = socketio.AsyncServer(
    async_mode="asgi",
    cors_allowed_origins=origins,
    logger=True,
    engineio_logger=True,
    ping_timeout=60,
    ping_interval=25,
    always_connect=True
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
    return {"status": "healthy"}

# Socket.IO event handlers
@sio.event
async def connect(sid, environ, auth):
    print(f"Client connected: {sid}")
    if not auth or "userId" not in auth:
        return False
    await sio.emit("connected", {"status": "connected"}, room=sid)

@sio.event
async def disconnect(sid):
    print(f"Client disconnected: {sid}")

@sio.event
async def join(sid, data):
    if "sessionId" in data:
        session_id = data["sessionId"]
        print(f"Client {sid} joined room: {session_id}")
        sio.enter_room(sid, session_id)
        await sio.emit("joined", {"status": "joined", "sessionId": session_id}, room=sid)

@sio.event
async def leave(sid, data):
    if "sessionId" in data:
        session_id = data["sessionId"]
        print(f"Client {sid} left room: {session_id}")
        sio.leave_room(sid, session_id)

@sio.event
async def message(sid, data):
    if all(key in data for key in ["text", "sessionId", "userId"]):
        # Create a message deduplication key
        message_key = f"{data['userId']}:{data['sessionId']}:{data['text']}"
        
        # Check if this is a duplicate message (sent on page refresh)
        if message_key in recent_messages:
            print(f"Detected duplicate message: {data['text'][:30]}...")
            # Don't process it again, but don't block it either
            # This way the user's message will still appear in their UI
            return
        
        # Add to recently processed messages
        recent_messages[message_key] = {
            "timestamp": datetime.now().timestamp(),
            "processed": True
        }
        
        # Clean up cache occasionally
        if len(recent_messages) % 10 == 0:
            await cleanup_message_cache()
        
        # Emit the user message to all clients in the room
        user_message = {
            **data,
            "id": str(uuid.uuid4()),
            "sender": "user",
            "timestamp": datetime.now().isoformat()
        }
        await sio.emit("message", user_message, room=data["sessionId"])
        
        try:
            # Process the message with our Sonar agent via the chat service
            from app.services.chat_service import process_message
            bot_response = await process_message(data["text"], data["sessionId"], data["userId"])
            
            # Emit the bot response to all clients in the room
            await sio.emit("message", bot_response, room=data["sessionId"])
        except Exception as e:
            # Emit an error message if processing fails
            error_message = {
                "id": str(uuid.uuid4()),
                "text": f"Sorry, there was an error processing your message: {str(e)}",
                "sender": "bot",
                "sessionId": data["sessionId"],
                "userId": data["userId"],
                "timestamp": datetime.now().isoformat(),
                "isError": True
            }
            await sio.emit("message", error_message, room=data["sessionId"])

# Mount the Socket.IO app
app.mount("/", socket_app)

if __name__ == "__main__":
    # Run the app with uvicorn
    uvicorn.run("app.main:app", host="0.0.0.0", port=8000, reload=True) 