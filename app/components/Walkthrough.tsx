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
const TOUR_RIGHT_INSET = 24;
const TOUR_TABS_GAP = 8;

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

function pickerControlsOverlap(el: HTMLElement) {
  const rect = el.getBoundingClientRect();
  return [...document.querySelectorAll('.model-picker select, .model-picker button')].some(node =>
    rectsOverlap(rect, node.getBoundingClientRect()),
  );
}

function shrinkWidthToClearPicker(el: HTMLElement) {
  const widthMax = tourWidthMax();
  const widthMin = tourWidthMin();
  for (let width = widthMax; width >= widthMin; width -= 8) {
    el.style.width = `${width}px`;
    if (!pickerControlsOverlap(el)) return;
  }
  el.style.width = `${widthMin}px`;
}

function tabsTopCap() {
  const tabs = document.querySelector('.mode-tabs');
  if (tabs) return tabs.getBoundingClientRect().bottom + TOUR_TABS_GAP;
  return TOUR_TABS_GAP;
}

function maxTourHeightFromTabs() {
  return Math.max(160, window.innerHeight - TOUR_BOTTOM_INSET - tabsTopCap());
}

function clearPickerHorizontalOverlap(el: HTMLElement) {
  const widthMax = tourWidthMax();
  el.style.right = `${TOUR_RIGHT_INSET}px`;
  el.style.width = `${widthMax}px`;
  for (let right = TOUR_RIGHT_INSET; right <= window.innerWidth - tourWidthMin() - 16; right += 12) {
    el.style.right = `${right}px`;
    shrinkWidthToClearPicker(el);
    if (!pickerControlsOverlap(el)) return;
  }
  shrinkWidthToClearPicker(el);
}

function layoutTourCard(el: HTMLElement) {
  el.style.bottom = `${TOUR_BOTTOM_INSET}px`;
  el.style.top = 'auto';
  el.style.maxHeight = 'none';

  clearPickerHorizontalOverlap(el);

  const maxH = maxTourHeightFromTabs();
  const naturalH = el.getBoundingClientRect().height;
  const capped = naturalH > maxH + 0.5;
  if (capped) {
    el.style.maxHeight = `${maxH}px`;
    el.dataset.capped = 'true';
  } else {
    el.style.maxHeight = 'none';
    delete el.dataset.capped;
  }
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
    const tabs = document.querySelector('.mode-tabs');
    if (watched) resizeObserver.observe(watched);
    if (tabs) resizeObserver.observe(tabs);
    window.addEventListener('resize', run);
    return () => {
      resizeObserver.disconnect();
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
