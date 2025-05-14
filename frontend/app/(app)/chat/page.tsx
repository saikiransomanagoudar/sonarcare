'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '../../../hooks/useAuth';
import { createChatSession, sendMessage } from '../../../lib/api';
import MessageInput from '../../../components/chat/MessageInput';

// This page shows an empty chat interface and only creates a session when the first message is sent
export default function NewChatPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !text.trim() || isSubmitting) return;

    setIsSubmitting(true);
    
    try {
      // Create a new chat session
      const session = await createChatSession(currentUser.uid);
      
      // Send the first message
      await sendMessage({
        message: text,
        sessionId: session.id,
        userId: currentUser.uid,
      });
      
      // Redirect to the new session
      router.push(`/chat/${session.id}`);
    } catch (error) {
      console.error('Error creating new chat session:', error);
      setIsSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-16 h-16 border-t-2 border-blue-500 rounded-full animate-spin mx-auto mb-4"></div>
        <p className="text-gray-600">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-[calc(100vh-64px)]">
      <div className="flex-1 overflow-y-auto p-4 flex flex-col items-center justify-center">
        <div className="text-center max-w-md p-6 bg-white rounded-lg shadow-sm">
          <h2 className="text-2xl font-bold text-gray-800 mb-2">SonarCare</h2>
          <p className="text-gray-600 mb-6">
            Ask any medical question to get reliable, research-backed information from our AI assistant.
          </p>
          <div className="text-sm text-gray-500 mb-4">
            <p>Type your first message below to start a new conversation.</p>
          </div>
        </div>
      </div>
      <div className="px-4 pb-4">
        <MessageInput onSendMessage={handleSendMessage} isLoading={isSubmitting} />
      </div>
    </div>
  );
} 