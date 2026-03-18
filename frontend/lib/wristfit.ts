// Wrist-fit scoring engine
// Pure functions — no side effects, no API calls

export interface FitScores {
  overall: number;
  diameter: number | null;
  thickness: number | null;
  lugToLug: number | null;
  label: string;
  verdict: string;
}

interface CaseSpecs {
  diameter?: string;
  thickness?: string;
  lugToLug?: string;
}

// Extract numeric mm value from spec string (e.g., "40 mm" → 40, "9.24 mm" → 9.24)
export function parseSpecMm(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)\s*mm/i);
  if (match) return parseFloat(match[1]);
  // Try bare number
  const bare = parseFloat(value);
  return isNaN(bare) ? null : bare;
}

function clamp(val: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, val));
}

function scoreDiameter(diameterMm: number, wristCm: number): number {
  const wristMm = wristCm * 10;
  const ratio = diameterMm / wristMm;
  // Ideal range: 0.36–0.46 of wrist circumference in mm
  if (ratio >= 0.36 && ratio <= 0.46) return 100;
  if (ratio < 0.36) {
    // Too small — linear falloff from 100 at 0.36 to 40 at 0.28
    return clamp(100 - ((0.36 - ratio) / 0.08) * 60, 0, 100);
  }
  // Too large — linear falloff from 100 at 0.46 to 40 at 0.54
  return clamp(100 - ((ratio - 0.46) / 0.08) * 60, 0, 100);
}

function scoreThickness(thicknessMm: number): number {
  if (thicknessMm <= 9) return 100;
  if (thicknessMm >= 17) return 0;
  if (thicknessMm <= 13) {
    // 100 at 9mm → 50 at 13mm
    return 100 - ((thicknessMm - 9) / 4) * 50;
  }
  // 50 at 13mm → 0 at 17mm
  return 50 - ((thicknessMm - 13) / 4) * 50;
}

function scoreLugToLug(lugMm: number, wristCm: number): number {
  const wristWidthMm = (wristCm * 10) / Math.PI;
  if (lugMm <= wristWidthMm) return 100;
  // Linear falloff: 0 at 120% of wrist width
  const overhang = lugMm / wristWidthMm;
  return clamp(100 - ((overhang - 1) / 0.2) * 100, 0, 100);
}

function getLabel(score: number): string {
  if (score >= 85) return 'Perfect Fit';
  if (score >= 70) return 'Great Fit';
  if (score >= 55) return 'Good Fit';
  if (score >= 40) return 'Wearable';
  return 'May Not Suit';
}

function buildVerdict(diameterMm: number | null, wristCm: number, overall: number, lugMm: number | null): string {
  const wristMm = wristCm * 10;
  if (!diameterMm) return '';

  const sizeWord = overall >= 70 ? 'excellent' : overall >= 55 ? 'good' : overall >= 40 ? 'acceptable' : 'challenging';

  let base = `This ${diameterMm}mm case is an ${sizeWord} match for your ${wristCm}cm wrist`;

  if (overall >= 70) {
    base += ' — balanced presence without overhang.';
  } else if (overall >= 55) {
    base += ' — noticeable on the wrist but still comfortable.';
  } else if (overall >= 40) {
    base += ' — it will wear large, consider trying it on first.';
  } else {
    base += ' — this watch may overhang your wrist significantly.';
  }

  if (lugMm) {
    const wristWidth = wristMm / Math.PI;
    if (lugMm > wristWidth * 1.05) {
      base += ` Tip: The ${lugMm}mm lug-to-lug may extend past your wrist.`;
    }
  }

  return base;
}

export function calculateFitScores(wristCm: number, caseSpecs: CaseSpecs | undefined | null): FitScores | null {
  if (!caseSpecs) return null;

  const diameterMm = parseSpecMm(caseSpecs.diameter);
  const thicknessMm = parseSpecMm(caseSpecs.thickness);
  const lugMm = parseSpecMm(caseSpecs.lugToLug);

  // Need at least diameter to calculate
  if (diameterMm === null) return null;

  const dScore = scoreDiameter(diameterMm, wristCm);
  const tScore = thicknessMm !== null ? scoreThickness(thicknessMm) : null;
  const lScore = lugMm !== null ? scoreLugToLug(lugMm, wristCm) : null;

  // Weighted average — redistribute weights if some specs missing
  let totalWeight = 0;
  let weightedSum = 0;

  weightedSum += dScore * 50;
  totalWeight += 50;

  if (tScore !== null) {
    weightedSum += tScore * 25;
    totalWeight += 25;
  }
  if (lScore !== null) {
    weightedSum += lScore * 25;
    totalWeight += 25;
  }

  const overall = Math.round(weightedSum / totalWeight);

  return {
    overall,
    diameter: Math.round(dScore),
    thickness: tScore !== null ? Math.round(tScore) : null,
    lugToLug: lScore !== null ? Math.round(lScore) : null,
    label: getLabel(overall),
    verdict: buildVerdict(diameterMm, wristCm, overall, lugMm),
  };
}
