"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../../hooks/useAuth";
import { createChatSession, sendMessage } from "../../../lib/api";
import MessageInput from "../../../components/chat/MessageInput";
import dynamic from "next/dynamic";

// Import SplineScene component with dynamic import
const SplineScene = dynamic(() => import("../../../components/SplineScene"), {
  ssr: false,
  loading: () => null,
});

// This page shows an empty chat interface and only creates a session when the first message is sent
export default function NewChatPage() {
  const { currentUser, loading } = useAuth();
  const router = useRouter();
  const [isSubmitting, setIsSubmitting] = useState(false);

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
      // Create a new chat session first
      const session = await createChatSession(currentUser.uid);

      // Instead of sending via REST API and redirecting, 
      // redirect to the session immediately and let the WebSocket handle the message
      router.push(`/chat/${session.id}?firstMessage=${encodeURIComponent(text)}`);
    } catch (error) {
      console.error("Error creating new chat session:", error);
      setIsSubmitting(false);
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
              Your AI medical assistant powered by advanced technology. Ask anything about health and medical topics.
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
                <strong>Medical Disclaimer:</strong> Information provided is for educational purposes only and is not a substitute for professional medical advice.
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}