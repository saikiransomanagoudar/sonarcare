import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ChatMessage } from '../../types';
import { sendMessage, deleteChatSession, updateSessionTitle } from '../../lib/api';
import { 
  initializeSocket, 
  joinChatSession, 
  leaveChatSession, 
  sendSocketMessage, 
  onMessageReceived, 
  onTypingStatus, 
  onStreamToken,
  onStreamComplete,
  onStreamStart,
  onStreamCompleteMessage,
  onStatusUpdate,
  onConnectionChange,
  removeListeners,
  getSocket,
  isConnected as checkConnection
} from '../../lib/socket';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

// Helper function to generate a concise title from the bot's response
const generateTitleFromResponse = (text: string): string => {
  // If text is too short, use it as is
  if (text.length < 60) return text;
  
  // Try to extract the first sentence or a fragment
  const firstSentence = text.split(/[.!?]/)[0];
  if (firstSentence.length < 80) return firstSentence;
  
  // If first sentence is too long, just take the first 50 chars and add ellipsis
  return firstSentence.substring(0, 50).trim() + '...';
};

// Add extended type for messages with sorting timestamps
interface ChatMessageWithTimestamp extends ChatMessage {
  _sortTimestamp?: number;
}

interface ChatLayoutProps {
  initialMessages?: ChatMessage[];
  sessionId: string;
}

