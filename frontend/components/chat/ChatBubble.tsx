import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isStreaming = message.isStreaming === true;
  
  // Format timestamp
  const formattedTime = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 flex items-center justify-center">
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
      )}
      
      <div className={`max-w-[75%] md:max-w-[70%] ${
        isUser 
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm' 
          : `${isStreaming ? 'bg-gradient-to-b from-white to-blue-50 border border-blue-100' : 'bg-white shadow-sm border border-gray-100'} text-gray-800 rounded-2xl rounded-tl-sm`
      } px-4 py-3`}>
        {isUser ? (
          <div className="text-sm">{message.text}</div>
        ) : (
          <div>
            {/* Medical disclaimer for bot messages */}
            {message.metadata?.showDisclaimer && (
              <div className="text-yellow-600 text-xs mb-2 italic border-l-2 border-yellow-500 pl-2">
                Note: This information is general and not a substitute for professional medical advice. Always consult a healthcare provider for medical concerns.
              </div>
            )}
            
            {/* Display error message or normal message */}
            {message.isError ? (
              <div className="text-red-500 text-sm">{message.text}</div>
            ) : (
              <div className={`prose prose-sm prose-blue max-w-none text-gray-800 ${isStreaming ? 'streaming-text' : ''}`}>
                <ReactMarkdown>{message.text}</ReactMarkdown>
                {isStreaming && (
                  <span className="inline-block w-1.5 h-4 ml-0.5 bg-blue-500 animate-pulse"></span>
                )}
              </div>
            )}
            
            {/* Display model information if available and not streaming */}
            {message.metadata?.sonar_model_used && !isStreaming && (
              <div className="text-xs text-gray-500 mt-2">
                Powered by: {message.metadata.sonar_model_used}
              </div>
            )}
          </div>
        )}
        
        {/* Timestamp (don't show for streaming messages) */}
        {!isStreaming && (
          <div className={`text-xs mt-1 text-right ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
            {formattedTime}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 flex items-center justify-center text-gray-600 text-sm font-medium">
            {message.userId ? message.userId.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBubble; 