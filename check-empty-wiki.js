// Check Wikipedia links in attraction-links.js for missing/empty pages
// Usage: node check-empty-wiki.js
import fs from 'fs';
import vm from 'vm';

const FILE = 'attraction-links.js';
const code = fs.readFileSync(FILE, 'utf8');
const ctx = { window: {} };
vm.createContext(ctx);
vm.runInContext(code, ctx, { filename: FILE });
const links = ctx.window.attractionLinks || {};

const isWiki = (u) => {
  try {
    const h = new URL(u).hostname.toLowerCase();
    return h.endsWith('.wikipedia.org');
  } catch { return false; }
};

const wikiEntries = Object.entries(links).filter(([, url]) => isWiki(url));

const HEADERS = {
  'User-Agent': 'Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'application/json, text/plain, */*'
};
const HTML_HEADERS = {
  'User-Agent': HEADERS['User-Agent'],
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
  'Accept-Language': 'de-DE,de;q=0.9,en;q=0.8'
};

function toWikiApi(urlStr) {
  const u = new URL(urlStr);
  const lang = u.hostname.split('.')[0] || 'en';
  // Extract title after /wiki/
  const path = u.pathname || '';
  const idx = path.indexOf('/wiki/');
  let title = idx >= 0 ? path.slice(idx + 6) : path.replace(/^\//, '');
  // Drop fragment
  title = title.split('#')[0];
  // Decode once
  try { title = decodeURIComponent(title); } catch {}
  // Normalize underscores to spaces for API
  title = title.replace(/_/g, ' ');
  const api = new URL(`https://${lang}.wikipedia.org/w/api.php`);
  api.searchParams.set('action', 'query');
  api.searchParams.set('format', 'json');
  api.searchParams.set('formatversion', '2');
  api.searchParams.set('origin', '*');
  api.searchParams.set('prop', 'info');
  api.searchParams.set('redirects', '1');
  api.searchParams.set('converttitles', '1');
  api.searchParams.set('titles', title);
  return api.toString();
}

const badUrl = (u) => /Special:Search|w\/index\.php\?search=/.test(u);
const badText = (t) => {
  if (!t) return false;
  const needles = [
    'noarticletext',
    'Wikipedia does not have an article with this exact name',
    'does not have an article with this exact name',
    'Es existiert derzeit kein Artikel mit diesem Namen',
    'Wikipedia hat noch keinen Artikel mit diesem Namen',
    'Diese Seite existiert noch nicht'
  ];
  return needles.some((s) => t.includes(s));
};

async function verifyByFetch(url) {
  try {
    const res = await fetch(url, { redirect: 'follow', headers: HTML_HEADERS });
    const finalUrl = res.url || url;
    if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
    const html = await res.text();
    if (badUrl(finalUrl) || badText(html)) return { ok: false, reason: 'missing-html' };
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: e.message };
  }
}

async function apiPageExists(urlStr) {
  const apiUrl = toWikiApi(urlStr);
  const res = await fetch(apiUrl, { headers: HEADERS });
  if (!res.ok) return { ok: false, reason: `HTTP ${res.status}` };
  const data = await res.json();
  const pages = data?.query?.pages;
  if (!Array.isArray(pages) || pages.length === 0) return { ok: false, reason: 'no pages' };
  const page = pages[0];
  if (page.invalid || page.missing) return { ok: false, reason: 'missing' };
  if (typeof page.pageid === 'number' && page.pageid > 0) return { ok: true };
  return { ok: false, reason: 'unknown' };
}

async function checkOne([name, url]) {
  try {
    const api = await apiPageExists(url);
    if (api.ok) return null;
    // Fallback by HTML fetch
    const html = await verifyByFetch(url);
    if (html.ok) return null;
    return { name, url, reason: api.reason || html.reason };
  } catch (e) {
    return { name, url, error: e.message };
  }
}

async function main() {
  const checks = wikiEntries.map(checkOne);
  const results = await Promise.all(checks);
  const missing = results.filter(Boolean).filter((r) => !r.error);
  const errors = results.filter((r) => r && r.error);

  if (missing.length === 0) {
    console.log('NONE');
  } else {
    for (const m of missing) console.log(`${m.name} :: ${m.url}${m.reason ? ' :: ' + m.reason : ''}`);
  }
  if (errors.length) {
    console.log('\nERRORS (manual check recommended):');
    for (const e of errors) console.log(`${e.name} :: ${e.url} :: ${e.error}`);
  }
}

main().catch((e) => { console.error(e); process.exit(1); });
