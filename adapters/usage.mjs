// Plan usage for the wall meter, read only from files already on this Mac. Nothing here
// talks to xAI or Anthropic, so it costs no tokens and sends nothing anywhere.
//
// Grok Bot: the desktop app caches your weekly usage in its sand-client-persistence store
//   (key "...weekly-usage.cache"): percent used, when it resets, plan name.
// Claude: two sources, newest wins.
//   1. ~/.head-office/claude-usage.json, written by adapters/claude-code/statusline.mjs from
//      Claude Code's status line (live 5-hour and weekly %, with reset times).
//   2. The Claude desktop app's plan-usage-history.json (5-hour and weekly %, sampled
//      whenever the app refreshes your usage).
// Codex: the rate limits Codex logs with every turn in its own session files (adapters/codex/sessions.mjs).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { GROK_DIR, readCacheKey } from './grok/watch.mjs';
import { codexUsage, codexInstalled } from './codex/sessions.mjs';

const CLAUDE_HISTORY = path.join(os.homedir(), 'Library', 'Application Support', 'Claude', 'plan-usage-history.json');
const CLAUDE_STATUSLINE = path.join(os.homedir(), '.head-office', 'claude-usage.json');
const FIVE_H = 5 * 3600_000, WEEK = 7 * 24 * 3600_000;

const readJson = (f) => { try { return JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return null; } };
const pct = (n) => (Number.isFinite(n) ? Math.max(0, Math.min(100, n)) : null);
const ms = (t) => (!t ? null : t < 1e12 ? t * 1000 : t); // status line reports epoch seconds

function grokUsage() {
  const cache = readCacheKey(/\.weekly-usage\.cache$/);
  const reading = cache?.kind === 'present' ? cache.reading : null;
  const u = reading?.usage;
  if (!u) return null;
  return {
    plan: [u.grokPlanLabel, u.unifiedPlanName].filter(Boolean).join(' · ') || 'Grok Bot',
    at: reading.readAtMs || 0,
    meters: [{ label: 'This week', percent: pct(u.percentUsed), resetsAt: u.nextResetMs || null }],
  };
}

function claudeUsage() {
  const fromStatusline = (() => {
    const s = readJson(CLAUDE_STATUSLINE);
    if (!s?.rate_limits) return null;
    const { five_hour: fh, seven_day: sd } = s.rate_limits;
    return { at: s.at || 0, fh: pct(fh?.used_percentage), fhReset: ms(fh?.resets_at), sd: pct(sd?.used_percentage), sdReset: ms(sd?.resets_at) };
  })();
  const fromDesktop = (() => {
    const samples = readJson(CLAUDE_HISTORY)?.samples;
    const last = Array.isArray(samples) ? samples.reduce((a, b) => (!a || b.t > a.t ? b : a), null) : null;
    return last?.u ? { at: last.t, fh: pct(last.u.fh), sd: pct(last.u.sd) } : null;
  })();
  const r = [fromStatusline, fromDesktop].filter(Boolean).sort((a, b) => b.at - a.at)[0];
  if (!r) return null;
  // A window that has rolled over since the reading started fresh, so its old number is meaningless.
  const age = Date.now() - r.at;
  const fhStale = r.fhReset ? Date.now() > r.fhReset : age > FIVE_H;
  const sdStale = r.sdReset ? Date.now() > r.sdReset : age > WEEK;
  return {
    plan: 'Claude',
    at: r.at,
    meters: [
      { label: '5-hour window', percent: fhStale ? null : r.fh, resetsAt: r.fhReset || null },
      { label: 'This week', percent: sdStale ? null : r.sd, resetsAt: r.sdReset || null },
    ],
  };
}

export const readUsage = () => ({ grok: grokUsage(), claude: claudeUsage(), codex: codexInstalled() ? codexUsage() : null });

export function watchUsage(onChange) {
  let last = '';
  const check = () => {
    const now = readUsage(), key = JSON.stringify(now);
    if (key !== last) { last = key; onChange(now); }
  };
  for (const dir of [path.dirname(CLAUDE_HISTORY), path.dirname(CLAUDE_STATUSLINE), path.join(GROK_DIR, 'sand-client-persistence')]) {
    try { fs.watch(dir, () => setTimeout(check, 300)); } catch { /* polling below still works */ }
  }
  setInterval(check, 30_000); // also catches windows going stale as time passes, and new Codex readings
  check();
}
