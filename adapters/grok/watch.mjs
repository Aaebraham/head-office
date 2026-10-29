// Grok Bot -> Head Office, with zero tokens.
//
// Grok Bots run in xAI's cloud and have no public API, but the Grok Bot desktop app keeps a
// live local copy of your roster and each bot's conversation. This module only *reads* that
// cache (it never writes to it, never talks to xAI, never sends anything anywhere) and turns it
// into office status: who's working, who's done, who needs you.
//
// Files live in ~/Library/Application Support/Grok Bot/sand-client-persistence. Their names are
// base32-encoded keys like "sand.client.slice.account.<you>.roster.last-roster".

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

export const GROK_DIR = path.join(os.homedir(), 'Library', 'Application Support', 'Grok Bot');
const CACHE = path.join(GROK_DIR, 'sand-client-persistence');

const WORKING_FOR_MS = 45 * 60_000; // a request with no reply after this long is treated as stale
const DONE_FOR_MS = 45_000;    // "Done" shows this long before the bot settles to idle

function decodeName(file) {
  const s = file.replace(/\.blob$/, '').toUpperCase();
  const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
  let bits = 0, value = 0; const out = [];
  for (const ch of s) {
    const v = alphabet.indexOf(ch); if (v < 0) continue;
    value = (value << 5) | v; bits += 5;
    if (bits >= 8) { out.push((value >>> (bits - 8)) & 255); bits -= 8; }
  }
  return Buffer.from(out).toString('utf8');
}

const parsed = new Map(); // file -> { mtimeMs, data }
function readJson(file) {
  try {
    const full = path.join(CACHE, file), { mtimeMs } = fs.statSync(full);
    const hit = parsed.get(file);
    if (hit && hit.mtimeMs === mtimeMs) return hit.data;
    const data = JSON.parse(fs.readFileSync(full, 'utf8'))?.value;
    parsed.set(file, { mtimeMs, data });
    return data;
  } catch { return null; }
}

function cacheFiles() {
  const out = { roster: null, transcripts: new Map() };
  let names = [];
  try { names = fs.readdirSync(CACHE).filter((f) => f.endsWith('.blob')); } catch { return out; }
  for (const f of names) {
    const key = decodeName(f);
    if (key.endsWith('.roster.last-roster')) out.roster = f;
    const m = /\.transcript\.replicas\.([0-9a-f-]{36})$/.exec(key);
    if (m) out.transcripts.set(m[1], f);
  }
  return out;
}

// The cached value of the first key matching `re`, e.g. /\.weekly-usage\.cache$/.
export function readCacheKey(re) {
  let names = [];
  try { names = fs.readdirSync(CACHE).filter((f) => f.endsWith('.blob')); } catch { return null; }
  const file = names.find((f) => re.test(decodeName(f)));
  return file ? readJson(file) : null;
}

export function grokAppRunning() {
  try {
    const { pid } = JSON.parse(fs.readFileSync(path.join(GROK_DIR, 'desktop-status.json'), 'utf8'));
    process.kill(pid, 0);
    return true;
  } catch { return false; }
}

// ---------------------------------------------------------------- who they are

const COLORS = {
  blue: '#4F8DFF', orange: '#FF8A3D', violet: '#8B6CFF', purple: '#8B6CFF', green: '#2FBF71', red: '#F0525F',
  gray: '#9A9AAE', grey: '#9A9AAE', magenta: '#E64FB4', pink: '#F78FB3', black: '#3A3A48', yellow: '#F5C04A',
  teal: '#22B8A8', cyan: '#38BDF8', brown: '#A0704C', white: '#E9E7F2', indigo: '#5B5BD6', lime: '#9BD13B',
};

const THEMES = [
  ['ops', /\b(manager|primary bot|chief of staff|router|routes it|assistant|operations)/i],
  ['security', /\b(secur|privacy|cyber|hack|threat|password|safety)/i],
  ['health', /\b(health|fitness|weight|diet|nutrition|workout|exercise|meal|calorie)/i],
  ['care', /\b(companion|emotional|therap|wellbeing|well-being|mental|mindful|feelings)/i],
  ['career', /\b(career|job|recruit|cv\b|resume|interview|hiring|visa)/i],
  ['design', /\b(design|ui\b|ux\b|brand|visual|creative|illustrat)/i],
  ['finance', /\b(financ|budget|money|invoice|expense|tax|saving|bank)/i],
  ['writing', /\b(second brain|notes?\b|memory|journal|writ|blog|newsletter|copy)/i],
  ['code', /\b(code|coding|develop|engineer|software|github|deploy|bug)/i],
  ['social', /\b(social|tweet|twitter|post|content|instagram|tiktok|marketing)/i],
  ['research', /\b(research|analy|scout|investigat|study)/i],
];
const themeFor = (text) => (THEMES.find(([, re]) => re.test(text || '')) || [null])[0];
const firstSentence = (row) => (row.description || '').split(/(?<=[.!?])\s/)[0];
// Judge the job from the title and opening line first; long instructions mention everything.
const themeOf = (row) => themeFor(`${row.title || ''} ${firstSentence(row)}`) || themeFor(row.description) || 'ops';

