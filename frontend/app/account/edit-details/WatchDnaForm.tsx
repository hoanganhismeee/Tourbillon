// Watch DNA form — behaviour-driven UI that shows an AI-generated taste profile.
// Four states: no data yet | profile exists | edit mode | generating.
'use client';
import { useState } from 'react';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getTasteProfile, saveTasteProfile, generateTasteProfile, fetchBrands, TasteProfile } from '@/lib/api';

// Returns true if the profile contains any extracted preference data
function hasAnyPreference(profile: TasteProfile): boolean {
  return (
    profile.preferredBrandIds.length > 0 ||
    profile.preferredMaterials.length > 0 ||
    profile.preferredDialColors.length > 0 ||
    profile.preferredCaseSize != null ||
    profile.priceMin != null ||
    profile.priceMax != null
  );
}

// Renders extracted preference chips for the profile view
function PreferenceChips({ profile, brands }: { profile: TasteProfile; brands?: { id: number; name: string }[] }) {
  const chips: string[] = [];

  if (profile.preferredBrandIds.length > 0 && brands) {
    profile.preferredBrandIds.forEach(id => {
      const brand = brands.find(b => b.id === id);
      if (brand) chips.push(brand.name);
    });
  }
  profile.preferredMaterials.forEach(m => chips.push(m));
  profile.preferredDialColors.forEach(c => chips.push(`${c} dial`));
  if (profile.preferredCaseSize) chips.push(`${profile.preferredCaseSize} case`);
  if (profile.priceMin != null && profile.priceMax != null) {
    chips.push(`$${profile.priceMin.toLocaleString()}–$${profile.priceMax.toLocaleString()}`);
  } else if (profile.priceMax != null) {
    chips.push(`under $${profile.priceMax.toLocaleString()}`);
  } else if (profile.priceMin != null) {
    chips.push(`from $${profile.priceMin.toLocaleString()}`);
  }

  if (chips.length === 0) return null;

  return (
    <div className="mt-3">
      <p className="text-xs text-[var(--primary-brown)]/70 mb-2">We understood:</p>
      <div className="flex flex-wrap gap-2">
        {chips.map((chip, i) => (
          <span
            key={i}
            className="px-3 py-1 rounded-full text-xs border border-[var(--primary-brown)]/40 text-[var(--primary-brown)] bg-white/5"
          >
            {chip}
          </span>
        ))}
      </div>
    </div>
  );
}

