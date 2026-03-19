// Wrist-fit scoring engine
// Pure functions — no side effects, no API calls

export interface FitScores {
  overall: number;
  diameter: number | null;
  thickness: number | null;
  label: string;
  verdict: string;
}

interface CaseSpecs {
  diameter?: string;
  thickness?: string;
}

// Extract numeric mm value from spec string (e.g., "40 mm" → 40, "9.24 mm" → 9.24)
export function parseSpecMm(value: string | undefined | null): number | null {
  if (!value) return null;
  const match = value.match(/([\d.]+)\s*mm/i);
  if (match) return parseFloat(match[1]);
  const bare = parseFloat(value);
  return isNaN(bare) ? null : bare;
}

function scoreDiameter(diameterMm: number, wristCm: number): number {
  const wristWidth = (wristCm * 10) / Math.PI;
  const ratio = diameterMm / wristWidth;

  if (ratio >= 0.68 && ratio <= 0.76) return 100;

  if (ratio >= 0.64 && ratio < 0.68) {
    // 80 -> 100
    return 80 + ((ratio - 0.64) / (0.68 - 0.64)) * 20;
  }

  if (ratio > 0.76 && ratio <= 0.82) {
    // 100 -> 80
    return 100 - ((ratio - 0.76) / (0.82 - 0.76)) * 20;
  }

  if (ratio >= 0.58 && ratio < 0.64) {
    // 40 -> 80
    return 40 + ((ratio - 0.58) / (0.64 - 0.58)) * 40;
  }

  if (ratio > 0.82 && ratio <= 0.88) {
    // 80 -> 40
    return 80 - ((ratio - 0.82) / (0.88 - 0.82)) * 40;
  }

  if (ratio > 0.88 && ratio <= 1.00) {
    // 40 -> 0
    return 40 - ((ratio - 0.88) / (1.00 - 0.88)) * 40;
  }

  return 0;
}

function scoreThickness(thicknessMm: number): number {
  if (thicknessMm <= 9.0) return 100;
  if (thicknessMm >= 17.0) return 0;

  if (thicknessMm <= 11.5) {
    // 100 -> 75
    return 100 - ((thicknessMm - 9.0) / (11.5 - 9.0)) * 25;
  }

  if (thicknessMm <= 13.5) {
    // 75 -> 45
    return 75 - ((thicknessMm - 11.5) / (13.5 - 11.5)) * 30;
  }

  if (thicknessMm <= 15.5) {
    // 45 -> 15
    return 45 - ((thicknessMm - 13.5) / (15.5 - 13.5)) * 30;
  }

  // 15.5 -> 17.0 : 15 -> 0
  return 15 - ((thicknessMm - 15.5) / (17.0 - 15.5)) * 15;
}

function getLabel(score: number): string {
  if (score >= 85) return 'Perfect Fit';
  if (score >= 70) return 'Great Fit';
  if (score >= 55) return 'Good Fit';
  if (score >= 40) return 'Wearable';
  return 'May Not Suit';
}

function buildVerdict(diameterMm: number, wristCm: number, overall: number): string {
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

  return base;
}

export function calculateFitScores(wristCm: number, caseSpecs: CaseSpecs | undefined | null): FitScores | null {
  if (!caseSpecs) return null;

  const diameterMm = parseSpecMm(caseSpecs.diameter);
  const thicknessMm = parseSpecMm(caseSpecs.thickness);

  if (diameterMm === null) return null;

  const dScore = scoreDiameter(diameterMm, wristCm);
  const tScore = thicknessMm !== null ? scoreThickness(thicknessMm) : null;

  // 70% diameter, 30% thickness; diameter-only if thickness unavailable
  const overall = tScore !== null
    ? Math.round(dScore * 0.7 + tScore * 0.3)
    : Math.round(dScore);

  return {
    overall,
    diameter: Math.round(dScore),
    thickness: tScore !== null ? Math.round(tScore) : null,
    label: getLabel(overall),
    verdict: buildVerdict(diameterMm, wristCm, overall),
  };
}
