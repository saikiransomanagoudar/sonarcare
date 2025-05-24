import { io, Socket } from 'socket.io-client';
import { WebSocketMessage, ChatMessage } from '../types';

let socket: Socket | null = null;
let currentUserId: string | null = null;

// Create a cache for recently sent messages to prevent duplicates on reconnection
const sentMessagesCache = new Map<string, number>();

// Event listeners arrays for new streaming functionality
let messageListeners: ((message: ChatMessage) => void)[] = [];
let typingListeners: ((isTyping: boolean) => void)[] = [];
let streamStartListeners: ((message: ChatMessage) => void)[] = [];
let streamChunkListeners: ((data: { id: string; text: string }) => void)[] = [];
let streamCompleteListeners: ((message: ChatMessage) => void)[] = [];
let statusListeners: ((status: string) => void)[] = [];
let connectionListeners: ((connected: boolean) => void)[] = [];

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
  // If socket exists and user is the same, return existing socket
  if (socket && socket.connected && currentUserId === userId) {
    console.log('Reusing existing WebSocket connection for user:', userId);
    return socket;
  }

  // Disconnect existing socket if user changed
  if (socket) {
    console.log('Disconnecting existing socket for user change');
    socket.disconnect();
  }

  currentUserId = userId;
  const SOCKET_URL = process.env.NEXT_PUBLIC_SOCKET_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';
  
  console.log('Initializing new WebSocket connection to:', SOCKET_URL, 'for user:', userId);
  
  socket = io(SOCKET_URL, {
    auth: {
      userId,
    },
    transports: ['websocket', 'polling'],
    path: '/socket.io',
    reconnection: true,
    reconnectionAttempts: 15, // Increased from 10
    reconnectionDelay: 1000,
    reconnectionDelayMax: 5000,
    randomizationFactor: 0.5,
    timeout: 30000, // Increased from 20000
    forceNew: false,
    autoConnect: true,
  });

  console.log('WebSocket initialized for user:', userId);
  
  // Connection events
  socket.on('connect', () => {
    console.log('Connected to WebSocket server with socket ID:', socket?.id);
    connectionListeners.forEach(listener => listener(true));
  });
  
  socket.on('disconnect', (reason) => {
    console.log('Disconnected from WebSocket server. Reason:', reason);
    connectionListeners.forEach(listener => listener(false));
  });
  
  socket.on('connect_error', (error) => {
    console.error('WebSocket connection error:', error.message || error);
    connectionListeners.forEach(listener => listener(false));
  });
  
  socket.on('error', (error) => {
    console.error('WebSocket error:', error);
  });

  // Listen for successful join confirmation
  socket.on('joined', (data) => {
    console.log('Successfully joined session:', data.sessionId);
  });

  socket.on('error', (data) => {
    console.error('WebSocket server error:', data);
  });

  // Regular message events (your existing logic)
  socket.on('message', (message: ChatMessage) => {
    console.log('Received regular message:', message);
    messageListeners.forEach(listener => listener(message));
  });

  // Typing events (your existing logic)
  socket.on('typing', (data: { sessionId: string; typing: boolean; timestamp?: string }) => {
    console.log('Typing status:', data);
    typingListeners.forEach(listener => listener(data.typing));
  });

  // NEW: Streaming events
  socket.on('message_start', (message: ChatMessage) => {
    console.log('Stream started:', message);
    streamStartListeners.forEach(listener => listener(message));
  });

  socket.on('message_chunk', (data: { id: string; text: string; sessionId: string; done: boolean; timestamp: string }) => {
    console.log('Stream chunk:', data);
    streamChunkListeners.forEach(listener => listener(data));
  });

  socket.on('message_complete', (message: ChatMessage) => {
    console.log('Stream complete:', message);
    streamCompleteListeners.forEach(listener => listener(message));
  });

  socket.on('status', (data: { status: string; sessionId: string; timestamp: string }) => {
    console.log('Status update:', data);
    statusListeners.forEach(listener => listener(data.status));
  });

  // Legacy stream events (keeping your existing handlers)
  socket.on('stream_token', (tokenData: { messageId: string, token: string }) => {
    console.log('Legacy stream token:', tokenData);
    streamChunkListeners.forEach(listener => listener({
      id: tokenData.messageId,
      text: tokenData.token
    }));
  });

  socket.on('stream_complete', (messageId: string) => {
    console.log('Legacy stream complete:', messageId);
    // Create dummy message for compatibility
    const dummyMessage: ChatMessage = {
      id: messageId,
      sessionId: '',
      userId: currentUserId || '',
      sender: 'bot',
      text: '',
      timestamp: new Date(),
      isStreaming: false
    };
    streamCompleteListeners.forEach(listener => listener(dummyMessage));
  });
  
  return socket;
};

