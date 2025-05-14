// User type
export interface User {
  uid: string;
  email: string | null;
  displayName: string | null;
  photoURL: string | null;
  createdAt: any; // Firestore Timestamp
}

// Chat Session type
export interface ChatSession {
  id: string;
  userId: string;
  createdAt: any; // Firestore Timestamp
  lastActivityAt: any; // Firestore Timestamp
  title: string;
  summary?: string;
}

// Chat Message type
export interface ChatMessage {
  id: string;
  sessionId: string;
  userId: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: any; // Firestore Timestamp
  metadata?: {
    sonar_model_used?: string;
    [key: string]: any;
  };
  isError?: boolean;
}

// API request types
export interface ChatRequest {
  message: string;
  sessionId?: string; // Optional for new sessions
  userId: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string; // Always returned, even for new sessions
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'message' | 'error' | 'typing' | 'connected' | 'disconnected';
  data: any;
} 