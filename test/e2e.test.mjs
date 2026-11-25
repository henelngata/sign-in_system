// End-to-end test against the production build: npm test (builds first).
// Only 127.0.0.1 is allowed; connecting via ::1 stands in for an "outside" address.
import { test, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { spawn, execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';

const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'register-e2e-'));
const DB = path.join(tmp, 'test.db');
const PORT = 4100 + Math.floor(Math.random() * 500);
const env = {
  ...process.env,
  NODE_ENV: 'production',
  NODE_OPTIONS: '--disable-warning=ExperimentalWarning',
  DB_PATH: DB,
  ALLOWED_NETWORKS: '127.0.0.1/32',
  TRUST_PROXY_HOPS: '0',
  SESSION_SECRET: 'e2e-secret',
  TIMEZONE: 'Africa/Nairobi',
  HOST: '::',
  PORT: String(PORT),
};

const children = [];
function start(cmd, args, extraEnv, readyText) {
  const child = spawn(cmd, args, { env: { ...env, ...extraEnv }, stdio: ['ignore', 'pipe', 'pipe'] });
  children.push(child);
  return new Promise((resolve, reject) => {
    let out = '';
    const timer = setTimeout(() => reject(new Error(`timeout starting ${cmd}:\n${out}`)), 30_000);
    const onData = (d) => { out += d; if (out.includes(readyText)) { clearTimeout(timer); resolve(child); } };
    child.stdout.on('data', onData);
    child.stderr.on('data', onData);
    child.on('exit', (code) => reject(new Error(`${cmd} exited ${code}:\n${out}`)));
  });
}

before(async () => {
  execFileSync('node', ['scripts/create-admin.mjs', 'clerk'], { env: { ...env, ADMIN_PASSWORD: 'correct-horse-battery' } });
  await start('node', ['server.mjs'], {}, 'Daily register');
});
after(() => {
  children.forEach((c) => c.kill());
  fs.rmSync(tmp, { recursive: true, force: true });
});

