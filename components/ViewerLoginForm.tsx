'use client';

import { useActionState } from 'react';
import { viewerLoginAction } from '@/app/whos-in/actions';
import Notice from './Notice';

export default function ViewerLoginForm() {
  const [state, formAction, pending] = useActionState(viewerLoginAction, null);
  return (
    <form action={formAction} autoComplete="off">
      {state?.errors.map((e) => <Notice key={e} type="error">{e}</Notice>)}
      <label>Staff number <input name="staff_no" required maxLength={30} autoCapitalize="characters" autoFocus /></label>
      <label>PIN <input name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" required maxLength={8} /></label>
      <div className="actions"><button className="btn primary" disabled={pending}>View list</button></div>
    </form>
  );
}
