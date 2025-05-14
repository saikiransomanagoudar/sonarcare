# SonarCare Backend

This is the backend server for the SonarCare medical chatbot, built with FastAPI and Perplexity Sonar APIs.

## Features

- FastAPI REST API for chat interactions
- WebSockets for real-time chat
- LangGraph multi-agent system for medical advice
- Perplexity Sonar API integration for grounded, researched responses
- Firebase authentication and data storage

## Getting Started

### Prerequisites

- Python 3.9+
- Firebase project with service account credentials
- Perplexity API key (get one at https://www.perplexity.ai/settings/api)

### Installation

1. Clone the repository if you haven't already
2. Navigate to the backend directory

```bash
cd backend
```

3. Create a virtual environment

```bash
python -m venv venv
```

4. Activate the virtual environment

```bash
# On Windows
venv\Scripts\activate
# On macOS/Linux
source venv/bin/activate
```

5. Install dependencies

```bash
pip install -r requirements.txt
```

6. Set up environment variables

Create a `.env` file in the backend directory with the following variables:

```
# Perplexity Sonar API Configuration
PERPLEXITY_API_KEY=your-perplexity-api-key
PERPLEXITY_MODEL=sonar-medium-online  # Optional, defaults to sonar-medium-online

# Firebase Configuration
FIREBASE_CREDENTIALS=path-to-firebase-service-account.json
# Or alternatively, you can use the JSON content directly:
# FIREBASE_CREDENTIALS_JSON={"type":"service_account","project_id":"..."}

# Security Configuration
JWT_SECRET_KEY=your-jwt-secret-key

# Server Configuration (optional)
PORT=8000
HOST=0.0.0.0
CORS_ORIGINS=http://localhost:3000,https://yourdomain.com
```

7. Run the development server

```bash
uvicorn app.main:app --reload
```

The API will be available at http://localhost:8000.

### Project Structure

```
/backend
  /app
    /api
      /v1
        /endpoints
          chat.py             # Chat endpoints
    /core
      config.py               # Application settings
      security.py             # Firebase auth and security
    /services
      chat_service.py         # Chat processing logic
      firebase_service.py     # Firestore database operations
    /agents                   # Perplexity Sonar API integration
      sonar_agent.py          # Perplexity Sonar agent implementation
      README.md               # Agent documentation
    main.py                   # FastAPI application entry point
  /tests                      # Unit and integration tests
  requirements.txt            # Python dependencies
  .env                        # Environment variables (not in repo)
```

## API Endpoints

- `GET /health` - Health check endpoint
- `POST /api/v1/chat/message` - Send a message to the chatbot
- `GET /api/v1/chat/messages` - Get messages for a chat session
- `GET /api/v1/chat/sessions` - Get all chat sessions for a user
- `POST /api/v1/chat/session` - Create a new chat session
- `DELETE /api/v1/chat/session/{sessionId}` - Delete a chat session

## WebSocket Events

- `connect` - Client connects to server
- `disconnect` - Client disconnects from server
- `join` - Client joins a chat session room
- `leave` - Client leaves a chat session room
- `message` - Client sends a message in a chat session

## Development Mode

The application can run in development mode without external dependencies:

1. Without a Perplexity API key, the agent will use mock responses for testing
2. Without Firebase credentials, a local mock implementation will be used for data storage

This makes it easy to develop and test locally without setting up all services. 