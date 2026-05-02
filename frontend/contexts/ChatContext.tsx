// Chat concierge context — manages message history, session ID, loading state, and actions.
// SessionID persisted in sessionStorage so history survives navigations but resets on hard reload.
'use client';

import { createContext, useContext, useState, useCallback, useRef, ReactNode, useEffect } from 'react';
import { sendChatMessage, clearChatSession, getTasteProfile, type ChatWatchCard, type ChatAction, type TasteProfile } from '@/lib/api';
import { getBufferedEvents } from '@/lib/behaviorTracker';
import { useAuth } from '@/contexts/AuthContext';

export interface ChatMessage {
  id?: string;
  createdAt?: number;
  role: 'user' | 'assistant';
  content: string;
  watchCards?: ChatWatchCard[];
  actions?: ChatAction[];
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
const CHAT_SESSION_KEY = 'chat_session_id';
const CHAT_MESSAGES_KEY = 'chat_messages';
const CHAT_USAGE_KEY = 'chat_usage';

function getOrCreateChatSessionId(): string {
  if (typeof window === 'undefined') return '';

  const stored = sessionStorage.getItem(CHAT_SESSION_KEY);
  if (stored) return stored;

  const id = crypto.randomUUID();
  sessionStorage.setItem(CHAT_SESSION_KEY, id);
  return id;
}

function loadStoredMessages(sessionId: string): ChatMessage[] {
  if (typeof window === 'undefined' || !sessionId) return [];

  try {
    const raw = sessionStorage.getItem(`${CHAT_MESSAGES_KEY}:${sessionId}`);
    if (!raw) return [];
    const parsed = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function loadStoredUsage(sessionId: string): { dailyUsed: number | null; dailyLimit: number | null } {
  if (typeof window === 'undefined' || !sessionId) {
    return { dailyUsed: null, dailyLimit: null };
  }

  try {
    const raw = sessionStorage.getItem(`${CHAT_USAGE_KEY}:${sessionId}`);
    if (!raw) return { dailyUsed: null, dailyLimit: null };
    const parsed = JSON.parse(raw);
    return {
      dailyUsed: typeof parsed?.dailyUsed === 'number' ? parsed.dailyUsed : null,
      dailyLimit: typeof parsed?.dailyLimit === 'number' ? parsed.dailyLimit : null,
    };
  } catch {
    return { dailyUsed: null, dailyLimit: null };
  }
}

// Builds a short human-readable summary of recent browsing behavior from localStorage.
function buildBehaviorSummary(): string | undefined {
  const events = getBufferedEvents();
  if (events.length === 0) return undefined;

  const brandCounts: Record<string, number> = {};
  const collectionCounts: Record<string, number> = {};

  for (const e of events) {
    if (e.type === 'brand_view' && e.entityName) {
      brandCounts[e.entityName] = (brandCounts[e.entityName] || 0) + 1;
    } else if (e.type === 'collection_view' && e.entityName) {
      collectionCounts[e.entityName] = (collectionCounts[e.entityName] || 0) + 1;
    }
  }

  const parts: string[] = [];
  const topBrands = Object.entries(brandCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count}x)`);
  if (topBrands.length > 0) parts.push(`Recently browsed brands: ${topBrands.join(', ')}`);

  const topCollections = Object.entries(collectionCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([name, count]) => `${name} (${count}x)`);
  if (topCollections.length > 0) parts.push(`Recently browsed collections: ${topCollections.join(', ')}`);

  return parts.length > 0 ? parts.join('. ') + '.' : undefined;
}

function formatPricePreference(profile: TasteProfile): string | null {
  const min = profile.priceMin ?? profile.behaviorPriceMin;
  const max = profile.priceMax ?? profile.behaviorPriceMax;
  if (min != null && max != null) return `$${min.toLocaleString()}-$${max.toLocaleString()}`;
  if (max != null) return `under $${max.toLocaleString()}`;
  if (min != null) return `from $${min.toLocaleString()}`;
  return null;
}

function buildTasteProfileSummary(profile: TasteProfile | null): string | undefined {
  if (!profile) return undefined;

  const parts: string[] = [];
  const summary = profile.summary ?? profile.behaviorSummary;
  if (summary) parts.push(`Watch DNA summary: ${summary}`);

  const materials = profile.preferredMaterials.length > 0
    ? profile.preferredMaterials
    : profile.behaviorPreferredMaterials;
  if (materials.length > 0) parts.push(`Preferred materials: ${materials.slice(0, 3).join(', ')}`);

  const dialColors = profile.preferredDialColors.length > 0
    ? profile.preferredDialColors
    : profile.behaviorPreferredDialColors;
  if (dialColors.length > 0) parts.push(`Preferred dial colors: ${dialColors.slice(0, 3).join(', ')}`);

  const caseSize = profile.preferredCaseSize ?? profile.behaviorPreferredCaseSize;
  if (caseSize) parts.push(`Preferred case size: ${caseSize}`);

  const pricePreference = formatPricePreference(profile);
  if (pricePreference) parts.push(`Preferred price range: ${pricePreference}`);

  return parts.length > 0 ? parts.join('. ') + '.' : undefined;
}

function buildPersonalizationSummary(profile: TasteProfile | null): string | undefined {
  const parts = [buildTasteProfileSummary(profile), buildBehaviorSummary()].filter(Boolean);
  return parts.length > 0 ? parts.join(' ') : undefined;
}

function getPreferredLanguageHint(): string | undefined {
  if (typeof navigator === 'undefined') return undefined;

  const language = navigator.languages?.find(Boolean) ?? navigator.language;
  return typeof language === 'string' && language.trim().length > 0 ? language : undefined;
}

export function ChatProvider({ children }: { children: ReactNode }) {
  const { isAuthenticated } = useAuth();
  const initialSessionId = getOrCreateChatSessionId();
  const [messages, setMessages] = useState<ChatMessage[]>(() => loadStoredMessages(initialSessionId));
  const [isOpen, setIsOpen] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [dailyUsed, setDailyUsed] = useState<number | null>(() => loadStoredUsage(initialSessionId).dailyUsed);
  const [dailyLimit, setDailyLimit] = useState<number | null>(() => loadStoredUsage(initialSessionId).dailyLimit);
  const [tasteProfile, setTasteProfile] = useState<TasteProfile | null>(null);
  // Init session ID synchronously on first render (client only) to avoid a race condition.
  const sessionIdRef = useRef<string>(initialSessionId);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    if (typeof window === 'undefined' || !sessionIdRef.current) return;

    try {
      sessionStorage.setItem(
        `${CHAT_MESSAGES_KEY}:${sessionIdRef.current}`,
        JSON.stringify(messages),
      );
    } catch {
      // ignore storage errors
    }
  }, [messages]);

  useEffect(() => {
    if (typeof window === 'undefined' || !sessionIdRef.current) return;

    try {
      sessionStorage.setItem(
        `${CHAT_USAGE_KEY}:${sessionIdRef.current}`,
        JSON.stringify({ dailyUsed, dailyLimit }),
      );
    } catch {
      // ignore storage errors
    }
  }, [dailyUsed, dailyLimit]);

  useEffect(() => {
    let cancelled = false;

    if (!isAuthenticated) {
      setTasteProfile(null);
      return;
    }

    getTasteProfile()
      .then(profile => {
        if (!cancelled) setTasteProfile(profile);
      })
      .catch(() => {
        if (!cancelled) setTasteProfile(null);
      });

    return () => {
      cancelled = true;
    };
  }, [isAuthenticated]);

  const sendMessage = useCallback(async (text: string) => {
    if (!text.trim() || isLoading) return;

    // Abort any in-flight request before starting a new one
    abortControllerRef.current?.abort();
    const controller = new AbortController();
    abortControllerRef.current = controller;

    const now = Date.now();
    const userMessage: ChatMessage = {
      id: crypto.randomUUID(),
      createdAt: now,
      role: 'user',
      content: text,
    };
    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    try {
      const behaviorSummary = buildPersonalizationSummary(tasteProfile);
      const preferredLanguage = getPreferredLanguageHint();
      const result = await sendChatMessage(
        sessionIdRef.current, text, behaviorSummary, preferredLanguage, controller.signal,
      );
      if (controller.signal.aborted) return;
      setDailyUsed(result.dailyUsed ?? null);
      setDailyLimit(result.dailyLimit ?? null);

      const assistantMessage: ChatMessage = {
        id: crypto.randomUUID(),
        createdAt: Date.now(),
        role: 'assistant',
        content: result.message,
        watchCards: result.watchCards?.length ? result.watchCards : undefined,
        actions: result.actions?.length ? result.actions : undefined,
      };
      setMessages(prev => [...prev, assistantMessage]);
    } catch (err) {
      // Ignore errors caused by the user intentionally clearing/aborting
      if (err instanceof Error && err.name === 'AbortError') return;
      setMessages(prev => [
        ...prev,
        { role: 'assistant', content: 'Something went wrong. Please try again.' },
      ]);
    } finally {
      if (!controller.signal.aborted) setIsLoading(false);
    }
  }, [isLoading, tasteProfile]);

  const clearSession = useCallback(async () => {
    // Cancel any in-flight request so it doesn't append to the cleared session
    abortControllerRef.current?.abort();
    abortControllerRef.current = null;
    await clearChatSession(sessionIdRef.current).catch(() => {});
    // Generate a new session ID
    const newId = crypto.randomUUID();
    sessionStorage.setItem(CHAT_SESSION_KEY, newId);
    sessionStorage.removeItem(`${CHAT_MESSAGES_KEY}:${sessionIdRef.current}`);
    sessionStorage.removeItem(`${CHAT_USAGE_KEY}:${sessionIdRef.current}`);
    sessionIdRef.current = newId;
    setMessages([]);
    setDailyUsed(null);
    setDailyLimit(null);
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
