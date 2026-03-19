// Wrist-fit recommender widget for the watch detail page.
// Accepts case specs and a user-supplied wrist circumference to display fit scores.
// Pure rule engine — no API calls, all scoring in lib/wristfit.ts.

'use client';

import React, { useState } from 'react';
import { calculateFitScores, FitScores } from '@/lib/wristfit';

interface WristFitWidgetProps {
  caseSpecs: Record<string, unknown> | undefined;
}

function scoreColor(score: number): string {
  if (score >= 85) return '#6ee7b7';
  if (score >= 70) return '#bfa68a';
  if (score >= 55) return '#fbbf24';
  if (score >= 40) return '#f97316';
  return '#ef4444';
}

function SubScoreBar({ label, score }: { label: string; score: number }) {
  const color = scoreColor(score);
  return (
    <div>
      <div className="flex justify-between items-center mb-1">
        <span className="text-xs text-white/50">{label}</span>
        <span className="text-xs font-medium" style={{ color }}>{score}</span>
      </div>
      <div className="h-1 bg-white/8 rounded-full overflow-hidden">
        <div
          className="h-full rounded-full transition-all duration-300"
          style={{ width: `${score}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

export default function WristFitWidget({ caseSpecs }: WristFitWidgetProps) {
  const [inputValue, setInputValue] = useState('');

  // Guard: hide if no diameter data available
  if (!caseSpecs?.diameter) return null;

  const wristCm = parseFloat(inputValue);
  const isValid = !isNaN(wristCm) && wristCm >= 10 && wristCm <= 25;
  const scores: FitScores | null = isValid
    ? calculateFitScores(wristCm, caseSpecs as { diameter?: string; thickness?: string })
    : null;

  const accentColor = scores ? scoreColor(scores.overall) : '#bfa68a';

  return (
    <div className="mt-10">
      <h2 className="text-2xl font-playfair font-semibold border-b border-white/10 pb-3 mb-6">
        Wrist Fit
      </h2>

      <div className={`bg-white/3 border border-white/10 rounded-xl ${scores ? 'p-6 space-y-5' : 'p-4 space-y-3'}`}>
        {/* Input */}
        <div>
          <label className="block text-xs font-medium text-white/40 uppercase tracking-widest mb-2">
            Your wrist circumference
          </label>
          <div className="flex items-center gap-3">
            <input
              type="number"
              min={10}
              max={25}
              step={0.5}
              placeholder="e.g. 17.0"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              className="w-32 bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white text-sm focus:outline-none focus:border-[#bfa68a]/50 [appearance:textfield] [&::-webkit-outer-spin-button]:appearance-none [&::-webkit-inner-spin-button]:appearance-none"
            />
            <span className="text-white/40 text-sm">cm</span>
          </div>
          {inputValue && !isValid && (
            <p className="text-xs text-white/40 mt-1">Enter a value between 10 and 25 cm</p>
          )}
        </div>

        {/* Score output */}
        {scores && (
          <>
            {/* Overall score */}
            <div className="flex items-center gap-4">
              <div
                className="w-16 h-16 rounded-full border-2 flex items-center justify-center flex-shrink-0"
                style={{ borderColor: accentColor }}
              >
                <span className="text-xl font-bold" style={{ color: accentColor }}>
                  {scores.overall}
                </span>
              </div>
              <div>
                <p className="font-semibold text-lg" style={{ color: accentColor }}>
                  {scores.label}
                </p>
                <p className="text-white/50 text-sm leading-snug mt-0.5">{scores.verdict}</p>
              </div>
            </div>

            {/* Sub-scores */}
            {(scores.diameter !== null || scores.thickness !== null) && (
              <div className="space-y-3 pt-1">
                {scores.diameter !== null && (
                  <SubScoreBar label="Diameter" score={scores.diameter} />
                )}
                {scores.thickness !== null && (
                  <SubScoreBar label="Thickness" score={scores.thickness} />
                )}
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