// A short job title from the bot's instructions, e.g. "You are Penny, X's friendly, honest
// personal finance bot." -> "Personal finance bot". The instructions themselves are never shown.
function roleFrom(row) {
  if (row.title) return row.title;
  let s = firstSentence(row).replace(/\([^)]*\)?/g, '').trim();
  s = s.replace(/^you are\s+/i, '').replace(new RegExp(`^${row.name}\\s*,\\s*`, 'i'), '');
  s = s.split(/\s*,\s*(?=[A-Z])/)[0]; // drop trailing clauses like ", Abraham's new studio"
  s = s.replace(/^the user's\s+/i, '').replace(/^[A-Z][\w-]*(?:\s+[A-Z][\w-]*)*'s\s+/, '').replace(/^(the|a|an)\s+/i, '');
  s = s.replace(/\s+(?:for|to|of|with)\s+[A-Z].*$/, '').replace(/[.,;:\s]+$/, '');
  s = s.replace(/^(?:[\w-]+,\s*)+/, ''); // "friendly, honest personal finance bot" -> "personal finance bot"
  let words = s.split(/\s+/).filter(Boolean);
  if (words.length > 3) words = words.slice(-3);
  if (words.join(' ').length > 26) words = words.slice(-2);
  s = words.join(' ');
  return s ? s[0].toUpperCase() + s.slice(1) : 'Grok Bot';
}

// ---------------------------------------------------------------- what they're doing

