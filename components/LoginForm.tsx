'use client';

import { useActionState } from 'react';
import { loginAction } from '@/app/admin/actions';
import Notice from './Notice';

export default function LoginForm() {
  const [state, formAction, pending] = useActionState(loginAction, null);
  return (
    <form action={formAction}>
      {state?.errors.map((e) => <Notice key={e} type="error">{e}</Notice>)}
      <label>Username <input name="username" required autoFocus autoComplete="username" /></label>
      <label>Password <input name="password" type="password" required autoComplete="current-password" /></label>
      <div className="actions"><button className="btn primary" disabled={pending}>Log in</button></div>
    </form>
  );
}
