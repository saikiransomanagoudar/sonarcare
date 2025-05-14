'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/layout/Navbar';
import { getChatSessions, createChatSession, deleteChatSession } from '../../lib/api';
import { ChatSession } from '../../types';
import { toast } from 'react-toastify';

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [loadingSessions, setLoadingSessions] = useState(false);

  // Redirect to login if not authenticated
  useEffect(() => {
    if (!currentUser && !loading) {
      router.push('/login');
    } else if (currentUser && !loading && pathname === '/dashboard') {
      // Redirect to chat instead of showing dashboard
      router.push('/chat');
    }
  }, [currentUser, loading, router, pathname]);

  // Load chat sessions for sidebar
  useEffect(() => {
    if (!currentUser) return;

    const loadSessions = async () => {
      try {
        setLoadingSessions(true);
        const data = await getChatSessions(currentUser.uid);
        // Sort sessions by last activity
        const sortedSessions = data.sort((a, b) => {
          return new Date(b.lastActivityAt).getTime() - new Date(a.lastActivityAt).getTime();
        });
        setSessions(sortedSessions);
      } catch (err) {
        console.error('Error loading chat sessions:', err);
      } finally {
        setLoadingSessions(false);
      }
    };

    loadSessions();
  }, [currentUser, pathname]);

  // Handle creating a new chat
  const handleNewChat = () => {
    // Simply redirect to the New Chat page
    router.push('/chat');
    // Close the sidebar on mobile
    setSidebarOpen(false);
  };

  // Handle deleting a chat session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Show confirmation toast with actions
    toast.info(
      <div>
        <p>Delete this conversation?</p>
        <div className="mt-2 flex justify-end gap-2">
          <button 
            onClick={() => toast.dismiss()}
            className="px-3 py-1 bg-gray-200 rounded text-sm"
          >
            Cancel
          </button>
          <button 
            onClick={async () => {
              toast.dismiss();
              
              // Show loading toast
              const loadingToast = toast.loading("Deleting conversation...");
              
              try {
                await deleteChatSession(sessionId);
                toast.dismiss(loadingToast);
                toast.success("Conversation deleted successfully");
                
                // Update local state
                setSessions(prev => prev.filter(session => session.id !== sessionId));
                
                // If we're currently viewing the deleted session, redirect to the chat page
                if (pathname === `/chat/${sessionId}`) {
                  router.push('/chat');
                }
              } catch (error) {
                toast.dismiss(loadingToast);
                toast.error("Failed to delete the conversation. Please try again.");
                console.error('Error deleting chat session:', error);
              }
            }}
            className="px-3 py-1 bg-red-500 text-white rounded text-sm"
          >
            Delete
          </button>
        </div>
      </div>,
      { autoClose: false, closeOnClick: false }
    );
  };

  // Show loading state while checking auth
  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50">
        <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin"></div>
      </div>
    );
  }

  // Don't render children if not authenticated
  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen">
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden">
        {/* Sidebar for chat history */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block w-full md:w-64 bg-gray-100 border-r border-gray-200 overflow-y-auto`}>
          <div className="p-4">
            <button
              onClick={handleNewChat}
              className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
              </svg>
              New Chat
            </button>
            
            <div className="mt-6">
              <h3 className="text-sm font-medium text-gray-500 uppercase tracking-wider mb-3">Recent Conversations</h3>
              {loadingSessions ? (
                <div className="flex justify-center py-4">
                  <div className="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4">No conversations yet</p>
              ) : (
                <ul className="space-y-2">
                  {sessions.map((session) => (
                    <li key={session.id}>
                      <div className="relative group">
                        <Link 
                          href={`/chat/${session.id}`}
                          className={`block px-3 py-2 rounded-lg hover:bg-gray-200 transition-colors ${
                            pathname === `/chat/${session.id}` ? 'bg-gray-200' : ''
                          }`}
                          onClick={() => setSidebarOpen(false)}
                        >
                          <p className="font-medium truncate pr-8">{session.title || 'Untitled Conversation'}</p>
                          <p className="text-xs text-gray-500 truncate">
                            {new Date(session.lastActivityAt).toLocaleString()}
                          </p>
                        </Link>
                        <button
                          onClick={(e) => handleDeleteSession(session.id, e)}
                          className="absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
                          title="Delete conversation"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          </div>
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden">
          {children}
        </div>
      </div>
    </div>
  );
} 