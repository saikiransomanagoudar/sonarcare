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
  isTyping?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ 
  messages, 
  isLoading = false,
  streamingMessages = {},
  streamingMessage = null,
  isTyping = false
}) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Debug logging for loading states
  React.useEffect(() => {
    const shouldShowLoading = isLoading || (isTyping && !streamingMessage && Object.keys(streamingMessages).length === 0);
    console.log('MessageList loading states:', {
      isLoading,
      isTyping,
      hasStreamingMessage: !!streamingMessage,
      streamingMessagesCount: Object.keys(streamingMessages).length,
      shouldShowLoading
    });
  }, [isLoading, isTyping, streamingMessage, streamingMessages]);

  // Auto-scroll to bottom on new messages or streaming updates
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, streamingMessages, streamingMessage?.text]);

  // Sort messages by timestamp to ensure chronological order
  const sortedMessages = React.useMemo(() => {
    console.log("MessageList - Original messages:", messages);
    
    const messagesWithNormalizedTimestamps = messages.map(msg => {
      let timestamp = 0;
      
      if (msg.timestamp) {
        if (typeof msg.timestamp === 'object' && (msg.timestamp as any).seconds) {
          timestamp = (msg.timestamp as any).seconds * 1000;
        } else if (typeof msg.timestamp === 'string') {
          timestamp = new Date(msg.timestamp).getTime();
        } else if (msg.timestamp instanceof Date) {
          timestamp = msg.timestamp.getTime();
        } else if (typeof msg.timestamp === 'number') {
          timestamp = msg.timestamp;
        }
      } else {
        if (msg.id) {
          const numericPart = msg.id.replace(/\D/g, '');
          if (numericPart) {
            timestamp = parseInt(numericPart, 10);
          }
        }
      }
      
      return {
        ...msg,
        _sortTimestamp: timestamp
      } as ChatMessageWithTimestamp;
    });
    
    const timeStampSorted = [...messagesWithNormalizedTimestamps]
      .sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
    
    const userMessages = timeStampSorted.filter(m => m.sender === 'user');
    const botMessages = timeStampSorted.filter(m => m.sender === 'bot');
    
    if (userMessages.length > 0 && botMessages.length > 0) {
      let transitions = 0;
      let prevSender = '';
      
      for (const msg of timeStampSorted) {
        if (prevSender && prevSender !== msg.sender) {
          transitions++;
        }
        prevSender = msg.sender;
      }
      
      const expectedTransitions = Math.min(userMessages.length, botMessages.length);
      if (transitions < expectedTransitions) {
        console.log("MessageList - Detected poor message alternation, fixing pattern");
        
        userMessages.sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
        botMessages.sort((a, b) => (a._sortTimestamp || 0) - (b._sortTimestamp || 0));
        
        const userFirst = userMessages.length > 0 && botMessages.length > 0 ?
          (userMessages[0]._sortTimestamp || 0) < (botMessages[0]._sortTimestamp || 0) :
          true;
        
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
    
    console.log("MessageList - Using timestamp-sorted messages");
    return timeStampSorted.map(({_sortTimestamp, ...rest}) => rest);
  }, [messages]);

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
    <div className="h-full flex flex-col" style={{ pointerEvents: 'none' }}>
      {/* Messages container */}
      <div className="flex-1 overflow-y-auto overflow-x-hidden p-4" style={{ pointerEvents: 'auto' }}>
        <div className="space-y-4 pb-4" style={{ pointerEvents: 'none' }}>
          {sortedMessages.map((message) => (
            <div key={message.id} style={{ pointerEvents: 'auto' }}>
              <ChatBubble message={message} />
            </div>
          ))}
          
          {/* New streaming message (priority over legacy streamingMessages) */}
          {streamingMessage && (
            <div style={{ pointerEvents: 'auto' }}>
              <ChatBubble key={`streaming-${streamingMessage.id}`} message={streamingMessage} />
            </div>
          )}
          
          {/* Legacy streaming messages (keeping for compatibility) */}
          {!streamingMessage && streamingBubbles.map((bubble, index) => (
            <div key={index} style={{ pointerEvents: 'auto' }}>
              {bubble}
            </div>
          ))}
          
          {/* Loading indicator */}
          {(isLoading || (isTyping && !streamingMessage && Object.keys(streamingMessages).length === 0)) && (
            <div className="flex items-start space-x-3 mb-4" style={{ pointerEvents: 'auto' }}>
              <div className="flex-shrink-0">
                <div className="w-8 h-8 rounded-full bg-blue-100/90 backdrop-blur-sm flex items-center justify-center shadow-md">
                  <svg 
                    className="h-5 w-5 text-blue-500" 
                    viewBox="0 0 24 24" 
                    fill="none" 
                    stroke="currentColor" 
                    strokeWidth="2"
                    strokeLinecap="round" 
                    strokeLinejoin="round"
                  >
                    <circle cx="12" cy="12" r="10" />
                    <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                    <line x1="9" y1="9" x2="9.01" y2="9" />
                    <line x1="15" y1="9" x2="15.01" y2="9" />
                  </svg>
                </div>
              </div>
              
              <div className="bg-white/80 backdrop-blur-sm shadow-md border border-gray-100 text-gray-800 rounded-2xl rounded-tl-sm px-4 py-3 max-w-[70%]">
                <div className="flex items-center justify-center">
                  <div className="flex space-x-1">
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '0ms', animationDuration: '1.2s' }}></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '200ms', animationDuration: '1.2s' }}></div>
                    <div className="h-2 w-2 bg-blue-500 rounded-full animate-bounce" style={{ animationDelay: '400ms', animationDuration: '1.2s' }}></div>
                  </div>
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