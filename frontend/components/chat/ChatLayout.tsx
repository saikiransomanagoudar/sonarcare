import React, { useState, useEffect, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../hooks/useAuth';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import { ChatMessage } from '../../types';
import { sendMessage, deleteChatSession } from '../../lib/api';
import { initializeSocket, joinChatSession, leaveChatSession, sendSocketMessage, onMessageReceived, onTypingStatus, removeListeners } from '../../lib/socket';
import { v4 as uuidv4 } from 'uuid';
import { toast } from 'react-toastify';

interface ChatLayoutProps {
  initialMessages?: ChatMessage[];
  sessionId: string;
}

const ChatLayout: React.FC<ChatLayoutProps> = ({ initialMessages = [], sessionId }) => {
  const { currentUser } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>(initialMessages);
  const [isLoading, setIsLoading] = useState(false);
  const [botIsTyping, setBotIsTyping] = useState(false);
  const router = useRouter();
  
  // Use refs to track message IDs and texts to prevent duplicates
  const processedMessages = useRef(new Set<string>());
  const lastMessageTexts = useRef(new Set<string>());

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
  }, [currentUser, sessionId]);

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
    <div className="flex flex-col h-full max-w-[50%] md:max-w-[45%] mx-auto">
      <div className="bg-white bg-opacity-90 backdrop-blur-sm border-b border-gray-200 p-2 flex justify-between items-center">
        <div className="text-sm text-gray-500">
          {messages.length > 0 ? `${messages.length} messages` : 'New conversation'}
        </div>
        <button
          onClick={handleDeleteSession}
          className="text-gray-400 hover:text-red-500 p-1 rounded hover:bg-gray-100"
          title="Delete conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
      <MessageList 
        messages={messages} 
        isLoading={isLoading || botIsTyping} 
      />
      <MessageInput 
        onSendMessage={handleSendMessage} 
        isLoading={isLoading} 
      />
    </div>
  );
};

export default ChatLayout; 