const clip = (s, n = 90) => { s = String(s || '').replace(/\[([^\]]+)\]\([^)]*\)/g, '$1').replace(/[*_`#>]/g, '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const firstLine = (s) => String(s || '').split('\n').map((l) => l.trim()).find(Boolean) || '';

export function stateFrom(row, entries, now, privateText) {
  const say = (s, n) => (privateText ? '' : clip(s, n));
  const talk = entries.filter((e) => e.kind === 'message' || e.kind === 'send-message' || e.kind === 'user-attachment');
  const last = talk[talk.length - 1];
  const lastUser = [...talk].reverse().find((e) => (e.kind === 'message' && e.role === 'user') || e.kind === 'user-attachment');
  const task = lastUser?.content ? { title: say(lastUser.content, 70) || 'A private task', startedAt: lastUser.timestampMs } : null;
  const age = last ? now - last.timestampMs : Infinity;
  const base = { task, lastAt: last?.timestampMs || row.lastActivityAt || 0, unread: row.unreadCount || 0 };

  if (!last) return { ...base, status: 'idle', activity: 'Free for a new task' };

  if (last.kind === 'message' && last.role === 'user' || last.kind === 'user-attachment') {
    if (age < WORKING_FOR_MS) return { ...base, status: 'working', activity: privateText ? 'Working on your request' : `Working on "${clip(last.content || last.file_name, 60)}"` };
    return { ...base, status: 'idle', activity: 'Free for a new task' };
  }

  const m = last.message || {};
  const pend = (kind, title, detail, extra = {}) => ({ ...base, status: 'needs_you', activity: title, pending: { id: `${row.id}:${last.id}`, kind, title, detail, canResolve: false, ...extra } });
  if (m.type === 'widget' && !last.widgetSkipped) return pend('question', 'Asking you', say(m.widget?.prompt, 220) || 'Has a question for you', { options: privateText ? [] : (m.widget?.options || []).slice(0, 6).map((o) => clip(o?.label ?? o?.text ?? o, 40)) });
  if (m.type === 'user-form' && !last.formResolution) return pend('form', m.formRequest?.title ? `Needs: ${clip(m.formRequest.title, 50)}` : 'Needs you to fill in a form', say(m.formRequest?.instruction || m.formRequest?.reason, 220));
  if (m.type === 'connector') return pend('connect', `Wants you to connect ${clip(m.connector, 30) || 'an app'}`, 'Open Grok Bot to connect it.');
  if (row.awaitingUserResponse) return pend('question', 'Waiting on you', say(firstLine(m.content), 220) || 'Open Grok Bot to reply.');

  const text = m.type === 'attachment' ? `Sent you ${clip(m.file_name, 40) || 'a file'}` : firstLine(m.content);
  if (m.type === 'text' && /\?\s*$/.test(String(m.content || '').trim()) && age < 3 * 3600_000) {
    return pend('question', 'Has a question for you', say(String(m.content).trim().split('\n').filter(Boolean).pop(), 220));
  }
  if (age < DONE_FOR_MS) return { ...base, status: 'done', activity: privateText ? 'Done' : `Done: ${clip(text, 70)}` };
  return { ...base, status: 'idle', activity: privateText ? 'Free for a new task' : `Last: ${clip(text, 70)}` };
}

// ---------------------------------------------------------------- the snapshot

// Returns every bot as { id, name, role, theme, shape, color, primary, status, activity, pending?, task?, ... }.
// options.private: set of bot names whose message text should never be shown.
// options.primary: the boss's name, when you'd rather say than have it worked out (see primaryOf).
export function readGrokBots({ private: privateNames = new Set(), primary: primaryName = '' } = {}) {
  const files = cacheFiles();
  const roster = files.roster ? readJson(files.roster) : null;
  const rows = (roster?.rows || []).filter((r) => !r.isRemovedFromSidebar);
  const bots = rows.filter((r) => !r.isGroup);
  const now = Date.now();

  // Group chats count too: a bot posting in a group is busy, and so is one you @mention there.
  const extra = new Map(bots.map((b) => [b.id, []]));
  for (const g of rows.filter((r) => r.isGroup)) {
    const entries = files.transcripts.has(g.id) ? readJson(files.transcripts.get(g.id))?.entries || [] : [];
    for (const e of entries) {
      if (e.kind === 'send-message' && extra.has(e.author?.id)) extra.get(e.author.id).push(e);
      if (e.kind === 'message' && e.role === 'user') for (const b of bots) if (new RegExp(`@${b.name}\\b`, 'i').test(e.content || '')) extra.get(b.id).push(e);
    }
  }

  const boss = primaryOf(bots, primaryName);
  return bots.map((row) => {
    const own = files.transcripts.has(row.id) ? readJson(files.transcripts.get(row.id))?.entries || [] : [];
    const entries = [...own, ...extra.get(row.id)].sort((a, b) => a.timestampMs - b.timestampMs);
    const isPrivate = privateNames.has(row.name.toLowerCase());
    return {
      id: `grok:${row.id}`,
      grokId: row.id,
      name: row.name,
      role: roleFrom(row),
      theme: themeOf(row),
      shape: row.avatarShape || 'blob',
      color: COLORS[(row.avatarColor || '').toLowerCase()] || (/^#[0-9a-f]{6}$/i.test(row.avatarColor || '') ? row.avatarColor : '#9A9AAE'),
      pinned: false,
      primary: row.id === boss,
      ...stateFrom(row, entries, now, isPrivate),
    };
  });
}

// ---------------------------------------------------------------- the boss

// Grok Bot has no "primary" flag, so the boss is whoever the evidence points at: instructions
// that make it the primary bot or the one that routes work to the others, a pin at the top of
// the Grok Bot sidebar, being the first bot you made, and the other bots naming it in theirs.
// Returns the boss's roster id, or null when nobody stands out.
const BOSS_WORDS = /\b(?:primary|main|lead|head)\s+(?:bot|assistant|agent)\b|\bchief of staff\b|\brout(?:er|es|ing)\b|\borchestrat|\bdelegates?\b/i;
function primaryOf(bots, name) {
  if (name) return bots.find((b) => b.name.toLowerCase() === name.toLowerCase())?.id ?? null;
  const pins = readCacheKey(/\.ui-agent-refs$/)?.pinnedAgentIds || [];
  const oldest = Math.min(...bots.map((b) => b.createdAt || Infinity));
  let best = null, bestScore = 2; // a pin, or being first, isn't enough on its own
  for (const b of bots) {
    let score = BOSS_WORDS.test(`${b.title || ''} ${firstSentence(b)}`) ? 4 : BOSS_WORDS.test(b.description || '') ? 2 : 0;
    if (pins.includes(b.id)) score += 2;
    if (b.createdAt === oldest) score += 1;
    score += Math.min(2, bots.filter((o) => o !== b && new RegExp(`\\b${b.name}\\b`).test(o.description || '')).length);
    if (score > bestScore) { best = b.id; bestScore = score; }
  }
  return best;
}

// Calls onChange whenever the Grok Bot app writes to its cache (debounced), and every few
// seconds anyway so time-based states (working -> idle) stay honest.
export function watchGrokBots(onChange) {
  let timer = null;
  const fire = () => { clearTimeout(timer); timer = setTimeout(onChange, 250); };
  try { fs.watch(CACHE, fire); } catch { /* app not installed yet: polling still picks it up */ }
  setInterval(fire, 5000);
  fire();
}
