// Codex -> Head Office without any setup, and with zero tokens.
//
// The Codex CLI and app keep a list of your threads in ~/.codex/state_<n>.sqlite and write each
// thread's steps to a "rollout" file under ~/.codex/sessions (plain .jsonl while it's open,
// zstd-compressed later). This module only reads them, never writes, and turns them into office
// status. The hooks (hook.mjs) add instant updates and Approve/Decline on top.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import zlib from 'node:zlib';
import { describeCodexTool, clip } from './describe.mjs';

export const CODEX = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const SESSIONS = path.join(CODEX, 'sessions');
const TAIL_BYTES = 256 * 1024;
const BUSY_FOR_MS = 15 * 60_000; // a turn with no follow-up after this long counts as quiet
const DONE_FOR_MS = 45_000;

export const codexInstalled = () => fs.existsSync(CODEX);

// Newest state database (the number in its name goes up when Codex migrates it).
let db = null, dbFile = null;
function database() {
  let files = [];
  try { files = fs.readdirSync(CODEX).filter((f) => /^state_\d+\.sqlite$/.test(f)); } catch { return null; }
  const newest = files.sort((a, b) => Number(b.match(/\d+/)[0]) - Number(a.match(/\d+/)[0]))[0];
  if (!newest) return null;
  const file = path.join(CODEX, newest);
  if (db && dbFile === file) return db;
  try { db?.close(); } catch {}
  try {
    const { DatabaseSync } = process.getBuiltinModule('node:sqlite');
    db = new DatabaseSync(file, { readOnly: true }); dbFile = file;
  } catch { db = null; } // Node without SQLite: hooks still work, the session list doesn't
  return db;
}

function threads(sinceMs) {
  const d = database();
  if (!d) return [];
  try {
    return d.prepare(`select id, rollout_path, title, name, cwd, updated_at_ms from threads
      where archived = 0 and coalesce(thread_source, '') in ('', 'user') and updated_at_ms > ?
      order by updated_at_ms desc limit 40`).all(sinceMs);
  } catch { return []; }
}

// A thread's title is its first prompt. Prefer the name you gave it, else the request itself.
function titleOf(t) {
  if (t.name) return String(t.name).trim();
  const s = String(t.title || '');
  const asked = /## My request:\s*([\s\S]+)/.exec(s)?.[1] || s;
  return asked.split('\n').map((l) => l.trim()).find((l) => l && !l.startsWith('#')) || '';
}

function rolloutLines(rolloutPath) {
  if (!rolloutPath) return null;
  for (const [file, zst] of [[rolloutPath, false], [`${rolloutPath}.zst`, true]]) {
    let stat; try { stat = fs.statSync(file); } catch { continue; }
    if (zst) return { stat, lines: zlib.zstdDecompressSync(fs.readFileSync(file)).toString('utf8').split('\n') };
    const fd = fs.openSync(file, 'r');
    try {
      const len = Math.min(stat.size, TAIL_BYTES), buf = Buffer.alloc(len);
      fs.readSync(fd, buf, 0, len, stat.size - len);
      const lines = buf.toString('utf8').split('\n');
      if (len < stat.size) lines.shift(); // first line is probably cut off
      return { stat, lines };
    } finally { fs.closeSync(fd); }
  }
  return null;
}

