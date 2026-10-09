'use client';
import {useEffect,useState} from 'react';
import Image from 'next/image';

import {TOUR_STORAGE_KEY} from '@/lib/tour';

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

export default function Walkthrough({request, onVoice}: {request: number; onVoice: () => void}) {
  const [open, setOpen] = useState(false);
  const [step, setStep] = useState(0);

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

  if (!open) return null;

  const last = step === steps.length - 1;

  return (
    <aside className="tour-hint" role="status" aria-live="polite" aria-label="Quick tour tip">
      <div className="tour-hint-top">
        <Image src="/x-rex.webp" alt="" width={48} height={48}/>
        <button type="button" className="text-button" onClick={finish}>Dismiss</button>
      </div>
      <div className="eyebrow">{steps[step][2]}</div>
      <h2>{steps[step][0]}</h2>
      <p>{steps[step][1]}</p>
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
