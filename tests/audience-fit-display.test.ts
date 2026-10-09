import {test} from 'node:test';
import assert from 'node:assert/strict';
import {
  AUDIENCE_FIT_OFFSET_MAX,
  AUDIENCE_FIT_OFFSET_MIN,
  AUDIENCE_FIT_OKAY_MIN,
  AUDIENCE_FIT_STRONG_MIN,
  audienceFitLabel,
  audienceFitScore,
  formatAudienceFit,
} from '../lib/audience-fit-display';

test('audience fit score clamps to the documented offset range', () => {
  assert.equal(audienceFitScore(AUDIENCE_FIT_OFFSET_MIN), 0);
  assert.equal(audienceFitScore(AUDIENCE_FIT_OFFSET_MAX), 100);
  assert.equal(audienceFitScore(AUDIENCE_FIT_OFFSET_MIN - 0.01), 0);
  assert.equal(audienceFitScore(AUDIENCE_FIT_OFFSET_MAX + 5), 100);
});

test('audience fit labels use fixed score thresholds', () => {
  assert.equal(audienceFitLabel(AUDIENCE_FIT_STRONG_MIN), 'Strong fit');
  assert.equal(audienceFitLabel(AUDIENCE_FIT_STRONG_MIN - 1), 'Okay fit');
  assert.equal(audienceFitLabel(AUDIENCE_FIT_OKAY_MIN), 'Okay fit');
  assert.equal(audienceFitLabel(AUDIENCE_FIT_OKAY_MIN - 1), 'Weak fit');
});

test('formatAudienceFit maps a strong lexical match and preserves raw in tooltip', () => {
  const fit = formatAudienceFit(0.60832, 0.607, true);
  assert.equal(fit.display, '94');
  assert.equal(fit.sublabel, 'Strong fit');
  assert.match(fit.title, /0\.60700/);
});

test('formatAudienceFit handles ineligible rows', () => {
  const fit = formatAudienceFit(0, -1, false);
  assert.equal(fit.display, 'Filtered');
  assert.equal(fit.sublabel, 'not eligible');
  assert.equal(fit.title, '');
});
