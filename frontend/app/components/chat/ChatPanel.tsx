// Chat panel with inline markdown, action execution, and watch-card follow-up support.
// Handles compare, Smart Search, and cursor actions from the concierge response contract.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, KeyboardEvent, useCallback, ReactNode, startTransition } from 'react';
import { useRouter } from 'next/navigation';
import { useChat } from '@/contexts/ChatContext';
import { useCursor } from '@/contexts/CursorContext';
import { imageTransformations } from '@/lib/cloudinary';
import { ScrollArea } from '@/components/ui/scroll-area';
import type { ChatWatchCard, ChatAction } from '@/lib/api';
import { fetchWatchBySlug } from '@/lib/api';
import { useCompare } from '@/stores/compareStore';

const EXAMPLE_PROMPTS = [
  'Compare the Aquanaut and the Overseas',
  'Tell me about Patek Philippe',
  'Sporty watches under $20,000',
  'Something elegant for a formal dinner',
  'Best diving watch from Rolex',
];

const ASSISTANT_REVEAL_START_MS = 140;

type NavigateFn = (href: string) => void;
type ActionStatus = 'idle' | 'loading' | 'error';

function splitRevealChunks(text: string): string[] {
  const tokens = text.match(/\n+|[^\s]+\s*/g) ?? [];
  if (tokens.length === 0) return [text];

  const chunks: string[] = [];
  let buffer = '';

  tokens.forEach((token, index) => {
    buffer += token;

    const trimmedToken = token.trim();
    const isLineBreak = /\n/.test(token);
    const isSentenceEnd = /[.!?]$/.test(trimmedToken);
    const isClauseEnd = /[,;:]$/.test(trimmedToken);
    const isLongChunk = buffer.length >= 34;
    const isEarlyChunk = index < 3 && buffer.length >= 18;
    const isLastToken = index === tokens.length - 1;

    if (isLineBreak || isSentenceEnd || (isClauseEnd && buffer.length >= 20) || isLongChunk || isEarlyChunk || isLastToken) {
      chunks.push(buffer);
      buffer = '';
    }
  });

  if (buffer) {
    chunks.push(buffer);
  }

  return chunks.length > 0 ? chunks : [text];
}

function getRevealDelay(chunk: string): number {
  const trimmed = chunk.trim();
  if (!trimmed) return 70;
  if (chunk.includes('\n')) return 170;
  if (/[.!?]$/.test(trimmed)) return 220;
  if (/[,;:]$/.test(trimmed)) return 150;
  return 95;
}

