'use server';

import { redirect } from 'next/navigation';
import { authenticateOfficer } from '@/lib/register';
import { clearViewerSession, setViewerSession } from '@/lib/session';
import type { FormState } from '@/app/admin/actions';

export async function viewerLoginAction(_prev: FormState, form: FormData): Promise<FormState> {
  const auth = authenticateOfficer(form.get('staff_no'), form.get('pin'));
  if ('error' in auth) return { errors: [auth.error.text] };
  if (!auth.officer.can_view_board) {
    return { errors: ['Your account does not have access to this list. Ask the administrator if you need it.'] };
  }
  await setViewerSession(auth.officer.id);
  redirect('/whos-in');
}

export async function viewerLogoutAction() {
  await clearViewerSession();
  redirect('/whos-in/login');
}
