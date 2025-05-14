# SonarCare - Medical AI Assistant

SonarCare is a full-stack medical advice chatbot powered by Perplexity Sonar APIs. It provides users with reliable, grounded medical information through a conversational interface.

## Project Structure

This project is organized into two main directories:

- **`/frontend`** - Next.js web application
- **`/backend`** - FastAPI Python server

## Features

- **Reliable Medical Information**: Powered by Perplexity Sonar's web search and reasoning capabilities
- **User Authentication**: Secure login/signup with email/password or Google authentication
- **Real-time Chat**: WebSocket-based chat for immediate AI responses
- **Chat History**: Save and access previous conversations
- **Medical Disclaimers**: Clear disclaimers about the informational nature of the content

## Technical Stack

### Frontend
- **Next.js**: React framework with App Router
- **TypeScript**: For type safety
- **Tailwind CSS**: For styling
- **Firebase Authentication**: For user authentication
- **Firebase Firestore**: For storing chat history
- **Socket.IO Client**: For real-time communication

### Backend
- **FastAPI**: Python framework for the backend API
- **LangGraph**: Multi-agent system for orchestrating AI agents
- **Perplexity Sonar API**: For grounded, research-backed responses
- **Firebase Admin SDK**: For authentication and database access
- **Socket.IO**: For real-time communication
- **Uvicorn**: ASGI server for running the application

## Getting Started

### Prerequisites
- Node.js 16+ and npm
- Python 3.9+
- Firebase project with Authentication and Firestore enabled
- Perplexity API key

### Installation

#### Frontend Setup
See [frontend README](./frontend/README.md) for detailed frontend setup instructions.

#### Backend Setup
See [backend README](./backend/README.md) for detailed backend setup instructions.

## Development

To run the entire application locally, you'll need to start both the frontend and backend servers:

1. Start the backend server (from the root directory):
```
cd backend
uvicorn app.main:app --reload
```

2. In a separate terminal, start the frontend (from the root directory):
```
cd frontend
npm run dev
```

The frontend will be available at http://localhost:3000 and the backend API at http://localhost:8000.

## Disclaimer

This application is for educational and informational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition.

## License

MIT 