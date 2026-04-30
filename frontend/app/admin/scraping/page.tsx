'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminGetScrapeStats, adminScrapeBrand, adminScrapeSitemap,
  adminScrapeListing, adminScrapeUrl, ScrapeStats,
} from '@/lib/api';

type Tab = 'brand' | 'sitemap' | 'listing' | 'url';

interface Result { ok: boolean; message: string; added?: number; scraped?: number }

function ResultBanner({ result, onDismiss }: { result: Result; onDismiss: () => void }) {
  return (
    <div className={`flex items-center justify-between px-4 py-2 rounded text-sm mb-4 ${result.ok ? 'bg-green-900/40 text-green-300' : 'bg-red-900/40 text-red-300'}`}>
      <span>{result.message}{result.added !== undefined ? ` — ${result.added} added` : ''}{result.scraped !== undefined && result.scraped !== result.added ? `, ${result.scraped} scraped` : ''}</span>
      <button onClick={onDismiss} className="ml-4 opacity-60 hover:opacity-100">✕</button>
    </div>
  );
}

export default function AdminScrapingPage() {
  const { isAdmin } = useAuth();
  const [stats, setStats] = useState<ScrapeStats | null>(null);
  const [tab, setTab] = useState<Tab>('brand');
  const [working, setWorking] = useState(false);
  const [result, setResult] = useState<Result | null>(null);

  // Brand tab
  const [brand, setBrand] = useState('');
  const [collection, setCollection] = useState('');
  const [maxWatches, setMaxWatches] = useState('25');

  // Sitemap tab
  const [smBrand, setSmBrand] = useState('');
  const [smUrl, setSmUrl] = useState('');
  const [smMax, setSmMax] = useState('25');

  // Listing tab
  const [lBrand, setLBrand] = useState('');
  const [lUrl, setLUrl] = useState('');
  const [lMax, setLMax] = useState('25');

  // URL tab
  const [uUrl, setUUrl] = useState('');
  const [uBrand, setUBrand] = useState('');
  const [uCollection, setUCollection] = useState('');

  useEffect(() => {
    if (isAdmin) adminGetScrapeStats().then(setStats).catch(() => null);
  }, [isAdmin]);

  const run = async (fn: () => Promise<Result>) => {
    setWorking(true); setResult(null);
    try {
      const r = await fn();
      setResult(r);
      adminGetScrapeStats().then(setStats).catch(() => null);
    } catch (e: unknown) {
      setResult({ ok: false, message: e instanceof Error ? e.message : 'Error' });
    } finally { setWorking(false); }
  };

  const handleBrand = () => run(async () => {
    const r = await adminScrapeBrand(brand, collection, Number(maxWatches));
    return { ok: r.success, message: r.message, added: r.watchesAdded, scraped: r.watchesScraped };
  });

  const handleSitemap = () => run(async () => {
    const r = await adminScrapeSitemap(smBrand, smUrl, Number(smMax));
    return { ok: r.success, message: r.message, added: r.watchesAdded };
  });

  const handleListing = () => run(async () => {
    const r = await adminScrapeListing(lBrand, lUrl, Number(lMax));
    return { ok: r.success, message: r.message, added: r.watchesAdded };
  });

  const handleUrl = () => run(async () => {
    const r = await adminScrapeUrl(uUrl, uBrand, uCollection);
    return { ok: r.success, message: r.message, added: r.watchesAdded };
  });

  const inputCls = 'w-full bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 focus:outline-none focus:border-[#c9a96e]';
  const labelCls = 'text-[#555] text-xs block mb-1';
  const smallInputCls = 'bg-[#0d0d0d] border border-[#1e1e1e] text-white text-sm rounded px-3 py-1.5 w-20 focus:outline-none focus:border-[#c9a96e]';

  return (
    <div className="p-6">
      <div className="flex items-start justify-between mb-5">
        <div>
          <h1 className="text-xl font-semibold text-white">Scraping</h1>
          {stats && (
            <p className="text-[#555] text-xs mt-0.5">
              {stats.totalBrands} brands · {stats.totalCollections} collections · {stats.totalWatches} watches
            </p>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-6 border-b border-[#1a1a1a] pb-2">
        {(['brand', 'sitemap', 'listing', 'url'] as Tab[]).map(t => (
          <button
            key={t}
            onClick={() => { setTab(t); setResult(null); }}
            className={`px-3 py-1 rounded text-xs transition-colors capitalize ${tab === t ? 'bg-[#1e1e1e] text-white' : 'text-[#555] hover:text-[#888]'}`}
          >{t === 'url' ? 'Single URL' : t === 'brand' ? 'Brand / Collection' : t.charAt(0).toUpperCase() + t.slice(1)}</button>
        ))}
      </div>

      {result && <ResultBanner result={result} onDismiss={() => setResult(null)} />}

      {tab === 'brand' && (
        <div className="max-w-md space-y-3">
          <p className="text-[#444] text-xs mb-3">Scrape watches from a brand's official website using legacy XPath config.</p>
          <div><label className={labelCls}>Brand name</label><input className={inputCls} placeholder="e.g. Patek Philippe" value={brand} onChange={e => setBrand(e.target.value)} /></div>
          <div><label className={labelCls}>Collection name</label><input className={inputCls} placeholder="e.g. Calatrava" value={collection} onChange={e => setCollection(e.target.value)} /></div>
          <div><label className={labelCls}>Max watches</label><input className={smallInputCls} type="number" min="1" max="100" value={maxWatches} onChange={e => setMaxWatches(e.target.value)} /></div>
          <button
            className="bg-[#c9a96e] text-black px-5 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors disabled:opacity-50"
            onClick={handleBrand} disabled={working || !brand.trim() || !collection.trim()}
          >{working ? 'Scraping…' : 'Scrape'}</button>
        </div>
      )}

      {tab === 'sitemap' && (
        <div className="max-w-md space-y-3">
          <p className="text-[#444] text-xs mb-3">Discover watch URLs from a sitemap XML, then extract each with Claude Haiku.</p>
          <div><label className={labelCls}>Brand name</label><input className={inputCls} placeholder="e.g. Grand Seiko" value={smBrand} onChange={e => setSmBrand(e.target.value)} /></div>
          <div><label className={labelCls}>Sitemap URL</label><input className={inputCls} placeholder="https://..." value={smUrl} onChange={e => setSmUrl(e.target.value)} /></div>
          <div><label className={labelCls}>Max watches</label><input className={smallInputCls} type="number" min="1" max="100" value={smMax} onChange={e => setSmMax(e.target.value)} /></div>
          <button
            className="bg-[#c9a96e] text-black px-5 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors disabled:opacity-50"
            onClick={handleSitemap} disabled={working || !smBrand.trim() || !smUrl.trim()}
          >{working ? 'Scraping…' : 'Scrape Sitemap'}</button>
        </div>
      )}

      {tab === 'listing' && (
        <div className="max-w-md space-y-3">
          <p className="text-[#444] text-xs mb-3">Crawl a listing/category page and extract all linked watch pages.</p>
          <div><label className={labelCls}>Brand name</label><input className={inputCls} placeholder="e.g. Breguet" value={lBrand} onChange={e => setLBrand(e.target.value)} /></div>
          <div><label className={labelCls}>Listing URL</label><input className={inputCls} placeholder="https://..." value={lUrl} onChange={e => setLUrl(e.target.value)} /></div>
          <div><label className={labelCls}>Max watches</label><input className={smallInputCls} type="number" min="1" max="100" value={lMax} onChange={e => setLMax(e.target.value)} /></div>
          <button
            className="bg-[#c9a96e] text-black px-5 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors disabled:opacity-50"
            onClick={handleListing} disabled={working || !lBrand.trim() || !lUrl.trim()}
          >{working ? 'Scraping…' : 'Scrape Listing'}</button>
        </div>
      )}

      {tab === 'url' && (
        <div className="max-w-md space-y-3">
          <p className="text-[#444] text-xs mb-3">Extract a single watch from a product page URL using Claude Haiku.</p>
          <div><label className={labelCls}>Product URL</label><input className={inputCls} placeholder="https://..." value={uUrl} onChange={e => setUUrl(e.target.value)} /></div>
          <div><label className={labelCls}>Brand name</label><input className={inputCls} placeholder="e.g. Omega" value={uBrand} onChange={e => setUBrand(e.target.value)} /></div>
          <div><label className={labelCls}>Collection name</label><input className={inputCls} placeholder="e.g. Seamaster" value={uCollection} onChange={e => setUCollection(e.target.value)} /></div>
          <button
            className="bg-[#c9a96e] text-black px-5 py-1.5 rounded text-sm font-medium hover:bg-[#d4b97e] transition-colors disabled:opacity-50"
            onClick={handleUrl} disabled={working || !uUrl.trim() || !uBrand.trim() || !uCollection.trim()}
          >{working ? 'Scraping…' : 'Scrape URL'}</button>
        </div>
      )}
    </div>
  );
}
