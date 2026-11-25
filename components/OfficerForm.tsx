'use client';

import Link from 'next/link';
import { useActionState } from 'react';
import { saveOfficerAction } from '@/app/admin/actions';
import Notice from './Notice';

type Props = {
  officer: {
    id: number; staff_no: string; full_name: string; title: string; department: string; can_view_board: number;
  } | null;
};

export default function OfficerForm({ officer }: Props) {
  const [state, formAction, pending] = useActionState(saveOfficerAction, null);
  const isNew = officer === null;

  return (
    <form action={formAction} autoComplete="off">
      {state?.errors.length ? (
        <Notice type="error">{state.errors.map((e) => <div key={e}>{e}</div>)}</Notice>
      ) : null}
      {officer && <input type="hidden" name="id" value={officer.id} />}
      <label>Staff number <input name="staff_no" defaultValue={officer?.staff_no} required maxLength={30} /></label>
      <label>Full name <input name="full_name" defaultValue={officer?.full_name} required maxLength={100} /></label>
      <label>
        Title
        <input name="title" list="titles" defaultValue={officer?.title ?? 'Officer'} maxLength={60} />
        <datalist id="titles">
          {['Director', 'Deputy Director', 'Assistant Director', 'Principal Officer', 'Senior Officer', 'Officer'].map((t) => (
            <option key={t} value={t} />
          ))}
        </datalist>
      </label>
      <label>Department <input name="department" defaultValue={officer?.department} maxLength={100} /></label>
      <label className="check">
        <input type="checkbox" name="can_view_board" defaultChecked={!!officer?.can_view_board} />
        <span>
          Can view who is signed in
          <small>For directors. They log in at “Who’s in” with their staff number and PIN.</small>
        </span>
      </label>
      <label>
        {isNew ? 'PIN (4–8 digits)' : 'New PIN (leave blank to keep current)'}
        <input name="pin" type="password" inputMode="numeric" pattern="\d{4,8}" maxLength={8} required={isNew} />
      </label>
      <div className="actions">
        <button className="btn primary" disabled={pending}>{isNew ? 'Add officer' : 'Save changes'}</button>
        <Link className="btn secondary" href="/admin/officers">Cancel</Link>
      </div>
    </form>
  );
}
