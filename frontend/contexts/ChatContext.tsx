// Chat concierge context — manages message history, session ID, and loading state.
// SessionID persisted in sessionStorage so history survives navigations but resets on hard reload.
'use client';

import { createContext, useContext, useState, useEffect, useCallback, useRef, ReactNode } from 'react';
import { sendChatMessage, clearChatSession, type ChatWatchCard } from '@/lib/api';

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  watchCards?: ChatWatchCard[];
}

interface ChatContextValue {
  messages: ChatMessage[];
  isOpen: boolean;
  isLoading: boolean;
  dailyUsed: number | null;
  dailyLimit: number | null;
  sendMessage: (text: string) => Promise<void>;
  clearSession: () => Promise<void>;
  openChat: () => void;
  closeChat: () => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyUsed, setDailyUsed] = useState<number | null>(null);
  const [dailyLimit, setDailyLimit] = useState<number | null>(null);
  const sessionIdRef = useRef<string>('');

  // Initialise session ID from sessionStorage (or generate new UUID)
  useEffect(() => {
    const stored = sessionStorage.getItem('chat_session_id');
    if (stored) {
      sessionIdRef.current = stored;
    } else {
      const id = crypto.randomUUID();
      sessionStorage.setItem('chat_session_id', id);
      sessionIdRef.current = id;
    }
  }, []);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    const userMessage: ChatMessage = { role: 'user', content: text };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const result = await sendChatMessage(sessionIdRef.current, text);
      setDailyUsed(result.dailyUsed ?? null);
      setDailyLimit(result.dailyLimit ?? null);

      const assistantMessage: ChatMessage = {
        role: 'assistant',
        content: result.message,
        watchCards: result.watchCards?.length ? result.watchCards : undefined,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch {
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      setIsLoading(false);
    }
  }, [isLoading]);

  const clearSession = useCallback(async () => {
    await clearChatSession(sessionIdRef.current).catch(() => {});
    // Generate a new session ID
    const newId = crypto.randomUUID();
    sessionStorage.setItem('chat_session_id', newId);
    sessionIdRef.current = newId;
    setMessages([]);
    setDailyUsed(null);
  }, []);

  const openChat  = useCallback(() => setIsOpen(true), []);
  const closeChat = useCallback(() => setIsOpen(false), []);

  return (
    <ChatContext.Provider value={{
      messages, isOpen, isLoading, dailyUsed, dailyLimit,
      sendMessage, clearSession, openChat, closeChat,
    }}>
      {children}
    </ChatContext.Provider>
  );
}

export function useChat(): ChatContextValue {
  const ctx = useContext(ChatContext);
  if (!ctx) throw new Error('useChat must be used within ChatProvider');
  return ctx;
}
