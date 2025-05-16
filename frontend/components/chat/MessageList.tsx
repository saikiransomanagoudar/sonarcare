import React, { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import { ChatMessage } from '../../types';

interface MessageListProps {
  messages: ChatMessage[];
  isLoading?: boolean;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isLoading = false }) => {
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  // If no messages, show welcome message
  if (messages.length === 0 && !isLoading) {
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

  return (
    <div className="flex-1 p-4 overflow-y-auto">      
      {/* Messages */}
      <div className="space-y-4 pb-4">
        {messages.map((message) => (
          <ChatBubble key={message.id} message={message} />
        ))}
        
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
      
      {/* Disclaimer notice */}
      <div className="sticky bottom-2 left-0 right-0 mx-auto w-fit bg-gradient-to-r from-amber-50 to-yellow-50 border-l-4 border-yellow-400 p-2 px-4 rounded-full text-xs shadow-md">
        <p className="text-yellow-700">
          <strong>Medical Disclaimer:</strong> Information provided is not a substitute for professional medical advice.
        </p>
      </div>
    </div>
  );
};

export default MessageList; 