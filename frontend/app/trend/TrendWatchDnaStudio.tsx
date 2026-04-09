'use client';

import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { fetchBrands, generateTasteProfile, saveTasteProfile, TasteProfile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { DYNAMIC_ROUTES } from '@/app/constants/routes';

function formatMoney(value: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(value);
}

function buildPreferenceChips(
  profile: TasteProfile,
  brands?: { id: number; name: string }[],
  source: 'effective' | 'behavior' = 'effective'
): string[] {
  const chips: string[] = [];

  const brandIds = source === 'behavior' ? profile.behaviorPreferredBrandIds : profile.preferredBrandIds;
  const materials = source === 'behavior' ? profile.behaviorPreferredMaterials : profile.preferredMaterials;
  const dialColors = source === 'behavior' ? profile.behaviorPreferredDialColors : profile.preferredDialColors;
  const caseSize = source === 'behavior' ? profile.behaviorPreferredCaseSize : profile.preferredCaseSize;
  const priceMin = source === 'behavior' ? profile.behaviorPriceMin : profile.priceMin;
  const priceMax = source === 'behavior' ? profile.behaviorPriceMax : profile.priceMax;

  if (brandIds.length > 0 && brands) {
    brandIds.forEach(id => {
      const brand = brands.find(item => item.id === id);
      if (brand) chips.push(brand.name);
    });
  }

  materials.forEach(value => chips.push(value));
  dialColors.forEach(value => chips.push(`${value} dial`));

  if (caseSize) chips.push(`${caseSize} case`);

  if (priceMin != null && priceMax != null) {
    chips.push(`${formatMoney(priceMin)}-${formatMoney(priceMax)}`);
  } else if (priceMax != null) {
    chips.push(`under ${formatMoney(priceMax)}`);
  } else if (priceMin != null) {
    chips.push(`from ${formatMoney(priceMin)}`);
  }

  return chips;
}

function ChipRow({ title, chips }: { title: string; chips: string[] }) {
  if (chips.length === 0) return null;

  return (
    <div className="pt-7">
      <p className="text-[9px] uppercase tracking-[0.4em] text-[#bfa68a]/75">{title}</p>
      <div className="mt-4 flex flex-wrap gap-2">
        {chips.map(chip => (
          <span
            key={`${title}-${chip}`}
            className="rounded-full border border-[#bfa68a]/20 px-4 py-2 text-[10px] uppercase tracking-[0.18em] text-[#f0e6d2]/72"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function TrendWatchDnaStudio() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [text, setText] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: Infinity,
  });

  const {
    data: profile,
    isLoading,
    isFetching,
    error,
  } = useQuery({
    queryKey: ['trendTasteProfile'],
    queryFn: async () => {
      const nextProfile = await generateTasteProfile();
      queryClient.setQueryData(['tasteProfile'], nextProfile);
      return nextProfile;
    },
    enabled: isAuthenticated,
    retry: false,
    refetchOnWindowFocus: false,
  });

  useEffect(() => {
    if (!editMode || !profile) return;
    setText(profile.tasteText ?? '');
  }, [editMode, profile]);

  const behaviorChips = useMemo(() => (
    profile ? buildPreferenceChips(profile, brands, 'behavior') : []
  ), [profile, brands]);

  const effectiveChips = useMemo(() => (
    profile ? buildPreferenceChips(profile, brands, 'effective') : []
  ), [profile, brands]);

  const formattedBehaviorDate = useMemo(() => {
    if (!profile?.behaviorAnalyzedAt) return null;
    return new Intl.DateTimeFormat('en-AU', {
      day: 'numeric',
      month: 'short',
      hour: 'numeric',
      minute: '2-digit',
    }).format(new Date(profile.behaviorAnalyzedAt));
  }, [profile?.behaviorAnalyzedAt]);

  const handleSave = async () => {
    if (!text.trim()) return;

    setSaving(true);
    setEditError('');

    try {
      const nextProfile = await saveTasteProfile(text.trim());
      queryClient.setQueryData(['tasteProfile'], nextProfile);
      queryClient.setQueryData(['trendTasteProfile'], nextProfile);
      setEditMode(false);
    } catch (saveError) {
      setEditError(saveError instanceof Error ? saveError.message : 'Failed to save your watch DNA.');
    } finally {
      setSaving(false);
    }
  };

  if (!isAuthenticated) return null;

  return (
    <section className="border-t border-[#bfa68a]/12 pt-12">
      <div className="grid gap-16 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,0.8fr)] lg:gap-20">
        <div>
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]">Watch DNA</p>
          <h2 className="mt-5 font-playfair font-light text-[#f0e6d2] leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
            Your recent direction, with the catalogue still intact.
          </h2>
          <p className="mt-6 max-w-xl text-[13.5px] leading-relaxed text-white/60">
            The analysis reads your latest browsing behavior and nudges the opening rows. Manual taste stays in control wherever you have already been explicit.
          </p>

          <div className="mt-10 border-l-2 border-[#bfa68a]/60 pl-5 py-1 mb-8">
            {isLoading || isFetching ? (
              <div className="flex items-center gap-4">
                <span className="inline-block h-4 w-4 rounded-full border border-[#bfa68a]/30 border-t-[#bfa68a] animate-spin" />
                <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
                  Reading your recent browsing and refining the feed...
                </p>
              </div>
            ) : error ? (
              <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
                The last analysis could not be refreshed right now. Your saved preferences are still active.
              </p>
            ) : profile?.behaviorSummary ? (
              <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
                {profile.behaviorSummary}
              </p>
            ) : profile?.hasEnoughBehaviorData ? (
              <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
                The feed is watching your recent direction, but the pattern is still too light to describe cleanly.
              </p>
            ) : (
              <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
                Browse a few more watches and come back. Once there is enough signal, this analysis will fill itself in.
              </p>
            )}
          </div>

          <ChipRow title="Latest analysis" chips={behaviorChips} />
          <ChipRow title="Active feed signals" chips={effectiveChips} />

          <div className="mt-10 flex flex-wrap items-center gap-4">
            <Link
              href={DYNAMIC_ROUTES.WATCHES_SORT('personalized')}
              className="inline-flex items-center justify-center border border-[#bfa68a]/25 px-10 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
            >
              Open the catalogue
            </Link>
            <button
              type="button"
              onClick={() => setEditMode(value => !value)}
              className="text-[10px] uppercase tracking-[0.3em] text-white/38 transition-colors duration-300 hover:text-[#f0e6d2]"
            >
              {editMode ? 'Close manual note' : 'Refine manually'}
            </button>
          </div>

          {editMode && (
            <div className="mt-10 max-w-2xl border-t border-[#bfa68a]/12 pt-8">
              <p className="text-[9px] uppercase tracking-[0.42em] text-[#bfa68a]/72">Manual override</p>
              <textarea
                value={text}
                onChange={event => {
                  setText(event.target.value);
                  setEditError('');
                }}
                rows={4}
                disabled={saving}
                placeholder="Describe what you value in a watch. Manual taste stays in control wherever it speaks clearly."
                className="mt-5 w-full resize-none border border-[#bfa68a]/18 bg-transparent px-5 py-4 text-sm leading-relaxed text-[#f0e6d2] placeholder:text-white/18 focus:border-[#bfa68a]/45 focus:outline-none"
              />

              <div className="mt-5 flex flex-wrap items-center gap-4">
                <button
                  type="button"
                  onClick={handleSave}
                  disabled={saving || !text.trim()}
                  className="inline-flex items-center justify-center bg-gradient-to-r from-[#bfa68a] via-[#d4b898] to-[#bfa68a] px-8 py-3 text-[9.5px] uppercase tracking-[0.32em] text-[#1e1206] disabled:cursor-not-allowed disabled:opacity-45"
                >
                  {saving ? 'Saving taste...' : 'Save manual taste'}
                </button>
                <p className="text-[12px] leading-relaxed text-white/32">
                  Manual taste fills the feed first. Behavior analysis only fills the gaps.
                </p>
              </div>

              {editError && (
                <p className="mt-4 text-sm text-red-300">{editError}</p>
              )}
            </div>
          )}
        </div>

        <aside className="border-t border-[#bfa68a]/12 pt-8 lg:border-t-0 lg:border-l lg:pl-10">
          <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]/80">Feed notes</p>
          <div className="mt-8 space-y-8">
            <div>
              <p className="text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/70">Ordering</p>
              <p className="mt-3 text-[13px] leading-relaxed text-white/50">
                The first rows respond to recent behavior, but the wider list keeps its stable catalogue order instead of reshuffling on every reload.
              </p>
            </div>

            <div>
              <p className="text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/70">Latest read</p>
              <p className="mt-3 text-[13px] leading-relaxed text-white/50">
                {formattedBehaviorDate ? `Last behavior analysis ${formattedBehaviorDate}.` : 'No behavior analysis has been saved yet.'}
              </p>
            </div>

            <div>
              <p className="text-[8.5px] uppercase tracking-[0.32em] text-[#bfa68a]/70">Manual note</p>
              <p className="mt-3 text-[13px] leading-relaxed text-white/50">
                {profile?.tasteText
                  ? 'A written taste note is active, so those preferences take priority wherever they are specific.'
                  : 'No manual note yet. The feed is currently learning from browsing behavior alone.'}
              </p>
            </div>
          </div>
        </aside>
      </div>
    </section>
  );
}
