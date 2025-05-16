'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import ChatLayout from '../../../../components/chat/ChatLayout';
import { getChatMessages } from '../../../../lib/api';
import { ChatMessage } from '../../../../types';
import dynamic from 'next/dynamic';

// Import SplineScene component with dynamic import
const SplineScene = dynamic(() => import('../../../../components/SplineScene'), {
  ssr: false,
  loading: () => null,
});

export default function ChatSessionPage() {
  const { currentUser } = useAuth();
  const params = useParams();
  const sessionId = params.sessionId as string;
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    if (!currentUser || !sessionId) return;

    const loadMessages = async () => {
      try {
        setLoading(true);
        const fetchedMessages = await getChatMessages(sessionId);
        setMessages(fetchedMessages);
      } catch (err) {
        console.error('Error loading chat messages:', err);
        setError('Failed to load conversation history');
      } finally {
        setLoading(false);
      }
    };

    loadMessages();
  }, [currentUser, sessionId]);

  // Add class to body to ensure full interaction with Spline
  useEffect(() => {
    // Enable pointer events on the body
    document.body.classList.add('spline-active');
    
    return () => {
      document.body.classList.remove('spline-active');
    };
  }, []);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center relative">
        <SplineScene />
        <div className="z-10 bg-white bg-opacity-50 backdrop-blur-sm p-8 rounded-lg shadow-lg">
          <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 text-center relative">
        <SplineScene />
        <div className="relative z-10">
          <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4 inline-block">
            <p className="font-bold">Error</p>
            <p>{error}</p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)] relative">
      <SplineScene />
      <div className="relative z-10 h-full flex justify-center items-start pt-4">
        <ChatLayout initialMessages={messages} sessionId={sessionId} />
      </div>
    </div>
  );
} 