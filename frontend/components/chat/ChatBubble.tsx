import React, { useState } from 'react';
import ReactMarkdown from 'react-markdown';
import { ChatMessage } from '../../types';

interface ChatBubbleProps {
  message: ChatMessage;
}

const ChatBubble: React.FC<ChatBubbleProps> = ({ message }) => {
  const isUser = message.sender === 'user';
  const isStreaming = message.isStreaming === true;
  const [isCopied, setIsCopied] = useState(false);
  
  // Format timestamp
  const formattedTime = message.timestamp ? new Date(message.timestamp).toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit'
  }) : '';

  // Copy function
  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(message.text);
      setIsCopied(true);
      setTimeout(() => setIsCopied(false), 2000); // Reset after 2 seconds
    } catch (err) {
      console.error('Failed to copy text: ', err);
    }
  };

  return (
    <div className={`flex ${isUser ? 'justify-end' : 'justify-start'} mb-4`}>
      {!isUser && (
        <div className="flex-shrink-0 mr-3">
          <div className="w-8 h-8 rounded-full bg-blue-100 bg-opacity-90 backdrop-blur-sm flex items-center justify-center shadow-md">
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
          ? 'bg-gradient-to-br from-blue-500 to-blue-600 text-white rounded-2xl rounded-tr-sm shadow-lg backdrop-blur-sm' 
          : `${
              isStreaming 
                ? 'bg-white bg-opacity-80 backdrop-blur-lg border-2 border-blue-200 shadow-xl' 
                : 'bg-white bg-opacity-90 backdrop-blur-sm shadow-md border border-gray-100'
            } text-gray-800 rounded-2xl rounded-tl-sm`
      } px-4 py-3 relative`}>
        
        {/* Copy button for bot messages (not streaming) */}
        {!isUser && !isStreaming && (
          <button
            onClick={handleCopy}
            className="cursor-pointer absolute bottom-2 left-2 p-1.5 rounded-lg hover:bg-gray-100 transition-all duration-200 group"
            title={isCopied ? "Copied!" : "Copy response"}
          >
            {isCopied ? (
              <svg className="h-4 w-4 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M5 13l4 4L19 7"></path>
              </svg>
            ) : (
              <svg className="h-4 w-4 text-gray-700 group-hover:text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M8 16H6a2 2 0 01-2-2V6a2 2 0 012-2h8a2 2 0 012 2v2m-6 12h8a2 2 0 002-2v-8a2 2 0 00-2-2h-8a2 2 0 00-2 2v8a2 2 0 002 2z"></path>
              </svg>
            )}
          </button>
        )}
        
        {/* Streaming glow effect */}
        {isStreaming && !isUser && (
          <div className="absolute inset-0 rounded-2xl rounded-tl-sm bg-gradient-to-r from-blue-400/10 to-purple-400/10 animate-pulse -z-10"></div>
        )}
        
        {isUser ? (
          <div className="text-sm leading-relaxed">{message.text}</div>
        ) : (
          <div>
            {/* Medical disclaimer for bot messages */}
            {message.metadata?.showDisclaimer && !isStreaming && (
              <div className="text-yellow-600 text-xs mb-3 italic border-l-2 border-yellow-500 pl-2 bg-yellow-50 bg-opacity-80 backdrop-blur-sm py-1 rounded-r">
                <strong>Note:</strong> This information is general and not a substitute for professional medical advice. Always consult a healthcare provider for medical concerns.
              </div>
            )}
            
            {/* Display error message or normal message */}
            {message.isError ? (
              <div className="text-red-500 text-sm flex items-center space-x-2">
                <svg className="h-4 w-4 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zm-7 4a1 1 0 11-2 0 1 1 0 012 0zm-1-9a1 1 0 00-1 1v4a1 1 0 102 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                </svg>
                <span>{message.text}</span>
              </div>
            ) : (
              <div className={`max-w-none text-gray-800 text-sm ${isStreaming ? 'streaming-text' : ''}`}>
                <ReactMarkdown 
                  components={{
                    p: ({ children }) => <p className="mb-2 last:mb-0 leading-relaxed text-sm">{children}</p>,
                    ul: ({ children }) => <ul className="list-disc pl-4 mb-2 space-y-1 text-sm">{children}</ul>,
                    ol: ({ children }) => <ol className="list-decimal pl-4 mb-2 space-y-1 text-sm">{children}</ol>,
                    li: ({ children }) => <li className="text-sm leading-relaxed">{children}</li>,
                    strong: ({ children }) => <strong className="font-semibold text-gray-900 text-sm">{children}</strong>,
                    em: ({ children }) => <em className="italic text-gray-700 text-sm">{children}</em>,
                    h1: ({ children }) => <h1 className="text-base font-bold mb-2 text-gray-900">{children}</h1>,
                    h2: ({ children }) => <h2 className="text-sm font-semibold mb-2 text-gray-900">{children}</h2>,
                    h3: ({ children }) => <h3 className="text-sm font-semibold mb-1 text-gray-900">{children}</h3>,
                    a: ({ href, children }) => (
                      <a 
                        href={href} 
                        target="_blank" 
                        rel="noopener noreferrer"
                        className="text-blue-600 hover:text-blue-800 underline hover:no-underline transition-colors duration-200 font-medium"
                      >
                        {children}
                      </a>
                    ),
                  }}
                >
                  {message.text}
                </ReactMarkdown>
                
                {/* Streaming cursor */}
                {isStreaming && (
                  <span className="inline-block w-0.5 h-4 ml-0.5 bg-blue-500 animate-pulse"></span>
                )}
              </div>
            )}
            
            {/* Display model information if available and not streaming */}
            {message.metadata?.sonar_model_used && !isStreaming && (
              <div className="text-xs text-gray-400 mt-2 flex items-center space-x-1">
                <svg className="h-3 w-3" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M3 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1zm0 4a1 1 0 011-1h12a1 1 0 110 2H4a1 1 0 01-1-1z" clipRule="evenodd" />
                </svg>
                <span>Powered by: {message.metadata.sonar_model_used}</span>
              </div>
            )}
          </div>
        )}
        
        {/* Timestamp (don't show for streaming messages) */}
        {!isStreaming && formattedTime && (
          <div className={`text-xs mt-2 text-right ${isUser ? 'text-blue-100' : 'text-gray-400'}`}>
            {formattedTime}
          </div>
        )}
      </div>
      
      {isUser && (
        <div className="flex-shrink-0 ml-3">
          <div className="w-8 h-8 rounded-full bg-gray-200 bg-opacity-90 backdrop-blur-sm flex items-center justify-center text-gray-600 text-sm font-medium shadow-md">
            {message.userId ? message.userId.charAt(0).toUpperCase() : 'U'}
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatBubble;