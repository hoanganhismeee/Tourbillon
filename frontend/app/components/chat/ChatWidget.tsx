// Floating chat concierge pill button + SlidingPanel host.
// Warm amber glass pill at bottom-8 right-8 — sits below the compare pill at bottom-24.
'use client';

import { motion } from 'framer-motion';
import SlidingPanel from '@/app/components/appointment/SlidingPanel';
import ChatPanel from './ChatPanel';
import { useChat } from '@/contexts/ChatContext';

export default function ChatWidget() {
  const { isOpen, openChat, closeChat } = useChat();

  return (
    <>
      {/* Floating pill */}
      <div className="fixed bottom-4 right-4 sm:bottom-8 sm:right-8 z-40 select-none">
        <motion.button
          initial={{ opacity: 0, scale: 0.8, y: 10 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          whileHover={{ scale: 1.04 }}
          whileTap={{ scale: 0.97 }}
          onClick={openChat}
          className="flex items-center gap-3 px-5 py-3.5 rounded-2xl border border-[#bfa68a]/50 shadow-xl shadow-black/40 cursor-pointer"
          style={{
            background: 'rgba(191,166,138,0.18)',
            backdropFilter: 'blur(20px)',
            WebkitBackdropFilter: 'blur(20px)',
          }}
        >
          {/* Chat bubble icon */}
          <svg
            width="18" height="18" viewBox="0 0 24 24" fill="none"
            stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"
            className="text-[#bfa68a]"
          >
            <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" />
          </svg>

          <span className="text-[#ecddc8] text-sm font-medium tracking-wide font-inter">
            Concierge
          </span>
        </motion.button>
      </div>

      {/* Sliding panel */}
      <SlidingPanel
        isOpen={isOpen}
        onClose={closeChat}
        title="Chat Concierge"
        maxWidth={624}
      >
        <ChatPanel />
      </SlidingPanel>
    </>
  );
}
