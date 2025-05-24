'use client';

import { useState, useEffect } from 'react';
import { useParams, useSearchParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import ChatLayout from '../../../../components/chat/ChatLayout';
import { getChatMessages } from '../../../../lib/api';
import { ChatMessage } from '../../../../types';
import dynamic from 'next/dynamic';

// Add extended type for messages with sorting timestamps
interface ChatMessageWithTimestamp extends ChatMessage {
  _sortTimestamp?: number;
}

// Import SplineScene component with dynamic import
const SplineScene = dynamic(() => import('../../../../components/SplineScene'), {
  ssr: false,
  loading: () => null,
});

export default function ChatSessionPage() {
  const { currentUser } = useAuth();
  const params = useParams();
  const searchParams = useSearchParams();
  const sessionId = params.sessionId as string;
  const firstMessage = searchParams.get('firstMessage');
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [firstMessageSent, setFirstMessageSent] = useState(false);

  // Function to ensure alternating user-bot pattern in messages
  const ensureAlternatingPattern = (messages: ChatMessage[]): ChatMessage[] => {
    console.log("Original unsorted messages:", messages);
    
    if (messages.length <= 1) return messages;
    
    // First try by timestamps
    const timeStampSorted = [...messages].sort((a, b) => {
      let timeA = 0;
      let timeB = 0;
      
      // Extract timestamp numbers
      if (a.timestamp) {
        if (typeof a.timestamp === 'object' && a.timestamp.seconds) {
          timeA = a.timestamp.seconds * 1000;
        } else if (typeof a.timestamp === 'string') {
          timeA = new Date(a.timestamp).getTime();
        } else if (a.timestamp instanceof Date) {
          timeA = a.timestamp.getTime();
        } else if (typeof a.timestamp === 'number') {
          timeA = a.timestamp;
        }
      }
      
      if (b.timestamp) {
        if (typeof b.timestamp === 'object' && b.timestamp.seconds) {
          timeB = b.timestamp.seconds * 1000;
        } else if (typeof b.timestamp === 'string') {
          timeB = new Date(b.timestamp).getTime();
        } else if (b.timestamp instanceof Date) {
          timeB = b.timestamp.getTime();
        } else if (typeof b.timestamp === 'number') {
          timeB = b.timestamp;
        }
      }
      
      return timeA - timeB;
    }).map(msg => ({
      ...msg,
      _sortTimestamp: typeof msg.timestamp === 'object' && msg.timestamp?.seconds 
        ? msg.timestamp.seconds * 1000 
        : msg.timestamp instanceof Date 
          ? msg.timestamp.getTime() 
          : typeof msg.timestamp === 'string'
            ? new Date(msg.timestamp).getTime()
            : typeof msg.timestamp === 'number'
              ? msg.timestamp
              : 0
    })) as ChatMessageWithTimestamp[];
    
    console.log("Timestamp sorted:", timeStampSorted);
    
    // Check if all messages from one sender are grouped together (common issue after refresh)
    let allUserFirst = true;
    let allBotFirst = true;
    let lastSenderType = '';
    
    // Count sender type transitions to detect poor alternation
    let transitions = 0;
    
    for (let i = 0; i < timeStampSorted.length; i++) {
      const msg = timeStampSorted[i];
      
      // Check first message type
      if (i === 0) {
        if (msg.sender === 'bot') allUserFirst = false;
        if (msg.sender === 'user') allBotFirst = false;
        lastSenderType = msg.sender;
        continue;
      }
      
      // Count transitions between sender types
      if (msg.sender !== lastSenderType) {
        transitions++;
        lastSenderType = msg.sender;
      }
      
      // Early detect if user messages are mixed with bot messages (good alternation)
      if (i > 0 && msg.sender !== timeStampSorted[0].sender) {
        allUserFirst = false;
        allBotFirst = false;
      }
    }
    
    // Calculate expected transitions for a well-alternated conversation
    // In a perfect alternating pattern, transitions would be close to messages.length - 1
    const expectedTransitions = timeStampSorted.length - 1;
    const transitionRatio = transitions / expectedTransitions;
    
    // If poor alternation detected (grouped messages or very few transitions),
    // forcefully interleave the messages
    if ((allUserFirst || allBotFirst || transitionRatio < 0.5) && timeStampSorted.length > 2) {
      console.log("Poor message alternation detected, using forced interleaving pattern");
      
      // Group by sender and sort each group by timestamp
      const userMessages = timeStampSorted.filter(m => m.sender === 'user');
      const botMessages = timeStampSorted.filter(m => m.sender === 'bot');
      
      // Manually interleave them, starting with user messages which typically initiate conversation
      const alternatingMessages: ChatMessageWithTimestamp[] = [];
      const maxLength = Math.max(userMessages.length, botMessages.length);
      
      // Determine which message type should come first based on first timestamp
      const userFirst = userMessages.length > 0 && botMessages.length > 0 ? 
        (userMessages[0]._sortTimestamp || 0) < (botMessages[0]._sortTimestamp || 0) : 
        userMessages.length > 0;
      
      if (userFirst) {
        // User message first
        for (let i = 0; i < maxLength; i++) {
          if (i < userMessages.length) alternatingMessages.push(userMessages[i]);
          if (i < botMessages.length) alternatingMessages.push(botMessages[i]);
        }
      } else {
        // Bot message first
        for (let i = 0; i < maxLength; i++) {
          if (i < botMessages.length) alternatingMessages.push(botMessages[i]);
          if (i < userMessages.length) alternatingMessages.push(userMessages[i]);
        }
      }
      
      console.log("Final alternating messages:", alternatingMessages);
      // Remove any temporary properties
      return alternatingMessages.map(({_sortTimestamp, ...rest}) => rest);
    }
    
    // If timestamp sorting seemed to work well, use that result
    console.log("Using timestamp-sorted messages with good alternation");
    return timeStampSorted.map(({_sortTimestamp, ...rest}) => rest);
  };

  useEffect(() => {
    if (!currentUser || !sessionId) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const fetchedMessages = await getChatMessages(sessionId);
        
        console.log("Raw fetched messages:", fetchedMessages);
        console.log("User messages in fetched:", fetchedMessages.filter(m => m.sender === 'user'));
        console.log("Bot messages in fetched:", fetchedMessages.filter(m => m.sender === 'bot'));
        
        // Ensure alternating pattern
        const sortedMessages = ensureAlternatingPattern(fetchedMessages);
        
        console.log("Final sorted messages:", sortedMessages);
        console.log("User messages in final:", sortedMessages.filter(m => m.sender === 'user'));
        console.log("Bot messages in final:", sortedMessages.filter(m => m.sender === 'bot'));
        
        setMessages(sortedMessages);
      } catch (err) {
        console.error('Error loading chat messages:', err);
        setError('Failed to load conversation history');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [currentUser, sessionId]);

  // Add class to body to ensure full interaction with Spline and prevent scrolling
  useEffect(() => {
    // Prevent all scrolling on the page
    const originalOverflow = document.body.style.overflow;
    const originalDocumentOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';
    
    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalDocumentOverflow;
    };
  }, []);

  // Handle first message from query parameter
  useEffect(() => {
    if (firstMessage && !firstMessageSent && !loading && currentUser) {
      // Wait longer for ChatLayout to initialize and WebSocket to stabilize, then trigger the first message
      const timer = setTimeout(() => {
        console.log('Dispatching first message event after delay:', firstMessage);
        const event = new CustomEvent('sendFirstMessage', { 
          detail: { message: firstMessage } 
        });
        window.dispatchEvent(event);
        setFirstMessageSent(true);
        
        // Clean up URL parameter
        const url = new URL(window.location.href);
        url.searchParams.delete('firstMessage');
        window.history.replaceState({}, '', url.toString());
      }, 1500); // Increased from 500ms to 1500ms to allow WebSocket to stabilize

      return () => clearTimeout(timer);
    }
  }, [firstMessage, firstMessageSent, loading, currentUser]);

  if (loading) {
    return (
      <div className="fixed inset-0 flex items-center justify-center">
        <div className="absolute inset-0 z-0">
          <SplineScene />
        </div>
        <div className="relative z-10 bg-white/20 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20">
          <div className="w-12 h-12 border-t-2 border-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-center font-medium">Loading conversation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="fixed inset-0">
        <div className="absolute inset-0 z-0">
          <SplineScene />
        </div>
        <div className="relative z-10 flex items-center justify-center p-4 h-full">
          <div className="bg-red-500/20 backdrop-blur-md border border-red-500/30 text-red-100 p-6 rounded-2xl shadow-2xl max-w-md mx-auto">
            <div className="flex items-center mb-3">
              <svg className="h-6 w-6 text-red-400 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <p className="font-bold">Error Loading Chat</p>
            </div>
            <p className="text-red-200">{error}</p>
            <button 
              onClick={() => window.location.reload()} 
              className="mt-4 px-4 py-2 bg-red-500/30 hover:bg-red-500/40 rounded-lg transition-colors text-sm font-medium"
            >
              Try Again
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen relative overflow-hidden pt-16">
      <div className="absolute inset-0 z-0">
        <SplineScene />
      </div>
      <div className="relative z-10 h-full flex justify-center items-start overflow-hidden">
        <div className="w-full max-w-4xl mx-auto px-4 h-full overflow-hidden">
          <ChatLayout initialMessages={messages} sessionId={sessionId} />
        </div>
      </div>
    </div>
  );
}