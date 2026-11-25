'use client';

import { useEffect, useMemo, useState } from 'react';

/**
 * Live HH:MM clock with smaller seconds, shown in the register's configured timezone
 * (not the device's), so it always matches the times that get recorded.
 */
export default function Clock({ className, timeZone }: { className?: string; timeZone: string }) {
  const fmt = useMemo(
    () => new Intl.DateTimeFormat('en-GB', { timeZone, hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' }),
    [timeZone],
  );
  const [now, setNow] = useState<Date | null>(null);
  useEffect(() => {
    setNow(new Date());
    const id = setInterval(() => setNow(new Date()), 1000);
    return () => clearInterval(id);
  }, []);

  if (!now) return <p className={className} aria-hidden>{' '}</p>;
  const part = (type: string) => fmt.formatToParts(now).find((p) => p.type === type)?.value ?? '00';
  return (
    <p className={className} aria-hidden>
      {part('hour')}:{part('minute')}<small>{part('second')}</small>
    </p>
  );
}
