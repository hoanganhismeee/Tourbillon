// Pure grading logic for the concierge spec-answer check.
//
// Separated from the runner so it can be tested without a backend. That separation is not
// cosmetic: the first version of this grader scored every generic reply as a hallucination
// and reported a 33% rate where the true rate was 0%. A grader whose bugs produce confident
// wrong conclusions needs tests more than the code it grades.

/// Phrasings that decline to answer. A refusal is a non-answer, never a false claim.
export const REFUSAL = /\b(don't have|do not have|not sure|no information|unable to|isn't listed|is not listed|not specified|couldn't find|could not find|no model with that reference)\b/i;

/// Competing values per field. Naming a different one of these is an assertion about the
/// field, and only then is an answer wrong; saying nothing about it is a non-answer.
export const VOCABULARY = {
  'case material': ['steel', 'titanium', 'platinum', 'ceramic', 'carbon', 'tantalum',
                    'rose gold', 'pink gold', 'white gold', 'yellow gold', 'gold'],
  'dial colour': ['black', 'blue', 'silver', 'white', 'green', 'grey', 'gray', 'brown',
                  'salmon', 'champagne', 'slate', 'anthracite', 'openworked', 'skeleton',
                  'transparent', 'sapphire', 'mother-of-pearl'],
  'movement type': ['automatic', 'self-winding', 'selfwinding', 'manual', 'hand-wound',
                    'hand wound', 'quartz', 'spring drive'],
};

/// Words that mean the same thing to a buyer. The catalogue and the model rarely spell a
/// material or a winding type the same way, and a spelling difference is not an error.
export const SYNONYMS = {
  'rose gold': ['rose gold', 'pink gold', '5n'],
  'pink gold': ['rose gold', 'pink gold', '5n'],
  automatic: ['automatic', 'self-winding', 'selfwinding', 'automatique', 'spring drive'],
  manual: ['manual', 'hand-wound', 'hand wound', 'manually wound', 'hand-winding'],
  transparent: ['transparent', 'sapphire', 'openworked', 'skeleton'],
};

/// Every figure the answer states for this field, ranges expanded. The catalogue stores
/// "min. 38 - max. 48 hours", and an answer of "38-48 hours" is correct on both ends;
/// reading only the figure adjacent to the unit would score the true answer as wrong.
export function statedNumbers(answer, unit) {
  const out = [];
  for (const m of answer.toLowerCase()
    .matchAll(/((?:\d+(?:[.,]\d+)?)(?:\s*[-–—/]\s*\d+(?:[.,]\d+)?)*)\s*([a-z]+)/g)) {
    if (!unit.test(m[2])) continue;
    for (const part of m[1].split(/[-–—/]/)) {
      const v = Number(part.trim().replace(',', '.'));
      if (!Number.isNaN(v)) out.push(v);
    }
  }
  return out;
}

/// Only a figure carrying the field's unit counts as an assertion. An earlier version tested
/// the unit against the whole answer, and the pattern "hour|hr|h\b" matched the h in "watch",
/// which turned every refusal into a hallucination.
export function gradeNumber(answer, expected, unit) {
  const stated = statedNumbers(answer, unit);
  if (stated.some(n => Math.abs(n - Number(expected)) < 0.51)) return 'correct';
  return stated.length > 0 ? 'wrong' : 'absent';
}

/// The spellings that should count as naming the stored value.
export function acceptedTerms(expected) {
  const value = String(expected).toLowerCase();
  const accepted = new Set();
  for (const [canonical, words] of Object.entries(SYNONYMS)) {
    if (value.includes(canonical)) words.forEach(w => accepted.add(w));
  }
  for (const token of value.replace(/[^a-z\s-]/g, ' ').split(/\s+/)) {
    if (token.length >= 4 && !['with', 'case', 'dial'].includes(token)) accepted.add(token);
  }
  if (accepted.size === 0) accepted.add(value);
  return accepted;
}

/// Text fields are graded on the distinctive word rather than the whole string: the catalogue
/// says "18K rose gold" where an answer reasonably says "rose gold".
export function gradeText(answer, expected, field) {
  const text = answer.toLowerCase();
  const accepted = acceptedTerms(expected);

  if ([...accepted].some(t => text.includes(t))) return 'correct';
  if (REFUSAL.test(text)) return 'absent';

  // Only a competing value from the same field makes this an assertion. A generic product
  // blurb, or a change of subject, is a non-answer — a different failure entirely.
  const competing = (VOCABULARY[field] ?? []).filter(v => !accepted.has(v));
  return competing.some(v => text.includes(v)) ? 'wrong' : 'absent';
}

/// An answer that never mentions the reference is describing some other watch. That is a
/// retrieval miss, not a false claim about this watch's specs, and scoring the two the same
/// way would blame the prose for something the search did.
export function isOffTarget(answer, reference) {
  const text = answer.toLowerCase();
  if (text.includes(reference.toLowerCase())) return false;
  // Accept a distinctive fragment too, so "5711/1A-010" still counts when the answer
  // writes "5711/1A" or just "5711".
  const parts = reference.toLowerCase().match(/[a-z0-9]{4,}/g) ?? [];
  return !parts.some(part => text.includes(part));
}

/// Single entry point, so the runner cannot apply the checks in the wrong order: a refusal is
/// a refusal even when it happens to name the reference, and an answer about a different
/// watch is never graded on this watch's values.
export function grade({ answer, expected, kind, unit, field, reference }) {
  if (REFUSAL.test(answer)) return 'absent';
  if (isOffTarget(answer, reference)) return 'off-target';
  return kind === 'number'
    ? gradeNumber(answer, expected, unit)
    : gradeText(answer, expected, field);
}