export default function WatchDnaForm() {
  const queryClient = useQueryClient();
  const router = useRouter();

  // Edit-mode state
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState('');
  const [savedProfile, setSavedProfile] = useState<TasteProfile | null>(null);

  // Whether the user has toggled into manual edit mode
  const [editMode, setEditMode] = useState(false);

  // Regeneration loading state
  const [generating, setGenerating] = useState(false);
  const [generateError, setGenerateError] = useState('');

  // Load existing profile on mount (uses global stale time so a fresh generate is picked up)
  const { data: initialProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['tasteProfile'],
    queryFn: getTasteProfile,
    retry: false,
  });

  // Fetch brands for resolving preferredBrandIds → names in PreferenceChips
  const { data: brands } = useQuery({
    queryKey: ['brands'],
    queryFn: fetchBrands,
    staleTime: Infinity,
  });

  // Pre-fill textarea when entering edit mode for the first time
  const activeProfile = savedProfile ?? initialProfile ?? null;
  if (editMode && text === '' && activeProfile?.tasteText) {
    setText(activeProfile.tasteText);
  }


  // Determine which UI state to render
  const hasData = activeProfile != null && (activeProfile.summary != null || hasAnyPreference(activeProfile));

  // --- Handlers ---

  const handleSave = async () => {
    if (!text.trim()) return;
    setEditError('');
    setSaving(true);
    try {
      const profile = await saveTasteProfile(text.trim());
      setSavedProfile(profile);
      setEditMode(false);
      queryClient.invalidateQueries({ queryKey: ['tasteProfile'] });
    } catch (err) {
      setEditError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const handleGenerate = async () => {
    setGenerateError('');
    setGenerating(true);
    try {
      await generateTasteProfile();
      queryClient.invalidateQueries({ queryKey: ['tasteProfile'] });
    } catch (err) {
      setGenerateError(err instanceof Error ? err.message : 'Failed to generate profile. Please try again.');
    } finally {
      setGenerating(false);
    }
  };

  const enterEditMode = () => {
    // Reset textarea to current profile text when opening
    setText(activeProfile?.tasteText ?? '');
    setEditError('');
    setSavedProfile(null);
    setEditMode(true);
  };

  const cancelEditMode = () => {
    setEditMode(false);
    setText('');
    setEditError('');
  };

  // --- Render ---

  return (
    <div className="pb-8 mb-8 border-b border-[var(--primary-brown)]/30">
      {/* Section header */}
      <div className="mb-5">
        <h2 className="text-2xl font-playfair text-[var(--light-cream)]">Watch DNA</h2>
        <p className="text-sm text-[var(--primary-brown)]/80 mt-1">
          Describe what you love in a watch. The AI will learn your taste and personalise your watch feed.
        </p>
      </div>

      {/* STATE 4: Generating */}
      {generating && (
        <div className="flex items-center gap-3 py-4">
          <span className="inline-block w-4 h-4 border-2 border-[var(--primary-brown)]/30 border-t-[var(--primary-brown)] rounded-full animate-spin" />
          <span className="text-sm text-[var(--primary-brown)]/80 italic">Analysing your browsing history...</span>
        </div>
      )}

      {/* STATE 1: No data yet (loading finished, no meaningful profile) */}
      {!generating && !profileLoading && !hasData && !editMode && (
        <div className="py-4 space-y-3">
          <p className="text-sm text-[var(--light-cream)]/70">
            Browse some watches and we&apos;ll build your taste profile automatically.
          </p>
          <p className="text-xs text-[var(--primary-brown)]/50 italic">
            The more you explore, the more personalised your recommendations become.
          </p>
          <button
            onClick={handleGenerate}
            disabled={generating}
            className="w-fit px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed cursor-pointer"
          >
            Generate my taste profile
          </button>
          {generateError && <p className="text-sm text-red-400">{generateError}</p>}
        </div>
      )}

      {/* STATE 2: Profile exists — show AI summary + chips + regenerate */}
      {!generating && !editMode && hasData && activeProfile && (
        <div className="space-y-4">
          {/* AI-generated summary card */}
          {activeProfile.summary && (
            <div className="border-l-2 border-[var(--cream-gold)] pl-4 py-2 italic text-[var(--light-cream)]/90 text-sm">
              {activeProfile.summary}
            </div>
          )}

          {/* Extracted preference chips */}
          <PreferenceChips profile={activeProfile} brands={brands} />

          {/* Regenerate button */}
          <div className="flex flex-col gap-2 pt-1">
            <button
              onClick={handleGenerate}
              disabled={generating}
              className="w-fit px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
            >
              Regenerate
            </button>

            {generateError && <p className="text-sm text-red-400">{generateError}</p>}

            {/* Edit manually toggle */}
            <span
              onClick={enterEditMode}
              className="text-xs text-[var(--primary-brown)]/60 hover:text-[var(--primary-brown)] cursor-pointer underline-offset-2 hover:underline transition w-fit"
            >
              Edit manually
            </span>
          </div>

          {/* View personalised collection after a successful manual save */}
          {savedProfile && (
            <button
              onClick={() => router.push('/watches')}
              className="w-fit px-6 py-2.5 rounded-xl font-semibold text-sm border border-[var(--primary-brown)]/60 text-[var(--primary-brown)] hover:bg-[var(--primary-brown)]/10 transition"
            >
              View Your Personalised Collection →
            </button>
          )}
        </div>
      )}

      {/* STATE 3: Edit mode — manual textarea */}
      {!generating && editMode && (
        <div className="space-y-3">
          <div className="relative">
            <textarea
              value={text}
              onChange={e => { setText(e.target.value); setEditError(''); setSavedProfile(null); }}
              placeholder="e.g. I like classic elegant watches, clean design, medium size, versatile for daily wear"
              rows={3}
              disabled={saving}
              className="w-full px-4 py-3 rounded-md border border-[var(--primary-brown)] focus:border-[var(--cream-gold)] bg-transparent text-[var(--light-cream)] placeholder-[var(--primary-brown)]/10 resize-none focus:outline-none transition disabled:opacity-10"
            />
          </div>

          {/* Save button */}
          <button
            onClick={handleSave}
            disabled={saving || !text.trim()}
            className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
          >
            {saving ? (
              <>
                <span className="inline-block w-4 h-4 border-2 border-[var(--dark-brown)]/30 border-t-[var(--dark-brown)] rounded-full animate-spin" />
                Analysing your taste...
              </>
            ) : (
              'Save My Taste'
            )}
          </button>

          {editError && <p className="text-sm text-red-400">{editError}</p>}

          {/* Cancel link */}
          {hasData && (
            <span
              onClick={cancelEditMode}
              className="text-xs text-[var(--primary-brown)]/60 hover:text-[var(--primary-brown)] cursor-pointer underline-offset-2 hover:underline transition"
            >
              Cancel
            </span>
          )}

        </div>
      )}
    </div>
  );
}
