// Client island: shows a personalisation CTA to anonymous visitors.
// Returns null for authenticated users — no flash, no layout shift.
'use client';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

export default function TasteCTA() {
  const { isAuthenticated } = useAuth();

  if (isAuthenticated) return null;

  return (
    <p className="mt-4 text-sm text-[var(--primary-brown)]/70">
      <Link
        href="/login"
        className="underline underline-offset-2 hover:text-[var(--primary-brown)] transition-colors"
      >
        Sign in
      </Link>
      {' '}to personalise your watch feed
    </p>
  );
}
