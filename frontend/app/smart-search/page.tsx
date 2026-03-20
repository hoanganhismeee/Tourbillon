// Server component wrapper — wraps SmartSearchClient in Suspense for useSearchParams
import { Suspense } from 'react';
import SmartSearchClient from './SmartSearchClient';

export default function SmartSearchPage() {
  return (
    <Suspense fallback={
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white/30" />
      </div>
    }>
      <SmartSearchClient />
    </Suspense>
  );
}
