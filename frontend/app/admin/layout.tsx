'use client';

import { useEffect } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { useAuth } from '@/contexts/AuthContext';

const NAV = [
  {
    group: 'Content',
    items: [
      { href: '/admin/watches', label: 'Watches' },
      { href: '/admin/collections', label: 'Collections' },
      { href: '/admin/brands', label: 'Brands' },
    ],
  },
  {
    group: 'Media',
    items: [{ href: '/admin/media', label: 'Media Library' }],
  },
  {
    group: 'Publishing',
    items: [
      { href: '/admin/editorial', label: 'Editorial' },
      { href: '/admin/scraping', label: 'Scraping' },
    ],
  },
  {
    group: 'System',
    items: [{ href: '/admin/system', label: 'System' }],
  },
];

export default function AdminLayout({ children }: { children: React.ReactNode }) {
  const { isAdmin, loading, user } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !isAdmin) router.replace('/');
  }, [loading, isAdmin, router]);

  if (loading || !isAdmin) return null;

  return (
    <div className="flex min-h-screen bg-[#0a0a0a]">
      <aside className="w-[180px] flex-shrink-0 border-r border-[#1e1e1e] flex flex-col bg-[#0d0d0d]">
        <div className="px-4 py-4 border-b border-[#1a1a1a]">
          <div className="text-[#c9a96e] text-[9px] tracking-[3px] uppercase">Tourbillon</div>
          <div className="text-[#444] text-[8px] mt-0.5">Admin Console</div>
        </div>

        <nav className="flex-1 overflow-y-auto py-2">
          {NAV.map(({ group, items }) => (
            <div key={group} className="mt-3">
              <div className="px-4 pb-1 text-[#333] text-[8px] tracking-[2px] uppercase">{group}</div>
              {items.map(({ href, label }) => {
                const active = pathname === href || pathname.startsWith(href + '/');
                return (
                  <Link
                    key={href}
                    href={href}
                    className={`block px-4 py-1.5 text-[10px] transition-colors ${
                      active
                        ? 'border-l-2 border-[#c9a96e] bg-[#161616] text-[#c9a96e]'
                        : 'text-[#555] hover:text-[#888]'
                    }`}
                  >
                    {label}
                  </Link>
                );
              })}
            </div>
          ))}
        </nav>

        <div className="px-4 py-3 border-t border-[#1a1a1a]">
          <div className="text-[#444] text-[9px] truncate">{user?.email ?? 'admin'}</div>
        </div>
      </aside>

      <main className="flex-1 min-w-0 overflow-hidden">{children}</main>
    </div>
  );
}