const decode = (s) => s.replace(/&quot;/g, '"').replace(/&#x27;|&#39;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&');

/** Cookie-keeping client that can submit Server Function forms the way a no-JS browser does. */
function client(host = '127.0.0.1', port = PORT) {
  const jar = new Map();
  const origin = `http://${host.includes(':') ? `[${host}]` : host}:${port}`;
  async function req(p, opts = {}) {
    const headers = { ...(opts.headers || {}) };
    if (jar.size) headers.cookie = [...jar].map(([k, v]) => `${k}=${v}`).join('; ');
    const res = await fetch(origin + p, { redirect: 'manual', ...opts, headers });
    for (const c of res.headers.getSetCookie()) {
      const [kv] = c.split(';');
      const i = kv.indexOf('=');
      const v = kv.slice(i + 1);
      if (v) jar.set(kv.slice(0, i), v); else jar.delete(kv.slice(0, i));
    }
    return res;
  }
  /** Load `page` and return the hidden Server Function fields of the form containing `field`. */
  async function capture(page, field) {
    const html = await (await req(page)).text();
    const form = [...html.matchAll(/<form[\s\S]*?<\/form>/g)].map((m) => m[0]).find((f) => f.includes(`name="${field}"`));
    assert.ok(form, `no form with field ${field} on ${page}`);
    const hidden = [];
    for (const [, tag] of form.matchAll(/(<input[^>]*type="hidden"[^>]*>)/g)) {
      const name = tag.match(/name="([^"]*)"/)?.[1];
      if (name) hidden.push([name, decode(tag.match(/value="([^"]*)"/)?.[1] ?? '')]);
    }
    return hidden;
  }
  /** Post a captured form with `values` filled in. */
  function post(page, hidden, values) {
    const body = new FormData();
    for (const [k, v] of hidden) body.append(k, v);
    for (const [k, v] of Object.entries(values)) body.set(k, v);
    return req(page, { method: 'POST', body, headers: { origin } });
  }
  /** Load `page`, find the form containing `field`, fill it in and submit it. */
  async function submit(page, field, values) {
    return post(page, await capture(page, field), values);
  }
  return { req, submit, capture, post };
}

/** Step 1 on the sign-in screen. Returns the HTML of the resulting page. */
const identify = async (c, staffNo, pin) => (await c.submit('/', 'staff_no', { staff_no: staffNo, pin })).text();
const statusOf = (html) => html.match(/data-status="(\w+)"/)?.[1] ?? null;

const flashOf = (html) => {
  const r = html.match(/data-type="(\w+)" data-message="([^"]*)"/); // kiosk result screen
  if (r) return [r[1], decode(r[2])];
  const m = html.match(/class="(?:flash|alert) (\w+)"[^>]*>([\s\S]*?)<\/div>/);
  return m ? [m[1], decode(m[2].replace(/<[^>]+>|<!-- -->/g, '')).trim()] : null;
};

test('outside addresses are blocked on every path, including static files and Server Functions', async () => {
  const outside = client('::1');
  for (const p of ['/', '/admin', '/admin/login', '/admin/export', '/_next/static/chunks/x.js', '/favicon.ico']) {
    const res = await outside.req(p);
    assert.equal(res.status, 403, p);
    assert.match(await res.text(), /Access restricted/);
  }
  const action = await outside.req('/', { method: 'POST', headers: { 'next-action': 'abc' } });
  assert.equal(action.status, 403);
  const db = new DatabaseSync(DB);
  assert.ok(db.prepare('SELECT COUNT(*) AS n FROM access_denied').get().n >= 7);
  db.close();
});

test('forged IP headers do not get past the block', async () => {
  const res = await client('::1').req('/', {
    headers: { 'x-forwarded-for': '127.0.0.1', 'x-client-ip': '127.0.0.1', 'x-real-ip': '127.0.0.1', 'x-register-guard': 'x' },
  });
  assert.equal(res.status, 403);
});

test('running plain `next start` (bypassing server.mjs) fails closed', async () => {
  const port = PORT + 1;
  await start('node', ['node_modules/next/dist/bin/next', 'start', '-p', String(port), '-H', '127.0.0.1'], {}, 'Ready');
  const res = await client('127.0.0.1', port).req('/', { headers: { 'x-client-ip': '127.0.0.1', 'x-forwarded-for': '127.0.0.1' } });
  assert.equal(res.status, 403);
});

test('allowed network sees the sign-in page', async () => {
  const res = await client().req('/');
  assert.equal(res.status, 200);
  assert.match(await res.text(), /Sign in or out/);
});

test('full flow: admin adds officer, officer signs in/out once, register and CSV show it', async () => {
  const admin = client();
  assert.equal((await admin.req('/admin')).headers.get('location'), '/admin/login');

  const bad = await admin.submit('/admin/login', 'username', { username: 'clerk', password: 'wrong-password' });
  assert.match(flashOf(await bad.text())?.[1] ?? '', /Invalid username or password/);

  const ok = await admin.submit('/admin/login', 'username', { username: 'clerk', password: 'correct-horse-battery' });
  assert.equal(ok.status, 303);
  assert.equal((await admin.req('/admin')).status, 200);

  const invalid = await admin.submit('/admin/officers/new', 'staff_no', { staff_no: 'X', full_name: '', pin: '12' });
  assert.match(flashOf(await invalid.text())?.[1] ?? '', /Full name is required/);

  const added = await admin.submit('/admin/officers/new', 'staff_no',
    { staff_no: 'dir-001', full_name: 'Jane Achieng', title: 'Director', department: 'Finance', pin: '4821' });
  assert.equal(added.status, 303);
  assert.match(await (await admin.req('/admin/officers')).text(), /Jane Achieng/);

  const kiosk = client();
  const press = async (action) => flashOf(await (await kiosk.submit('/', 'action', { action })).text());

  // Wrong PIN stays on step 1.
  const wrong = await identify(kiosk, 'DIR-001', '0000');
  assert.deepEqual(flashOf(wrong), ['error', 'Invalid staff number or PIN.']);
  assert.equal(statusOf(wrong), null);

  // Step 2: greeted by name, only the Sign in button is offered.
  let html = await identify(kiosk, 'dir-001', '4821');
  assert.equal(statusOf(html), 'none');
  assert.match(html, /Good (morning|afternoon|evening)/);
  assert.match(html, /Sign in now/);
  assert.doesNotMatch(html, /Sign out now/);
  const signForm = await kiosk.capture('/', 'action'); // kept to replay requests the UI no longer offers

  // A forged "out" before signing in is still refused by the server, and the step-2 session ends.
  assert.match((await press('out'))[1], /not signed in today/);
  assert.equal(statusOf(await (await kiosk.req('/')).text()), null);

  await identify(kiosk, 'DIR-001', '4821');
  const signedIn = await press('in');
  assert.equal(signedIn[0], 'success');
  // Times are shown in East Africa Time (UTC+3), whatever timezone the server machine uses.
  const eat = (d) => new Intl.DateTimeFormat('en-GB', { timeZone: 'Africa/Nairobi', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' }).format(d);
  const shown = signedIn[1].match(/Signed in at (\d\d:\d\d)/)[1];
  assert.ok([eat(new Date(Date.now() - 60_000)), eat(new Date())].includes(shown), `${shown} is not EAT (${eat(new Date())})`);
  const db0 = new DatabaseSync(DB);
  assert.equal(db0.prepare('SELECT COUNT(*) AS n FROM attendance').get().n, 1);
  db0.close();

  // Logging in again shows "signed in" and only the Sign out button.
  html = await identify(kiosk, 'DIR-001', '4821');
  assert.equal(statusOf(html), 'in');
  assert.match(html, /Signed in since \d\d:\d\d/);
  assert.match(html, /Sign out now/);
  assert.doesNotMatch(html, /Sign in now/);
  // Forcing a second sign-in anyway is refused.
  assert.match((await kiosk.post('/', signForm, { action: 'in' }).then((r) => r.text()).then(flashOf))[1],
    /already signed in \(since .*\)\. You cannot sign in twice/);

  await identify(kiosk, 'DIR-001', '4821');
  const out = await press('out');
  assert.equal(out[0], 'success');
  assert.match(out[1], /Goodbye.*Signed out at/);

  // Day complete: no buttons at all, and a forced sign-in is refused.
  html = await identify(kiosk, 'DIR-001', '4821');
  assert.equal(statusOf(html), 'done');
  assert.doesNotMatch(html, /Sign (in|out) now/);
  assert.match((await kiosk.post('/', signForm, { action: 'in' }).then((r) => r.text()).then(flashOf))[1],
    /already complete.*You cannot sign in again today/);

  // Without step 1 (no session), pressing a button does nothing.
  assert.match((await kiosk.post('/', signForm, { action: 'in' }).then((r) => r.text()).then(flashOf))[1], /session timed out/);

  const db = new DatabaseSync(DB);
  const row = db.prepare('SELECT * FROM attendance').get();
  db.close();
  assert.equal(row.sign_in_ip, '127.0.0.1');
  assert.ok(row.sign_out_at);

  const reg = await (await admin.req('/admin')).text();
  assert.match(reg, /Jane Achieng/);
  assert.match(reg, /Signed out/);

  const csv = await admin.req(`/admin/export?from=${row.day}&to=${row.day}`);
  assert.equal(csv.status, 200);
  assert.match(await csv.text(), /DIR-001,Jane Achieng,Director,Finance,\d\d:\d\d,127\.0\.0\.1/);

  assert.equal((await kiosk.req('/admin/export')).status, 401, 'export needs admin login');
});

test('simultaneous sign-ins (double tap / two devices) record exactly one entry, without errors', async () => {
  const admin = client();
  await admin.submit('/admin/login', 'username', { username: 'clerk', password: 'correct-horse-battery' });
  await admin.submit('/admin/officers/new', 'staff_no',
    { staff_no: 'OFF-002', full_name: 'Peter Mwangi', title: 'Officer', department: 'Hansard', pin: '5555' });

  // Six devices all reach step 2, then all press "Sign in" at the same moment.
  const devices = Array.from({ length: 6 }, () => client());
  for (const d of devices) assert.equal(statusOf(await identify(d, 'OFF-002', '5555')), 'none');
  const forms = await Promise.all(devices.map((d) => d.capture('/', 'action')));
  const results = await Promise.all(devices.map(async (d, i) => {
    const res = await d.post('/', forms[i], { action: 'in' });
    return [res.status, flashOf(await res.text())];
  }));
  assert.ok(results.every(([status]) => status === 200), JSON.stringify(results));
  assert.equal(results.filter(([, f]) => f?.[0] === 'success').length, 1, JSON.stringify(results));
  assert.ok(results.filter(([, f]) => f?.[0] === 'warning').every(([, f]) => /cannot sign in twice/.test(f[1])));

  const db = new DatabaseSync(DB);
  const n = db.prepare("SELECT COUNT(*) AS n FROM attendance a JOIN officers o ON o.id = a.officer_id WHERE o.staff_no = 'OFF-002'").get().n;
  db.close();
  assert.equal(n, 1);
});

test("directors see who's signed in; other officers and anonymous visitors can't", async () => {
  const anon = client();
  assert.equal((await anon.req('/whos-in')).headers.get('location'), '/whos-in/login');

  // OFF-002 has no director access.
  const officer = client();
  const refused = await officer.submit('/whos-in/login', 'staff_no', { staff_no: 'OFF-002', pin: '5555' });
  assert.match(flashOf(await refused.text())?.[1] ?? '', /does not have access/);
  assert.equal((await officer.req('/whos-in')).status, 307);

  // Director access is granted via the officer form checkbox.
  const admin = client();
  await admin.submit('/admin/login', 'username', { username: 'clerk', password: 'correct-horse-battery' });
  await admin.submit('/admin/officers/new', 'staff_no',
    { staff_no: 'DIR-009', full_name: 'Grace Wanjiru', title: 'Director', department: 'Clerks', pin: '9090', can_view_board: 'on' });

  const director = client();
  const ok = await director.submit('/whos-in/login', 'staff_no', { staff_no: 'dir-009', pin: '9090' });
  assert.equal(ok.status, 303);
  const board = await (await director.req('/whos-in')).text();
  assert.match(board, /Who’s signed in/);
  assert.match(board, /Signed in now \(<!-- -->1<!-- -->\)[\s\S]*Peter Mwangi/);
  assert.match(board, /Signed out today[\s\S]*Jane Achieng/);
  assert.match(board, /Not signed in today[\s\S]*Grace Wanjiru/);

  // A director login is not an admin login.
  assert.equal((await director.req('/admin')).headers.get('location'), '/admin/login');
  assert.equal((await director.req('/admin/export')).status, 401);

  // Admins can see the list too.
  assert.equal((await admin.req('/whos-in')).status, 200);
});

test('installable as an app: manifest and icon are served', async () => {
  const c = client();
  const manifest = await c.req('/manifest.webmanifest');
  assert.equal(manifest.status, 200);
  assert.equal((await manifest.json()).display, 'standalone');
  assert.equal((await c.req('/icon.svg')).status, 200);
});

test('five wrong PINs lock the account', async () => {
  const kiosk = client();
  let last;
  for (let i = 0; i < 5; i++) {
    last = flashOf(await identify(kiosk, 'DIR-001', '1111'));
  }
  assert.match(last[1], /Locked for 15 minutes/);
});

test('Server Function from a foreign origin is rejected', async () => {
  const c = client();
  const html = await (await c.req('/')).text();
  const form = html.match(/<form[\s\S]*?<\/form>/)[0];
  const body = new FormData();
  for (const [, tag] of form.matchAll(/(<input[^>]*type="hidden"[^>]*>)/g)) {
    body.append(tag.match(/name="([^"]*)"/)[1], decode(tag.match(/value="([^"]*)"/)?.[1] ?? ''));
  }
  body.set('staff_no', 'DIR-001'); body.set('pin', '4821'); body.set('action', 'in');
  const res = await c.req('/', { method: 'POST', body, headers: { origin: 'https://evil.example' } });
  assert.notEqual(res.status, 200);
});
