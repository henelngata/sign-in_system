# Parliament Daily Register

A sign-in and sign-out register for directors and officers, built with **Next.js 16** (App Router, Server Functions) and SQLite (a local file, or hosted Turso on Vercel).

It runs either on your **own server** (`npm start`) or on **Vercel**. See [Deploying on Vercel](#deploying-on-vercel).

It **only works from the parliament network**. Requests from any other IP address get an "Access restricted" page, and each blocked attempt is logged. That covers pages, the admin area, static files and Server Function calls.

## How it works

- **Sign-in screen (`/`)**: an officer enters their staff number and PIN, then taps **Sign In** when they arrive or **Sign Out** when they leave. The time and IP address are recorded.
  - Each officer gets **one sign-in and one sign-out per day**. Signing in again is refused, including after signing out.
  - The database enforces this, so a double tap or two devices at once still produce exactly one entry.
- **Who's in (`/whos-in`)**: a live list of who is signed in now, who has signed out and who hasn't signed in today. It refreshes every 30 seconds.
  - Directors log in with their own staff number and PIN. Only officers with **"Can view who is signed in"** ticked by the admin get access. Directors already in the database get it automatically when you upgrade.
  - The director login lasts 1 hour, in case it's opened on a shared tablet. Admins can see the list too.
- **Admin (`/admin`)**:
  - See the register for any day: who is present, who has signed out, who hasn't signed in.
  - Export a date range to CSV (opens in Excel).
  - Add, edit or deactivate officers. Reset a PIN or unlock an account.
  - The **Security** page lists the allowed networks and the latest blocked attempts.
- PINs and passwords are stored as salted scrypt hashes. Five wrong PINs lock the account for 15 minutes. Admin sessions are signed, httpOnly, SameSite=strict cookies.

### Why there is a custom server (`server.mjs`)

Next.js on its own can't reliably tell you the visitor's IP. With `next start`, `X-Forwarded-For` is only filled in when the client hasn't sent one, so an outsider could send `X-Forwarded-For: 10.x.x.x` and pass an IP check made in `proxy.ts`. To prevent that:

1. **`server.mjs`** (Next's documented custom-server setup) reads the IP from the TCP connection and blocks anything outside `ALLOWED_NETWORKS` before Next.js runs. It removes any client-supplied `x-client-ip`, then passes the verified IP to the app in that header, along with a random token generated each time the server starts.
2. **`proxy.ts`** rejects any request that doesn't carry that token. If someone starts the app with plain `next start` by mistake, everything returns 403 instead of running without the IP check.

**On your own server, always start the app with `npm start` or `npm run dev`, never `next start`.** On Vercel there is no `server.mjs`. There, `proxy.ts` does the IP check itself using the IP that Vercel's edge reports (see below).

## Setup

Requires Node.js 22.13 or later. Locally the database is a SQLite file (`data/register.db`), so there is no separate database server.

```bash
npm install
cp .env.example .env              # edit ALLOWED_NETWORKS, TIMEZONE, ORG_NAME, SESSION_SECRET
npm run create-admin -- clerk     # prompts for a password (min 10 chars)
npm run build
npm start                         # http://<server-ip>:3000
```

For development, run `npm run dev`. It goes through the same IP guard.

Log in at `/admin/login`, add the officers with their staff numbers and PINs, and the register is ready.

`npm test` builds the app and runs the end-to-end tests in [test/e2e.test.mjs](test/e2e.test.mjs). They cover:

- blocking outside addresses and forged headers
- the fail-closed `next start` check
- the full sign-in and sign-out flow
- the PIN lockout
- the CSV export
- rejecting Server Function calls from other sites

## Project layout

| Path | What it is |
| --- | --- |
| `server.mjs` | Entry point: IP guard in front of Next.js |
| `proxy.ts` | Rejects requests that didn't pass through `server.mjs` |
| `app/page.tsx`, `app/actions.ts` | Sign-in screen and its Server Function |
| `app/admin/(panel)/…` | Register, officers and security pages (login required) |
| `app/admin/actions.ts` | Admin Server Functions (each checks the login itself) |
| `app/admin/export/route.ts` | CSV download |
| `lib/register.ts` | Sign-in rules and database queries |
| `lib/network.mjs`, `lib/schema.mjs`, `lib/hash.mjs` | Shared by `server.mjs`, scripts and the app |

## Recommended rollout: an internal web app, installed on entrance tablets

There's no need for a native (App Store or Play Store) app. The register is a website on the parliament intranet that **installs like an app**:

- **Entrance tablets (main way to sign).** Mount one or two tablets at the staff entrance. Open the register, choose "Add to Home screen" / "Install app", and it opens full-screen with its own icon. Lock the tablet to that app:
  - Android: Screen pinning, or a kiosk/MDM tool
  - iPad: Guided Access
  This is the strongest setup, because people have to physically be at the door to sign.
- **Directors' "Who's in" list.** Directors open `/whos-in` on their office PC or phone while on the parliament network. They can install it to their home screen too.
- **Admin.** Use a normal browser on a clerk's PC.

Why not a native app:

- Store apps need publishing, updates on every device, and developer accounts.
- The network restriction works the same way for a website, because the device has to be on parliament Wi-Fi or the LAN either way.
- One server update reaches everyone at once.

**Decide whether officers may sign from their own phones.** It's allowed today if the phone is on parliament Wi-Fi. That's convenient, but anyone within Wi-Fi range (car park, nearby café) can sign, and an officer could sign for a colleague who shared their PIN. If that matters, give the entrance tablets a fixed IP or their own network segment, and set `ALLOWED_NETWORKS` to only those addresses. Then signing is only possible at the door. Directors and admins would also need to be on those addresses, so if you want to separate the two, raise it and the app can be given a separate kiosk-only rule.

## Deploying on Vercel

Vercel runs only the Next.js part, not `server.mjs`. The app detects this (`VERCEL=1`) and switches to Vercel mode:

- **IP check.** `proxy.ts` reads the visitor's IP from `x-real-ip` / `x-forwarded-for`. Vercel's edge sets these itself and [overwrites anything the visitor sends](https://vercel.com/docs/headers/request-headers#x-forwarded-for), so they can't be faked. Outsiders get the "Access restricted" page, and attempts are logged.
- **Database.** Vercel's filesystem is temporary and not shared between instances, so a SQLite file would lose data. Use a hosted **Turso** (libSQL) database. It speaks SQLite, so the code is the same.

### Steps

1. **Create the database.** In the Vercel dashboard, open **Storage / Marketplace**, choose **Turso**, and connect it to this project. That sets `TURSO_DATABASE_URL` and `TURSO_AUTH_TOKEN`. (Or create it at turso.tech and add both variables yourself.)
2. **Set environment variables** (Project → Settings → Environment Variables):
   | Variable | Value |
   | --- | --- |
   | `ALLOWED_NETWORKS` | The parliament's **public** IP address(es) (see below) |
   | `SESSION_SECRET` | A long random string: `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"` |
   | `TIMEZONE` | `Africa/Nairobi` |
   | `ORG_NAME` | e.g. `Parliament` |
   | `SECURE_COOKIES` | `true` |
3. **Redeploy** so the new variables take effect. Tables are created automatically on the first request.
4. **Create the first admin** in the hosted database, from your computer:
   ```bash
   TURSO_DATABASE_URL=libsql://… TURSO_AUTH_TOKEN=… npm run create-admin -- clerk
   ```

### The IP rule changes on Vercel: use the parliament's public IP

On your own server inside the building, the app sees internal addresses like `10.10.4.20`. On Vercel the app is on the internet, so it sees the address the parliament's traffic **leaves the building from**: its public IP, shared by everyone inside through the router/NAT. Internal ranges like `10.x` or `192.168.x` will never match on Vercel.

- Ask ICT for the parliament's **static public IP(s)**, or check from inside the building at a site like ifconfig.me. Put those in `ALLOWED_NETWORKS`, for example `41.90.12.34` or `41.90.12.32/29`.
- **The public IP must be static.** If it's dynamic, it will change and lock everyone out until the setting is updated.
- **Everything behind that public IP is allowed**, including guest Wi-Fi if it shares the same internet connection. Ask ICT to give guest Wi-Fi a different public IP, or accept that risk.
- Staff on mobile data (not parliament Wi-Fi) are blocked, which is what you want.

If the parliament can't provide a static public IP, or guest Wi-Fi can't be separated, host the app on an internal server instead (the setup above). There, the check uses internal addresses and the app isn't reachable from the internet at all.

## Getting the network restriction right

1. **Get the exact ranges from ICT.** Ask for every LAN, Wi-Fi and VPN range that counts as "the workplace", for example `10.10.0.0/16` or `192.168.20.0/24`, and put them in `ALLOWED_NETWORKS`.
2. **Host the app on an internal server.** Ideally it isn't reachable from the internet at all. The IP allowlist is the second layer of protection, not the only one.
3. **If it sits behind nginx, IIS or a load balancer**, every request will appear to come from the proxy's IP. In that case:
   - set `TRUST_PROXY_HOPS=1` (one proxy),
   - make sure the proxy sets `X-Forwarded-For` (nginx: `proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;`),
   - firewall the Node port so that **only the proxy** can reach it.
   Leave `TRUST_PROXY_HOPS=0` if users connect straight to Node.
4. **Check NAT.** If the parliament's internet traffic and internal traffic share a public IP, don't allowlist that public IP. Anyone coming in through that gateway would pass. Use the internal ranges instead.
5. **IPv6.** `HOST=0.0.0.0` listens on IPv4 only. Use `HOST=::` to accept IPv6 as well, and add the IPv6 ranges to `ALLOWED_NETWORKS`.
6. After changing `.env`, restart the app. The **Security** page shows the ranges currently in force.

## Running it permanently (Linux, systemd)

```ini
# /etc/systemd/system/register.service
[Unit]
Description=Parliament Daily Register
After=network.target

[Service]
WorkingDirectory=/opt/register
Environment=NODE_ENV=production
ExecStart=/usr/bin/node --disable-warning=ExperimentalWarning server.mjs
Restart=always
User=register

[Install]
WantedBy=multi-user.target
```

Run `npm run build` first, then `sudo systemctl enable --now register`.

## Backups

On Vercel, the data lives in Turso, which has its own backups and point-in-time restore (see the Turso dashboard). On your own server:

All data is in `data/register.db`. Back it up regularly, for example with a nightly copy using `sqlite3 data/register.db ".backup backup.db"`.
