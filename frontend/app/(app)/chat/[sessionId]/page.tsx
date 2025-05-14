'use client';

import { useState, useEffect } from 'react';
import { useParams } from 'next/navigation';
import { useAuth } from '../../../../hooks/useAuth';
import ChatLayout from '../../../../components/chat/ChatLayout';
import { getChatMessages } from '../../../../lib/api';
import { ChatMessage } from '../../../../types';

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

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="container mx-auto px-4 py-12 text-center">
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 rounded mb-4 inline-block">
          <p className="font-bold">Error</p>
          <p>{error}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="h-[calc(100vh-64px)]">
      <ChatLayout initialMessages={messages} sessionId={sessionId} />
    </div>
  );
} 