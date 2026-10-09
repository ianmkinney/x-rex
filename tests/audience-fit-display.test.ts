import {test} from 'node:test';
import assert from 'node:assert/strict';
import {ARCHETYPES,DEFAULT_CONTEXT,analyze} from '../lib/engine';
import {
  AUDIENCE_FIT_OKAY_MIN,
  AUDIENCE_FIT_STRONG_MIN,
  audienceFitDisplayScores,
  audienceFitLabel,
  audienceResultsByDisplayScore,
  formatAudienceFit,
} from '../lib/audience-fit-display';

const SAMPLE =
  'One small AI workflow that saves me time: ask Claude to turn meeting notes into an action list, then use an automation to create tasks. Start with one repetitive step, not your entire business. What would you automate first?';

test('audience fit labels use fixed score thresholds', () => {
  assert.equal(audienceFitLabel(AUDIENCE_FIT_STRONG_MIN), 'Strong fit');
  assert.equal(audienceFitLabel(AUDIENCE_FIT_STRONG_MIN - 1), 'Okay fit');
  assert.equal(audienceFitLabel(AUDIENCE_FIT_OKAY_MIN), 'Okay fit');
  assert.equal(audienceFitLabel(AUDIENCE_FIT_OKAY_MIN - 1), 'Weak fit');
});

test('rank-based display scores spread 0–100 across eligible archetypes', () => {
  const scores = audienceFitDisplayScores([
    {raw: -0.6, eligible: true},
    {raw: 0, eligible: true},
    {raw: 0.6, eligible: true},
  ]);
  assert.deepEqual(scores, [0, 50, 100]);
});

test('display sort lists archetypes by descending display score', () => {
  const results = analyze(SAMPLE, ARCHETYPES, DEFAULT_CONTEXT);
  const rows = audienceResultsByDisplayScore(results);
  for (let i = 1; i < rows.length; i++) {
    assert.ok(rows[i - 1].displayScore >= rows[i].displayScore);
  }
  const tech = rows.find(r => r.result.archetype.id === 'tech-curious');
  const everyday = rows.find(r => r.result.archetype.id === 'everyday');
  assert.ok(tech && everyday && tech.displayScore > everyday.displayScore);
});

test('sample post analysis yields more than one fit label', () => {
  const results = analyze(SAMPLE, ARCHETYPES, DEFAULT_CONTEXT);
  const rows = audienceResultsByDisplayScore(results);
  const labels = new Set(rows.map(r => (r.result.eligible ? formatAudienceFit(r.displayScore, r.result.raw, true).sublabel : null)).filter(Boolean));
  assert.ok(labels.size > 1);
  assert.ok(labels.has('Strong fit'));
  assert.ok(labels.has('Weak fit'));
});

test('formatAudienceFit preserves raw value in tooltip', () => {
  const fit = formatAudienceFit(94, 0.607, true);
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
