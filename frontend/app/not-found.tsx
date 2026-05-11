// Custom 404 page — shown for any unmatched route in the app.
import Link from 'next/link';

export default function NotFound() {
  return (
    <div className="min-h-[60vh] flex flex-col items-center justify-center px-4 text-center">
      <p className="text-[9px] uppercase tracking-[0.5em] text-[#bfa68a] mb-4">404</p>
      <h1 className="font-playfair text-[2.5rem] sm:text-[3.5rem] font-light text-[#f0e6d2] leading-tight mb-4">
        Page not found
      </h1>
      <p className="text-white/40 text-sm leading-relaxed mb-8 max-w-xs">
        The page you are looking for does not exist or has been moved.
      </p>
      <Link
        href="/watches"
        className="inline-block py-3 px-8 text-[9.5px] uppercase tracking-[0.32em] font-medium text-[#1e1206] transition-all duration-500"
        style={{
          background: 'linear-gradient(105deg, #bfa68a 0%, #d4b898 50%, #bfa68a 100%)',
          backgroundSize: '200% 100%',
        }}
      >
        Browse Watches
      </Link>
    </div>
  );
}
