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
  'Tell me about Vacheron Constantin',
  'As a girl, should I wear round or square dial',
];

type NavigateFn = (href: string) => void;
type ActionStatus = 'idle' | 'loading' | 'error';

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
      result.push(<strong key={`${keyPrefix}-strong-${match.index}`}>{match[2]}</strong>);
    } else if (match[0].startsWith('*')) {
      result.push(<em key={`${keyPrefix}-em-${match.index}`}>{match[3]}</em>);
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
  const handleNavigate = useCallback((href: string) => {
    startTransition(() => {
      router.push(href);
    });
  }, [router]);

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
}: {
  actions: ChatAction[];
  autoExecute?: boolean;
  messageKey: string;
}) {
  const router = useRouter();
  const { addToCompare, clearCompare } = useCompare();
  const { setCursor } = useCursor();
  const [actionStatus, setActionStatus] = useState<Record<string, ActionStatus>>({});
  const autoExecutedRef = useRef<Set<string>>(new Set());

  const getActionKey = useCallback((action: ChatAction) => {
    if (action.type === 'compare') return `compare:${action.slugs?.join('|') ?? ''}`;
    if (action.type === 'search') return `search:${action.query ?? ''}`;
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
      if (action.type !== 'compare' && action.type !== 'set_cursor') return;

      const autoKey = `${messageKey}:${getActionKey(action)}`;
      if (autoExecutedRef.current.has(autoKey)) return;
      autoExecutedRef.current.add(autoKey);
      void executeAction(action);
    });
  }, [actions, autoExecute, executeAction, getActionKey, messageKey]);

  if (!actions.length) return null;

  return (
    <div className="mt-3 flex flex-wrap gap-2">
      {actions.map((action, idx) => {
        const status = actionStatus[getActionKey(action)] ?? 'idle';

        if (action.type === 'search' && action.query) {
          const query = action.query;
          return (
            <button
              key={`${messageKey}-${idx}`}
              onClick={() => router.push(`/smart-search?q=${encodeURIComponent(query)}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#bfa68a]/30 px-3 py-1.5 text-[11px] text-[#bfa68a] transition-colors hover:border-[#bfa68a]/60 hover:bg-[#bfa68a]/10 hover:text-[#ecddc8]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              {action.label}
            </button>
          );
        }

        if (action.type === 'compare' && action.slugs?.length) {
          return (
            <button
              key={`${messageKey}-${idx}`}
              onClick={() => void handleCompare(action)}
              disabled={status === 'loading'}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#bfa68a]/30 px-3 py-1.5 text-[11px] text-[#bfa68a] transition-colors hover:border-[#bfa68a]/60 hover:bg-[#bfa68a]/10 hover:text-[#ecddc8] disabled:cursor-not-allowed disabled:opacity-50"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>
              {status === 'loading' ? 'Opening compare...' : status === 'error' ? 'Retry compare' : action.label}
            </button>
          );
        }

        if (action.type === 'set_cursor' && action.cursor) {
          return (
            <button
              key={`${messageKey}-${idx}`}
              onClick={() => handleCursor(action)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#bfa68a]/30 px-3 py-1.5 text-[11px] text-[#bfa68a] transition-colors hover:border-[#bfa68a]/60 hover:bg-[#bfa68a]/10 hover:text-[#ecddc8]"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <path d="M5 5l14 7-14 7 3-7-3-7Z" />
              </svg>
              {action.label}
            </button>
          );
        }

        return null;
      })}
    </div>
  );
}

export default function ChatPanel() {
  const { messages, isLoading, dailyUsed, dailyLimit, sendMessage, clearSession } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);
  const initialMessageCountRef = useRef(messages.length);

  useEffect(() => {
    useCompare.persist.rehydrate();
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  useEffect(() => {
    if (textareaRef.current) {
      textareaRef.current.style.height = 'auto';
      textareaRef.current.style.height = `${textareaRef.current.scrollHeight}px`;
    }
  }, [input]);

  const handleSend = async () => {
    const text = input.trim();
    if (!text || isLoading) return;
    setInput('');
    await sendMessage(text);
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      void handleSend();
    }
  };

  const handlePromptClick = async (prompt: string) => {
    setInput('');
    await sendMessage(prompt);
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
              key={index}
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
                <MarkdownMessage text={message.content} />
                {message.watchCards && message.watchCards.length > 0 && (
                  <WatchCardRow cards={message.watchCards} />
                )}
                {message.actions && message.actions.length > 0 && (
                  <ActionChips
                    actions={message.actions}
                    messageKey={`message-${index}`}
                    autoExecute={message.role === 'assistant' && index === messages.length - 1 && index >= initialMessageCountRef.current}
                  />
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
