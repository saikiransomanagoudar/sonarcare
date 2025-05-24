import React, { useState, useRef, KeyboardEvent } from 'react';

interface MessageInputProps {
  onSendMessage: (message: string) => void;
  isLoading?: boolean;
  disabled?: boolean;
  showSuggestions?: boolean; // Optional prop for backward compatibility
}

const MessageInput: React.FC<MessageInputProps> = ({
  onSendMessage,
  isLoading = false,
  disabled = false,
  showSuggestions = false, // Default to false for existing chats
}) => {
  const [message, setMessage] = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    if (message.trim() && !isLoading && !disabled) {
      onSendMessage(message.trim());
      setMessage('');
      
      // Reset textarea height
      if (textareaRef.current) {
        textareaRef.current.style.height = 'auto';
      }
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSubmit(e);
    }
  };

  // Auto-resize textarea
  const handleTextareaChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const textarea = e.target;
    setMessage(textarea.value);
    
    // Reset height to calculate the right height
    textarea.style.height = 'auto';
    // Set new height based on scrollHeight (content)
    textarea.style.height = `${Math.min(textarea.scrollHeight, 150)}px`;
  };

  const isDisabled = isLoading || disabled || !message.trim();

  return (
    <div className="p-4">
      <form onSubmit={handleSubmit}>
        <div className="relative">
          <textarea
            ref={textareaRef}
            className={`w-full border rounded-xl px-4 py-3 pr-12 focus:outline-none focus:ring-2 resize-none min-h-[50px] max-h-[150px] text-gray-700 placeholder-gray-400 shadow-lg backdrop-blur-md transition-all duration-200 ${
              disabled 
                ? 'border-gray-200 bg-gray-50 bg-opacity-80 cursor-not-allowed focus:ring-gray-300' 
                : 'border-gray-300 bg-white bg-opacity-90 hover:bg-opacity-95 focus:ring-blue-400 focus:border-transparent'
            }`}
            placeholder={disabled ? "Connecting to SonarCare..." : "Type your medical question..."}
            value={message}
            onChange={handleTextareaChange}
            onKeyDown={handleKeyDown}
            disabled={disabled}
            rows={1}
          />
          <button
            type="submit"
            className={`absolute right-2 bottom-3 p-2 rounded-full transition-all duration-200 backdrop-blur-sm ${
              isDisabled
                ? 'bg-gray-100 bg-opacity-80 text-gray-400 cursor-not-allowed' 
                : 'bg-blue-500 bg-opacity-90 text-white hover:bg-blue-600 hover:bg-opacity-95 hover:scale-105 shadow-lg hover:shadow-xl'
            }`}
            disabled={isDisabled}
            title={disabled ? "Connecting..." : isLoading ? "Sending..." : "Send message"}
          >
            {isLoading ? (
              <svg className="animate-spin h-5 w-5" viewBox="0 0 24 24">
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                  fill="none"
                />
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                />
              </svg>
            ) : disabled ? (
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
            ) : (
              <svg
                className="h-5 w-5"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            )}
          </button>
        </div>
      </form>
      
      {/* Quick suggestion buttons - only show when enabled (for new chats) */}
      {showSuggestions && !isLoading && !disabled && message.length === 0 && (
        <div className="mt-3 flex flex-wrap gap-2">
          {[
            "I have a headache",
            "Symptoms of fever", 
            "Find a doctor near me",
            "What department treats diabetes?"
          ].map((suggestion, index) => (
            <button
              key={index}
              onClick={() => {
                setMessage(suggestion);
                if (textareaRef.current) {
                  textareaRef.current.focus();
                  // Trigger auto-resize
                  textareaRef.current.style.height = 'auto';
                  textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 150)}px`;
                }
              }}
              className="px-3 py-1.5 text-xs bg-white bg-opacity-70 hover:bg-opacity-90 text-gray-600 rounded-full transition-all duration-200 border border-gray-200 border-opacity-50 backdrop-blur-sm hover:shadow-md hover:scale-105"
            >
              {suggestion}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

export default MessageInput;