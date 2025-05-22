import React, { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import { ChatMessage } from '../../types';

// Add extended type for messages with sorting timestamps
interface ChatMessageWithTimestamp extends ChatMessage {
  _sortTimestamp?: number;
}

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
  streamingMessages?: {[key: string]: string};
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading = false,
  streamingMessages = {}
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessages]);

  // Sort messages by timestamp to ensure chronological order
  const sortedMessages = React.useMemo(() => {
    console.log("MessageList - Original messages:", messages);
    
    // Create a copy of messages with normalized timestamp values for consistent sorting
    const messagesWithNormalizedTimestamps = messages.map(msg => {
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
      } else {
        // If no timestamp, use message ID as a fallback to maintain some order
        // (This assumes IDs have some sequential property)
        if (msg.id) {
          // Extract numeric part if it exists
          const numericPart = msg.id.replace(/\D/g, '');
          if (numericPart) {
            timestamp = parseInt(numericPart, 10);
          }
        }
      }
      
      // Return a copy with numerical timestamp for sorting
      return {
        ...msg,
        _sortTimestamp: timestamp
      } as ChatMessageWithTimestamp;
    });
    
    // First attempt to sort by timestamps
    const timeStampSorted = [...messagesWithNormalizedTimestamps]
      .sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
    
    // Check for alternating pattern issues - usually after page refresh
    const userMessages = timeStampSorted.filter(m => m.sender === 'user');
    const botMessages = timeStampSorted.filter(m => m.sender === 'bot');
    
    // Check for grouping issues (all users, then all bots)
    if (userMessages.length > 0 && botMessages.length > 0) {
      // Count sender transitions
      let transitions = 0;
      let prevSender = '';
      
      for (const msg of timeStampSorted) {
        if (prevSender && prevSender !== msg.sender) {
          transitions++;
        }
        prevSender = msg.sender;
      }
      
      // If we have too few transitions, enforce alternating pattern
      const expectedTransitions = Math.min(userMessages.length, botMessages.length);
      if (transitions < expectedTransitions) {
        console.log("MessageList - Detected poor message alternation, fixing pattern");
        
        // Sort each group by timestamp
        userMessages.sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
        botMessages.sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
        
        // Determine which type comes first
        const userFirst = userMessages.length > 0 && botMessages.length > 0 ?
          (userMessages[0]._sortTimestamp || 0) < (botMessages[0]._sortTimestamp || 0) :
          true; // Default to user first
        
        // Create alternating pattern
        const alternatingMessages: ChatMessageWithTimestamp[] = [];
        const maxLength = Math.max(userMessages.length, botMessages.length);
        
        if (userFirst) {
          for (let i = 0; i < maxLength; i++) {
            if (i < userMessages.length) alternatingMessages.push(userMessages[i]);
            if (i < botMessages.length) alternatingMessages.push(botMessages[i]);
          }
        } else {
          for (let i = 0; i < maxLength; i++) {
            if (i < botMessages.length) alternatingMessages.push(botMessages[i]);
            if (i < userMessages.length) alternatingMessages.push(userMessages[i]);
          }
        }
        
        return alternatingMessages.map(({_sortTimestamp, ...rest}) => rest);
      }
    }
    
    // If sorting by timestamp seems reasonable, use that
    console.log("MessageList - Using timestamp-sorted messages");
    return timeStampSorted.map(({_sortTimestamp, ...rest}) => rest);
  }, [messages]);

  // If no messages, show welcome message
  if (sortedMessages.length === 0 && !isLoading && Object.keys(streamingMessages).length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
        <div className="max-w-lg">
          <div className="w-20 h-20 rounded-full bg-blue-100 flex items-center justify-center mx-auto mb-4">
            <svg 
              className="h-10 w-10 text-blue-500" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
              strokeWidth="1.5"
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-800 mb-3">Welcome to SonarCare</h2>
          <p className="text-gray-600 mb-6">
            Your AI medical assistant powered by Perplexity Sonar. Ask me anything about health and medical topics.
          </p>
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm mb-4">
            <p className="text-yellow-700 text-sm">
              <strong>Medical Disclaimer:</strong> Information provided is for general purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.
              Always seek the advice of your physician or other qualified health provider.
            </p>
          </div>
          <p className="text-gray-500 text-sm">Type your first message below to get started.</p>
        </div>
      </div>
    );
  }

  // Create an array for streaming messages to display
  const streamingBubbles = Object.entries(streamingMessages).map(([messageId, text]) => {
    const dummyMessage: ChatMessage = {
      id: messageId,
      sessionId: '',
      userId: '',
      sender: 'bot',
      text,
      timestamp: new Date(),
      isStreaming: true
    };
    
    return <ChatBubble key={`streaming-${messageId}`} message={dummyMessage} />;
  });

  return (
    <div className="flex-1 p-4 overflow-y-auto">      
      {/* Messages */}
      <div className="space-y-4 pb-4">
        {sortedMessages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        
        {/* Streaming messages */}
        {streamingBubbles}
        
        {/* Loading indicator */}
        {isLoading && (
          <div className="flex items-center space-x-3 p-3 bg-gray-50 rounded-2xl max-w-[70%] mb-4 animate-pulse">
            <div className="w-8 h-8 rounded-full bg-gray-200"></div>
            <div className="flex space-x-1">
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
              <div className="h-2 w-2 bg-gray-300 rounded-full"></div>
            </div>
            <span className="text-sm text-gray-500">SonarCare is thinking...</span>
          </div>
        )}
      </div>
      
      {/* Auto-scroll reference element */}
      <div ref={messagesEndRef} />
      
      {/* Disclaimer notice
      <div className="sticky bottom-2 left-0 right-0 mx-auto w-fit bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-yellow-400 p-2 px-4 rounded-full text-xs shadow-md">
        <p className="text-yellow-700">
          <strong>Medical Disclaimer:</strong> Information provided is not a substitute for professional medical advice.
        </p>
      </div> */}
    </div>
  );
};

export default MessageList; 