export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
    currentUserId = null;
    console.log('WebSocket disconnected');
  }
  removeListeners();
};

export const joinChatSession = (sessionId: string, userId?: string) => {
  if (!socket) {
    console.error('Cannot join session: Socket not initialized');
    return false;
  }
  
  if (!socket.connected) {
    console.warn(`Cannot join session ${sessionId}: Socket not connected`);
    return false;
  }
  
  try {
    const joinData: any = { sessionId };
    if (userId) {
      joinData.userId = userId;
    }
    
    socket.emit('join', joinData);
    console.log('Sent join request for session:', sessionId, userId ? `(user: ${userId})` : '');
    return true;
  } catch (error) {
    console.error('Error sending join request:', error);
    return false;
  }
};

export const leaveChatSession = (sessionId: string) => {
  if (socket) {
    socket.emit('leave', { sessionId });
    console.log('Left chat session:', sessionId);
  }
};

export const sendSocketMessage = (message: string, sessionId: string, userId: string) => {
  if (!socket) {
    console.error('Cannot send message: Socket not initialized');
    return false;
  }
  
  if (!socket.connected) {
    console.error('Cannot send message: Socket not connected');
    return false;
  }
  
  // Create a unique key for this message
  const messageKey = `${userId}-${sessionId}-${message}`;
  
  // Check if we've recently sent this exact message
  if (sentMessagesCache.has(messageKey)) {
    console.log('Prevented duplicate message send:', message.substring(0, 20) + '...');
    return false;
  }
  
  try {
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
    });
    
    console.log('Sent message successfully:', message.substring(0, 50));
    return true;
  } catch (error) {
    console.error('Error sending message:', error);
    // Remove from cache if send failed
    sentMessagesCache.delete(messageKey);
    return false;
  }
};

// Your existing functions (keeping the same API)
export const onMessageReceived = (callback: (message: ChatMessage) => void) => {
  messageListeners.push(callback);
};

export const onTypingStatus = (callback: (isTyping: boolean) => void) => {
  typingListeners.push(callback);
};

export const onStreamToken = (callback: (tokenData: { messageId: string, token: string }) => void) => {
  // Map new chunk events to legacy token events for compatibility
  streamChunkListeners.push((data: { id: string; text: string }) => {
    callback({
      messageId: data.id,
      token: data.text
    });
  });
};

export const onStreamComplete = (callback: (messageId: string) => void) => {
  streamCompleteListeners.push((message: ChatMessage) => {
    callback(message.id);
  });
};

// NEW: Additional streaming functions
export const onStreamStart = (callback: (message: ChatMessage) => void) => {
  streamStartListeners.push(callback);
};

export const onStreamChunk = (callback: (data: { id: string; text: string }) => void) => {
  streamChunkListeners.push(callback);
};

export const onStreamCompleteMessage = (callback: (message: ChatMessage) => void) => {
  streamCompleteListeners.push(callback);
};

export const onStatusUpdate = (callback: (status: string) => void) => {
  statusListeners.push(callback);
};

export const onConnectionChange = (callback: (connected: boolean) => void) => {
  connectionListeners.push(callback);
};

export const removeListeners = () => {
  // Clear all listener arrays
  messageListeners = [];
  typingListeners = [];
  streamStartListeners = [];
  streamChunkListeners = [];
  streamCompleteListeners = [];
  statusListeners = [];
  connectionListeners = [];

  // Remove socket event listeners
  if (socket) {
    socket.off('message');
    socket.off('typing');
    socket.off('stream_token');
    socket.off('stream_complete');
    socket.off('message_start');
    socket.off('message_chunk');
    socket.off('message_complete');
    socket.off('status');
  }
};

// Utility functions
export const getSocket = (): Socket | null => socket;
export const isConnected = (): boolean => socket?.connected || false;