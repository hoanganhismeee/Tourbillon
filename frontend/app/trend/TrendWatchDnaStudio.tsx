'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { generateTasteProfile, saveTasteProfile } from '@/lib/api';
import { useAuth } from '@/contexts/AuthContext';
import { DYNAMIC_ROUTES } from '@/app/constants/routes';

export default function TrendWatchDnaStudio() {
  const { isAuthenticated } = useAuth();
  const queryClient = useQueryClient();
  const [editMode, setEditMode] = useState(false);
  const [text, setText] = useState('');
  const [editError, setEditError] = useState('');
  const [saving, setSaving] = useState(false);

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
      <div className="max-w-4xl">
        <p className="text-[10px] uppercase tracking-[0.4em] text-[#bfa68a]">Watch DNA</p>
        <h2 className="mt-5 font-playfair font-light text-[#f0e6d2] leading-tight" style={{ fontSize: 'clamp(2rem, 4vw, 3.5rem)' }}>
          A profile shaped by what keeps catching your eye.
        </h2>
        <p className="mt-6 max-w-2xl text-[13.5px] leading-relaxed text-white/60">
          A quiet read on your taste, ready whenever you want to refine it.
        </p>

        <div className="mt-10 border-l-2 border-[#bfa68a]/60 py-1 pl-5">
          {isLoading || isFetching ? (
            <div className="flex items-center gap-4">
              <span className="inline-block h-4 w-4 rounded-full border border-[#bfa68a]/30 border-t-[#bfa68a] animate-spin" />
              <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
                Reading your Watch DNA...
              </p>
            </div>
          ) : error ? (
            <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
              Your Watch DNA could not be refreshed right now.
            </p>
          ) : profile?.behaviorSummary ? (
            <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
              {profile.behaviorSummary}
            </p>
          ) : (
            <p className="font-playfair italic text-[1.2rem] leading-relaxed text-[#f0e6d2]">
              Keep browsing to form your Watch DNA.
            </p>
          )}
        </div>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <Link
            href={DYNAMIC_ROUTES.WATCHES_SORT('personalized')}
            className="relative inline-flex items-center justify-center overflow-hidden border border-[#bfa68a]/25 px-12 py-4 text-[10px] uppercase tracking-[0.3em] text-[#bfa68a] transition-all duration-500 group hover:border-[#bfa68a]/40 hover:bg-[#bfa68a]/8"
          >
            <span className="transform transition-transform duration-500 group-hover:-translate-x-3">
              Open the catalogue
            </span>
            <span className="absolute right-6 -translate-x-4 text-[14px] opacity-0 transition-all duration-500 group-hover:translate-x-0 group-hover:opacity-100">
              →
            </span>
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
              placeholder="Describe what you value in a watch."
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
            </div>

            {editError && (
              <p className="mt-4 text-sm text-red-300">{editError}</p>
            )}
          </div>
        )}
      </div>
    </section>
  );
}
