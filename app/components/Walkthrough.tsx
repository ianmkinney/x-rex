'use client';
import {useEffect, useState} from 'react';
import {createPortal} from 'react-dom';
import Image from 'next/image';

import {TOUR_STORAGE_KEY} from '@/lib/tour';

const steps = [
  ['Meet your writing sidekick.', 'Explore audience fit and drafts in your voice. Scores are simulations—not For You promises.', 'START HERE'],
  ['Make it sound like you.', 'Open Your writing style, save examples, and pick your OpenRouter model.', '01 / YOUR VOICE'],
  ['Find the right people.', 'Analyze a post or Build for an audience to match archetypes and draft options.', '02 / YOUR AUDIENCE'],
  ['Write for their interests.', 'Target a profile from a public bio and posts, or paste examples.', '03 / A SPECIFIC READER'],
  ['Copy the post. Keep the why.', 'Copy post, Post on X, and read the why below.', '04 / READY TO SHARE'],
] as const;

function tourDismissed() {
  try {
    return localStorage.getItem(TOUR_STORAGE_KEY) === 'done';
  } catch {
    return false;
  }
}

export default function Walkthrough({request, onVoice}: {request: number; onVoice: () => void}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
  }, []);

  useEffect(() => {
    if (!tourDismissed()) setOpen(true);
  }, []);

  useEffect(() => {
    if (request) {
      setStep(0);
      setOpen(true);
    }
  }, [request]);

  function finish() {
    try {
      localStorage.setItem(TOUR_STORAGE_KEY, 'done');
    } catch {
      /* ignore quota / private mode */
    }
    setOpen(false);
  }

  if (!open || !mounted) return null;

  const last = step === steps.length - 1;

  const card = (
    <aside className="tour-hint" role="status" aria-live="polite" aria-label="Quick tour tip">
      <div className="tour-hint-top">
        <Image src="/x-rex.webp" alt="" width={36} height={36}/>
        <button type="button" className="text-button" onClick={finish}>Dismiss</button>
      </div>
      <div className="tour-hint-main">
        <div className="eyebrow">{steps[step][2]}</div>
        <h2>{steps[step][0]}</h2>
        <p className="tour-hint-body">{steps[step][1]}</p>
        {last && (
          <button type="button" className="text-button tour-voice" onClick={() => { finish(); onVoice(); }}>
            Set up my writing voice
          </button>
        )}
      </div>
      <div className="tour-hint-footer">
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
        <small>{step + 1} of {steps.length}</small>
      </div>
    </aside>
  );

  return createPortal(card, document.body);
}
