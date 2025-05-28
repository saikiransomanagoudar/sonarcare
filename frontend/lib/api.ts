import { ChatRequest, ChatResponse, ChatSession, ChatMessage } from "../types";
import { auth } from './firebase/clientApp';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Generic fetch wrapper with error handling
async function fetchAPI<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  // Get the current user's ID token
  const token = auth.currentUser ? await auth.currentUser.getIdToken() : null;
  
  try {
    const res = await fetch(`${API_URL}${endpoint}`, {
      ...options,
      mode: 'cors',
      credentials: 'omit', // Don't send cookies or session info
      headers: {
        'Content-Type': 'application/json',
        'Accept': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
        ...options.headers,
      },
    });

    if (!res.ok) {
      // Try to parse the error JSON, but handle cases where it might not be valid JSON
      try {
        const error = await res.json();
        throw new Error(error.message || `Error ${res.status}: ${res.statusText}`);
      } catch (e) {
        throw new Error(`Error ${res.status}: ${res.statusText}`);
      }
    }

    // If status is 204 No Content, return null as there is no body
    if (res.status === 204) {
      return null as unknown as T;
    }

    return await res.json();
  } catch (err) {
    console.error('API request failed:', err);
    throw err;
  }
}

export const getChatSessions = async (userId: string): Promise<ChatSession[]> => {
  return fetchAPI<ChatSession[]>(`/api/v1/chat/sessions?userId=${userId}`);
};

export const getChatMessages = async (sessionId: string): Promise<ChatMessage[]> => {
  return fetchAPI<ChatMessage[]>(`/api/v1/chat/messages?sessionId=${sessionId}`);
};

export const sendMessage = async (request: ChatRequest): Promise<ChatResponse> => {
  return fetchAPI<ChatResponse>('/api/v1/chat/message', {
    method: 'POST',
    body: JSON.stringify(request),
  });
};

export const createChatSession = async (userId: string): Promise<ChatSession> => {
  return fetchAPI<ChatSession>('/api/v1/chat/session', {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
};

export const deleteChatSession = async (sessionId: string): Promise<void> => {
  try {
    await fetchAPI(`/api/v1/chat/session/${sessionId}`, {
      method: 'DELETE',
    });
  } catch (error) {
    console.error('Error deleting session:', error);
    throw error;
  }
};

export const updateSessionTitle = async (sessionId: string, title: string): Promise<ChatSession> => {
  return fetchAPI<ChatSession>(`/api/v1/chat/session/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify({ title }),
  });
};

export const updateChatSession = async (
  sessionId: string, 
  updates: { title?: string; summary?: string }
): Promise<ChatSession> => {
  return fetchAPI<ChatSession>(`/api/v1/chat/session/${sessionId}`, {
    method: 'PATCH',
    body: JSON.stringify(updates),
  });
};

export const getChatSession = async (sessionId: string): Promise<ChatSession> => {
  return fetchAPI<ChatSession>(`/api/v1/chat/session/${sessionId}`);
};