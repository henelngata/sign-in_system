// The "Access restricted" page, shared by server.mjs and proxy.ts (Vercel).

/** @param {unknown} s */
const escapeHtml = (s) => String(s).replace(/[&<>"']/g, (c) => `&#${c.charCodeAt(0)};`);

/** @param {string} ip @param {string} orgName */
export function deniedPage(ip, orgName) {
  const org = escapeHtml(orgName);
  return `<!doctype html><html lang="en"><head><meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1"><meta name="robots" content="noindex">
<title>Access restricted</title><style>
*{box-sizing:border-box}
body{font-family:system-ui,-apple-system,'Segoe UI',Roboto,sans-serif;margin:0;min-height:100vh;display:grid;place-items:center;padding:1.5rem;
color:#0f172a;background:radial-gradient(700px 500px at 100% 0%,rgba(74,128,210,.25),transparent 70%),linear-gradient(165deg,#0b1f3a,#071428)}
.box{max-width:30rem;padding:2.25rem;background:#fff;border-radius:24px;box-shadow:0 24px 60px -16px rgba(0,0,0,.45);text-align:center}
.icon{width:4.5rem;height:4.5rem;margin:0 auto 1.25rem;border-radius:50%;display:grid;place-items:center;background:#fdecef;color:#e0384f}
h1{margin:0 0 .5rem;font-size:1.6rem;letter-spacing:-.02em}p{line-height:1.55;color:#475569;margin:.5rem 0}
code{background:#f1f5f9;border:1px solid #e2e8f0;padding:.1rem .45rem;border-radius:6px;color:#0f172a}
</style></head><body><div class="box">
<div class="icon"><svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="4" y="11" width="16" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg></div>
<h1>Access restricted</h1>
<p>The ${org} Daily Register can only be used from the ${org} network.</p>
<p>Your address <code>${escapeHtml(ip || 'unknown')}</code> is not on the workplace network. This attempt has been logged.</p>
<p>If you are on the premises and seeing this, contact ICT support.</p>
</div></body></html>`;
}
