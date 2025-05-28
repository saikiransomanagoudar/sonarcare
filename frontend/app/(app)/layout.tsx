'use client';

import { useState, useEffect, useCallback, useMemo, memo } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '../../hooks/useAuth';
import Navbar from '../../components/layout/Navbar';
import { getChatSessions, createChatSession, deleteChatSession, updateChatSession } from '../../lib/api';
import { ChatSession } from '../../types';
import { toast } from 'react-toastify';
import dynamic from 'next/dynamic';
import ConfirmationModal from '../../components/ui/ConfirmationModal';

// Import SplineScene component with dynamic import to avoid SSR issues
const SplineScene = dynamic(() => import('../../components/SplineScene'), {
  ssr: false,
  loading: () => null,
});

// Helper function to generate title from bot response
const generateTitleFromResponse = (response: string): string => {
  if (!response) return 'New Conversation';
  
  // Remove markdown formatting
  let cleanResponse = response.replace(/\*\*([^*]+)\*\*/g, '$1'); // Remove bold
  cleanResponse = cleanResponse.replace(/\*([^*]+)\*/g, '$1'); // Remove italic
  cleanResponse = cleanResponse.replace(/#{1,6}\s+/g, ''); // Remove headers
  
  // Get the first meaningful sentence
  const sentences = cleanResponse.split(/[.!?]+/).filter(s => s.trim().length > 10);
  let title = sentences[0] || cleanResponse;
  
  // Clean up and truncate
  title = title.trim();
  if (title.length > 50) {
    title = title.substring(0, 47) + '...';
  }
  
  // If still too generic or empty, use a fallback
  if (!title || title.length < 5 || title.toLowerCase().includes('i understand') || title.toLowerCase().includes('i\'m sonarcare')) {
    title = 'Health Consultation';
  }
  
  return title;
};

// Fixed helper component to handle time display with proper hydration
const TimeDisplay = memo(({ date }: { date: string }) => {
  const [mounted, setMounted] = useState(false);
  
  // Memoize the formatted time display to prevent recalculation
  const timeDisplay = useMemo(() => {
    if (!mounted) return '';
    
    try {
      const dateObj = new Date(date);
      if (isNaN(dateObj.getTime())) {
        return 'Recent';
      }

      const now = new Date();
      
      // Get date strings for comparison (this removes time component)
      const messageDate = dateObj.toDateString();
      const todayDate = now.toDateString();
      
      // Calculate yesterday's date string
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayDate = yesterday.toDateString();
      
      // Compare date strings directly
      if (messageDate === todayDate) {
        // Same day - show time with explicit locale options
        return dateObj.toLocaleTimeString('en-US', { 
          hour: 'numeric', 
          minute: '2-digit',
          hour12: true
        });
      } else if (messageDate === yesterdayDate) {
        // Yesterday - show "Yesterday"
        return 'Yesterday';
      } else {
        // Older - show date with explicit locale options
        return dateObj.toLocaleDateString('en-US', {
          month: 'short',
          day: 'numeric'
        });
      }
    } catch (error) {
      console.error('Error formatting time:', error);
      return 'Recent';
    }
  }, [date, mounted]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Prevent hydration mismatch by not rendering time until mounted
  if (!mounted) {
    return <span className="text-xs text-gray-500 dark:text-gray-400">•••</span>;
  }

  return <span className="text-xs text-gray-500 dark:text-gray-400">{timeDisplay}</span>;
});

// Memoized session item component to prevent unnecessary re-renders
const SessionItem = memo(({ 
  session, 
  isActive, 
  onDelete, 
  onSidebarClose 
}: { 
  session: ChatSession;
  isActive: boolean;
  onDelete: (sessionId: string, e: React.MouseEvent) => void;
  onSidebarClose: () => void;
}) => {
  return (
    <li key={session.id}>
      <div className="relative group">
        <Link 
          href={`/chat/${session.id}`}
          className={`block px-3 py-3 rounded-xl hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all duration-200 backdrop-blur-sm border border-transparent hover:border-white/40 dark:hover:border-gray-600/40 hover:shadow-md ${
            isActive
              ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/50 shadow-md backdrop-blur-md' 
              : ''
          }`}
          onClick={onSidebarClose}
        >
          <div className="flex items-center">
            <div className="w-8 h-8 bg-blue-100/80 dark:bg-blue-900/50 rounded-lg flex items-center justify-center mr-3 flex-shrink-0 border border-blue-200/50 dark:border-blue-700/50">
              <svg className="w-4 h-4 text-blue-500 dark:text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
              </svg>
            </div>
            <div className="flex-1 min-w-0 pr-8">
              <p className="font-medium text-gray-700 dark:text-gray-200 truncate text-sm">
                {session.title || 'New Conversation'}
              </p>
              <p className="text-xs text-gray-500 dark:text-gray-400 mt-1">
                <TimeDisplay date={session.lastActivityAt} />
              </p>
            </div>
          </div>
        </Link>
        <button
          onClick={(e) => onDelete(session.id, e)}
          className="cursor-pointer absolute right-2 top-1/2 -translate-y-1/2 p-1.5 text-gray-400 dark:text-gray-500 hover:text-red-500 dark:hover:text-red-400 hover:bg-white/60 dark:hover:bg-gray-700/60 rounded-lg opacity-0 group-hover:opacity-100 transition-all duration-200 backdrop-blur-sm border border-transparent hover:border-red-200/50 dark:hover:border-red-700/50"
          title="Delete conversation"
        >
          <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
          </svg>
        </button>
      </div>
    </li>
  );
}, (prevProps, nextProps) => {
  // Custom comparison to prevent unnecessary re-renders
  return (
    prevProps.session.id === nextProps.session.id &&
    prevProps.session.title === nextProps.session.title &&
    prevProps.session.lastActivityAt === nextProps.session.lastActivityAt &&
    prevProps.isActive === nextProps.isActive
  );
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

  // Function to load sessions - memoized to prevent unnecessary re-renders
  const loadSessions = useCallback(async () => {
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
  }, [currentUser]);

  // Load chat sessions for sidebar
  useEffect(() => {
    loadSessions();
  }, [loadSessions]);

  // Listen for session title updates and new bot responses
  useEffect(() => {
    const handleSessionTitleUpdate = () => {
      // Don't reload sessions - title updates are already handled by handleBotResponse
      // This prevents unnecessary re-mounting of TimeDisplay components
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

    // Listen for bot responses to update session titles
    const handleBotResponse = async (event: CustomEvent) => {
      const { sessionId, response, isFirstMessage } = event.detail;
      
      if (sessionId && response && isFirstMessage && currentUser?.uid) {
        try {
          // Generate title from the bot response
          const generatedTitle = generateTitleFromResponse(response);
          
          // Update the session title in the backend
          await updateChatSession(sessionId, { title: generatedTitle });
          
          // Update local state efficiently - only update title, keep original lastActivityAt
          setSessions(prev => prev.map(session => 
            session.id === sessionId 
              ? { ...session, title: generatedTitle }
              : session
          ));
        } catch (error) {
          console.error('Error updating session title:', error);
        }
      }
    };

    window.addEventListener('sessionTitleUpdated', handleSessionTitleUpdate);
    window.addEventListener('newSessionCreated', handleNewSessionCreated as EventListener);
    window.addEventListener('botResponseReceived', handleBotResponse as unknown as EventListener);
    
    return () => {
      window.removeEventListener('sessionTitleUpdated', handleSessionTitleUpdate);
      window.removeEventListener('newSessionCreated', handleNewSessionCreated as EventListener);
      window.removeEventListener('botResponseReceived', handleBotResponse as unknown as EventListener);
    };
  }, [currentUser]); // Removed loadSessions dependency to prevent recreation of event handlers

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

  // Handle deleting a chat session - memoized to prevent re-renders
  const handleDeleteSession = useCallback(async (sessionId: string, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    // Open the confirmation modal
    setDeleteModal({
      isOpen: true,
      sessionId,
      isDeleting: false
    });
  }, []);

  // Handle sidebar close - memoized to prevent re-renders
  const handleSidebarClose = useCallback(() => {
    setSidebarOpen(false);
  }, []);

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
      <div className="min-h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 transition-colors duration-300 flex items-center justify-center relative overflow-hidden">
        {/* Background decorative elements */}
        <div className="absolute inset-0 overflow-hidden">
          <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 dark:bg-blue-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob"></div>
          <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-100 dark:bg-cyan-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
          <div className="absolute top-40 left-40 w-80 h-80 bg-teal-100 dark:bg-teal-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        </div>
        
        <div className="z-10 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20 dark:border-gray-700/50">
          <div className="w-12 h-12 border-t-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin mx-auto"></div>
          <p className="text-gray-800 dark:text-white text-center font-medium mt-4">Loading SonarCare...</p>
        </div>
        
        <style jsx>{`
          @keyframes blob {
            0% { transform: translate(0px, 0px) scale(1); }
            33% { transform: translate(30px, -50px) scale(1.1); }
            66% { transform: translate(-20px, 20px) scale(0.9); }
            100% { transform: translate(0px, 0px) scale(1); }
          }
          .animate-blob { animation: blob 7s infinite; }
          .animation-delay-2000 { animation-delay: 2s; }
          .animation-delay-4000 { animation-delay: 4s; }
        `}</style>
      </div>
    );
  }

  if (!currentUser) {
    return null;
  }

  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-white to-cyan-50 dark:from-gray-900 dark:via-gray-800 dark:to-blue-900 relative transition-colors duration-300">
      {/* Background decorative elements */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-80 h-80 bg-blue-100 dark:bg-blue-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob"></div>
        <div className="absolute -bottom-40 -left-40 w-80 h-80 bg-cyan-100 dark:bg-cyan-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-2000"></div>
        <div className="absolute top-40 left-40 w-80 h-80 bg-teal-100 dark:bg-teal-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-70 animate-blob animation-delay-4000"></div>
        <div className="absolute top-1/2 right-1/4 w-60 h-60 bg-purple-100 dark:bg-purple-800/30 rounded-full mix-blend-multiply dark:mix-blend-screen filter blur-xl opacity-50 animate-blob animation-delay-6000"></div>
      </div>

      {/* Custom scrollbar styles */}
      <style jsx global>{`
        .custom-scrollbar::-webkit-scrollbar {
          width: 6px;
        }
        .custom-scrollbar::-webkit-scrollbar-track {
          background: rgba(255, 255, 255, 0.1);
          border-radius: 3px;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb {
          background: rgba(255, 255, 255, 0.3);
          border-radius: 3px;
          border: none;
        }
        .custom-scrollbar::-webkit-scrollbar-thumb:hover {
          background: rgba(255, 255, 255, 0.5);
        }
        .custom-scrollbar {
          scrollbar-width: thin;
          scrollbar-color: rgba(255, 255, 255, 0.3) rgba(255, 255, 255, 0.1);
        }
        
        @keyframes blob {
          0% { transform: translate(0px, 0px) scale(1); }
          33% { transform: translate(30px, -50px) scale(1.1); }
          66% { transform: translate(-20px, 20px) scale(0.9); }
          100% { transform: translate(0px, 0px) scale(1); }
        }
        .animate-blob { animation: blob 7s infinite; }
        .animation-delay-2000 { animation-delay: 2s; }
        .animation-delay-4000 { animation-delay: 4s; }
        .animation-delay-6000 { animation-delay: 6s; }
      `}</style>
      
      <Navbar onMenuClick={() => setSidebarOpen(!sidebarOpen)} />
      
      <div className="flex flex-1 overflow-hidden relative z-10">
        {/* Mobile overlay */}
        {sidebarOpen && (
          <div 
            className="fixed inset-0 z-20 backdrop-blur-md bg-black/20 dark:bg-black/40 md:hidden transition-all duration-300 ease-in-out"
            onClick={() => setSidebarOpen(false)}
          />
        )}
        
        {/* Toggle button for desktop - positioned relative to the main container */}
        <button 
          onClick={() => setDesktopSidebarOpen(!desktopSidebarOpen)}
          className={`cursor-pointer hidden md:flex absolute top-4 bg-white/80 dark:bg-gray-800/80 backdrop-blur-md p-1.5 rounded-full shadow-lg border border-white/30 dark:border-gray-700/30 hover:bg-white/90 dark:hover:bg-gray-700/90 hover:shadow-xl transition-all duration-200 items-center justify-center z-40 ${
            desktopSidebarOpen ? 'left-60' : 'left-11.5'
          }`}
          aria-label={desktopSidebarOpen ? 'Minimize sidebar' : 'Expand sidebar'}
        >
          <svg 
            className="h-4 w-4 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-gray-100 transition-colors duration-200" 
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
          bg-white/80 dark:bg-gray-800/80
          backdrop-blur-md
          border-r border-white/30 dark:border-gray-700/30
          shadow-xl md:shadow-lg 
          transition-all duration-300 ease-in-out
          flex flex-col
          pt-16 md:pt-0
          will-change-transform
        `}>
          
          {/* Sidebar content - conditionally show full content based on desktopSidebarOpen */}
          <div className={`relative flex-1 flex flex-col min-h-0 overflow-hidden ${!desktopSidebarOpen && 'md:hidden'}`}>       
            {/* Mobile close button */}
            <div className="md:hidden flex justify-between items-center px-4 py-3 border-b border-white/30 dark:border-gray-700/30 flex-shrink-0 bg-white/60 dark:bg-gray-800/60 backdrop-blur-sm">
              <h2 className="text-lg font-semibold text-gray-800 dark:text-gray-200">Menu</h2>
              <button
                onClick={() => setSidebarOpen(false)}
                className="cursor-pointer p-2 rounded-md text-gray-500 dark:text-gray-400 hover:text-gray-700 dark:hover:text-gray-200 hover:bg-white/50 dark:hover:bg-gray-700/50 transition-colors"
                aria-label="Close sidebar"
              >
                <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            
            {/* This is the main container for the New Chat button and scrollable history */}
            <div className="px-4 py-4 flex-1 flex flex-col min-h-0"> 
              <button
                onClick={handleNewChat}
                className="cursor-pointer w-full py-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600 transition-all duration-200 flex items-center justify-center mb-6 flex-shrink-0 shadow-lg hover:shadow-xl transform hover:scale-[1.02] backdrop-blur-sm border border-blue-600/30 dark:border-blue-500/30"
              >
                <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
                New Chat
              </button>
              
              <h3 className="text-xs font-bold text-gray-600 dark:text-gray-400 uppercase tracking-wider mb-3 px-2 flex-shrink-0">Recent Conversations</h3>
              
              {/* Conditional rendering for loading/empty/sessions list */}
              {loadingSessions ? (
                <div className="flex justify-center py-4 flex-shrink-0">
                  <div className="w-6 h-6 border-t-2 border-blue-500 dark:border-blue-400 rounded-full animate-spin"></div>
                </div>
              ) : sessions.length === 0 ? (
                <div className="text-center py-8 flex-shrink-0">
                  <div className="w-12 h-12 bg-gray-100 dark:bg-gray-700/50 rounded-full flex items-center justify-center mx-auto mb-3">
                    <svg className="w-6 h-6 text-gray-400 dark:text-gray-500" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                    </svg>
                  </div>
                  <p className="text-sm text-gray-500 dark:text-gray-400">No conversations yet</p>
                  <p className="text-xs text-gray-400 dark:text-gray-500 mt-1">Start a new chat to begin</p>
                </div>
              ) : (
                <ul className="flex-1 space-y-2 overflow-y-auto pr-2 custom-scrollbar min-h-0">
                  {sessions.map((session) => (
                    <SessionItem 
                      key={session.id}
                      session={session}
                      isActive={pathname === `/chat/${session.id}`}
                      onDelete={handleDeleteSession}
                      onSidebarClose={handleSidebarClose}
                    />
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
                className="cursor-pointer p-3 bg-gradient-to-r from-blue-500 to-blue-600 dark:from-blue-600 dark:to-blue-700 text-white rounded-xl hover:from-blue-600 hover:to-blue-700 dark:hover:from-blue-500 dark:hover:to-blue-600 transition-all duration-200 mb-6 shadow-lg hover:shadow-xl transform hover:scale-105 backdrop-blur-sm border border-blue-600/30 dark:border-blue-500/30"
                title="New Chat"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
                </svg>
              </button>
              
              {sessions.length > 0 && (
                <div className="flex flex-col items-center space-y-2 w-full">
                  {sessions.slice(0, 5).map((session) => (
                    <Link 
                      key={session.id}
                      href={`/chat/${session.id}`}
                      className={`cursor-pointer p-2.5 rounded-xl hover:bg-white/60 dark:hover:bg-gray-700/60 transition-all duration-200 backdrop-blur-sm border border-transparent hover:border-white/40 dark:hover:border-gray-600/40 hover:shadow-md transform hover:scale-105 ${
                        pathname === `/chat/${session.id}` 
                          ? 'bg-blue-50/80 dark:bg-blue-900/30 border-blue-200/50 dark:border-blue-700/50 shadow-md' 
                          : ''
                      }`}
                      title={session.title || 'New Conversation'}
                    >
                      <svg className="w-5 h-5 text-gray-500 dark:text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth="2">
                        <path strokeLinecap="round" strokeLinejoin="round" d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
                      </svg>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
        
        {/* Main content */}
        <div className="flex-1 overflow-hidden w-full md:w-auto">
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