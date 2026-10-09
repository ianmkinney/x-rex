/**
 * Audience fit UI score maps the engine's post-offset ranking signal to 0–100.
 *
 * The deterministic engine ranks archetypes by `offset` (after X's negative-score
 * rescaling). Raw weighted sums can be negative; offset keeps comparisons on a
 * single scale, so the display score uses offset rather than raw.
 *
 * Mapping: linear clamp from [OFFSET_MIN, OFFSET_MAX] → [0, 100], rounded.
 * OFFSET_MIN is the typical floor for eligible posts with negative raw scores.
 * OFFSET_MAX is a practical ceiling for strong lexical matches in this lab.
 */
export const AUDIENCE_FIT_OFFSET_MIN = 0.00088;
export const AUDIENCE_FIT_OFFSET_MAX = 0.65;

/** Display score ≥ 70 → Strong fit */
export const AUDIENCE_FIT_STRONG_MIN = 70;
/** Display score ≥ 40 (and < 70) → Okay fit; below 40 → Weak fit */
export const AUDIENCE_FIT_OKAY_MIN = 40;

export type AudienceFitLabel = 'Strong fit' | 'Okay fit' | 'Weak fit';

export function audienceFitScore(offset: number): number {
  const span = AUDIENCE_FIT_OFFSET_MAX - AUDIENCE_FIT_OFFSET_MIN;
  const normalized = (offset - AUDIENCE_FIT_OFFSET_MIN) / span;
  return Math.round(Math.min(100, Math.max(0, normalized * 100)));
}

export function audienceFitLabel(score: number): AudienceFitLabel {
  if (score >= AUDIENCE_FIT_STRONG_MIN) return 'Strong fit';
  if (score >= AUDIENCE_FIT_OKAY_MIN) return 'Okay fit';
  return 'Weak fit';
}

export type AudienceFitDisplay =
  | {eligible: false; display: 'Filtered'; sublabel: 'not eligible'; title: ''}
  | {eligible: true; display: string; sublabel: AudienceFitLabel; score: number; title: string};

export function formatAudienceFit(offset: number, raw: number, eligible: boolean): AudienceFitDisplay {
  if (!eligible) {
    return {eligible: false, display: 'Filtered', sublabel: 'not eligible', title: ''};
  }
  const score = audienceFitScore(offset);
  const sublabel = audienceFitLabel(score);
  return {
    eligible: true,
    display: String(score),
    sublabel,
    score,
    title: `Raw value score: ${raw.toFixed(5)}`,
  };
}
