// Small stroke icons (inherit colour and size from the surrounding text).
type P = { className?: string };
const base = {
  width: '1.15em', height: '1.15em', viewBox: '0 0 24 24', fill: 'none', stroke: 'currentColor',
  strokeWidth: 2, strokeLinecap: 'round', strokeLinejoin: 'round', 'aria-hidden': true,
} as const;

export const ArrowRight = (p: P) => <svg {...base} {...p}><path d="M5 12h14M13 6l6 6-6 6" /></svg>;
export const LogIn = (p: P) => <svg {...base} {...p}><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4M10 17l5-5-5-5M15 12H3" /></svg>;
export const LogOut = (p: P) => <svg {...base} {...p}><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4M16 17l5-5-5-5M21 12H9" /></svg>;
export const Check = (p: P) => <svg {...base} {...p}><path d="M20 6 9 17l-5-5" /></svg>;
export const Alert = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 8v4M12 16h.01" /></svg>;
export const Lock = (p: P) => <svg {...base} {...p}><rect x="4" y="11" width="16" height="10" rx="2" /><path d="M8 11V7a4 4 0 0 1 8 0v4" /></svg>;
export const User = (p: P) => <svg {...base} {...p}><circle cx="12" cy="8" r="4" /><path d="M4 21a8 8 0 0 1 16 0" /></svg>;
export const Key = (p: P) => <svg {...base} {...p}><circle cx="8" cy="15" r="4" /><path d="m11 12 9-9M17 6l3 3M14 9l2 2" /></svg>;
export const Users = (p: P) => <svg {...base} {...p}><circle cx="9" cy="8" r="4" /><path d="M2 21a7 7 0 0 1 14 0M16 4a4 4 0 0 1 0 8M22 21a7 7 0 0 0-4-6.3" /></svg>;
export const Clock = (p: P) => <svg {...base} {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></svg>;
export const Download = (p: P) => <svg {...base} {...p}><path d="M12 3v12M7 10l5 5 5-5M5 21h14" /></svg>;
export const Plus = (p: P) => <svg {...base} {...p}><path d="M12 5v14M5 12h14" /></svg>;

/** The register's mark: a clipboard with a tick. */
export const Mark = (p: P) => (
  <svg viewBox="0 0 32 32" width="1em" height="1em" aria-hidden {...p}>
    <rect width="32" height="32" rx="9" fill="currentColor" />
    <rect x="9" y="7" width="14" height="18" rx="2.5" fill="#fff" opacity=".95" />
    <rect x="12.5" y="5.5" width="7" height="3.5" rx="1.5" fill="#d4ad55" />
    <path d="m12.5 16.5 2.6 2.6 4.8-5.4" fill="none" stroke="#0e9f6e" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