function renderInlineMarkdown(
  text: string,
  keyPrefix: string,
  onNavigate: NavigateFn,
): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([\s\S]*?)\]\(([^)]+)\))/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[0].startsWith('**')) {
      result.push(
        <strong key={`${keyPrefix}-strong-${match.index}`}>
          {renderInlineMarkdown(match[2], `${keyPrefix}-si-${match.index}`, onNavigate)}
        </strong>
      );
    } else if (match[0].startsWith('*')) {
      result.push(
        <em key={`${keyPrefix}-em-${match.index}`}>
          {renderInlineMarkdown(match[3], `${keyPrefix}-ei-${match.index}`, onNavigate)}
        </em>
      );
    } else {
      const href = match[5];
      const label = match[4];
      const isInternal = href.startsWith('/');
      const isChipLink = /^\/(collections|brands)\//.test(href);

      if (isInternal) {
        result.push(
          <button
            key={`${keyPrefix}-internal-${match.index}`}
            type="button"
            onClick={() => onNavigate(href)}
            className={
              isChipLink
                ? 'inline-flex items-center rounded-full border border-[#bfa68a]/35 text-[#bfa68a] text-[11px] px-2.5 py-0.5 mx-0.5 hover:border-[#bfa68a]/70 hover:text-[#ecddc8] hover:bg-[#bfa68a]/10 transition-colors'
                : 'text-[#bfa68a] underline underline-offset-2 hover:text-[#ecddc8] transition-colors'
            }
            style={isChipLink ? { verticalAlign: 'middle' } : undefined}
          >
            {label}
          </button>
        );
      } else {
        result.push(
          <a
            key={`${keyPrefix}-external-${match.index}`}
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="text-[#bfa68a] underline underline-offset-2 hover:text-[#ecddc8] transition-colors"
          >
            {label}
          </a>
        );
      }
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

function renderMarkdown(text: string, onNavigate: NavigateFn): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let listItems: { marker: string; content: string }[] = [];
  let listType: 'ordered' | 'unordered' | null = null;

  const flushList = () => {
    if (listItems.length === 0 || !listType) return;
    const listIndex = nodes.length;

    if (listType === 'ordered') {
      nodes.push(
        <ol key={`list-${listIndex}`} className="my-3 list-decimal space-y-2 pl-5">
          {listItems.map((item, idx) => (
            <li key={`item-${idx}`} className="pl-1">
              {renderInlineMarkdown(item.content, `list-${listIndex}-${idx}`, onNavigate)}
            </li>
          ))}
        </ol>
      );
    } else {
      nodes.push(
        <ul key={`list-${listIndex}`} className="my-3 space-y-2">
          {listItems.map((item, idx) => (
            <li key={`item-${idx}`} className="flex gap-2">
              <span className="text-[#bfa68a]/80">{item.marker}</span>
              <span>{renderInlineMarkdown(item.content, `list-${listIndex}-${idx}`, onNavigate)}</span>
            </li>
          ))}
        </ul>
      );
    }

    listItems = [];
    listType = null;
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();
    if (!trimmed) {
      flushList();
      return;
    }

    const orderedMatch = trimmed.match(/^(\d+)\.\s+(.+)$/);
    if (orderedMatch) {
      if (listType && listType !== 'ordered') flushList();
      listType = 'ordered';
      listItems.push({ marker: `${orderedMatch[1]}.`, content: orderedMatch[2] });
      return;
    }

    const unorderedMatch = trimmed.match(/^-\s+(.+)$/);
    if (unorderedMatch) {
      if (listType && listType !== 'unordered') flushList();
      listType = 'unordered';
      listItems.push({ marker: '-', content: unorderedMatch[1] });
      return;
    }

    flushList();
    nodes.push(
      <p key={`p-${idx}`} className={nodes.length > 0 ? 'mt-3' : ''}>
        {renderInlineMarkdown(trimmed, `p-${idx}`, onNavigate)}
      </p>
    );
  });

  flushList();
  return nodes;
}

function MarkdownMessage({ text }: { text: string }) {
  const router = useRouter();
  const { closeChat } = useChat();
  const handleNavigate = useCallback((href: string) => {
    closeChat();
    startTransition(() => {
      router.push(href);
    });
  }, [router, closeChat]);

  return <div>{renderMarkdown(text, handleNavigate)}</div>;
}

function WatchCardRow({ cards }: { cards: ChatWatchCard[] }) {
  return (
    <div className="mt-3 flex gap-3 overflow-x-auto pb-1">
      {cards.map(card => (
        <Link
          key={card.id}
          href={`/watches/${card.slug || card.id}`}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl border border-white/10 p-2.5 hover:border-[#bfa68a]/40 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', width: 100 }}
        >
          <div className="relative h-16 w-16 overflow-hidden rounded-lg bg-white/5">
            {card.imageUrl || card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl || imageTransformations.thumbnail(card.image!)}
                alt={card.name}
                className="h-full w-full object-contain"
              />
            ) : (
              <div className="flex h-full w-full items-center justify-center text-xs text-white/20">
                No image
              </div>
            )}
          </div>
          <p className="w-full line-clamp-2 text-center text-[10px] leading-tight text-[#ecddc8]/80">
            {card.name}
          </p>
          <p className="text-[10px] text-[#bfa68a]">
            {card.currentPrice === 0 ? 'PoR' : `$${card.currentPrice.toLocaleString()}`}
          </p>
        </Link>
      ))}
    </div>
  );
}

