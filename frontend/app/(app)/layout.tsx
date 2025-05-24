'use client';

import { useState, useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/layout/Navbar';
import { getChatSessions, createChatSession, deleteChatSession } from '../../lib/api';
import { ChatSession } from '../../types';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';

// Import SplineScene component with dynamic import to avoid SSR issues
const SplineScene = dynamic(() => import('../../components/SplineScene'), {
  ssr: false,
  loading: () => null,
});

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [desktopSidebarOpen, setDesktopSidebarOpen] = useState(true);
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

  // Function to load sessions
  const loadSessions = async () => {
    if (!currentUser) return;
    
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

  // Load chat sessions for sidebar
  useEffect(() => {
    loadSessions();
  }, [currentUser, pathname]);

  // Listen for session title updates
  useEffect(() => {
    const handleSessionTitleUpdate = () => {
      // Refresh the sessions list when a title is updated
      if (currentUser) {
        loadSessions();
      }
    };

    window.addEventListener('sessionTitleUpdated', handleSessionTitleUpdate);
    
    return () => {
      window.removeEventListener('sessionTitleUpdated', handleSessionTitleUpdate);
    };
  }, [currentUser]);

  // Listen for toggle sidebar events from the chat page
  useEffect(() => {
    const handleToggleSidebar = () => {
      // For mobile, just toggle
      if (window.innerWidth < 768) {
        setSidebarOpen(prev => !prev);
      } else {
        // For desktop, toggle the desktop sidebar state
        setDesktopSidebarOpen(prev => !prev);
      }
    };

    window.addEventListener('toggleSidebar', handleToggleSidebar);
    
    return () => {
      window.removeEventListener('toggleSidebar', handleToggleSidebar);
    };
  }, []);

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
      <div className="flex min-h-screen items-center justify-center bg-gray-50 relative">
        {/* Spline Background */}
        <SplineScene />
        <div className="z-10 bg-white bg-opacity-50 backdrop-blur-sm p-8 rounded-lg shadow-lg">
          <div className="w-12 h-12 border-t-2 border-blue-500 rounded-full animate-spin"></div>
        </div>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen relative">
      {/* Spline Background */}
      <div className="absolute inset-0 z-0">
        <SplineScene />
      </div>
      
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Sidebar for chat history */}
        <div className={`${sidebarOpen ? 'block' : 'hidden'} md:block md:relative ${desktopSidebarOpen ? 'md:w-64' : 'md:w-12'} bg-white border-r border-gray-200 shadow-sm transition-all duration-300 flex flex-col h-full`}>
          {/* Toggle button for desktop */}
          <button 
            onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
            className="hidden md:flex absolute right-0 top-4 bg-white p-1 rounded-l-md shadow-md border border-r-0 border-gray-200 z-10"
            style={{ transform: 'translateX(100%)' }}
            aria-label={desktopSidebarOpen ? 'Minimize sidebar' : 'Expand sidebar'}
          >
            <svg 
              className="h-5 w-5 text-gray-500 hover:text-gray-700" 
              fill="none" 
              viewBox="0 0 24 24" 
              stroke="currentColor"
            >
              <path 
                strokeLinecap="round" 
                strokeLinejoin="round" 
                strokeWidth="2" 
                d={desktopSidebarOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} 
              />
            </svg>
          </button>
          
          {/* Sidebar content - conditionally show full content based on desktopSidebarOpen */}
          <div className={`relative flex-1 flex flex-col ${!desktopSidebarOpen && 'md:hidden'}`}>       
            <div className="px-4 pb-4 flex-1 flex flex-col">
              <button
                onClick={handleNewChat}
                className="w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center mb-6"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Chat
              </button>
              
              <div className="flex-1 min-h-0">
                <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 px-2">Recent Conversations</h3>
                {loadingSessions ? (
                  <div className="flex justify-center py-4">
                    <div className="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                  </div>
                ) : sessions.length === 0 ? (
                  <p className="text-center text-sm text-gray-500 py-4">No conversations yet</p>
                ) : (
                  <ul className="space-y-1 overflow-y-auto max-h-full pr-2">
                    {sessions.map((session) => (
                      <li key={session.id}>
                        <div className="relative group">
                          <Link 
                            href={`/chat/${session.id}`}
                            className={`block px-3 py-2 rounded-lg hover:bg-gray-100 transition-colors ${
                              pathname === `/chat/${session.id}` ? 'bg-blue-50 border-l-4 border-blue-500 pl-2' : ''
                            }`}
                            onClick={() => setSidebarOpen(false)}
                          >
                            <div className="flex items-center">
                              <svg className="w-4 h-4 text-gray-500 mr-2 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                              </svg>
                              <p className="font-medium text-gray-700 truncate pr-8">{session.title || 'Untitled Conversation'}</p>
                            </div>
                            <p className="text-xs text-gray-500 mt-1 pl-6">
                              {new Date(session.lastActivityAt).toLocaleDateString()} · {new Date(session.lastActivityAt).toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'})}
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
          
          {/* Minimized sidebar content */}
          {!desktopSidebarOpen && (
            <div className="hidden md:flex flex-col items-center pt-4">
              
              
              <button
                onClick={handleNewChat}
                className="p-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mb-6"
                title="New Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              
              {sessions.length > 0 && (
                <div className="flex flex-col items-center space-y-2 w-full">
                  {sessions.slice(0, 5).map((session) => (
                    <Link 
                      key={session.id}
                      href={`/chat/${session.id}`}
                      className={`p-2 rounded-lg hover:bg-gray-100 transition-colors ${
                        pathname === `/chat/${session.id}` ? 'bg-blue-50' : ''
                      }`}
                      title={session.title || 'Untitled Conversation'}
                    >
                      <svg className="w-5 h-5 text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden bg-white bg-opacity-90 backdrop-blur-sm">
          {children}
        </div>
      </div>
    </div>
  );
}