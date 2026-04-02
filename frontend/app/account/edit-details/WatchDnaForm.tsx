// Watch DNA form — lets users describe their watch preferences in plain text (≤10 words).
// The backend sends the text to the AI service which extracts structured preferences,
// then those preferences are used to personalise the All Watches grid.
'use client';
import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { useRouter } from 'next/navigation';
import { getTasteProfile, saveTasteProfile, TasteProfile } from '@/lib/api';
import { useQuery } from '@tanstack/react-query';

// Returns the word count of a string (splits on whitespace, ignores empty tokens)
function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

// Renders extracted preference chips after a successful save
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
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [savedProfile, setSavedProfile] = useState<TasteProfile | null>(null);

  // Load existing profile to pre-fill textarea on mount
  const { data: initialProfile, isLoading: profileLoading } = useQuery({
    queryKey: ['tasteProfile'],
    queryFn: getTasteProfile,
    staleTime: Infinity,
    retry: false,
  });

  // Pre-fill textarea once initial profile loads (only if text hasn't been edited yet)
  if (initialProfile && text === '' && initialProfile.tasteText) {
    setText(initialProfile.tasteText);
  }

  const wordCount = countWords(text);
  const overLimit = wordCount > 15;

  const handleSave = async () => {
    if (!text.trim()) return;
    if (overLimit) {
      setError('Please keep your description to 15 words or fewer.');
      return;
    }
    setError('');
    setSaving(true);
    try {
      const profile = await saveTasteProfile(text.trim());
      setSavedProfile(profile);
      // Invalidate so AllWatchesSection re-fetches and re-sorts immediately
      queryClient.invalidateQueries({ queryKey: ['tasteProfile'] });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  };

  const displayProfile = savedProfile ?? initialProfile ?? null;

  return (
    <div className="pb-8 mb-8 border-b border-[var(--primary-brown)]/30">
      {/* Section header */}
      <div className="mb-5">
        <h2 className="text-2xl font-playfair text-[var(--light-cream)]">Watch DNA</h2>
        <p className="text-sm text-[var(--primary-brown)]/80 mt-1">
          Describe what you love in a watch. The AI will learn your taste and personalise your watch feed.
        </p>
      </div>

      {/* Textarea */}
      <div className="relative">
        <textarea
          value={text}
          onChange={e => { setText(e.target.value); setError(''); setSavedProfile(null); }}
          placeholder="e.g. I like classic elegant watches, clean design, medium size, versatile for daily wear"
          rows={3}
          disabled={profileLoading || saving}
          className={`w-full px-4 py-3 rounded-md border bg-transparent text-[var(--light-cream)] placeholder-[var(--primary-brown)]/10 resize-none focus:outline-none transition
            ${overLimit
              ? 'border-red-400/60 focus:border-red-400'
              : 'border-[var(--primary-brown)] focus:border-[var(--cream-gold)]'
            }
            disabled:opacity-10`}
        />
        {/* Live word count */}
        <span className={`absolute bottom-3 right-4 text-xs ${overLimit ? 'text-red-400' : 'text-[var(--primary-brown)]/60'}`}>
          {wordCount} / 15 words
        </span>
      </div>

      {/* Hard-coded budget note */}
      <p className="text-xs text-[var(--primary-brown)]/10 mt-1.5 italic">
        Limit to 15 words to save model token, cause I&apos;m broke
      </p>

      {/* Save button */}
      <button
        onClick={handleSave}
        disabled={saving || overLimit || !text.trim()}
        className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-r from-[var(--primary-brown)] to-[var(--cream-gold)] text-[var(--dark-brown)] hover:opacity-90 transition disabled:opacity-40 disabled:cursor-not-allowed flex items-center gap-2 cursor-pointer"
      >
        {saving ? (
          <>
            {/* Spinner */}
            <span className="inline-block w-4 h-4 border-2 border-[var(--dark-brown)]/30 border-t-[var(--dark-brown)] rounded-full animate-spin" />
            Analysing your taste...
          </>
        ) : (
          'Save My Taste'
        )}
      </button>

      {error && <p className="mt-2 text-sm text-red-400">{error}</p>}

      {/* Extracted preferences chips */}
      {!saving && displayProfile && (
        <PreferenceChips profile={displayProfile} />
      )}

      {savedProfile && !saving && (
        <button
          onClick={() => router.push('/watches')}
          className="mt-4 px-6 py-2.5 rounded-xl font-semibold text-sm border border-[var(--primary-brown)]/60 text-[var(--primary-brown)] hover:bg-[var(--primary-brown)]/10 transition"
        >
          View Your Personalised Collection →
        </button>
      )}
    </div>
  );
}