function ActionChips({
  actions,
  autoExecute = false,
  messageKey,
  onSendMessage,
}: {
  actions: ChatAction[];
  autoExecute?: boolean;
  messageKey: string;
  onSendMessage?: (text: string) => void;
}) {
  const router = useRouter();
  const { closeChat } = useChat();
  const { addToCompare, clearCompare } = useCompare();
  const { setCursor } = useCursor();
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});
  const autoExecutedRef = useRef<Set<string>>(new Set());

  const getActionKey = useCallback((action: ChatAction) => {
    if (action.type === 'compare') return `compare:${action.slugs?.join('|') ?? ''}`;
    if (action.type === 'search') return `search:${action.query ?? ''}`;
    if (action.type === 'navigate') return `navigate:${action.href ?? ''}`;
    if (action.type === 'suggest') return `suggest:${action.query ?? action.label ?? ''}`;
    return `set_cursor:${action.cursor ?? ''}`;
  }, []);

  const handleCompare = useCallback(async (action: ChatAction) => {
    const actionKey = getActionKey(action);
    if (!action.slugs?.length || actionStatus[actionKey] === 'loading') return;

    setActionStatus(prev => ({ ...prev, [actionKey]: 'loading' }));
    try {
      const watches = await Promise.all(action.slugs.map(slug => fetchWatchBySlug(slug)));
      clearCompare();
      watches.forEach(watch => addToCompare(watch));
      setActionStatus(prev => ({ ...prev, [actionKey]: 'idle' }));
      closeChat();
      router.push('/compare');
    } catch {
      setActionStatus(prev => ({ ...prev, [actionKey]: 'error' }));
    }
  }, [actionStatus, addToCompare, clearCompare, getActionKey, router]);

  const handleCursor = useCallback((action: ChatAction) => {
    if (!action.cursor) return;
    setCursor(action.cursor);
    setActionStatus(prev => ({ ...prev, [getActionKey(action)]: 'idle' }));
  }, [getActionKey, setCursor]);

  const executeAction = useCallback(async (action: ChatAction) => {
    if (action.type === 'compare') {
      await handleCompare(action);
      return;
    }

    if (action.type === 'set_cursor') {
      handleCursor(action);
    }
  }, [handleCompare, handleCursor]);

  useEffect(() => {
    if (!autoExecute) return;

    actions.forEach(action => {
      if (action.type !== 'set_cursor') return;

      const autoKey = `${messageKey}:${getActionKey(action)}`;
      if (autoExecutedRef.current.has(autoKey)) return;
      autoExecutedRef.current.add(autoKey);
      void executeAction(action);
    });
  }, [actions, autoExecute, executeAction, getActionKey, messageKey]);

  // Filter out set_cursor chips — they auto-execute and the message text confirms the change
  const visibleActions = actions.filter(a => a.type !== 'set_cursor');
  const suggestActions = visibleActions.filter(a => a.type === 'suggest');
  const actionItems = visibleActions.filter(a => a.type !== 'suggest');
  if (!visibleActions.length) return null;

  // Per-type icons
  const compareIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <path d="M16 3h5v5" /><path d="M8 3H3v5" /><path d="M12 22v-8.3a4 4 0 0 0-1.172-2.872L3 3" /><path d="m15 9 6-6" />
    </svg>
  );
  const searchIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <circle cx="11" cy="11" r="8" /><path d="m21 21-4.3-4.3" />
    </svg>
  );
  const exploreIcon = (
    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="flex-shrink-0">
      <circle cx="12" cy="12" r="10" /><polygon points="16.24 7.76 14.12 14.12 7.76 16.24 9.88 9.88 16.24 7.76" />
    </svg>
  );

  const chevron = (
    <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" className="flex-shrink-0 opacity-30">
      <path d="M9 18l6-6-6-6" />
    </svg>
  );

  // Primary actions: compare + search — amber-tinted, stronger border
  const primaryClass = "flex w-full items-center gap-3 rounded-xl border border-[#bfa68a]/20 px-3.5 py-2.5 text-left text-[12px] leading-snug text-[#ecddc8]/70 transition-all hover:border-[#bfa68a]/40 hover:text-[#ecddc8] hover:bg-[#bfa68a]/[0.06] group";
  const primaryStyle = { background: 'rgba(191,166,138,0.05)' };

  // Suggestion actions: navigate — lighter, subdued
  const suggestionClass = "flex w-full items-center gap-3 rounded-xl border border-white/[0.06] px-3.5 py-2 text-left text-[11.5px] leading-snug text-white/45 transition-all hover:border-white/15 hover:text-white/70 hover:bg-white/[0.03] group";
  const suggestionStyle = { background: 'rgba(255,255,255,0.02)' };

  return (
    <div className="mt-4 flex flex-col gap-1.5 border-t border-white/[0.06] pt-3">
      {actionItems.map((action, idx) => {
        const status = actionStatus[getActionKey(action)] ?? 'idle';
        const isPrimary = action.type === 'compare' || action.type === 'search';
        const chipClass = isPrimary ? primaryClass : suggestionClass;
        const chipStyle = isPrimary ? primaryStyle : suggestionStyle;

        if (action.type === 'search' && action.query) {
          const query = action.query;
          return (
            <button
              key={`${messageKey}-${idx}`}
              onClick={() => { closeChat(); router.push(`/smart-search?q=${encodeURIComponent(query)}`); }}
              className={chipClass}
              style={chipStyle}
            >
              <span className="text-[#bfa68a]/60 group-hover:text-[#bfa68a]">{searchIcon}</span>
              <span className="flex-1">{action.label}</span>
              {chevron}
            </button>
          );
        }

        if (action.type === 'compare' && action.slugs?.length) {
          return (
            <button
              key={`${messageKey}-${idx}`}
              onClick={() => void handleCompare(action)}
              disabled={status === 'loading'}
              className={`${chipClass} disabled:cursor-not-allowed disabled:opacity-40`}
              style={chipStyle}
            >
              <span className="text-[#bfa68a]/60 group-hover:text-[#bfa68a]">{compareIcon}</span>
              <span className="flex-1">{status === 'loading' ? 'Opening compare...' : status === 'error' ? 'Try again' : action.label}</span>
              {chevron}
            </button>
          );
        }

        if (action.type === 'navigate' && action.label) {
          return (
            <button
              key={`${messageKey}-${idx}`}
              onClick={() => { if (action.href) { closeChat(); router.push(action.href); } }}
              className={chipClass}
              style={chipStyle}
            >
              <span className="text-white/30 group-hover:text-white/50">{exploreIcon}</span>
              <span className="flex-1">{action.label}</span>
              {chevron}
            </button>
          );
        }

        return null;
      })}

      {suggestActions.length > 0 && (
        <div className={`flex flex-col gap-1.5 ${actionItems.length > 0 ? 'mt-2' : ''}`}>
          <p className="px-0.5 text-[10px] uppercase tracking-wider text-white/25">Try asking</p>
          {suggestActions.map((action, idx) => (
            <button
              key={`${messageKey}-suggest-${idx}`}
              onClick={() => onSendMessage?.(action.query ?? action.label)}
              className="w-full rounded-full border border-[#bfa68a]/20 px-4 py-2 text-center text-xs text-white/50 transition-colors hover:border-[#bfa68a]/50 hover:text-white/80"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {action.label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

function AssistantMessage({
  text,
  watchCards,
  actions,
  messageKey,
  animate,
  autoExecute,
  onSendMessage,
  onRevealProgress,
}: {
  text: string;
  watchCards?: ChatWatchCard[];
  actions?: ChatAction[];
  messageKey: string;
  animate: boolean;
  autoExecute: boolean;
  onSendMessage?: (text: string) => void;
  onRevealProgress?: () => void;
}) {
  const router = useRouter();
  const onNavigate = useCallback((href: string) => {
    startTransition(() => { router.push(href); });
  }, [router]);

  const [visibleText, setVisibleText] = useState(animate ? '' : text);
  const [isComplete, setIsComplete] = useState(!animate);
  const onRevealProgressRef = useRef(onRevealProgress);

  useEffect(() => {
    onRevealProgressRef.current = onRevealProgress;
  }, [onRevealProgress]);

  useEffect(() => {
    if (!animate) {
      setVisibleText(text);
      setIsComplete(true);
      return;
    }

    const chunks = splitRevealChunks(text);
    let chunkIndex = 0;
    let assembled = '';
    let timeoutId: ReturnType<typeof setTimeout> | undefined;

    setVisibleText('');
    setIsComplete(false);

    const revealNextChunk = () => {
      const nextChunk = chunks[chunkIndex];
      if (nextChunk === undefined) {
        setIsComplete(true);
        onRevealProgressRef.current?.();
        return;
      }

      assembled += nextChunk;
      chunkIndex += 1;
      setVisibleText(assembled);
      onRevealProgressRef.current?.();

      if (chunkIndex >= chunks.length) {
        setIsComplete(true);
        return;
      }

      timeoutId = setTimeout(revealNextChunk, getRevealDelay(nextChunk));
    };

    timeoutId = setTimeout(revealNextChunk, ASSISTANT_REVEAL_START_MS);

    return () => {
      if (timeoutId) clearTimeout(timeoutId);
    };
  }, [animate, text]);

  return (
    <>
      {isComplete ? (
        <MarkdownMessage text={text} />
      ) : (
        <div>
          {renderMarkdown(visibleText, onNavigate)}
          <span className="ml-0.5 inline-block h-[1em] w-px translate-y-[2px] animate-pulse bg-[#bfa68a]/70 align-middle" />
        </div>
      )}
      {isComplete && watchCards && watchCards.length > 0 && (
        <WatchCardRow cards={watchCards} />
      )}
      {isComplete && actions && actions.length > 0 && (
        <ActionChips
          actions={actions}
          messageKey={messageKey}
          autoExecute={autoExecute}
          onSendMessage={onSendMessage}
        />
      )}
    </>
  );
}

export default function ChatPanel() {
  const { messages, isLoading, dailyUsed, dailyLimit, sendMessage, clearSession } = useChat();
  const [input, setInput] = useState(() => {
    try { return sessionStorage.getItem('chat-draft') ?? ''; } catch { return ''; }
  });
  const [revealTick, setRevealTick] = useState(0);
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const mountTimeRef = useRef(Date.now());
  const submitLockRef = useRef(false);

  useEffect(() => {
    useCompare.persist.rehydrate();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading, revealTick]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
    try { sessionStorage.setItem('chat-draft', input); } catch { /* ignore */ }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading || submitLockRef.current) return;
    submitLockRef.current = true;
    setInput('');
    try { sessionStorage.removeItem('chat-draft'); } catch { /* ignore */ }
    try {
      await sendMessage(text);
    } finally {
      submitLockRef.current = false;
    }
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handlePromptClick = async (prompt: string) => {
    if (isLoading || submitLockRef.current) return;
    submitLockRef.current = true;
    setInput('');
    try {
      await sendMessage(prompt);
    } finally {
      submitLockRef.current = false;
    }
  };

  const showUsage = dailyLimit !== null && dailyUsed !== null;

  return (
    <div className="flex h-[calc(100vh-88px)] flex-col overflow-hidden">
      <div className="flex items-center justify-between px-8 pb-4">
        <p className="text-sm text-white/40">Ask about any watch or brand</p>
        {messages.length > 0 && (
          <button
            onClick={clearSession}
            className="text-xs text-white/30 transition-colors hover:text-white/60"
          >
            Clear
          </button>
        )}
      </div>

      <ScrollArea className="min-h-0 flex-1">
        <div className="space-y-4 px-6 py-2">
          {messages.length === 0 && (
            <div className="flex flex-col items-center justify-center gap-5 py-12">
              <svg
                width="32" height="32" viewBox="0 0 24 24" fill="none"
                stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
                className="text-[#bfa68a]/40"
              >
                <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
              </svg>
              <h3 className="font-playfair text-base text-[#ecddc8]/70">How can I help you?</h3>

              <div className="flex w-full max-w-xs flex-col items-center gap-2">
                {EXAMPLE_PROMPTS.map(prompt => (
                  <button
                    key={prompt}
                    onClick={() => void handlePromptClick(prompt)}
                    className="w-full rounded-full border border-[#bfa68a]/20 px-4 py-2 text-center text-xs text-white/50 transition-colors hover:border-[#bfa68a]/50 hover:text-white/80"
                    style={{ background: 'rgba(255,255,255,0.03)' }}
                  >
                    {prompt}
                  </button>
                ))}
              </div>
            </div>
          )}

          {messages.map((message, index) => (
            <div
              key={message.id ?? index}
              className={`flex ${message.role === 'user' ? 'justify-end' : 'justify-start'}`}
            >
              <div
                className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                  message.role === 'user'
                    ? 'rounded-br-md bg-[#bfa68a]/20 text-[#ecddc8]'
                    : 'rounded-bl-md text-white/80'
                }`}
                style={message.role === 'assistant' ? { background: 'rgba(255,255,255,0.05)' } : undefined}
              >
                {message.role === 'assistant' ? (
                  <AssistantMessage
                    text={message.content}
                    watchCards={message.watchCards}
                    actions={message.actions}
                    messageKey={message.id ?? `message-${index}`}
                    animate={
                      index === messages.length - 1
                      && (message.createdAt ?? 0) >= mountTimeRef.current
                    }
                    autoExecute={
                      index === messages.length - 1
                      && (message.createdAt ?? 0) >= mountTimeRef.current
                    }
                    onSendMessage={(text) => void handlePromptClick(text)}
                    onRevealProgress={() => setRevealTick((tick) => tick + 1)}
                  />
                ) : (
                  <MarkdownMessage text={message.content} />
                )}
              </div>
            </div>
          ))}

          {isLoading && (
            <div className="flex justify-start">
              <div
                className="rounded-2xl rounded-bl-md px-4 py-3 text-sm"
                style={{ background: 'rgba(255,255,255,0.05)' }}
              >
                <span className="flex items-center gap-1">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#bfa68a]/60" style={{ animationDelay: '0ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#bfa68a]/60" style={{ animationDelay: '150ms' }} />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-[#bfa68a]/60" style={{ animationDelay: '300ms' }} />
                </span>
              </div>
            </div>
          )}

          <div ref={bottomRef} />
        </div>
      </ScrollArea>

      {showUsage && (
        <div className="pb-2 text-center text-xs text-white/25">
          {dailyUsed} of {dailyLimit} messages today
        </div>
      )}

      <div
        className="border-t border-white/[0.08] px-6 py-5"
        style={{ background: '#1a1613' }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={event => setInput(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none overflow-hidden rounded-xl border border-white/10 bg-white/5 px-4 py-3 text-sm text-[#ecddc8] outline-none transition-colors placeholder:text-white/25 focus:border-white/20"
          />
          <button
            onClick={() => void handleSend()}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 rounded-full border border-[#bfa68a]/30 bg-[#bfa68a]/20 p-2.5 transition-opacity hover:bg-[#bfa68a]/30 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <svg
              width="16" height="16" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"
              className="text-[#bfa68a]"
            >
              <path d="M12 19V5M5 12l7-7 7 7" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
}
