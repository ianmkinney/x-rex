/**
 * Audience fit UI scores spread each analysis run across 0–100.
 *
 * Raw weighted sums can cluster (many negatives look identical after offset
 * rescaling). For a readable mix of Strong / Okay / Weak labels, we rank
 * eligible archetypes by raw value within the current result set and map
 * rank linearly to 0–100 (worst → 0, best → 100). Tooltip text still shows
 * the underlying raw value score from the engine.
 */
export const AUDIENCE_FIT_STRONG_MIN = 70;
export const AUDIENCE_FIT_OKAY_MIN = 40;

export type AudienceFitLabel = 'Strong fit' | 'Okay fit' | 'Weak fit';

export function audienceFitLabel(score: number): AudienceFitLabel {
  if (score >= AUDIENCE_FIT_STRONG_MIN) return 'Strong fit';
  if (score >= AUDIENCE_FIT_OKAY_MIN) return 'Okay fit';
  return 'Weak fit';
}

/** Rank-based 0–100 display scores, one per result row (ineligible rows stay 0). */
export function audienceFitDisplayScores(results: {raw: number; eligible: boolean}[]): number[] {
  const scores = results.map(() => 0);
  const eligible = results.map((r, i) => (r.eligible ? i : -1)).filter(i => i >= 0);
  if (!eligible.length) return scores;
  if (eligible.length === 1) {
    scores[eligible[0]] = 100;
    return scores;
  }
  const sorted = [...eligible].sort((a, b) => results[a].raw - results[b].raw);
  sorted.forEach((index, rank) => {
    scores[index] = Math.round((rank / (sorted.length - 1)) * 100);
  });
  return scores;
}

export type AudienceFitDisplay =
  | {eligible: false; display: 'Filtered'; sublabel: 'not eligible'; title: ''}
  | {eligible: true; display: string; sublabel: AudienceFitLabel; score: number; title: string};

export function formatAudienceFit(displayScore: number, raw: number, eligible: boolean): AudienceFitDisplay {
  if (!eligible) {
    return {eligible: false, display: 'Filtered', sublabel: 'not eligible', title: ''};
  }
  const score = displayScore;
  const sublabel = audienceFitLabel(score);
  return {
    eligible: true,
    display: String(score),
    sublabel,
    score,
    title: `Raw value score: ${raw.toFixed(5)}`,
  };
}
