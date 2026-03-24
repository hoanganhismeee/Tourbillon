// Contact advisor page — watch-specific inquiry (/contact?watchId=X) or general inquiry (/contact)
// Requires authentication; redirects to login if not signed in
'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Image from 'next/image';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'framer-motion';
import { fetchWatchById, submitContactInquiry } from '@/lib/api';
import { imageTransformations } from '@/lib/cloudinary';
import { useAuth } from '@/contexts/AuthContext';
import ScrollFade from '@/app/scrollMotion/ScrollFade';

export default function ContactPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const { isAuthenticated, loading: authLoading } = useAuth();

  const watchIdParam = searchParams.get('watchId');
  const watchId = watchIdParam ? parseInt(watchIdParam, 10) : null;

  const [message, setMessage] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch watch data if watchId is provided
  const { data: watch } = useQuery({
    queryKey: ['watch', watchId],
    queryFn: () => fetchWatchById(watchId!),
    enabled: watchId !== null && !isNaN(watchId),
  });

  // Auth gate — redirect to login after auth loading completes
  useEffect(() => {
    if (authLoading) return;
    if (!isAuthenticated) {
      const redirect = watchId
        ? `/contact?watchId=${watchId}`
        : '/contact';
      router.replace(`/login?redirect=${encodeURIComponent(redirect)}`);
    }
  }, [isAuthenticated, authLoading, watchId, router]);

  const handleSubmit = async () => {
    if (!message.trim()) {
      setError('Please enter a message.');
      return;
    }

    setSubmitting(true);
    setError(null);

    try {
      await submitContactInquiry({
        watchId: watchId ?? undefined,
        message: message.trim(),
      });
      setSubmitted(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send inquiry');
    } finally {
      setSubmitting(false);
    }
  };

  // Show nothing while checking auth
  if (authLoading || !isAuthenticated) {
    return (
      <div className="min-h-screen bg-black text-white flex items-center justify-center">
        <div className="animate-spin h-8 w-8 border-2 border-[#bfa68a] border-t-transparent rounded-full" />
      </div>
    );
  }

  return (
    <ScrollFade>
      <div className="min-h-screen bg-black text-white pt-32 pb-20 px-6 lg:px-16">
        <div className="max-w-2xl mx-auto">
          <AnimatePresence mode="wait">
            {submitted ? (
              /* Success state */
              <motion.div
                key="success"
                initial={{ opacity: 0, y: 20 }}
                animate={{ opacity: 1, y: 0 }}
                className="text-center py-16"
              >
                <motion.div
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  transition={{ type: 'spring', stiffness: 200, damping: 15 }}
                  className="w-20 h-20 rounded-full border-2 border-[#bfa68a] flex items-center justify-center mx-auto mb-6"
                >
                  <svg width="32" height="32" viewBox="0 0 24 24" fill="none">
                    <path d="M5 13L9 17L19 7" stroke="#bfa68a" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round"/>
                  </svg>
                </motion.div>
                <h1 className="text-3xl font-playfair font-bold text-[#f0e6d2] mb-3">Inquiry Sent</h1>
                <p className="text-white/60 mb-2">
                  Your message has been received. Check your email for a confirmation.
                </p>
                <p className="text-white/40 text-sm mb-10">
                  Our advisor team typically responds within 24-48 hours.
                </p>
                <button
                  onClick={() => router.back()}
                  className="py-3 px-8 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition"
                >
                  Back to Browsing
                </button>
              </motion.div>
            ) : (
              /* Form state */
              <motion.div key="form" initial={{ opacity: 0 }} animate={{ opacity: 1 }}>
                <h1 className="text-4xl font-playfair font-bold text-[#f0e6d2] mb-2">
                  {watch ? 'Contact an Advisor' : 'Contact Us'}
                </h1>
                {watch && (
                  <p className="text-white/50 mb-8">
                    Inquire about {watch.description || watch.name}
                  </p>
                )}
                {!watch && (
                  <p className="text-white/50 mb-8">
                    How can we help you?
                  </p>
                )}

                {/* Watch card preview */}
                {watch && (
                  <div className="flex gap-5 p-5 rounded-2xl border border-white/10 bg-white/[0.02] mb-8">
                    <div className="w-24 h-24 rounded-xl overflow-hidden bg-white/5 shrink-0">
                      {watch.image && (
                        <Image
                          src={imageTransformations.thumbnail(watch.image)}
                          alt={watch.name}
                          width={96} height={96}
                          className="w-full h-full object-cover"
                          unoptimized
                        />
                      )}
                    </div>
                    <div>
                      <p className="text-xs uppercase tracking-widest text-white/40 mb-1">
                        {watch.description?.split(' ')[0] || 'Watch'}
                      </p>
                      <h3 className="font-semibold text-white">{watch.description || watch.name}</h3>
                      <p className="text-xs text-white/40 mt-0.5">{watch.name}</p>
                      <p className="text-[#bfa68a] font-semibold mt-2">
                        {watch.currentPrice > 0
                          ? `$${watch.currentPrice.toLocaleString('en-US', { minimumFractionDigits: 2 })}`
                          : 'Price on Request'}
                      </p>
                    </div>
                  </div>
                )}

                {/* Message textarea */}
                <div className="mb-6">
                  <label className="block text-sm text-white/60 mb-2">Your Message</label>
                  <textarea
                    value={message}
                    onChange={e => setMessage(e.target.value)}
                    maxLength={2000}
                    rows={6}
                    placeholder={watch
                      ? 'Tell us about your interest in this timepiece...'
                      : 'How can we help you?'}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white placeholder:text-white/30 focus:outline-none focus:border-[#bfa68a]/50 transition resize-none"
                  />
                  <p className="text-xs text-white/30 text-right mt-1">{message.length}/2000</p>
                </div>

                {error && (
                  <div className="mb-6 p-4 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm">
                    {error}
                  </div>
                )}

                <motion.button
                  whileTap={{ scale: 0.97 }}
                  onClick={handleSubmit}
                  disabled={submitting || !message.trim()}
                  className="py-4 px-10 rounded-xl font-semibold bg-[#bfa68a] text-black hover:bg-[#d4c4a8] transition disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {submitting ? 'Sending...' : 'Send Inquiry'}
                </motion.button>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>
    </ScrollFade>
  );
}
