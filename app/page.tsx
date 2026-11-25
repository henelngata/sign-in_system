import { connection } from 'next/server';
import { getKioskOfficer } from '@/lib/session';
import { statusOf, todayRecord } from '@/lib/register';
import { greeting, localDay, localTime, longDate, timezone } from '@/lib/time';
import { initials } from '@/lib/format';
import Kiosk, { type KioskOfficer } from '@/components/Kiosk';

export default async function KioskPage() {
  await connection(); // render per request so "today" is always current
  const officer = await getKioskOfficer();
  let view: KioskOfficer | null = null;
  if (officer) {
    const record = todayRecord(officer.id);
    view = {
      fullName: officer.full_name,
      firstName: officer.full_name.split(/\s+/)[0]!,
      initials: initials(officer.full_name),
      title: officer.title,
      department: officer.department,
      status: statusOf(record),
      signInAt: localTime(record?.sign_in_at),
      signOutAt: localTime(record?.sign_out_at),
    };
  }
  return (
    <Kiosk
      orgName={process.env.ORG_NAME || 'Parliament'}
      today={longDate(localDay())}
      greeting={greeting()}
      timeZone={timezone}
      officer={view}
    />
  );
}
