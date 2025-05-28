# SonarCare - Medical Advice Chatbot

SonarCare is a full-stack medical advice chatbot powered by Perplexity Sonar APIs. It provides users with reliable, grounded medical information through a conversational interface.

## 🚀 Key Features

### 🏥 Medical Intelligence
- **Research-Backed Responses**: Powered by Perplexity Sonar's web search and reasoning capabilities
- **Multi-Agent Architecture**: Specialized agents for symptoms, treatments, hospital search, and unbiased fact checks and deep medical research.
- **Healthcare Validation**: Smart filtering to ensure medical relevance and safety
- **Medical Disclaimers**: Clear guidance about informational nature of content

### 💻 User Experience
- **Real-time Chat**: WebSocket-based streaming responses
- **User Authentication**: Firebase Auth with email/password and Google sign-in
- **Chat History**: Persistent conversation storage with Firebase Firestore
- **Modern UI**: Responsive design with Tailwind CSS and shadcn/ui components
- **Mobile-Friendly**: Optimized for all device sizes

## 🏗️ Technical Architecture

### Frontend (Next.js 14)
```
frontend/
├── app/                   # Next.js App Router
├── components/            # Reusable UI components
├── hooks/                 # Custom React hooks
├── lib/                   # Utility libraries and Firebase config
├── context/               # React context providers
├── types/                 # TypeScript type definitions
└── public/                # Static assets
```

**Tech Stack:**
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type safety and developer experience
- **Tailwind CSS**: Utility-first CSS framework
- **shadcn/ui**: Modern component library
- **Firebase SDK**: Authentication and Firestore integration
- **Socket.IO Client**: Real-time communication

### Backend (FastAPI)
```
backend/
├── app/
│   ├── main.py                    # FastAPI application and Socket.IO server
│   ├── core/
│   │   ├── config.py             # Application configuration
│   │   └── optimization_config.py # Performance optimization settings
│   ├── agents/
│   │   ├── fast_intent_classifier.py      # Ultra-fast local intent detection
│   │   ├── langgraph_setup.py            # Multi-agent orchestration
│   │   ├── action_operator_agent.py      # Intent classification agent
│   │   ├── symptom_checker_agent.py      # Symptom analysis agent
│   │   ├── treatment_advisor_agent.py    # Treatment recommendation agent
│   │   ├── hospital_finder_agent.py      # Hospital/clinic search agent
│   │   ├── department_inquiry_agent.py   # Medical department guidance
│   │   ├── deep_medical_research_agent.py # Latest research insights
│   │   ├── unbiased_factual_agent.py     # Objective medical information
│   │   └── comprehensive_health_agent.py # Complete health assessments
│   ├── services/
│   │   ├── firebase_service.py           # Firebase Admin SDK integration
│   │   ├── streaming_chat_service.py     # Original streaming service
│   │   └── optimized_streaming_service.py # High-performance streaming
│   └── api/
│       └── v1/
│           └── endpoints/
│               └── chat.py               # REST API endpoints
├── test_optimization.py          # Performance benchmarking tools
└── requirements.txt              # Python dependencies
```

**Tech Stack:**
- **FastAPI**: High-performance Python web framework
- **LangGraph**: Multi-agent orchestration system
- **Perplexity Sonar API**: Advanced web search and reasoning
- **Firebase Admin SDK**: Authentication and database management
- **Socket.IO**: Real-time bidirectional communication
- **aiohttp**: Async HTTP client with connection pooling
- **Uvicorn**: ASGI server for production deployment

## 🛠️ Installation & Setup

### Prerequisites
- **Node.js 18+** and npm
- **Python 3.9+** with pip
- **Firebase Project** with Authentication and Firestore enabled
- **Perplexity API Key** from [Perplexity](https://perplexity.ai)

### 1. Clone Repository
```bash
git clone <repository-url>
cd sonarcare
```

### 2. Backend Setup
```bash
cd backend

# Install Python dependencies
pip install -r requirements.txt

# Create environment file
cp .env.example .env

# Configure environment variables
# Edit .env with your API keys and configuration
```

**Required Environment Variables:**
```bash
# Perplexity API
PERPLEXITY_API_KEY=your_perplexity_api_key
PERPLEXITY_SONAR=sonar
PERPLEXITY_SONAR_REASONING_PRO=sonar-reasoning-pro
PERPLEXITY_SONAR_DEEP_RESEARCH=sonar-deep-research

# Firebase
FIREBASE_CREDENTIALS=firebase-credentials.json

# Server Configuration
HOST=0.0.0.0
PORT=8000

# Performance Optimizations (optional)
USE_FAST_INTENT_CLASSIFIER=true
ENABLE_RESPONSE_CACHING=true
ENABLE_PARALLEL_PROCESSING=true
ENABLE_TRUE_STREAMING=true
```

### 3. Frontend Setup
```bash
cd frontend

# Install dependencies
npm install

# Create environment file
cp .env.local.example .env.local

# Configure Firebase settings
# Edit .env.local with your Firebase configuration
```

**Required Environment Variables:**
```bash
NEXT_PUBLIC_FIREBASE_API_KEY=your_firebase_api_key
NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN=your-project.firebaseapp.com
NEXT_PUBLIC_FIREBASE_PROJECT_ID=your-project-id
NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET=your-project.appspot.com
NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID=your_sender_id
NEXT_PUBLIC_FIREBASE_APP_ID=your_app_id
EXT_PUBLIC_FIREBASE_MEASUREMENT_ID=your_measurement_id
```

### 4. Firebase Configuration
1. Create a Firebase project at [Firebase Console](https://console.firebase.google.com)
2. Enable **Authentication** (Email/Password and Google providers)
3. Enable **Firestore Database**
4. Download service account credentials as `firebase-credentials.json`
5. Place credentials file in the `backend/` directory

## 🚦 Running the Application

### Development Mode

**Start Backend Server:**
```bash
cd backend
uvicorn app.main:app --reload --host 0.0.0.0 --port 8000
# (OR)
# python -m app.main
```

**Start Frontend (separate terminal):**
```bash
cd frontend
npm run dev
```

**Access Application:**
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000
- API Documentation: http://localhost:8000/docs

## 📡 API Reference

### REST Endpoints

- `GET /api/v1/sessions` - Get user chat sessions
- `POST /api/v1/sessions` - Create new chat session

## 🔒 Security Features

- **Firebase Authentication**: Secure user authentication with JWT tokens
- **Input Validation**: Comprehensive request validation and sanitization
- **Healthcare Filtering**: Smart validation to ensure medical relevance
- **CORS Configuration**: Properly configured cross-origin resource sharing
- **Rate Limiting**: Built-in protection against abuse (configurable)

## ⚠️ Medical Disclaimer

**Important:** This application is for educational and informational purposes only. It is not intended to be a substitute for professional medical advice, diagnosis, or treatment. Always seek the advice of your physician or other qualified health provider with any questions you may have regarding a medical condition. Never disregard professional medical advice or delay in seeking it because of something you have read in this application.
 