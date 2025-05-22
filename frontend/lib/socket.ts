import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, ChatMessage } from '../types';

let socket: Socket | null = null;
// Create a cache for recently sent messages to prevent duplicates on reconnection
const sentMessagesCache = new Map<string, number>();

// Helper to clean up old cache entries
const cleanupMessageCache = () => {
  const now = Date.now();
  const maxAge = 5 * 60 * 1000; // 5 minutes
  
  sentMessagesCache.forEach((timestamp, key) => {
    if (now - timestamp > maxAge) {
      sentMessagesCache.delete(key);
    }
  });
};

export const initializeSocket = (userId: string) => {
  if (!socket) {
    const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || 'http://localhost:8000';
    
    socket = io(SOCKET_URL, {
      auth: {
        userId,
      },
      transports: ['websocket', 'polling'],
      path: '/socket.io',
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
    });

    console.log('WebSocket initialized for user:', userId);
    
    socket.on('connect', () => {
      console.log('Connected to WebSocket server');
    });
    
    socket.on('disconnect', () => {
      console.log('Disconnected from WebSocket server');
    });
    
    socket.on('connect_error', (error) => {
      console.error('WebSocket connection error:', error);
    });
    
    socket.on('error', (error) => {
      console.error('WebSocket error:', error);
    });
  }
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    console.log('WebSocket disconnected');
  }
};

export const joinChatSession = (sessionId: string) => {
  if (socket) {
    socket.emit('join', { sessionId });
    console.log('Joined chat session:', sessionId);
  }
};

export const leaveChatSession = (sessionId: string) => {
  if (socket) {
    socket.emit('leave', { sessionId });
    console.log('Left chat session:', sessionId);
  }
};

export const sendSocketMessage = (message: string, sessionId: string, userId: string) => {
  if (socket) {
    // Create a unique key for this message
    const messageKey = `${userId}-${sessionId}-${message}`;
    
    // Check if we've recently sent this exact message
    if (sentMessagesCache.has(messageKey)) {
      console.log('Prevented duplicate message send:', message.substring(0, 20) + '...');
      return;
    }
    
    // Add to cache with current timestamp
    sentMessagesCache.set(messageKey, Date.now());
    
    // Clean up old cache entries occasionally
    if (Math.random() < 0.1) { // 10% chance to run cleanup
      cleanupMessageCache();
    }
    
    // Send the message
    socket.emit('message', {
      text: message,
      sessionId,
      userId,
      sender: 'user',
      timestamp: new Date().toISOString(),
    });
  }
};

export const onMessageReceived = (callback: (message: ChatMessage) => void) => {
  if (socket) {
    socket.on('message', callback);
  }
};

export const onTypingStatus = (callback: (isTyping: boolean) => void) => {
  if (socket) {
    socket.on('typing', callback);
  }
};

export const onStreamToken = (callback: (tokenData: { messageId: string, token: string }) => void) => {
  if (socket) {
    socket.on('stream_token', callback);
  }
};

export const onStreamComplete = (callback: (messageId: string) => void) => {
  if (socket) {
    socket.on('stream_complete', callback);
  }
};

export const removeListeners = () => {
  if (socket) {
    socket.off('message');
    socket.off('typing');
    socket.off('stream_token');
    socket.off('stream_complete');
  }
}; 