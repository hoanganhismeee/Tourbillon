// Chat panel — full interactive implementation of the concierge chat interface.
// Renders message bubbles, markdown, watch thumbnail cards, action chips, and example prompts.
'use client';

import Link from 'next/link';
import { useEffect, useRef, useState, KeyboardEvent, useCallback, ReactNode } from 'react';
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

interface MarkdownCursorHandlers {
  onEnter: () => void;
  onLeave: () => void;
}

// Simple markdown renderer — handles bold, italic, links, and line breaks across the whole message
function renderInlineMarkdown(
  text: string,
  cursorHandlers: MarkdownCursorHandlers,
  keyPrefix: string,
): ReactNode[] {
  const result: ReactNode[] = [];
  const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([\s\S]*?)\]\(([^)]+)\)|\n)/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = pattern.exec(text)) !== null) {
    if (match.index > lastIndex) {
      result.push(text.slice(lastIndex, match.index));
    }

    if (match[0] === '\n') {
      result.push(<br key={`${keyPrefix}-br-${match.index}`} />);
    } else if (match[0].startsWith('**')) {
      result.push(<strong key={`${keyPrefix}-strong-${match.index}`}>{match[2]}</strong>);
    } else if (match[0].startsWith('*')) {
      result.push(<em key={`${keyPrefix}-em-${match.index}`}>{match[3]}</em>);
    } else {
      const href = match[5];
      const label = match[4];
      const isInternal = href.startsWith('/');
      const isChipLink = /^\/(collections|brands)\//.test(href);
      result.push(
        isChipLink ? (
          <Link
            key={`${keyPrefix}-chip-${match.index}`}
            href={href}
            onMouseEnter={cursorHandlers.onEnter}
            onMouseLeave={cursorHandlers.onLeave}
            className="inline-flex items-center rounded-full border border-[#bfa68a]/35 text-[#bfa68a] text-[11px] px-2.5 py-0.5 mx-0.5 hover:border-[#bfa68a]/70 hover:text-[#ecddc8] hover:bg-[#bfa68a]/10 transition-colors"
            style={{ verticalAlign: 'middle' }}
          >
            {label}
          </Link>
        ) : (
          <a
            key={`${keyPrefix}-link-${match.index}`}
            href={href}
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noopener noreferrer'}
            onMouseEnter={cursorHandlers.onEnter}
            onMouseLeave={cursorHandlers.onLeave}
            className="text-[#bfa68a] underline underline-offset-2 hover:text-[#ecddc8] transition-colors"
          >
            {label}
          </a>
        )
      );
    }

    lastIndex = match.index + match[0].length;
  }

  if (lastIndex < text.length) {
    result.push(text.slice(lastIndex));
  }

  return result;
}

function renderMarkdown(text: string, cursorHandlers: MarkdownCursorHandlers): ReactNode[] {
  const lines = text.replace(/\r\n/g, '\n').split('\n');
  const nodes: ReactNode[] = [];
  let listItems: string[] = [];

  const flushList = () => {
    if (listItems.length === 0) return;
    const listIndex = nodes.length;
    nodes.push(
      <ul key={`list-${listIndex}`} className="my-3 space-y-2">
        {listItems.map((item, idx) => (
          <li key={`item-${idx}`} className="flex gap-2">
            <span className="text-[#bfa68a]/80">-</span>
            <span>{renderInlineMarkdown(item, cursorHandlers, `list-${listIndex}-${idx}`)}</span>
          </li>
        ))}
      </ul>
    );
    listItems = [];
  };

  lines.forEach((line, idx) => {
    const trimmed = line.trim();

    if (!trimmed) {
      flushList();
      return;
    }

    if (trimmed.startsWith('- ')) {
      listItems.push(trimmed.slice(2));
      return;
    }

    flushList();
    nodes.push(
      <p key={`p-${idx}`} className={nodes.length > 0 ? 'mt-3' : ''}>
        {renderInlineMarkdown(trimmed, cursorHandlers, `p-${idx}`)}
      </p>
    );
  });

  flushList();
  return nodes;
}

