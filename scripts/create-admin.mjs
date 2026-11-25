// Usage: npm run create-admin -- <username>
// Creates an admin account, or resets the password if the username already exists.
// The password comes from ADMIN_PASSWORD, or is prompted for (input hidden).
import readline from 'node:readline';
import nextEnv from '@next/env';

nextEnv.loadEnvConfig(process.cwd(), process.env.NODE_ENV !== 'production', { info() {}, error: console.error });
const { openDb } = await import('../lib/schema.mjs');
const { hashSecret } = await import('../lib/hash.mjs');

const username = (process.argv[2] || '').trim();
if (!/^[a-zA-Z0-9_.-]{3,40}$/.test(username)) {
  console.error('Usage: npm run create-admin -- <username>   (3-40 chars: letters, digits, _ . -)');
  process.exit(1);
}

function askHidden(question) {
  return new Promise((resolve) => {
    const rl = readline.createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    rl._writeToOutput = (s) => { if (s.includes(question)) process.stdout.write(s); };
    rl.question(question, (answer) => { rl.close(); process.stdout.write('\n'); resolve(answer); });
  });
}

let password = process.env.ADMIN_PASSWORD;
if (!password) {
  password = await askHidden('Password: ');
  const again = await askHidden('Confirm password: ');
  if (password !== again) { console.error('Passwords do not match.'); process.exit(1); }
}
if (password.length < 10) { console.error('Password must be at least 10 characters.'); process.exit(1); }

const db = openDb();
const hash = hashSecret(password);
const existing = db.prepare('SELECT id FROM admins WHERE username = ?').get(username);
if (existing) {
  db.prepare('UPDATE admins SET password_hash = ? WHERE id = ?').run(hash, existing.id);
  console.log(`Password reset for admin "${username}".`);
} else {
  db.prepare('INSERT INTO admins (username, password_hash, created_at) VALUES (?, ?, ?)')
    .run(username, hash, new Date().toISOString());
  console.log(`Admin "${username}" created.`);
}
