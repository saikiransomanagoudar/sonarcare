import React from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  
  // Format timestamp
  const formattedTime = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      <div className={`max-w-[60%] md:max-w-[50%] ${isUser ? 'bg-blue-500 text-white' : 'bg-white bg-opacity-90 backdrop-blur-sm text-gray-800'} rounded-lg px-4 py-2 shadow-sm`}>
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
              <div className="prose prose-sm dark:prose-invert text-gray-800">
                <ReactMarkdown>{message.text}</ReactMarkdown>
              </div>
            )}
            
            {/* Display model information if available */}
            {message.metadata?.sonar_model_used && (
              <div className="text-xs text-gray-500 mt-1">
                Powered by: {message.metadata.sonar_model_used}
              </div>
            )}
          </div>
        )}
        
        {/* Timestamp */}
        <div className={`text-xs mt-1 ${isUser ? 'text-blue-200' : 'text-gray-500'}`}>
          {formattedTime}
        </div>
      </div>
    </div>
  );
};

export default ChatBubble; 