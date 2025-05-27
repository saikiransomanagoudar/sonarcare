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
import ConfirmationModal from '../../components/ui/ConfirmationModal';

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
  const [deleteModal, setDeleteModal] = useState<{isOpen: boolean, sessionId: string | null, isDeleting: boolean}>({
    isOpen: false,
    sessionId: null,
    isDeleting: false
  });

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
  }, [currentUser]);

  // Listen for session title updates
  useEffect(() => {
    const handleSessionTitleUpdate = () => {
      // Refresh the sessions list when a title is updated
      if (currentUser) {
        loadSessions();
      }
    };

    // Listen for new session creation to add it optimistically
    const handleNewSessionCreated = (event: CustomEvent) => {
      const { sessionId, title } = event.detail;
      if (sessionId && currentUser?.uid) {
        // Add the new session optimistically to the list
        const newSession: ChatSession = {
          id: sessionId,
          title: title || 'New Conversation',
          lastActivityAt: new Date().toISOString(),
          userId: currentUser.uid,
          createdAt: new Date().toISOString()
        };
        
        setSessions(prev => [newSession, ...prev]);
      }
    };

    window.addEventListener('sessionTitleUpdated', handleSessionTitleUpdate);
    window.addEventListener('newSessionCreated', handleNewSessionCreated as EventListener);
    
    return () => {
      window.removeEventListener('sessionTitleUpdated', handleSessionTitleUpdate);
      window.removeEventListener('newSessionCreated', handleNewSessionCreated as EventListener);
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

  // Handle window resize to close mobile sidebar when switching to desktop
  useEffect(() => {
    const handleResize = () => {
      if (window.innerWidth >= 768) {
        setSidebarOpen(false); // Close mobile sidebar on desktop
      }
    };

    window.addEventListener('resize', handleResize);
    
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, []);

  // Handle creating a new chat
  const handleNewChat = () => {
    // If we're already on the new chat page, dispatch a reset event
    if (pathname === '/chat') {
      // Dispatch a custom event to reset the new chat page state
      window.dispatchEvent(new CustomEvent('resetNewChat'));
    } else {
      // Navigate to the New Chat page
      router.push('/chat');
    }
    // Close the sidebar on mobile
    setSidebarOpen(false);
  };

  // Handle deleting a chat session
  const handleDeleteSession = async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Open the confirmation modal
    setDeleteModal({
      isOpen: true,
      sessionId,
      isDeleting: false
    });
  };

  // Handle confirming the deletion
  const handleConfirmDelete = async () => {
    if (!deleteModal.sessionId) return;

    setDeleteModal(prev => ({ ...prev, isDeleting: true }));

    try {
      await deleteChatSession(deleteModal.sessionId);
      toast.success("Conversation deleted successfully");
      
      // Update local state
      setSessions(prev => prev.filter(session => session.id !== deleteModal.sessionId));
      
      // If we're currently viewing the deleted session, redirect to the chat page
      if (pathname === `/chat/${deleteModal.sessionId}`) {
        router.push('/chat');
      }
      
      // Close modal
      setDeleteModal({ isOpen: false, sessionId: null, isDeleting: false });
    } catch (error) {
      toast.error("Failed to delete the conversation. Please try again.");
      console.error('Error deleting chat session:', error);
      setDeleteModal(prev => ({ ...prev, isDeleting: false }));
    }
  };

  // Handle closing the modal
  const handleCloseDeleteModal = () => {
    if (!deleteModal.isDeleting) {
      setDeleteModal({ isOpen: false, sessionId: null, isDeleting: false });
    }
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
      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(243, 244, 246, 0.5);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(156, 163, 175, 0.6);
          border-radius: 3px;
          border: none;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(107, 114, 128, 0.8);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(156, 163, 175, 0.6) rgba(243, 244, 246, 0.5);
        }
      `}</style>
      
      {/* Spline Background */}
      <div className="absolute inset-0 z-0">
        <SplineScene />
      </div>
      
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 backdrop-blur-md bg-white/20 md:hidden transition-all duration-300 ease-in-out"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Toggle button for desktop - positioned relative to the main container */}
        <button 
          onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
          className={`cursor-pointer hidden md:flex absolute top-4 bg-white p-1.5 rounded-full shadow-lg border border-gray-300 hover:bg-gray-50 hover:shadow-xl transition-all duration-200 items-center justify-center z-40 ${
            desktopSidebarOpen ? 'left-60' : 'left-11.5'
          }`}
          aria-label={desktopSidebarOpen ? 'Minimize sidebar' : 'Expand sidebar'}
        >
          <svg 
            className="h-4 w-4 text-gray-600 hover:text-gray-800 transition-colors duration-200" 
            fill="none" 
            viewBox="0 0 24 24" 
            stroke="currentColor"
            strokeWidth="2.5"
          >
            <path 
              strokeLinecap="round" 
              strokeLinejoin="round" 
              d={desktopSidebarOpen ? "M15 19l-7-7 7-7" : "M9 5l7 7-7 7"} 
            />
          </svg>
        </button>

        {/* Sidebar for chat history */}
        <div className={`
          ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} 
          md:translate-x-0 
          fixed md:relative 
          left-0 top-0 
          z-30 md:z-auto
          w-64 
          ${desktopSidebarOpen ? 'md:w-64' : 'md:w-12'} 
          h-full
          bg-white 
          border-r border-gray-200 
          shadow-lg md:shadow-sm 
          transition-all duration-300 ease-in-out
          flex flex-col
          pt-16 md:pt-0
          will-change-transform
        `}>
          
          {/* Sidebar content - conditionally show full content based on desktopSidebarOpen */}
          <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${!desktopSidebarOpen && 'md:hidden'}`}>       
            {/* Mobile close button */}
            <div className="md:hidden flex justify-between items-center px-4 py-3 border-b border-gray-200 flex-shrink-0">
              <h2 className="text-lg font-semibold text-gray-800">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="cursor-pointer p-2 rounded-md text-gray-500 hover:text-gray-700 hover:bg-gray-100"
                aria-label="Close sidebar"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* This is the main container for the New Chat button and scrollable history */}
            <div className="px-4 py-4 flex-1 flex flex-col min-h-0"> {/* Ensures this container takes available space and enables scrolling for its children */}
              <button
                onClick={handleNewChat}
                className="cursor-pointer w-full py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors flex items-center justify-center mb-6 flex-shrink-0"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Chat
              </button>
              
              <h3 className="text-xs font-bold text-gray-600 uppercase tracking-wider mb-3 px-2 flex-shrink-0">Recent Conversations</h3>
              
              {/* Conditional rendering for loading/empty/sessions list */}
              {loadingSessions ? (
                <div className="flex justify-center py-4 flex-shrink-0">
                  <div className="w-6 h-6 border-t-2 border-blue-500 rounded-full animate-spin"></div>
                </div>
              ) : sessions.length === 0 ? (
                <p className="text-center text-sm text-gray-500 py-4 flex-shrink-0">No conversations yet</p>
              ) : (
                // The UL is now the direct flex-growing and scrollable child within the container above
                <ul className="flex-1 space-y-1 overflow-y-auto pr-2 custom-scrollbar min-h-0"> {/* Added min-h-0 here as well for safety */}
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
                          className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-1 text-gray-400 hover:text-red-500 hover:bg-gray-100 rounded opacity-0 group-hover:opacity-100 transition-opacity"
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
          
          {/* Minimized sidebar content */}
          {!desktopSidebarOpen && (
            <div className="hidden md:flex flex-col items-center pt-4 px-2">
              <button
                onClick={handleNewChat}
                className="cursor-pointer p-3 bg-blue-500 text-white rounded-lg hover:bg-blue-600 transition-colors mb-6"
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
                      className={`cursor-pointer p-2 rounded-lg hover:bg-gray-100 transition-colors ${
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
        <div className="flex-1 overflow-hidden bg-white bg-opacity-90 backdrop-blur-sm w-full md:w-auto">
          {children}
        </div>
      </div>

      {/* Delete Confirmation Modal */}
      <ConfirmationModal
        isOpen={deleteModal.isOpen}
        onClose={handleCloseDeleteModal}
        onConfirm={handleConfirmDelete}
        title="Delete Conversation"
        message="Are you sure you want to delete this conversation? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        isLoading={deleteModal.isDeleting}
      />
    </div>
  );
}