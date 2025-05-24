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
  streamingMessage?: ChatMessage | null;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading = false,
  streamingMessages = {},
  streamingMessage = null
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessages, streamingMessage?.text]);

  // Sort messages by timestamp to ensure chronological order (keeping your exact logic)
  const sortedMessages = React.useMemo(() => {
    console.log("MessageList - Original messages:", messages);
    
    // Create a copy of messages with normalized timestamp values for consistent sorting
    const messagesWithNormalizedTimestamps = messages.map(msg => {
      // Create a timestamp that's guaranteed to be a number
      let timestamp = 0;
      
      if (msg.timestamp) {
        // Handle different timestamp formats
        if (typeof msg.timestamp === 'object' && (msg.timestamp as any).seconds) {
          // Firestore timestamp object
          timestamp = (msg.timestamp as any).seconds * 1000;
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

  // If no messages, show welcome message with transparency
  if (sortedMessages.length === 0 && !isLoading && Object.keys(streamingMessages).length === 0 && !streamingMessage) {
    return (
      <div className="flex flex-col items-center justify-center h-full text-center px-6 py-10">
        <div className="max-w-lg bg-white/80 backdrop-blur-lg rounded-2xl p-8 shadow-xl border border-gray-200/50">
          <div className="w-20 h-20 rounded-full bg-blue-100/90 backdrop-blur-sm flex items-center justify-center mx-auto mb-6 shadow-lg">
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
          <div className="bg-gradient-to-r from-yellow-50 to-amber-50 border-l-4 border-yellow-400 p-4 rounded-lg shadow-sm mb-4 bg-opacity-80 backdrop-blur-sm">
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

  // Create an array for streaming messages to display (keeping your existing logic)
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
    <div className="h-full flex flex-col">
      {/* Messages container - fully scrollable */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4">
        <div className="space-y-4 pb-4">
          {sortedMessages.map((message) => (
            <ChatBubble key={message.id} message={message} />
          ))}
          
          {/* New streaming message (priority over legacy streamingMessages) */}
          {streamingMessage && (
            <ChatBubble key={`streaming-${streamingMessage.id}`} message={streamingMessage} />
          )}
          
          {/* Legacy streaming messages (keeping for compatibility) */}
          {!streamingMessage && streamingBubbles}
          
          {/* Loading indicator */}
          {isLoading && !streamingMessage && Object.keys(streamingMessages).length === 0 && (
            <div className="flex items-start space-x-3 mb-4">
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-100/90 backdrop-blur-sm flex items-center justify-center shadow-md">
                  <div className="flex space-x-0.5">
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '0ms' }}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '200ms' }}></div>
                    <div className="w-1 h-1 bg-blue-500 rounded-full animate-pulse" style={{ animationDelay: '400ms' }}></div>
                  </div>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm shadow-md border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[70%]">
                <div className="flex items-center space-x-3">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms' }}></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '150ms' }}></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '300ms' }}></div>
                  </div>
                  <span className="text-sm text-gray-500">SonarCare is thinking...</span>
                </div>
              </div>
            </div>
          )}
        </div>
        
        {/* Auto-scroll reference element */}
        <div ref={messagesEndRef} />
      </div>
    </div>
  );
};

export default MessageList;