function readRollout(rolloutPath, now) {
  const r = rolloutLines(rolloutPath);
  if (!r) return null;
  let busy = false, tool = null, said = '', lastTs = 0, limits = null, limitsAt = 0;
  for (const line of r.lines) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    const p = e.payload || {}, ts = Date.parse(e.timestamp) || 0;
    if (e.type === 'event_msg' && p.type === 'task_started') { busy = true; tool = null; said = ''; lastTs = ts; }
    else if (e.type === 'event_msg' && p.type === 'task_complete') { busy = false; tool = null; said = String(p.last_agent_message || '').trim(); lastTs = ts; }
    else if (e.type === 'event_msg' && p.type === 'token_count' && p.rate_limits) { limits = p.rate_limits; limitsAt = ts; }
    else if (e.type === 'response_item' && /^(custom_tool_call|function_call|local_shell_call)$/.test(p.type)) {
      let input = p.input ?? p.arguments ?? p.action ?? {};
      if (typeof input === 'string' && p.type === 'function_call') { try { input = JSON.parse(input); } catch {} }
      tool = { name: p.name || 'shell', input }; lastTs = ts;
    }
  }
  const age = now - (lastTs || r.stat.mtimeMs);
  let status = 'idle', activity = 'Waiting for your next prompt', pending = null;
  if (busy && age < BUSY_FOR_MS) [status, activity] = tool ? describeCodexTool(tool.name, tool.input) : ['thinking', 'Thinking it through'];
  else if (!busy && said) {
    const lastLine = said.split('\n').map((l) => l.trim()).filter(Boolean).pop() || '';
    if (/\?\s*\**\s*$/.test(lastLine) && age < 3 * 3600_000) {
      status = 'needs_you'; activity = 'Has a question for you';
      pending = { id: `${path.basename(rolloutPath)}:${lastTs}`, kind: 'question', title: 'Has a question for you', detail: clip(lastLine, 220), canResolve: false };
    } else if (age < DONE_FOR_MS) [status, activity] = ['done', `Done: ${clip(said.split('\n')[0], 70)}`];
  }
  return { status, activity, pending, lastAt: lastTs || r.stat.mtimeMs, limits, limitsAt };
}

const cache = new Map(); // rollout path -> { key, at, state }
let latestLimits = null;

// Every Codex thread touched within `activeMs`, as office agents.
export function readCodexSessions({ activeMs = 2 * 3600_000 } = {}) {
  const now = Date.now(), out = [];
  for (const t of threads(now - activeMs)) {
    const hit = cache.get(t.rollout_path);
    let state;
    if (hit && hit.key === t.updated_at_ms && now - hit.at < 30_000) state = hit.state;
    else { try { state = readRollout(t.rollout_path, now); } catch { state = null; } cache.set(t.rollout_path, { key: t.updated_at_ms, at: now, state }); }
    if (state?.limits && state.limitsAt > (latestLimits?.at || 0)) latestLimits = { at: state.limitsAt, limits: state.limits };
    const title = titleOf(t);
    out.push({
      id: `codex:${t.id}`, project: path.basename(t.cwd || '') || 'Codex', title, cwd: t.cwd,
      task: title ? { title: clip(title, 70) } : null,
      status: state?.status || 'idle', activity: state?.activity || 'Waiting for your next prompt',
      pending: state?.pending || null, lastAt: Math.max(state?.lastAt || 0, t.updated_at_ms || 0),
    });
  }
  return out;
}

// Plan usage, from the rate limits Codex logs with every turn (the newest thread that has them).
const WINDOW_LABEL = { 300: '5-hour window', 10080: 'This week', 43200: 'This month' };
export function codexUsage() {
  if (!latestLimits) {
    const [t] = threads(0);
    if (t) { const s = readRollout(t.rollout_path, Date.now()); if (s?.limits) latestLimits = { at: s.limitsAt, limits: s.limits }; }
  }
  if (!latestLimits) return null;
  const { at, limits } = latestLimits;
  const meters = [limits.primary, limits.secondary].filter(Boolean).map((w) => {
    const resetsAt = w.resets_at ? w.resets_at * 1000 : null;
    return {
      label: WINDOW_LABEL[w.window_minutes] || `${Math.round(w.window_minutes / 60)}-hour window`,
      percent: resetsAt && Date.now() > resetsAt ? null : Math.max(0, Math.min(100, w.used_percent)),
      resetsAt,
    };
  });
  const plan = limits.plan_type ? `Codex ${limits.plan_type[0].toUpperCase()}${limits.plan_type.slice(1)}` : 'Codex';
  return meters.length ? { plan, at, meters } : null;
}

export function watchCodexSessions(onChange) {
  let timer = null, last = 0;
  const fire = () => { if (timer) return; timer = setTimeout(() => { timer = null; last = Date.now(); onChange(); }, Math.max(300, 1500 - (Date.now() - last))); };
  try { fs.watch(SESSIONS, { recursive: true }, (_, name) => { if (name?.endsWith('.jsonl')) fire(); }); } catch { /* polling below still works */ }
  setInterval(fire, 4000);
  fire();
}
