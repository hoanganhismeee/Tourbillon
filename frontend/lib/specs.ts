// Shared watch specification parsing utilities
// Extracts and formats WatchSpecs JSON into display-ready sections

export interface SpecRow {
  label: string;
  value: string;
}

export interface SpecSection {
  title: string;
  rows: SpecRow[];
}

export interface StructuredSpecs {
  productionStatus?: string;
  dial?: Record<string, unknown>;
  case?: Record<string, unknown>;
  movement?: Record<string, unknown>;
  strap?: Record<string, unknown>;
}

// Label maps for each spec section — controls display order and human-readable names
const caseLabels: Record<string, string> = {
  material: 'Material',
  diameter: 'Diameter',
  thickness: 'Thickness',
  waterResistance: 'Water Resistance',
  crystal: 'Crystal',
  caseBack: 'Case Back',
};

const dialLabels: Record<string, string> = {
  color: 'Color',
  finish: 'Finish',
  indices: 'Indices',
  hands: 'Hands',
};

const movementLabels: Record<string, string> = {
  caliber: 'Caliber',
  type: 'Type',
  powerReserve: 'Power Reserve',
  frequency: 'Frequency',
  jewels: 'Jewels',
  functions: 'Functions',
};

const strapLabels: Record<string, string> = {
  material: 'Material',
  color: 'Color',
  buckle: 'Buckle',
};

// Parse structured specs JSON string into typed object
export function parseStructuredSpecs(specsString: string | null): StructuredSpecs | null {
  if (!specsString) return null;

  try {
    const parsed = JSON.parse(specsString);
    if (parsed && typeof parsed === 'object' && !Array.isArray(parsed) &&
      (parsed.dial || parsed.case || parsed.movement || parsed.strap)) {
      return parsed as StructuredSpecs;
    }
  } catch {
    // Not JSON
  }
  return null;
}

// Parse legacy flat specs (array or semicolon-separated)
export function parseFlatSpecs(specsString: string | null): SpecRow[] {
  if (!specsString) return [];

  try {
    const parsed = JSON.parse(specsString);
    if (Array.isArray(parsed)) {
      return parsed.map(spec => ({
        label: spec.name || spec.key || 'Specification',
        value: spec.value || spec.val || 'N/A'
      }));
    }
    if (typeof parsed === 'object' && !parsed.dial && !parsed.case && !parsed.movement) {
      return Object.entries(parsed).map(([key, val]) => ({
        label: key.charAt(0).toUpperCase() + key.slice(1),
        value: String(val) || 'N/A'
      }));
    }
  } catch {
    const specs = specsString.split(';').map(s => s.trim()).filter(Boolean);
    return specs.map(spec => {
      const idx = spec.indexOf(':');
      if (idx > 0) {
        return { label: spec.substring(0, idx).trim(), value: spec.substring(idx + 1).trim() };
      }
      return { label: 'Specification', value: spec };
    });
  }
  return [{ label: 'Specifications', value: specsString }];
}

// Format a spec section's fields into display rows
export function formatSection(section: Record<string, unknown> | undefined, labels: Record<string, string>): SpecRow[] {
  if (!section) return [];
  return Object.entries(labels)
    .filter(([key]) => section[key] != null)
    .map(([key, label]) => {
      const val = section[key];
      if (Array.isArray(val)) {
        return { label, value: val.map((v, i) => i === 0 ? String(v) : String(v).toLowerCase()).join(', ') };
      }
      return { label, value: String(val) };
    });
}

// Build all spec sections from structured specs
export function buildSpecSections(specs: StructuredSpecs): SpecSection[] {
  return [
    { title: 'Case', rows: formatSection(specs.case, caseLabels) },
    { title: 'Dial', rows: formatSection(specs.dial, dialLabels) },
    { title: 'Movement', rows: formatSection(specs.movement, movementLabels) },
    { title: 'Strap', rows: formatSection(specs.strap, strapLabels) },
  ].filter(s => s.rows.length > 0);
}

// Get all unique spec labels across sections (for comparison table)
export function getAllLabelsForSection(sectionKey: 'case' | 'dial' | 'movement' | 'strap'): Record<string, string> {
  const labelMaps = { case: caseLabels, dial: dialLabels, movement: movementLabels, strap: strapLabels };
  return labelMaps[sectionKey];
}
