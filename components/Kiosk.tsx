'use client';

import { useActionState, useEffect, useRef, useState, useTransition } from 'react';
import { endKioskAction, identifyAction, signAction, type IdentifyState, type SignResult } from '@/app/actions';
import Clock from './Clock';
import * as I from './icons';

export type KioskOfficer = {
  fullName: string;
  firstName: string;
  initials: string;
  title: string;
  department: string;
  status: 'none' | 'in' | 'done';
  signInAt: string;
  signOutAt: string;
};

type Props = { orgName: string; today: string; greeting: string; timeZone: string; officer: KioskOfficer | null };

const IDLE_SECONDS = 60; // status screen closes itself after this long

/**
 * Three steps on one screen:
 *  1. Identify: staff number + PIN
 *  2. Status:   "Good morning, Jane". Shows today's status and the one button that applies.
 *  3. Result:   confirmation, then back to step 1 automatically (shared tablets)
 */
export default function Kiosk({ orgName, today, greeting, timeZone, officer }: Props) {
  const [idState, identify, identifying] = useActionState(identifyAction, null);
  const [result, sign, signing] = useActionState(signAction, null);
  const [dismissed, setDismissed] = useState<string | null>(null);
  const showResult = !!result && result.id !== dismissed;
  const step = showResult ? 'result' : officer ? 'status' : 'identify';

  return (
    <div className="kiosk">
      <aside className="kiosk-hero">
        <div className="hero-time">
          <p className="hero-date">{today}</p>
          <Clock className="hero-clock" timeZone={timeZone} />
          <p className="hero-sub">Directors &amp; officers: sign in when you arrive and sign out when you leave.</p>
        </div>
        <p className="hero-foot"><I.Lock /> Available on the {orgName} network only</p>
      </aside>

      <section className="kiosk-panel">
        <div className="kiosk-card" key={step} data-step={step}>
          {step === 'result' && result ? (
            <ResultView result={result} onDone={() => setDismissed(result.id)} />
          ) : step === 'status' && officer ? (
            <StatusView officer={officer} greeting={greeting} sign={sign} signing={signing} />
          ) : (
            <IdentifyView state={idState} action={identify} pending={identifying} />
          )}
        </div>
      </section>
    </div>
  );
}

function IdentifyView({ state, action, pending }: { state: IdentifyState; action: (f: FormData) => void; pending: boolean }) {
  const formRef = useRef<HTMLFormElement>(null);

  // Clear half-typed details after a minute idle so the next person doesn't see them.
  useEffect(() => {
    let idle: ReturnType<typeof setTimeout>;
    const reset = () => {
      clearTimeout(idle);
      idle = setTimeout(() => formRef.current?.reset(), 60_000);
    };
    const events = ['input', 'click', 'keydown'] as const;
    events.forEach((e) => document.addEventListener(e, reset));
    reset();
    return () => {
      clearTimeout(idle);
      events.forEach((e) => document.removeEventListener(e, reset));
    };
  }, []);

  return (
    <>
      <p className="eyebrow">Welcome</p>
      <h1 className="card-title">Sign in or out</h1>
      <p className="muted">Enter your staff number and PIN to continue.</p>
      {state?.error && <div className="alert error" role="alert"><I.Alert /> <span>{state.error}</span></div>}
      <form ref={formRef} action={action} autoComplete="off" className="stack">
        <label className="field">
          <span>Staff number</span>
          <div className="input-wrap">
            <I.User />
            <input name="staff_no" required maxLength={30} autoCapitalize="characters" autoFocus placeholder="e.g. DIR-001" />
          </div>
        </label>
        <label className="field">
          <span>PIN</span>
          <div className="input-wrap">
            <I.Key />
            <input name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" required maxLength={8} placeholder="••••" className="pin" />
          </div>
        </label>
        <button className="btn primary xl" disabled={pending}>
          {pending ? <span className="spinner" /> : <>Continue <I.ArrowRight /></>}
        </button>
      </form>
    </>
  );
}

function StatusView({ officer, greeting, sign, signing }: {
  officer: KioskOfficer; greeting: string; sign: (f: FormData) => void; signing: boolean;
}) {
  const [left, setLeft] = useState(IDLE_SECONDS);
  const [, startTransition] = useTransition();

  useEffect(() => {
    const id = setInterval(() => setLeft((s) => s - 1), 1000);
    return () => clearInterval(id);
  }, []);
  useEffect(() => {
    if (left <= 0) startTransition(() => endKioskAction());
  }, [left]);

  const label = {
    none: 'Not signed in today',
    in: `Signed in since ${officer.signInAt}`,
    done: 'Day complete',
  }[officer.status];

  return (
    <>
      <div className="person">
        <div className="avatar xl">{officer.initials}</div>
        <div>
          <p className="eyebrow">{greeting},</p>
          <h1 className="card-title">{officer.firstName}</h1>
          <p className="muted">{officer.title}{officer.department ? ` · ${officer.department}` : ''}</p>
        </div>
      </div>

      <div className={`status-chip ${officer.status}`} data-status={officer.status}>
        <span className="dot" /> {label}
      </div>

      <ol className="timeline">
        <li className={officer.signInAt ? 'done' : ''}>
          <span className="tl-icon"><I.LogIn /></span>
          <span className="tl-label">Signed in</span>
          <strong>{officer.signInAt || '—'}</strong>
        </li>
        <li className={officer.signOutAt ? 'done' : ''}>
          <span className="tl-icon"><I.LogOut /></span>
          <span className="tl-label">Signed out</span>
          <strong>{officer.signOutAt || '—'}</strong>
        </li>
      </ol>

      {officer.status === 'none' && (
        <form action={sign}>
          <button name="action" value="in" className="btn success xl" disabled={signing}>
            {signing ? <span className="spinner" /> : <><I.LogIn /> Sign in now</>}
          </button>
        </form>
      )}
      {officer.status === 'in' && (
        <form action={sign}>
          <button name="action" value="out" className="btn danger xl" disabled={signing}>
            {signing ? <span className="spinner" /> : <><I.LogOut /> Sign out now</>}
          </button>
        </form>
      )}
      {officer.status === 'done' && (
        <p className="done-note">You have signed in and out today. See you tomorrow!</p>
      )}

      <form action={endKioskAction} className="card-foot">
        <button className="btn ghost">{officer.status === 'done' ? 'Done' : `Not ${officer.firstName}? Cancel`}</button>
        <span className="muted small">Closes in {Math.max(left, 0)}s</span>
      </form>
    </>
  );
}

function ResultView({ result, onDone }: { result: NonNullable<SignResult>; onDone: () => void }) {
  useEffect(() => {
    const id = setTimeout(onDone, 7000);
    return () => clearTimeout(id);
  }, [onDone]);

  const ok = result.type === 'success';
  const heading = ok ? (result.action === 'in' ? 'You’re signed in' : 'You’re signed out') : 'Nothing changed';
  const line = ok
    ? result.action === 'in' ? `Have a great day, ${result.firstName}.` : `Thank you, ${result.firstName}. Safe journey home.`
    : result.text;

  return (
    <div className={`result ${ok ? `ok ${result.action}` : 'warn'}`} data-type={result.type} data-message={result.text} role="status">
      <div className="result-icon">{ok ? <I.Check /> : <I.Alert />}</div>
      <h1 className="card-title">{heading}</h1>
      {ok && <p className="result-time"><I.Clock /> {result.time}</p>}
      <p className="muted">{line}</p>
      <button className="btn primary" onClick={onDone}>Done</button>
      <div className="countdown" aria-hidden><span /></div>
    </div>
  );
}
