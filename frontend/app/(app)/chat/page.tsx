"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { createChatSession, sendMessage } from "../../../lib/api";
import MessageInput from "../../../components/chat/MessageInput";
import ChatLayout from "../../../components/chat/ChatLayout";
import { ChatMessage } from "../../../types";
import { initializeSocket } from "../../../lib/socket";
import dynamic from "next/dynamic";

// Import SplineScene component with dynamic import
const SplineScene = dynamic(() => import("../../../components/SplineScene"), {
  ssr: false,
  loading: () => null,
});

// This page shows an empty chat interface and only creates a session when the first message is sent
export default function NewChatPage() {
  const { currentUser, loading } = useAuth();
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [showChat, setShowChat] = useState(false);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Initialize WebSocket connection early
  useEffect(() => {
    if (currentUser) {
      console.log('Initializing WebSocket early for new chat page');
      initializeSocket(currentUser.uid);
    }
  }, [currentUser]);

  // Listen for reset event from "New Chat" button
  useEffect(() => {
    const handleResetNewChat = () => {
      console.log('Resetting new chat page state');
      // Reset all state to initial values
      setIsSubmitting(false);
      setSessionId(null);
      setMessages([]);
      setShowChat(false);
      setIsTransitioning(false);
      
      // Clear URL back to /chat
      window.history.pushState({}, '', '/chat');
    };

    window.addEventListener('resetNewChat', handleResetNewChat);
    
    return () => {
      window.removeEventListener('resetNewChat', handleResetNewChat);
    };
  }, []);

  // Add class to body to ensure full interaction with Spline and prevent scrolling
  useEffect(() => {
    // Prevent all scrolling on the page
    const originalOverflow = document.body.style.overflow;
    const originalDocumentOverflow = document.documentElement.style.overflow;
    
    document.body.style.overflow = 'hidden';
    document.documentElement.style.overflow = 'hidden';

    return () => {
      document.body.style.overflow = originalOverflow;
      document.documentElement.style.overflow = originalDocumentOverflow;
    };
  }, []);

  const handleSendMessage = async (text: string) => {
    if (!currentUser || !text.trim() || isSubmitting) return;

    setIsSubmitting(true);

    try {
      setIsTransitioning(true);
      
      // Create a new chat session first
      const session = await createChatSession(currentUser.uid);
      
      // Immediately notify the sidebar about the new session
      window.dispatchEvent(new CustomEvent('newSessionCreated', { 
        detail: { sessionId: session.id, title: null } 
      }));
      
      // Set the session ID and show chat interface (no temporary message)
      setSessionId(session.id);
      setShowChat(true);
      
      // Update URL without redirecting to maintain streaming
      window.history.pushState({}, '', `/chat/${session.id}`);
      
      // Add a delay to ensure session is fully created and WebSocket is ready
      setTimeout(() => {
        setIsSubmitting(false);
        setIsTransitioning(false);
        
        // Wait for ChatLayout to mount and WebSocket to join session
        setTimeout(() => {
          // Dispatch the first message event for the ChatLayout to handle
          const event = new CustomEvent('sendFirstMessage', { 
            detail: { message: text } 
          });
          window.dispatchEvent(event);
          
          // Dispatch a notification that we want to refresh the session list for title update
          setTimeout(() => {
            window.dispatchEvent(new CustomEvent('sessionTitleUpdated'));
          }, 1000);
        }, 200); // Additional delay for WebSocket session join
      }, 300); // Initial delay for session creation

    } catch (error) {
      console.error("Error creating new chat session:", error);
      setIsSubmitting(false);
      setIsTransitioning(false);
    }
  };

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <SplineScene />
        </div>
        <div className="relative z-10 bg-white/10 backdrop-blur-md p-8 rounded-2xl shadow-2xl border border-white/20">
          <div className="w-16 h-16 border-t-2 border-blue-400 rounded-full animate-spin mx-auto mb-4"></div>
          <p className="text-white text-center font-medium">Loading SonarCare...</p>
        </div>
      </div>
    );
  }

  // Show chat interface if session is created
  if (showChat && sessionId) {
    return (
      <div className="h-screen relative overflow-hidden">
        <div className="absolute inset-0 z-0">
          <SplineScene />
        </div>
        <div className="relative z-10 h-full flex justify-center items-start overflow-hidden pt-16">
          <div className="w-full max-w-4xl mx-auto px-4 h-full flex flex-col overflow-hidden">
            <ChatLayout key={sessionId} initialMessages={messages} sessionId={sessionId} />
          </div>
        </div>
      </div>
    );
  }

  // Show welcome screen
  return (
    <div className="flex flex-col h-screen bg-gradient-to-br from-blue-50 via-indigo-50 to-purple-50 relative overflow-hidden pt-16">
      <div className="absolute inset-0 z-0">
        <SplineScene />
      </div>
      
      <div className="absolute inset-0 bg-white/5 backdrop-blur-[2px] z-0"></div>
      
      <div className="flex-1 p-6 flex flex-col items-center justify-center relative z-10 overflow-hidden">
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center justify-center overflow-hidden">
          <div className="mb-8 text-center">
            <h1 className="text-3xl font-bold text-gray-800 mb-3">Welcome to SonarCare</h1>
            <p className="text-gray-600 max-w-lg mx-auto">
              Ask anything about healthcare.
            </p>
          </div>
          
          <div className="w-full max-w-xl bg-white bg-opacity-90 backdrop-blur-lg rounded-2xl shadow-lg border border-gray-100 p-6">
            <div className="pb-4 text-center">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-blue-100 mb-4">
                <svg 
                  className="h-6 w-6 text-blue-500" 
                  viewBox="0 0 24 24" 
                  fill="none" 
                  stroke="currentColor" 
                  strokeWidth="2"
                  strokeLinecap="round" 
                  strokeLinejoin="round"
                >
                  <circle cx="12" cy="12" r="10" />
                  <path d="M8 14s1.5 2 4 2 4-2 4-2" />
                  <line x1="9" y1="9" x2="9.01" y2="9" />
                  <line x1="15" y1="9" x2="15.01" y2="9" />
                </svg>
              </div>
              <p className="text-gray-700 font-medium">Start a new conversation</p>
            </div>
            
            <MessageInput
              onSendMessage={handleSendMessage}
              isLoading={isSubmitting}
              showSuggestions={true}
            />
            
            <div className="mt-4 bg-yellow-50 rounded-lg p-3 border-l-4 border-yellow-400">
              <p className="text-yellow-800 text-xs">
                <strong>Medical Disclaimer:</strong> Information provided is for educational purposes only and is not a substitute for professional medical advice. Always consult a qualified healthcare provider with any questions you may have regarding a medical condition or treatment.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}