// Chat panel — full interactive implementation of the concierge chat interface.
// Renders message bubbles, markdown, watch thumbnail cards, and example prompt chips.
'use client';

import { useEffect, useRef, useState, KeyboardEvent } from 'react';
import { useChat } from '@/contexts/ChatContext';
import { imageTransformations } from '@/lib/cloudinary';
import type { ChatWatchCard } from '@/lib/api';

const EXAMPLE_PROMPTS = [
  'Compare the Aquanaut and the Overseas',
  'Tell me about Vacheron Constantin',
  'As a girl, should I wear round or square dial',
];

// Simple markdown renderer — handles bold, italic, links, and line breaks
function renderMarkdown(text: string): React.ReactNode[] {
  // Split on newlines first
  const lines = text.split('\n');
  const result: React.ReactNode[] = [];

  lines.forEach((line, lineIdx) => {
    if (lineIdx > 0) result.push(<br key={`br-${lineIdx}`} />);

    // Process inline patterns: **bold**, *italic*, [text](url)
    const parts: React.ReactNode[] = [];
    const pattern = /(\*\*([^*]+)\*\*|\*([^*]+)\*|\[([^\]]+)\]\(([^)]+)\))/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;

    while ((match = pattern.exec(line)) !== null) {
      // Text before this match
      if (match.index > lastIndex) {
        parts.push(line.slice(lastIndex, match.index));
      }

      if (match[0].startsWith('**')) {
        parts.push(<strong key={match.index}>{match[2]}</strong>);
      } else if (match[0].startsWith('*')) {
        parts.push(<em key={match.index}>{match[3]}</em>);
      } else {
        // Link — internal links use Next router, external open in new tab
        const href = match[5];
        const isInternal = href.startsWith('/');
        parts.push(
          <a
            key={match.index}
            href={href}
            target={isInternal ? undefined : '_blank'}
            rel={isInternal ? undefined : 'noopener noreferrer'}
            className="text-[#bfa68a] underline underline-offset-2 hover:text-[#ecddc8] transition-colors"
          >
            {match[4]}
          </a>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    // Remaining text after last match
    if (lastIndex < line.length) {
      parts.push(line.slice(lastIndex));
    }

    result.push(...parts);
  });

  return result;
}

// Compact watch card shown below assistant messages
function WatchCardRow({ cards }: { cards: ChatWatchCard[] }) {
  return (
    <div className="flex gap-3 mt-3 overflow-x-auto pb-1">
      {cards.map(card => (
        <a
          key={card.id}
          href={`/watches/${card.id}`}
          className="flex-shrink-0 flex flex-col items-center gap-1.5 rounded-xl border border-white/10 p-2.5 hover:border-[#bfa68a]/40 transition-colors"
          style={{ background: 'rgba(255,255,255,0.04)', width: 100 }}
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
            {card.description || card.name}
          </p>
          <p className="text-[#bfa68a] text-[10px]">
            {card.currentPrice === 0 ? 'PoR' : `$${card.currentPrice.toLocaleString()}`}
          </p>
        </a>
      ))}
    </div>
  );
}

export default function ChatPanel() {
  const { messages, isLoading, dailyUsed, dailyLimit, sendMessage, clearSession } = useChat();
  const [input, setInput] = useState('');
  const bottomRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Auto-scroll to bottom on new message
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, isLoading]);

  // Auto-resize textarea
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
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 88px)' }}>

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
      <div className="flex-1 overflow-y-auto px-6 py-2 space-y-4">

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

            {/* Clickable example prompt chips */}
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
              <div>{renderMarkdown(msg.content)}</div>
              {msg.watchCards && msg.watchCards.length > 0 && (
                <WatchCardRow cards={msg.watchCards} />
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
            className="flex-1 resize-none bg-white/5 rounded-xl border border-white/10 text-[#ecddc8] text-sm px-4 py-3 placeholder-white/25 outline-none focus:border-white/20 transition-colors max-h-32 overflow-y-auto"
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