// Compact watch card shown below assistant messages — switches cursor to tourbillon on hover
function WatchCardRow({ cards }: { cards: ChatWatchCard[] }) {
  const { setCursor } = useCursor();
  return (
    <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
      {cards.map(card => (
        <a
          key={card.id}
          href={`/watches/${card.slug || card.id}`}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl border border-white/10 p-2.5 hover:border-[#bfa68a]/40 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', width: 100 }}
          onMouseEnter={() => setCursor('tourbillon')}
          onMouseLeave={() => setCursor('default')}
        >
          <div className="w-16 h-16 relative overflow-hidden rounded-lg bg-white/5">
            {card.imageUrl || card.image ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={card.imageUrl || imageTransformations.thumbnail(card.image!)}
                alt={card.name}
                className="w-full h-full object-contain"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-white/20 text-xs">
                No image
              </div>
            )}
          </div>
          <p className="text-[#ecddc8]/80 text-[10px] text-center leading-tight line-clamp-2 w-full">
            {card.name}
          </p>
          <p className="text-[#bfa68a] text-[10px]">
            {card.currentPrice === 0 ? 'PoR' : `$${card.currentPrice.toLocaleString()}`}
          </p>
        </a>
      ))}
    </div>
  );
}

// Action chips rendered below assistant messages — compare and smart-search actions
function ActionChips({ actions, autoExecute = false }: { actions: ChatAction[]; autoExecute?: boolean }) {
  const router = useRouter();
  const { addToCompare, clearCompare } = useCompare();
  const [compareStatus, setCompareStatus] = useState<Record<number, 'idle' | 'adding' | 'done'>>({});

  const handleCompare = useCallback(async (action: ChatAction, idx: number) => {
    if (!action.slugs?.length || compareStatus[idx] !== 'idle') return;
    setCompareStatus(prev => ({ ...prev, [idx]: 'adding' }));
    try {
      const watches = await Promise.all(action.slugs.map(slug => fetchWatchBySlug(slug)));
      clearCompare();
      watches.forEach(w => addToCompare(w));
      setCompareStatus(prev => ({ ...prev, [idx]: 'done' }));
      router.push('/compare');
    } catch {
      setCompareStatus(prev => ({ ...prev, [idx]: 'idle' }));
    }
  }, [addToCompare, clearCompare, compareStatus, router]);

  useEffect(() => {
    if (!autoExecute) return;

    const firstCompareIdx = actions.findIndex(action => action.type === 'compare' && !!action.slugs?.length);
    if (firstCompareIdx === -1) return;

    void handleCompare(actions[firstCompareIdx], firstCompareIdx);
  }, [actions, autoExecute, handleCompare]);

  if (!actions.length) return null;

  return (
    <div className="flex flex-wrap gap-2 mt-3">
      {actions.map((action, idx) => {
        if (action.type === 'search' && action.query) {
          return (
            <button
              key={idx}
              onClick={() => router.push(`/smart-search?q=${encodeURIComponent(action.query!)}`)}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#bfa68a]/30 text-[#bfa68a] text-[11px] px-3 py-1.5 hover:border-[#bfa68a]/60 hover:text-[#ecddc8] hover:bg-[#bfa68a]/10 transition-colors"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <circle cx="11" cy="11" r="8" /><path d="m21 21-4.35-4.35" />
              </svg>
              {action.label}
            </button>
          );
        }

        if (action.type === 'compare' && action.slugs?.length) {
          const status = compareStatus[idx] ?? 'idle';
          return (
            <button
              key={idx}
              onClick={() => handleCompare(action, idx)}
              disabled={status !== 'idle'}
              className="inline-flex items-center gap-1.5 rounded-full border border-[#bfa68a]/30 text-[#bfa68a] text-[11px] px-3 py-1.5 hover:border-[#bfa68a]/60 hover:text-[#ecddc8] hover:bg-[#bfa68a]/10 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                <rect x="3" y="3" width="7" height="18" rx="1" /><rect x="14" y="3" width="7" height="18" rx="1" />
              </svg>
              {status === 'adding' ? 'Opening compare…' : status === 'done' ? 'Compare ready' : action.label}
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
  const { setCursor } = useCursor();
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

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  const handlePromptClick = async (prompt: string) => {
    setInput('');
    await sendMessage(prompt);
  };

  const showUsage = dailyLimit !== null && dailyUsed !== null;

  return (
    <div className="flex h-[calc(100vh-88px)] flex-col overflow-hidden">

      {/* Subtitle + clear button row */}
      <div className="flex items-center justify-between px-8 pb-4">
        <p className="text-white/40 text-sm">Ask about any watch or brand</p>
        {messages.length > 0 && (
          <button
            onClick={clearSession}
            className="text-white/30 text-xs hover:text-white/60 transition-colors"
          >
            Clear
          </button>
        )}
      </div>

      {/* Message area */}
      <ScrollArea className="min-h-0 flex-1">
      <div className="px-6 py-2 space-y-4">

        {/* Empty state */}
        {messages.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-5 py-12">
            <svg
              width="32" height="32" viewBox="0 0 24 24" fill="none"
              stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
              className="text-[#bfa68a]/40"
            >
              <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
            </svg>
            <h3 className="text-[#ecddc8]/70 text-base font-playfair">How can I help you?</h3>

            <div className="flex flex-col items-center gap-2 w-full max-w-xs">
              {EXAMPLE_PROMPTS.map((prompt) => (
                <button
                  key={prompt}
                  onClick={() => handlePromptClick(prompt)}
                  className="rounded-full border border-[#bfa68a]/20 text-white/50 text-xs px-4 py-2 text-center w-full hover:border-[#bfa68a]/50 hover:text-white/80 transition-colors cursor-pointer"
                  style={{ background: 'rgba(255,255,255,0.03)' }}
                >
                  {prompt}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Conversation messages */}
        {messages.map((msg, i) => (
          <div
            key={i}
            className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
                msg.role === 'user'
                  ? 'bg-[#bfa68a]/20 text-[#ecddc8] rounded-br-md'
                  : 'text-white/80 rounded-bl-md'
              }`}
              style={msg.role === 'assistant' ? { background: 'rgba(255,255,255,0.05)' } : undefined}
            >
              <div>{renderMarkdown(msg.content, {
                onEnter: () => setCursor('tourbillon'),
                onLeave: () => setCursor('default'),
              })}</div>
              {msg.watchCards && msg.watchCards.length > 0 && (
                <WatchCardRow cards={msg.watchCards} />
              )}
              {msg.actions && msg.actions.length > 0 && (
                <ActionChips
                  actions={msg.actions}
                  autoExecute={msg.role === 'assistant' && i === messages.length - 1 && i >= initialMessageCountRef.current}
                />
              )}
            </div>
          </div>
        ))}

        {/* Loading indicator */}
        {isLoading && (
          <div className="flex justify-start">
            <div
              className="rounded-2xl rounded-bl-md px-4 py-3 text-sm"
              style={{ background: 'rgba(255,255,255,0.05)' }}
            >
              <span className="flex gap-1 items-center">
                <span className="w-1.5 h-1.5 rounded-full bg-[#bfa68a]/60 animate-bounce" style={{ animationDelay: '0ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#bfa68a]/60 animate-bounce" style={{ animationDelay: '150ms' }} />
                <span className="w-1.5 h-1.5 rounded-full bg-[#bfa68a]/60 animate-bounce" style={{ animationDelay: '300ms' }} />
              </span>
            </div>
          </div>
        )}

        <div ref={bottomRef} />
      </div>
      </ScrollArea>

      {/* Usage counter */}
      {showUsage && (
        <div className="text-center text-white/25 text-xs pb-2">
          {dailyUsed} of {dailyLimit} messages today
        </div>
      )}

      {/* Input area */}
      <div
        className="border-t border-white/[0.08] px-6 py-5"
        style={{ background: '#1a1613' }}
      >
        <div className="flex items-end gap-3">
          <textarea
            ref={textareaRef}
            value={input}
            onChange={e => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none bg-white/5 rounded-xl border border-white/10 text-[#ecddc8] text-sm px-4 py-3 placeholder-white/25 outline-none focus:border-white/20 transition-colors overflow-hidden"
          />
          <button
            onClick={handleSend}
            disabled={isLoading || !input.trim()}
            className="flex-shrink-0 bg-[#bfa68a]/20 border border-[#bfa68a]/30 rounded-full p-2.5 transition-opacity disabled:opacity-40 hover:bg-[#bfa68a]/30 cursor-pointer disabled:cursor-not-allowed"
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
