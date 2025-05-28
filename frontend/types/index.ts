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
  title?: string | null;
  summary?: string;
  createdAt: string; // Changed from any to string since backend now returns ISO strings
  lastActivityAt: string; // Changed from any to string since backend now returns ISO strings
}

// Chat Message type
export interface ChatMessage {
  [x: string]: any;
  id: string;
  sessionId: string;
  userId: string;
  sender: 'user' | 'bot';
  text: string;
  timestamp: string; // Changed from any to string since backend now returns ISO strings
  metadata?: {
    sonar_model_used?: string;
    [key: string]: any;
  };
  isError?: boolean;
  isStreaming?: boolean;
}

// API request types
export interface ChatRequest {
  message: string;
  sessionId?: string;
  userId: string;
}

export interface ChatResponse {
  message: ChatMessage;
  sessionId: string;
}

// WebSocket message types
export interface WebSocketMessage {
  type: 'message' | 'error' | 'typing' | 'connected' | 'disconnected';
  data: any;
} 