import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, ChatMessage } from '../types';

let socket: Socket | null = null;

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

export const removeListeners = () => {
  if (socket) {
    socket.off('message');
    socket.off('typing');
  }
}; 