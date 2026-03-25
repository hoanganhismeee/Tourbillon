// Chat panel content — layout shell for the concierge chat interface.
// Renders subtitle, empty message area with example prompts, and input bar.
'use client';

const EXAMPLE_PROMPTS = [
  'Compare the Aquanaut and the Overseas',
  'Tell me about Vacheron Constantin',
];

export default function ChatPanel() {
  return (
    // min-height fills the remaining panel space below the SlidingPanel header (~88px)
    <div className="flex flex-col" style={{ minHeight: 'calc(100vh - 88px)' }}>

      {/* Subtitle */}
      <p className="text-white/40 text-sm px-8 pb-6">
        Ask about any watch or brand
      </p>

      {/* Message area — empty state, centered */}
      <div className="flex-1 flex flex-col items-center justify-center gap-5 px-8 py-12">
        <svg
          width="32" height="32" viewBox="0 0 24 24" fill="none"
          stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
          className="text-[#bfa68a]/40"
        >
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
        </svg>

        <h3 className="text-[#ecddc8]/70 text-base font-playfair">
          How can I help you?
        </h3>

        {/* Non-interactive example prompt chips */}
        <div className="flex flex-col items-center gap-2 w-full max-w-xs">
          {EXAMPLE_PROMPTS.map((prompt) => (
            <div
              key={prompt}
              className="rounded-full border border-[#bfa68a]/20 text-white/50 text-xs px-4 py-2 text-center"
              style={{ background: 'rgba(255,255,255,0.03)' }}
            >
              {prompt}
            </div>
          ))}
        </div>
      </div>

      {/* Input area — pinned at bottom of flex column */}
      <div
        className="border-t border-white/[0.08] px-6 py-5"
        style={{ background: '#1a1613' }}
      >
        <div className="flex items-end gap-3">
          <textarea
            placeholder="Ask anything..."
            rows={1}
            className="flex-1 resize-none bg-white/5 rounded-xl border border-white/10 text-[#ecddc8] text-sm px-4 py-3 placeholder-white/25 outline-none focus:border-white/20 transition-colors"
          />
          {/* Send button — disabled in shell, no backend yet */}
          <button
            disabled
            className="opacity-50 cursor-not-allowed flex-shrink-0 bg-[#bfa68a]/20 border border-[#bfa68a]/30 rounded-full p-2.5"
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
