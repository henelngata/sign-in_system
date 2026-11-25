'use client';

import { useEffect, useState } from 'react';

type Props = { type: 'success' | 'error' | 'warning'; children: React.ReactNode; hideAfterMs?: number };

/** A coloured message box that can fade out on its own (used on the shared sign-in screen). */
export default function Notice({ type, children, hideAfterMs }: Props) {
  const [visible, setVisible] = useState(true);
  useEffect(() => {
    setVisible(true);
    if (!hideAfterMs) return;
    const id = setTimeout(() => setVisible(false), hideAfterMs);
    return () => clearTimeout(id);
  }, [children, hideAfterMs]);
  if (!visible) return null;
  return <div className={`flash ${type}`} role="status">{children}</div>;
}
