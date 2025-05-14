'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useAuth } from '../../../hooks/useAuth';
import { getChatSessions, deleteChatSession } from '../../../lib/api';
import { ChatSession } from '../../../types';

export default function DashboardPage() {
  const { currentUser } = useAuth();
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Load chat sessions
  useEffect(() => {
    if (!currentUser) return;

    const loadSessions = async () => {
      try {
        setLoading(true);
        const data = await getChatSessions(currentUser.uid);
        // Sort sessions by last activity
        const sortedSessions = data.sort((a, b) => {
          return b.lastActivityAt?.toDate?.() - a.lastActivityAt?.toDate?.() || 0;
        });
        setSessions(sortedSessions);
      } catch (err) {
        console.error('Error loading chat sessions:', err);
        setError('Failed to load your conversation history. Please try again later.');
      } finally {
        setLoading(false);
      }
    };

    loadSessions();
  }, [currentUser]);

  // Handle session deletion
  const handleDeleteSession = async (sessionId: string) => {
    try {
      if (confirm('Are you sure you want to delete this conversation? This action cannot be undone.')) {
        await deleteChatSession(sessionId);
        setSessions(prev => prev.filter(session => session.id !== sessionId));
      }
    } catch (err) {
      console.error('Error deleting chat session:', err);
      alert('Failed to delete the conversation. Please try again.');
    }
  };

  return (
    <div className="container mx-auto px-4 py-8">
      <div className="flex justify-between items-center mb-8">
        <h1 className="text-2xl font-bold text-gray-800">Your Conversations</h1>
        <Link
          href="/chat"
          className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
        >
          New Conversation
        </Link>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <div className="w-8 h-8 border-t-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
      ) : error ? (
        <div className="bg-red-100 border-l-4 border-red-500 text-red-700 p-4 mb-4">
          {error}
        </div>
      ) : sessions.length === 0 ? (
        <div className="bg-white rounded-lg shadow p-8 text-center">
          <svg
            className="w-16 h-16 text-gray-400 mx-auto mb-4"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={1.5}
              d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z"
            />
          </svg>
          <h2 className="text-xl font-semibold text-gray-800 mb-2">No conversations yet</h2>
          <p className="text-gray-600 mb-6">
            Start a new conversation to ask medical questions and get information from our AI assistant.
          </p>
          <Link
            href="/chat"
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors"
          >
            Start Your First Conversation
          </Link>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {sessions.map((session) => (
            <div
              key={session.id}
              className="bg-white rounded-lg shadow overflow-hidden hover:shadow-md transition-shadow"
            >
              <div className="p-4">
                <h3 className="font-semibold text-lg mb-1 truncate">
                  {session.title || 'Untitled Conversation'}
                </h3>
                <p className="text-sm text-gray-600 mb-2">
                  {session.lastActivityAt && new Date(session.lastActivityAt).toLocaleString()}
                </p>
                {session.summary && (
                  <p className="text-sm text-gray-700 line-clamp-2">{session.summary}</p>
                )}
              </div>
              <div className="flex border-t border-gray-200 divide-x divide-gray-200">
                <Link
                  href={`/chat/${session.id}`}
                  className="flex-1 px-4 py-2 text-center text-blue-500 hover:bg-blue-50 transition-colors text-sm"
                >
                  Continue Chat
                </Link>
                <button
                  onClick={() => handleDeleteSession(session.id)}
                  className="flex-1 px-4 py-2 text-center text-red-500 hover:bg-red-50 transition-colors text-sm"
                >
                  Delete
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
} 