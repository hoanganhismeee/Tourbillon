'use client';

import React, { useEffect, useState } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import {
  adminGetScrapeStats, adminGetEditorialStatus, adminGetEmbeddingStatus, adminGetQueryCacheStatus,
  ScrapeStats, EditorialStatus, EmbeddingStatus, QueryCacheStatus,
} from '@/lib/api';

function Card({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div className="bg-[#0d0d0d] border border-[#1a1a1a] rounded-lg p-5">
      <h2 className="text-white text-sm font-medium mb-4">{title}</h2>
      {children}
    </div>
  );
}

function Stat({ label, value, accent }: { label: string; value: string | number; accent?: boolean }) {
  return (
    <div className="flex justify-between items-center py-1.5 border-b border-[#111] last:border-0">
      <span className="text-[#555] text-xs">{label}</span>
      <span className={`text-xs font-mono ${accent ? 'text-[#c9a96e]' : 'text-[#888]'}`}>{value}</span>
    </div>
  );
}

function CoverageBar({ pct }: { pct: number }) {
  return (
    <div className="mt-3 mb-1 h-1 bg-[#1a1a1a] rounded-full overflow-hidden">
      <div className="h-full bg-[#c9a96e]" style={{ width: `${Math.min(pct, 100)}%` }} />
    </div>
  );
}

function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / (1024 * 1024)).toFixed(1)} MB`;
}

export default function AdminAnalyticsPage() {
  const { isAdmin } = useAuth();
  const [scrape, setScrape] = useState<ScrapeStats | null>(null);
  const [editorial, setEditorial] = useState<EditorialStatus | null>(null);
  const [embedding, setEmbedding] = useState<EmbeddingStatus | null>(null);
  const [cache, setCache] = useState<QueryCacheStatus | null>(null);

  useEffect(() => {
    if (!isAdmin) return;
    adminGetScrapeStats().then(setScrape).catch(() => null);
    adminGetEditorialStatus().then(setEditorial).catch(() => null);
    adminGetEmbeddingStatus().then(setEmbedding).catch(() => null);
    adminGetQueryCacheStatus().then(setCache).catch(() => null);
  }, [isAdmin]);

  return (
    <div className="p-6">
      <div className="mb-5">
        <h1 className="text-xl font-semibold text-white">Analytics</h1>
        <p className="text-[#555] text-xs mt-0.5">Platform health and content coverage at a glance</p>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">

        <Card title="Catalogue">
          {scrape ? (
            <>
              <Stat label="Brands" value={scrape.totalBrands} accent />
              <Stat label="Collections" value={scrape.totalCollections} />
              <Stat label="Watches" value={scrape.totalWatches} accent />
              {scrape.lastScrapedAt && (
                <Stat label="Last scraped" value={new Date(scrape.lastScrapedAt).toLocaleDateString()} />
              )}
            </>
          ) : <p className="text-[#333] text-xs">Loading…</p>}
        </Card>

        <Card title="Editorial Coverage">
          {editorial ? (
            <>
              <Stat label="Total watches" value={editorial.total} />
              <Stat label="With editorial" value={editorial.withEditorial} accent />
              <Stat label="Coverage" value={`${editorial.coveragePct.toFixed(1)}%`} accent />
              <CoverageBar pct={editorial.coveragePct} />
            </>
          ) : <p className="text-[#333] text-xs">Loading…</p>}
        </Card>

        <Card title="AI Embeddings">
          {embedding ? (
            <>
              <Stat label="Total watches" value={embedding.total} />
              <Stat label="Embedded" value={embedding.embedded} accent />
              <Stat label="Coverage" value={`${embedding.coveragePct.toFixed(1)}%`} accent />
              <CoverageBar pct={embedding.coveragePct} />
            </>
          ) : <p className="text-[#333] text-xs">Loading…</p>}
        </Card>

        <Card title="Query Cache">
          {cache ? (
            <>
              <Stat label="Cached queries" value={cache.entries} accent />
              <Stat label="Cache size" value={formatBytes(cache.sizeBytes)} />
              {cache.message && <Stat label="Status" value={cache.message} />}
            </>
          ) : <p className="text-[#333] text-xs">Loading…</p>}
        </Card>

      </div>
    </div>
  );
}
