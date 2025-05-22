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
  removeListeners 
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
  const [sidebarVisible, setSidebarVisible] = useState(false);
  const router = useRouter();
  
  // Use refs to track message IDs and texts to prevent duplicates
  const processedMessages = useRef(new Set<string>());
  const lastMessageTexts = useRef(new Set<string>());
  const titleGenerated = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);
  // Add a flag to track initial load
  const initialLoadComplete = useRef<boolean>(false);

  // Add a new state for streaming responses
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
          
          // Also add user messages to text cache for extra protection against duplicates
          if (msg.sender === 'user') {
            lastMessageTexts.current.add(`user-${msg.text}`);
          }
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

    // Setup message listener
    onMessageReceived((message: ChatMessage) => {
      if (!message.id) {
        // Assign ID if missing
        message.id = uuidv4();
      }
      
      const messageKey = `${message.id}`;
      const messageTextKey = `${message.sender}-${message.text}`;
      
      // Skip if we've already processed this message ID
      if (processedMessages.current.has(messageKey)) {
        return;
      }
      
      // For user messages, also check if we recently displayed a message with the same text
      if (message.sender === 'user' && lastMessageTexts.current.has(messageTextKey)) {
        return;
      }
      
      // Mark as processed
      processedMessages.current.add(messageKey);
      lastMessageTexts.current.add(messageTextKey);
      
      // Limit size of tracking sets
      if (processedMessages.current.size > 200) {
        const values = Array.from(processedMessages.current);
        processedMessages.current = new Set(values.slice(-100));
      }
      if (lastMessageTexts.current.size > 50) {
        const values = Array.from(lastMessageTexts.current);
        lastMessageTexts.current = new Set(values.slice(-25));
      }
      
      // Add the message to our list
      setMessages(prev => {
        // First add the new message
        const newMessages = [...prev, message];
        
        // Now normalize timestamps for consistent sorting
        const messagesWithNormalizedTimestamps = newMessages.map(msg => {
          // Create a timestamp that's guaranteed to be a number
          let timestamp = 0;
          
          if (msg.timestamp) {
            // Handle different timestamp formats
            if (typeof msg.timestamp === 'object' && msg.timestamp.seconds) {
              // Firestore timestamp object
              timestamp = msg.timestamp.seconds * 1000;
            } else if (typeof msg.timestamp === 'string') {
              // ISO string
              timestamp = new Date(msg.timestamp).getTime();
            } else if (msg.timestamp instanceof Date) {
              // Date object
              timestamp = msg.timestamp.getTime();
            } else if (typeof msg.timestamp === 'number') {
              // Already a timestamp
              timestamp = msg.timestamp;
            }
          }
          
          // Return a copy with numerical timestamp for sorting
          return {
            ...msg,
            _sortTimestamp: timestamp
          } as ChatMessageWithTimestamp;
        });
        
        // Group messages by sender
        const userMessages = messagesWithNormalizedTimestamps.filter(m => m.sender === 'user');
        const botMessages = messagesWithNormalizedTimestamps.filter(m => m.sender === 'bot');
        
        // Check if we need to enforce alternating pattern
        const needsAlternating = 
          userMessages.length > 0 && 
          botMessages.length > 0 && 
          (
            // All user messages first, then all bot messages
            userMessages.every(u => (u._sortTimestamp || 0) < (botMessages[0]._sortTimestamp || 0)) ||
            // All bot messages first, then all user messages  
            botMessages.every(b => (b._sortTimestamp || 0) < (userMessages[0]._sortTimestamp || 0))
          );
        
        if (needsAlternating) {
          // Sort each group by timestamp
          userMessages.sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
          botMessages.sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
          
          // Determine which type comes first based on first message
          const userFirst = 
            userMessages.length > 0 && botMessages.length > 0 ? 
            (userMessages[0]._sortTimestamp || 0) < (botMessages[0]._sortTimestamp || 0) : 
            userMessages.length > 0;
          
          // Interleave messages
          const interleavedMessages: ChatMessageWithTimestamp[] = [];
          const maxLength = Math.max(userMessages.length, botMessages.length);
          
          if (userFirst) {
            // User message first
            for (let i = 0; i < maxLength; i++) {
              if (i < userMessages.length) interleavedMessages.push(userMessages[i]);
              if (i < botMessages.length) interleavedMessages.push(botMessages[i]);
            }
          } else {
            // Bot message first
            for (let i = 0; i < maxLength; i++) {
              if (i < botMessages.length) interleavedMessages.push(botMessages[i]);
              if (i < userMessages.length) interleavedMessages.push(userMessages[i]);
            }
          }
          
          // Return alternating messages (remove temp property)
          return interleavedMessages.map(({_sortTimestamp, ...rest}) => rest);
        }
          
        // Sort by the numerical timestamp
        return messagesWithNormalizedTimestamps
          .sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0))
          .map(({ _sortTimestamp, ...rest }) => rest); // Remove temp property
      });
      
      // If bot message received, stop the loading state
      if (message.sender === 'bot') {
        setIsLoading(false);
        setBotIsTyping(false);
        
        // Generate title from first bot response if we haven't already
        // Using messagesRef to avoid dependency on messages array
        const currentMessages = messagesRef.current;
        const existingBotMessages = currentMessages.filter(m => m.sender === 'bot').length;
        
        if (existingBotMessages === 0 && !titleGenerated.current) {
          // Generate a more meaningful title
          let title = "";
          
          // Get topic from the message text
          // Try to extract a meaningful phrase from the bot response
          const text = message.text;
          
          console.log("[Title Generation] Processing first bot message:", text.substring(0, 100) + "...");
          
          // Try different strategies to extract a good title
          if (text.includes("I'm sorry to hear you're experiencing")) {
            // Extract the symptom
            const symptomsMatch = text.match(/experiencing\s+(.*?)(?:\.|\s+It\s+can)/i);
            if (symptomsMatch && symptomsMatch[1]) {
              title = `About ${symptomsMatch[1]}`;
              console.log("[Title Generation] Extracted symptom:", title);
            }
          } else if (text.toLowerCase().includes("about") && text.includes(":")) {
            // Look for sections with headers/topics
            const aboutMatch = text.match(/about\s+(.*?):/i);
            if (aboutMatch && aboutMatch[1]) {
              title = aboutMatch[1];
              console.log("[Title Generation] Extracted topic from 'about' phrase:", title);
            }
          } else {
            // Default to first sentence trimming
            title = generateTitleFromResponse(text);
            console.log("[Title Generation] Generated from first sentence:", title);
          }
          
          // Ensure the title is not too long and starts with a capital letter
          if (title.length > 60) title = title.substring(0, 57) + "...";
          title = title.charAt(0).toUpperCase() + title.slice(1);
          
          console.log("[Title Generation] Final title:", title);
          
          // Update UI and backend
          setSessionTitle(title);
          
          try {
            updateSessionTitle(sessionId, title)
              .then(() => {
                titleGenerated.current = true;
                console.log("[Title Generation] Title updated in backend and sidebar will refresh");
                // Force reload the sessions in the sidebar using a custom event
                window.dispatchEvent(new CustomEvent('sessionTitleUpdated'));
              })
              .catch(err => {
                console.error("[Title Generation] Failed to update session title:", err);
              });
          } catch (error) {
            console.error("[Title Generation] Error updating session title:", error);
          }
        }
      }
    });

    // Setup typing indicator listener
    onTypingStatus(setBotIsTyping);

    // Setup streaming message handlers
    onStreamToken(({ messageId, token }) => {
      console.log("Received token:", token, "for message:", messageId);
      
      setStreamingMessages(prev => {
        const currentText = prev[messageId] || "";
        return {
          ...prev,
          [messageId]: currentText + token
        };
      });
    });

    onStreamComplete((messageId) => {
      console.log("Stream complete for message:", messageId);
      
      // Clear the streaming message
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
      removeListeners();
    };
  }, [currentUser, sessionId]); // Removed messages dependency

  // Handle sending message
  const handleSendMessage = async (text: string) => {
    if (!currentUser || !text.trim()) return;

    try {
      // Create a temporary message ID
      const messageId = uuidv4();
      const messageKey = `${messageId}`;
      const messageTextKey = `user-${text}`;
      
      // Mark as processed upfront to prevent duplication
      processedMessages.current.add(messageKey);
      lastMessageTexts.current.add(messageTextKey);
      
      // Add message to UI immediately
      setMessages(prev => [
        ...prev, 
        {
          id: messageId,
          sessionId,
          userId: currentUser.uid,
          sender: 'user',
          text,
          timestamp: new Date(),
        }
      ]);
      
      // Set loading state
      setIsLoading(true);
      
      // Send the message through the socket
      sendSocketMessage(text, sessionId, currentUser.uid);
      
      // Also send the message through REST API for processing
      // Note: The bot response will come back through the socket
      const response = await sendMessage({
        message: text,
        sessionId,
        userId: currentUser.uid,
      });
      
      // If no session redirect to the new session (this handles the case of a new session)
      if (response.sessionId !== sessionId) {
        router.push(`/chat/${response.sessionId}`);
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
    <div className="w-full max-w-4xl h-full flex flex-col bg-white rounded-lg shadow-lg overflow-hidden relative">
      {/* Chat header with actions */}
      <div className="flex items-center justify-between bg-white border-b border-gray-200 p-3">
        {/* Hamburger menu for sidebar toggle */}
        <button 
          onClick={toggleSidebar}
          className="p-2 rounded-lg hover:bg-gray-100 transition-colors"
          aria-label="Toggle sidebar"
        >
          <svg 
            className="h-5 w-5 text-gray-700" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              strokeWidth="2" 
              d="M4 6h16M4 12h16M4 18h16" 
            />
          </svg>
        </button>
        
        <div className="flex-1 flex justify-end">
          <button
            onClick={handleDeleteSession}
            className="p-2 text-gray-500 hover:text-red-500 rounded-lg hover:bg-gray-100 transition-colors"
            title="Delete conversation"
          >
            <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
      
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto px-4 py-3 bg-gray-50">
        <MessageList 
          messages={messages} 
          streamingMessages={streamingMessages}
        />
        {botIsTyping && Object.keys(streamingMessages).length === 0 && (
          <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-lg w-max ml-2 mt-2">
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
            <div className="w-2 h-2 bg-gray-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
          </div>
        )}
      </div>
      
      {/* Message input */}
      <div className="border-t border-gray-200 p-4 bg-white">
        <MessageInput
          onSendMessage={handleSendMessage}
          isLoading={isLoading}
        />
      </div>
    </div>
  );
};

export default ChatLayout; 