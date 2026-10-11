'use client';
import {useEffect,useLayoutEffect,useRef,useState} from 'react';
import Image from 'next/image';

import {TOUR_STORAGE_KEY} from '@/lib/tour';

const TOUR_WIDTH_MAX = 300;
const TOUR_WIDTH_MIN = 200;

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

const TOUR_BOTTOM_INSET = 16;
const TOUR_CHROME_GAP = 8;

const TOUR_CHROME_SELECTORS = [
  '.mode-tabs',
  '.page-heading h1',
  '.page-heading .version-pill',
] as const;

const TOUR_PICKER_CONTROL_SELECTORS = '.model-picker select, .model-picker button';

function tourControlElements(): Element[] {
  const nodes: Element[] = [];
  for (const sel of TOUR_CHROME_SELECTORS) {
    nodes.push(...document.querySelectorAll(sel));
  }
  document.querySelectorAll(TOUR_PICKER_CONTROL_SELECTORS).forEach(node => nodes.push(node));
  return nodes;
}

function rectsOverlap(a: DOMRect, b: DOMRect) {
  return a.width > 0 && b.width > 0 && a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
}

function tourWidthMax() {
  if (window.innerWidth <= 700) return Math.min(TOUR_WIDTH_MAX, 240);
  return TOUR_WIDTH_MAX;
}

function tourWidthMin() {
  return window.innerWidth <= 700 ? 168 : TOUR_WIDTH_MIN;
}

function controlOverlapsTour(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  for (const node of tourControlElements()) {
    if (rectsOverlap(rect, node.getBoundingClientRect())) return true;
  }
  return false;
}

function shrinkWidthToClearControls(el: HTMLElement) {
  const widthMax = tourWidthMax();
  const widthMin = tourWidthMin();

  for (let width = widthMax; width >= widthMin; width -= 8) {
    el.style.width = `${width}px`;
    if (!controlOverlapsTour(el)) return;
  }
  el.style.width = `${widthMin}px`;
}

function clampMaxHeightBelowChrome(el: HTMLElement) {
  const bottomInset = TOUR_BOTTOM_INSET;
  const cssMax = window.innerHeight - bottomInset - TOUR_CHROME_GAP;
  let maxH = cssMax;

  for (let i = 0; i < 16; i++) {
    el.style.maxHeight = `${Math.max(120, maxH)}px`;
    const rect = el.getBoundingClientRect();
    let minTop = TOUR_CHROME_GAP;
    let overlaps = false;
    for (const node of tourControlElements()) {
      const r = node.getBoundingClientRect();
      if (!rectsOverlap(rect, r)) continue;
      overlaps = true;
      minTop = Math.max(minTop, r.bottom + TOUR_CHROME_GAP);
    }
    if (!overlaps) {
      el.dataset.compact = el.getBoundingClientRect().height < 220 ? 'true' : '';
      return;
    }
    const nextMax = window.innerHeight - bottomInset - minTop;
    if (nextMax >= maxH - 0.5) {
      el.dataset.compact = 'true';
      return;
    }
    maxH = nextMax;
    el.dataset.compact = 'true';
  }
}

function keepCardInViewport(el: HTMLElement) {
  for (let i = 0; i < 8; i++) {
    const rect = el.getBoundingClientRect();
    if (rect.top >= -0.5 && rect.bottom <= window.innerHeight + 0.5) return;
    if (rect.top < -0.5) {
      const trim = -rect.top + 4;
      el.style.maxHeight = `${Math.max(120, rect.height - trim)}px`;
      el.dataset.compact = 'true';
      continue;
    }
    return;
  }
}

function keepVoiceInView(el: HTMLElement) {
  const voice = el.querySelector('.tour-voice');
  if (!voice) return;
  for (let i = 0; i < 10; i++) {
    const r = voice.getBoundingClientRect();
    if (r.top >= 0 && r.bottom <= window.innerHeight + 0.5 && r.height > 0) return;
    const overflow = Math.max(0, r.bottom - window.innerHeight) + Math.max(0, -r.top);
    el.style.maxHeight = `${Math.max(120, el.getBoundingClientRect().height - overflow - 6)}px`;
    el.dataset.compact = 'true';
  }
}

function keepFooterInView(el: HTMLElement) {
  const footer = el.querySelector('.tour-hint-footer');
  if (!footer) return;
  for (let i = 0; i < 8; i++) {
    const footerBottom = footer.getBoundingClientRect().bottom;
    if (footerBottom <= window.innerHeight + 0.5) return;
    const trim = footerBottom - window.innerHeight + 4;
    const maxH = el.getBoundingClientRect().height - trim;
    el.style.maxHeight = `${Math.max(120, maxH)}px`;
    el.dataset.compact = 'true';
  }
}

function layoutTourCard(el: HTMLElement) {
  el.style.width = `${tourWidthMax()}px`;
  el.style.maxHeight = '';
  delete el.dataset.compact;
  for (let pass = 0; pass < 12; pass++) {
    shrinkWidthToClearControls(el);
    clampMaxHeightBelowChrome(el);
    if (!controlOverlapsTour(el)) break;
  }
  keepFooterInView(el);
  keepCardInViewport(el);
  keepVoiceInView(el);
}

export default function Walkthrough({request, onVoice}: {request: number; onVoice: () => void}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mobileLayout, setMobileLayout] = useState(
    () => typeof window !== 'undefined' && window.matchMedia('(max-width: 700px)').matches,
  );
  const tourRef = useRef<HTMLElement>(null);

  useEffect(() => {
    if (!tourDismissed()) setOpen(true);
  }, []);

  useEffect(() => {
    const mq = window.matchMedia('(max-width: 700px)');
    const update = () => setMobileLayout(mq.matches);
    update();
    mq.addEventListener('change', update);
    return () => mq.removeEventListener('change', update);
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
    const run = () => layoutTourCard(el);
    run();
    const resizeObserver = new ResizeObserver(run);
    const watched = document.querySelector('.main-content');
    const picker = document.querySelector('.model-picker');
    if (watched) resizeObserver.observe(watched);
    if (picker) resizeObserver.observe(picker);
    window.addEventListener('resize', run);
    return () => {
      resizeObserver?.disconnect();
      window.removeEventListener('resize', run);
    };
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
      <div className="tour-hint-scroll">
        <div className="eyebrow">{steps[step][2]}</div>
        <h2>{steps[step][0]}</h2>
        <p className="tour-hint-body">{steps[step][1]}</p>
        {last && mobileLayout && (
          <button type="button" className="text-button tour-voice" onClick={() => { finish(); onVoice(); }}>
            Set up my writing voice
          </button>
        )}
      </div>
      <div className="tour-hint-footer">
        {last && !mobileLayout && (
          <button type="button" className="text-button tour-voice" onClick={() => { finish(); onVoice(); }}>
            Set up my writing voice
          </button>
        )}
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
        <small>{step + 1} of {steps.length} · You can replay this anytime</small>
      </div>
    </aside>
  );
}