const ChatLayout: React.FC<ChatLayoutProps> = ({ initialMessages = [], sessionId }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [botIsTyping, setBotIsTyping] = useState(false);
  const [sessionTitle, setSessionTitle] = useState<string>('');
  const [isConnected, setIsConnected] = useState(false);
  const [currentStatus, setCurrentStatus] = useState<string>('');
  const [streamingMessage, setStreamingMessage] = useState<ChatMessage | null>(null);
  const router = useRouter();
  
  // Use refs to track message IDs to prevent duplicates
  const processedMessages = useRef(new Set<string>());
  const titleGenerated = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  // Add a flag to track initial load
  const initialLoadComplete = useRef<boolean>(false);

  // Add a new state for streaming responses (keeping for backward compatibility)
  const [streamingMessages, setStreamingMessages] = useState<{[key: string]: string}>({});

  // Keep messagesRef updated with the latest messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
  // Pre-populate processed messages on initial load
  useEffect(() => {
    // Only do this once on initial load
    if (!initialLoadComplete.current && initialMessages.length > 0) {
      console.log("Pre-populating processed message cache with initial messages");
      
      // Mark all initial messages as processed to prevent duplicates
      initialMessages.forEach(msg => {
        if (msg.id) {
          processedMessages.current.add(msg.id);
        }
      });
      
      initialLoadComplete.current = true;
    }
  }, [initialMessages]);

  // Toggle sidebar visibility
  const toggleSidebar = () => {
    // Dispatch a custom event that the layout component can listen for
    const event = new CustomEvent('toggleSidebar');
    window.dispatchEvent(event);
  };

  // Generate title from initial messages if there are any bot messages
  useEffect(() => {
    if (initialMessages.length > 0 && !titleGenerated.current) {
      const botMessages = initialMessages.filter(m => m.sender === 'bot');
      if (botMessages.length > 0) {
        const firstBotMessage = botMessages[0];
        const title = generateTitleFromResponse(firstBotMessage.text);
        setSessionTitle(title);
        
        // Don't update the title on the backend if this is initial load - assume it's already set
        titleGenerated.current = true;
      }
    }
  }, [initialMessages]);

  // Initialize WebSocket connection
  useEffect(() => {
    if (!currentUser) return;

    const socket = initializeSocket(currentUser.uid);

    // Join the chat session room
    if (sessionId) {
      joinChatSession(sessionId);
    }

    // Listen for first message event from new chat redirect
    const handleFirstMessage = (event: CustomEvent) => {
      const message = event.detail?.message;
      if (message && typeof message === 'string') {
        console.log('Sending first message from query parameter:', message);
        handleSendMessage(message);
      }
    };

    window.addEventListener('sendFirstMessage', handleFirstMessage as EventListener);

    // Setup connection status listener
    onConnectionChange((connected: boolean) => {
      console.log('Connection status changed:', connected);
      setIsConnected(connected);
      if (!connected) {
        setBotIsTyping(false);
        setCurrentStatus('');
        setStreamingMessage(null);
      }
    });

    // Setup message listener - NOW HANDLES ALL MESSAGES (USER AND BOT)
    onMessageReceived((message: ChatMessage) => {
      console.log('Received message via socket:', message);
      
      if (!message.id) {
        // Assign ID if missing
        message.id = uuidv4();
        console.log('Assigned new ID to message:', message.id);
      }
      
      const messageKey = `${message.id}`;
      
      // Skip if we've already processed this exact message ID
      if (processedMessages.current.has(messageKey)) {
        console.log('Skipping duplicate message ID:', messageKey);
        return;
      }
      
      // Mark as processed immediately to prevent duplicates
      processedMessages.current.add(messageKey);
      console.log('Processing new message:', messageKey, 'Sender:', message.sender);
      
      // Limit size of tracking sets
      if (processedMessages.current.size > 200) {
        const values = Array.from(processedMessages.current);
        processedMessages.current = new Set(values.slice(-100));
      }
      
      // Clear loading state when we receive any message (user or bot)
      if (message.sender === 'user') {
        setIsLoading(false);
        setCurrentStatus('');
      }
      
      // Add ALL messages here (both user and bot messages)
      setMessages(prev => {
        // If this is a user message, check if we have a temporary message with the same text
        // and replace it to avoid duplicates while preserving proper server-side data
        if (message.sender === 'user') {
          console.log('Processing user message from server:', message);
          const tempMessageIndex = prev.findIndex(m => 
            m.sender === 'user' && 
            m.text === message.text && 
            (m as any).isTemporary === true
          );
          
          if (tempMessageIndex !== -1) {
            console.log('Replacing temporary user message with server message');
            console.log('Temporary message:', prev[tempMessageIndex]);
            console.log('Server message:', message);
            const newMessages = [...prev];
            newMessages[tempMessageIndex] = { ...message, isTemporary: false };
            return newMessages.sort((a, b) => {
              const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 
                          typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() :
                          typeof a.timestamp === 'object' && a.timestamp?.seconds ? a.timestamp.seconds * 1000 :
                          typeof a.timestamp === 'number' ? a.timestamp : 0;
              
              const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 
                          typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() :
                          typeof b.timestamp === 'object' && b.timestamp?.seconds ? b.timestamp.seconds * 1000 :
                          typeof b.timestamp === 'number' ? b.timestamp : 0;
              
              return timeA - timeB;
            });
          } else {
            console.log('No temporary message found to replace, adding user message directly');
          }
        }
        
        // Otherwise, filter by ID and add the new message
        const filtered = prev.filter(m => m.id !== message.id);
        const newMessages = [...filtered, message];
        
        console.log('Updated message list, total messages:', newMessages.length);
        console.log('User messages count:', newMessages.filter(m => m.sender === 'user').length);
        console.log('Bot messages count:', newMessages.filter(m => m.sender === 'bot').length);
        
        // Sort messages by timestamp to maintain proper order
        return newMessages.sort((a, b) => {
          const timeA = a.timestamp instanceof Date ? a.timestamp.getTime() : 
                      typeof a.timestamp === 'string' ? new Date(a.timestamp).getTime() :
                      typeof a.timestamp === 'object' && a.timestamp?.seconds ? a.timestamp.seconds * 1000 :
                      typeof a.timestamp === 'number' ? a.timestamp : 0;
          
          const timeB = b.timestamp instanceof Date ? b.timestamp.getTime() : 
                      typeof b.timestamp === 'string' ? new Date(b.timestamp).getTime() :
                      typeof b.timestamp === 'object' && b.timestamp?.seconds ? b.timestamp.seconds * 1000 :
                      typeof b.timestamp === 'number' ? b.timestamp : 0;
          
          return timeA - timeB;
        });
      });
    });

    // Setup status update listener
    onStatusUpdate((status: string) => {
      console.log('Status update received:', status);
      setCurrentStatus(status);
    });

    // Setup typing indicator listener
    onTypingStatus((typing: boolean) => {
      console.log('Typing status received:', typing);
      setBotIsTyping(typing);
      if (!typing) {
        setCurrentStatus('');
      }
    });

    // Get socket instance for direct event listeners
    const socketInstance = getSocket();
    
    if (socketInstance) {
      // Add listener for message_chunk events (your backend sends these)
      const handleMessageChunk = (data: any) => {
        console.log('Received message_chunk:', data);
        
        if (!data.id || !data.text) return;
        
        // Update streaming message if it exists and matches
        setStreamingMessage(prev => {
          if (prev && prev.id === data.id) {
            return {
              ...prev,
              text: data.text,
              isStreaming: true
            };
          } else if (!prev) {
            // Create new streaming message
            return {
              id: data.id,
              sessionId: data.sessionId || sessionId,
              userId: currentUser.uid,
              sender: 'bot',
              text: data.text,
              timestamp: new Date(),
              isStreaming: true
            };
          }
          return prev;
        });
        
        // Also update legacy streaming for fallback
        setStreamingMessages(prev => ({
          ...prev,
          [data.id]: data.text
        }));
      };

      // Add listener for message_complete events (your backend sends these)
      const handleMessageComplete = (data: any) => {
        console.log('Received message_complete:', data);
        
        if (!data.id) return;
        
        // Skip if already processed
        if (processedMessages.current.has(data.id)) {
          return;
        }
        
        processedMessages.current.add(data.id);
        
        // Create final message object
        const finalMessage: ChatMessage = {
          id: data.id,
          sessionId: data.sessionId || sessionId,
          userId: data.userId || currentUser.uid,
          sender: data.sender || 'bot',
          text: data.text,
          timestamp: data.timestamp ? new Date(data.timestamp) : new Date(),
          metadata: data.metadata || {},
          isStreaming: false
        };
        
        // Add to messages list
        setMessages(prev => {
          const filtered = prev.filter(m => m.id !== finalMessage.id);
          return [...filtered, finalMessage];
        });
        
        // Clear streaming state
        setStreamingMessage(null);
        setStreamingMessages(prev => {
          const { [data.id]: _, ...rest } = prev;
          return rest;
        });
        setBotIsTyping(false);
        setCurrentStatus('');
        setIsLoading(false);
        
        // Generate title from first bot response if we haven't already
        if (!titleGenerated.current && finalMessage.sender === 'bot') {
          const title = generateTitleFromResponse(finalMessage.text);
          
          try {
            updateSessionTitle(sessionId, title)
              .then(() => {
                titleGenerated.current = true;
                console.log('Title updated successfully');
                window.dispatchEvent(new CustomEvent('sessionTitleUpdated'));
              })
              .catch(err => {
                console.error('Failed to update session title:', err);
              });
          } catch (error) {
            console.error('Error updating session title:', error);
          }
        }
      };

      // Add event listeners
      socketInstance.on('message_chunk', handleMessageChunk);
      socketInstance.on('message_complete', handleMessageComplete);
    }

    // Setup new streaming message handlers
    onStreamStart((message: ChatMessage) => {
      console.log('Stream started:', message);
      
      setStreamingMessage({
        ...message,
        text: '',
        isStreaming: true
      });
      
      setBotIsTyping(false);
      setCurrentStatus('');
      setIsLoading(false);
    });

    // Setup legacy streaming message handlers (for backward compatibility)
    onStreamToken(({ messageId, token }) => {
      console.log("Received token:", token, "for message:", messageId);
      
      // Update new streaming message if it exists
      setStreamingMessage(prev => {
        if (prev && prev.id === messageId) {
          return {
            ...prev,
            text: token
          };
        }
        return prev;
      });
      
      // Also update legacy streaming messages
      setStreamingMessages(prev => ({
        ...prev,
        [messageId]: token
      }));
    });

    onStreamCompleteMessage((finalMessage: ChatMessage) => {
      console.log('Stream completed:', finalMessage);
      
      // Skip if already processed
      if (processedMessages.current.has(finalMessage.id)) {
        return;
      }
      
      processedMessages.current.add(finalMessage.id);
      
      // Add the final message to the messages list
      setMessages(prev => {
        const filtered = prev.filter(m => m.id !== finalMessage.id);
        return [...filtered, {
          ...finalMessage,
          isStreaming: false
        }];
      });
      
      // Clear streaming message
      setStreamingMessage(null);
      setBotIsTyping(false);
      setCurrentStatus('');
      setIsLoading(false);
      
      // Generate title from first bot response if we haven't already
      if (!titleGenerated.current && finalMessage.sender === 'bot') {
        const title = generateTitleFromResponse(finalMessage.text);
        
        try {
          updateSessionTitle(sessionId, title)
            .then(() => {
              titleGenerated.current = true;
              console.log('Title updated successfully');
              window.dispatchEvent(new CustomEvent('sessionTitleUpdated'));
            })
            .catch(err => {
              console.error('Failed to update session title:', err);
            });
        } catch (error) {
          console.error('Error updating session title:', error);
        }
      }
    });

    onStreamComplete((messageId) => {
      console.log("Stream complete for message:", messageId);
      
      // Clear the legacy streaming message
      setStreamingMessages(prev => {
        const { [messageId]: _, ...rest } = prev;
        return rest;
      });
    });

    // Cleanup
    return () => {
      if (sessionId) {
        leaveChatSession(sessionId);
      }
      
      // Remove custom event listeners
      const socketInstance = getSocket();
      if (socketInstance) {
        socketInstance.off('message_chunk');
        socketInstance.off('message_complete');
      }
      
      // Remove first message listener
      window.removeEventListener('sendFirstMessage', handleFirstMessage as EventListener);
      
      removeListeners();
    };
  }, [currentUser, sessionId]);

  // Cleanup temporary messages that weren't replaced by server messages
  useEffect(() => {
    const cleanupInterval = setInterval(() => {
      setMessages(prev => {
        const now = Date.now();
        const timeoutMs = 60000; // Increased to 60 seconds to be less aggressive
        
        const filteredMessages = prev.filter(message => {
          // Remove temporary messages that are older than the timeout
          if ((message as any).isTemporary) {
            const messageTime = message.timestamp instanceof Date ? message.timestamp.getTime() : 
                              typeof message.timestamp === 'string' ? new Date(message.timestamp).getTime() :
                              typeof message.timestamp === 'object' && message.timestamp?.seconds ? message.timestamp.seconds * 1000 :
                              typeof message.timestamp === 'number' ? message.timestamp : 0;
            
            const age = now - messageTime;
            if (age > timeoutMs) {
              console.log(`Removing stale temporary message after ${age/1000}s:`, message.id, message.text.substring(0, 30));
              return false;
            } else {
              console.log(`Keeping temporary message (age: ${age/1000}s):`, message.id, message.text.substring(0, 30));
            }
          }
          return true;
        });
        
        if (filteredMessages.length !== prev.length) {
          console.log(`Cleaned up ${prev.length - filteredMessages.length} stale temporary messages`);
        }
        
        return filteredMessages.length !== prev.length ? filteredMessages : prev;
      });
    }, 15000); // Check every 15 seconds instead of 10
    
    return () => clearInterval(cleanupInterval);
  }, []);

  // Handle sending message
  const handleSendMessage = async (text: string) => {
    if (!currentUser || !text.trim() || isLoading) return;

    try {
      // Set loading state immediately
      setIsLoading(true);
      setCurrentStatus('Sending message...');
      
      // Create a temporary message ID
      const messageId = uuidv4();
      const tempUserMessage: ChatMessage = {
        id: messageId,
        sessionId,
        userId: currentUser.uid,
        sender: 'user',
        text,
        timestamp: new Date(),
        isTemporary: true, // Flag to identify temporary messages
      };
      
      // Send via WebSocket if connected, otherwise fallback to REST
      if (isConnected && getSocket()?.connected) {
        console.log('Sending via WebSocket');
        
        // Add message to UI immediately as a temporary message
        setMessages(prev => [...prev, tempUserMessage]);
        
        // Mark this message as processed to handle duplicates
        processedMessages.current.add(messageId);
        
        // Send message via socket
        sendSocketMessage(text, sessionId, currentUser.uid);
        
        // Set a timeout to clear loading state if no response comes back
        setTimeout(() => {
          setIsLoading(false);
          setCurrentStatus('');
        }, 10000); // 10 seconds timeout
        
      } else {
        console.log('WebSocket not connected, using REST API fallback');
        
        // Add message to UI immediately for REST API
        setMessages(prev => [...prev, tempUserMessage]);
        
        const response = await sendMessage({
          message: text,
          sessionId,
          userId: currentUser.uid,
        });
        
        // Add bot response if we got one
        if (response.message) {
          setMessages(prev => [...prev, response.message]);
        }
        
        setIsLoading(false);
        setCurrentStatus('');
        
        // Handle session redirect if needed
        if (response.sessionId !== sessionId) {
          router.push(`/chat/${response.sessionId}`);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      
      // Show error message
      setMessages(prev => [
        ...prev,
        {
          id: uuidv4(),
          sessionId,
          userId: currentUser.uid,
          sender: 'bot',
          text: 'Sorry, there was an error processing your message. Please try again.',
          timestamp: new Date(),
          isError: true,
        },
      ]);
      
      setIsLoading(false);
      setCurrentStatus('');
    }
  };

  // Handle deleting the current chat session
  const handleDeleteSession = async () => {
    if (!currentUser || !sessionId) return;
    
    // Show confirmation toast with actions
    toast.info(
      <div>
        <p>Delete this conversation?</p>
        <div className="mt-2 flex justify-end gap-2">
          <button 
            onClick={() => toast.dismiss()}
            className="px-3 py-1 bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              toast.dismiss();
              
              // Show loading toast
              const loadingToast = toast.loading("Deleting conversation...");
              
              try {
                await deleteChatSession(sessionId);
                toast.dismiss(loadingToast);
                toast.success("Conversation deleted successfully");
                router.push('/chat'); // Navigate to the new chat page
              } catch (error) {
                toast.dismiss(loadingToast);
                toast.error("Failed to delete the conversation. Please try again.");
                console.error('Error deleting chat session:', error);
              }
            }}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false }
    );
  };

  return (
    <div 
      className="w-full max-w-4xl h-full flex flex-col overflow-hidden relative"
      style={{ pointerEvents: 'none' }}
    >
      {/* Transparent header with minimal controls - NO HAMBURGER MENU */}
      <div 
        className="flex items-center justify-between p-3 bg-white/20 backdrop-blur-sm rounded-t-lg"
        style={{ pointerEvents: 'auto' }}
      >
        <div className="flex-1"></div>
        
        <div className="flex items-center space-x-3">
          {/* Connection status indicator */}
          <div className="flex items-center space-x-2 px-3 py-1.5 rounded-full bg-white/30 backdrop-blur-sm shadow-md">
            <div className={`w-2 h-2 rounded-full ${isConnected ? 'bg-green-500' : 'bg-red-500'}`} />
            <span className="text-sm text-gray-700">
              {isConnected ? 'Connected' : 'Disconnected'}
            </span>
          </div>
          
          {/* Delete button */}
          <button
            onClick={handleDeleteSession}
            className="p-2 rounded-lg bg-white/30 backdrop-blur-sm hover:bg-white/40 hover:text-red-500 transition-all shadow-md"
            title="Delete conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Status indicator with transparency */}
      {(currentStatus || botIsTyping) && (
        <div 
          className="mx-4 mb-2 bg-blue-50/60 backdrop-blur-sm border border-blue-200/50 rounded-lg px-4 py-2 shadow-md"
          style={{ pointerEvents: 'auto' }}
        >
          <div className="flex items-center space-x-2">
            <div className="w-2 h-2 bg-blue-500 rounded-full animate-pulse" />
            <span className="text-sm text-blue-700">
              {currentStatus || 'SonarCare is typing...'}
            </span>
          </div>
        </div>
      )}
      
      {/* Messages container - scrollable with transparent background and custom scrollbar */}
      <div 
        className="flex-1 overflow-y-auto overflow-x-hidden custom-scrollbar"
        style={{ 
          pointerEvents: 'none'
        }}
      >
        <style jsx>{`
          .custom-scrollbar::-webkit-scrollbar {
            width: 8px;
          }
          .custom-scrollbar::-webkit-scrollbar-track {
            background: transparent;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb {
            background: rgba(255, 255, 255, 0.3);
            border-radius: 4px;
            border: none;
          }
          .custom-scrollbar::-webkit-scrollbar-thumb:hover {
            background: rgba(255, 255, 255, 0.5);
          }
          .custom-scrollbar {
            scrollbar-width: thin;
            scrollbar-color: rgba(255, 255, 255, 0.3) transparent;
          }
        `}</style>
        
        <div style={{ pointerEvents: 'auto' }}>
          <MessageList 
            messages={messages} 
            streamingMessages={streamingMessages}
            streamingMessage={streamingMessage}
            isLoading={isLoading && !streamingMessage && !botIsTyping}
          />
        </div>
      </div>
      
      {/* Message input with semi-transparent background - NO SUGGESTIONS */}
      <div 
        className="bg-white/70 backdrop-blur-lg border-t border-gray-200/50 shadow-lg rounded-b-lg"
        style={{ pointerEvents: 'auto' }}
      >
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading || !!streamingMessage}
          disabled={!isConnected}
          showSuggestions={false}
        />
      </div>
    </div>
  );
};

export default ChatLayout;