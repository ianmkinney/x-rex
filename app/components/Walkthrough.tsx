'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Image from 'next/image';

import {TOUR_STORAGE_KEY} from '@/lib/tour';

const TOUR_BOTTOM_GUTTER = 84;
const TOUR_SIDE_GUTTER = 88;
const TOUR_CLEARANCE = 12;

const FORBIDDEN_SELECTORS = [
  '.mode-tabs',
  '.page-heading h1',
  '.page-heading .version-pill',
  '.model-picker',
];

const steps = [
  ['Meet your writing sidekick.', 'X-Rex helps you turn a good idea into a post worth reading. Explore audience fit, draft for specific interests, and keep your own voice. Scores are simulations—not a promise of For You placement.', 'START HERE'],
  ['Make it sound like you.', 'Open Your writing style at the top. Import your own public X profile or paste a few posts, review the examples, then save. Choose your OpenRouter writing model below.', '01 / YOUR VOICE'],
  ['Find the right people.', 'Analyze a post to explore which archetypes it fits. Or use Build for an audience: pick your people, add a topic, and generate three readable options. Restaurant owners are first in the list.', '02 / YOUR AUDIENCE'],
  ['Write for someone’s interests.', 'Target a profile uses a public reader’s bio and posts to suggest interests. This is different from your own writing profile. You can paste public examples if import is unavailable.', '03 / A SPECIFIC READER'],
  ['Copy the post. Keep the why.', 'Each draft has an editable post box, Copy post, and Post on X. The reasoning and algorithm markers sit underneath. Ask X-Rex for help anytime; replay this tour from the header.', '04 / READY TO SHARE'],
] as const;

function tourDismissed() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

function rectsOverlap(a: DOMRect, b: DOMRect) {
  return a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function forbiddenRects() {
  return FORBIDDEN_SELECTORS.flatMap(sel => {
    const el = document.querySelector(sel);
    if (!el) return [];
    const rect = el.getBoundingClientRect();
    return rect.width > 0 && rect.height > 0 ? [rect] : [];
  });
}

function overlapsForbidden(tour: DOMRect) {
  return forbiddenRects().some(block => rectsOverlap(tour, block));
}

function tabsFloor() {
  const tabs = document.querySelector('.mode-tabs')?.getBoundingClientRect();
  return (tabs?.bottom ?? 0) + TOUR_CLEARANCE;
}

function anchorInResultsColumn(el: HTMLElement) {
  const results = document.querySelector('.results-panel')?.getBoundingClientRect();
  if (results && results.width > 180) {
    el.style.left = `${results.left + 16}px`;
    el.style.right = 'auto';
    el.style.maxWidth = `${Math.min(360, results.width - 32)}px`;
    return;
  }
  el.style.left = 'auto';
  el.style.right = `${TOUR_SIDE_GUTTER}px`;
  el.style.maxWidth = '';
}

function applyPlacement(el: HTMLElement, compact: boolean, anchorTop: boolean) {
  el.classList.toggle('tour-hint--tip', compact);
  el.style.maxHeight = '';
  el.style.overflowY = 'visible';
  anchorInResultsColumn(el);
  if (anchorTop) {
    el.style.top = `${tabsFloor()}px`;
    el.style.bottom = 'auto';
  } else {
    el.style.top = 'auto';
    el.style.bottom = `${TOUR_BOTTOM_GUTTER}px`;
  }
}

function fitsViewport(tour: DOMRect) {
  const actions = document.querySelector('.tour-hint .tour-actions')?.getBoundingClientRect();
  const actionsBottom = actions?.bottom ?? tour.bottom;
  return tour.top >= tabsFloor() - 1 && actionsBottom <= window.innerHeight - 8;
}

function placeTourCard(el: HTMLElement) {
  const short = window.innerHeight <= 750;
  const layouts: {compact: boolean; anchorTop: boolean}[] = short
    ? [
        {compact: true, anchorTop: true},
        {compact: false, anchorTop: true},
        {compact: true, anchorTop: false},
        {compact: false, anchorTop: false},
      ]
    : [
        {compact: false, anchorTop: true},
        {compact: true, anchorTop: true},
        {compact: false, anchorTop: false},
        {compact: true, anchorTop: false},
      ];
  let best: {compact: boolean; anchorTop: boolean} | null = null;
  for (const layout of layouts) {
    applyPlacement(el, layout.compact, layout.anchorTop);
    const rect = el.getBoundingClientRect();
    if (!overlapsForbidden(rect) && fitsViewport(rect)) return;
    if (!overlapsForbidden(rect) && !best) best = layout;
  }
  if (best) applyPlacement(el, best.compact, best.anchorTop);
  else applyPlacement(el, true, true);

  if (el.getBoundingClientRect().bottom > window.innerHeight - 8) {
    el.scrollIntoView({block: 'end', inline: 'nearest'});
  }
}

export default function Walkthrough({request, onVoice}: {request: number; onVoice: () => void}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const tourRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!tourDismissed()) setOpen(true);
  }, []);

  useEffect(() => {
    if (request) {
      setStep(0);
      setOpen(true);
    }
  }, [request]);

  useLayoutEffect(() => {
    if (!open) return;
    const el = tourRef.current;
    if (!el) return;
    const run = () => placeTourCard(el);
    run();
    window.addEventListener('resize', run);
    return () => window.removeEventListener('resize', run);
  }, [open, step]);

  function finish() {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    } catch {
      /* ignore quota / private mode */
    }
    setOpen(false);
  }

  if (!open) return null;

  const last = step === steps.length - 1;

  return (
    <aside ref={tourRef} className="tour-hint" role="status" aria-live="polite" aria-label="Quick tour tip">
      <div className="tour-hint-top">
        <Image src="/x-rex.webp" alt="" width={48} height={48}/>
        <button type="button" className="text-button" onClick={finish}>Dismiss</button>
      </div>
      <div className="eyebrow">{steps[step][2]}</div>
      <h2>{steps[step][0]}</h2>
      <p className="tour-hint-body">{steps[step][1]}</p>
      <div className="tour-dots" aria-label="Tour steps">
        {steps.map((s, i) => (
          <button
            key={s[0]}
            type="button"
            aria-label={`Go to tour step ${i + 1}`}
            aria-current={i === step ? 'step' : undefined}
            className={i === step ? 'active' : ''}
            onClick={() => setStep(i)}
          />
        ))}
      </div>
      <div className="tour-actions">
        <button type="button" className="secondary" disabled={step === 0} onClick={() => setStep(n => n - 1)}>Back</button>
        <button type="button" className="primary" onClick={() => (last ? finish() : setStep(n => n + 1))}>
          {last ? 'Got it' : 'Next'}
        </button>
      </div>
      {last && (
        <button type="button" className="text-button tour-voice" onClick={() => { finish(); onVoice(); }}>
          Set up my writing voice
        </button>
      )}
      <small>{step + 1} of {steps.length} · You can replay this anytime</small>
    </aside>
  );
}
