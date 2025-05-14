import React, { useEffect, useRef } from 'react';
import ChatBubble from './ChatBubble';
import { ChatMessage } from '@/types';

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
      <div className="flex flex-col items-center justify-center h-full text-center px-4 py-10">
        <h2 className="text-2xl font-bold text-gray-800 mb-2">Welcome to SonarCare</h2>
        <p className="text-gray-600 mb-6 max-w-md">
          Your AI medical assistant powered by Perplexity Sonar. Ask me anything about health and medical topics.
        </p>
        <div className="bg-yellow-50 border-l-4 border-yellow-400 p-4 mb-4 max-w-md">
          <p className="text-yellow-700 text-sm">
            <strong>Medical Disclaimer:</strong> Information provided is for general purposes only and is not a substitute for professional medical advice, diagnosis, or treatment.
            Always seek the advice of your physician or other qualified health provider.
          </p>
        </div>
        <p className="text-gray-500 text-sm">Type your first message below to get started.</p>
      </div>
    );
  }

  return (
    <div className="flex-1 p-4 overflow-y-auto">
      {/* Persistent medical disclaimer at the top */}
      <div className="sticky top-0 bg-yellow-50 border-l-4 border-yellow-400 p-2 mb-4 text-sm z-10">
        <p className="text-yellow-700">
          <strong>Medical Disclaimer:</strong> Information provided is not a substitute for professional medical advice.
        </p>
      </div>
      
      {/* Messages */}
      {messages.map((message) => (
        <ChatBubble key={message.id} message={message} />
      ))}
      
      {/* Loading indicator */}
      {isLoading && (
        <div className="flex items-center space-x-2 p-2 bg-gray-100 rounded-lg max-w-[70%] mb-4">
          <div className="animate-pulse flex space-x-1">
            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
            <div className="h-2 w-2 bg-gray-400 rounded-full"></div>
          </div>
          <span className="text-sm text-gray-500">AI assistant is thinking...</span>
        </div>
      )}
      
      {/* Auto-scroll reference element */}
      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList; 