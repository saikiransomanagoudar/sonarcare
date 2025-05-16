import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ChatMessage } from '../../types';
import { sendMessage, deleteChatSession, updateSessionTitle } from '../../lib/api';
import { initializeSocket, joinChatSession, leaveChatSession, sendSocketMessage, onMessageReceived, onTypingStatus, removeListeners } from '../../lib/socket';
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
  const router = useRouter();
  
  // Use refs to track message IDs and texts to prevent duplicates
  const processedMessages = useRef(new Set<string>());
  const lastMessageTexts = useRef(new Set<string>());
  const titleGenerated = useRef<boolean>(false);
  const messagesRef = useRef<ChatMessage[]>(initialMessages);

  // Keep messagesRef updated with the latest messages
  useEffect(() => {
    messagesRef.current = messages;
  }, [messages]);
  
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
      setMessages(prev => [...prev, message]);
      
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
          
          // Try different strategies to extract a good title
          if (text.includes("I'm sorry to hear you're experiencing")) {
            // Extract the symptom
            const symptomsMatch = text.match(/experiencing\s+(.*?)(?:\.|\s+It\s+can)/i);
            if (symptomsMatch && symptomsMatch[1]) {
              title = `About ${symptomsMatch[1]}`;
            }
          } else if (text.toLowerCase().includes("about") && text.includes(":")) {
            // Look for sections with headers/topics
            const aboutMatch = text.match(/about\s+(.*?):/i);
            if (aboutMatch && aboutMatch[1]) {
              title = aboutMatch[1];
            }
          } else {
            // Default to first sentence trimming
            title = generateTitleFromResponse(text);
          }
          
          // Ensure the title is not too long and starts with a capital letter
          if (title.length > 60) title = title.substring(0, 57) + "...";
          title = title.charAt(0).toUpperCase() + title.slice(1);
          
          // Update UI and backend
          setSessionTitle(title);
          
          try {
            updateSessionTitle(sessionId, title)
              .then(() => {
                titleGenerated.current = true;
                // Force reload the sessions in the sidebar using a custom event
                window.dispatchEvent(new CustomEvent('sessionTitleUpdated'));
              })
              .catch(err => {
                console.error("Failed to update session title:", err);
              });
          } catch (error) {
            console.error("Error updating session title:", error);
          }
        }
      }
    });

    // Setup typing indicator listener
    onTypingStatus(setBotIsTyping);

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
    <div className="flex flex-col h-full w-full max-w-4xl mx-auto px-4">
      <div className="bg-white bg-opacity-95 backdrop-blur-md border border-gray-100 shadow-sm rounded-lg mt-4 mb-2 p-3 flex justify-between items-center">
        <div className="flex items-center">
          <svg 
            className="h-5 w-5 text-blue-500 mr-2" 
            viewBox="0 0 24 24" 
            fill="none" 
            stroke="currentColor" 
            strokeWidth="2"
            strokeLinecap="round" 
            strokeLinejoin="round"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>
          <span className="font-medium text-gray-700">
            {sessionTitle || (messages.length > 0 ? `Conversation (${messages.length} messages)` : 'New conversation')}
          </span>
        </div>
        <button
          onClick={handleDeleteSession}
          className="text-gray-400 hover:text-red-500 p-1 rounded-full hover:bg-gray-100 transition-colors"
          title="Delete conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <div className="flex-1 overflow-hidden bg-white bg-opacity-95 backdrop-blur-md border border-gray-100 shadow-md rounded-xl flex flex-col">
        <MessageList 
          messages={messages} 
          isLoading={isLoading || botIsTyping} 
        />
        <MessageInput 
          onSendMessage={handleSendMessage} 
          isLoading={isLoading} 
        />
      </div>
    </div>
  );
};

export default ChatLayout; 