// Claude Code -> Head Office without any setup, and with zero tokens.
//
// Claude Code writes every session to ~/.claude/projects/<folder>/<session-id>.jsonl as it
// works: prompts, each tool step, replies, plus the session's title. This module only reads
// the end of recently changed files and turns them into office status. The hooks (hook.mjs)
// add instant updates and Approve/Decline on top; without them, this still shows every session.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describeTool, clip } from './describe.mjs';

export const PROJECTS = path.join(os.homedir(), '.claude', 'projects');
const TAIL_BYTES = 256 * 1024;
const BUSY_FOR_MS = 15 * 60_000; // a step with no follow-up after this long counts as quiet
const DONE_FOR_MS = 45_000;

const cache = new Map(); // file -> { mtimeMs, size, state }

function tailLines(file, size) {
  const fd = fs.openSync(file, 'r');
  try {
    const len = Math.min(size, TAIL_BYTES), buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    const lines = buf.toString('utf8').split('\n');
    if (len < size) lines.shift(); // first line is probably cut off
    return lines;
  } finally { fs.closeSync(fd); }
}

const textOf = (content) => (typeof content === 'string' ? content : Array.isArray(content) ? content.filter((c) => c?.type === 'text').map((c) => c.text).join('\n') : '');
const isRealPrompt = (e) => {
  if (e.type !== 'user' || e.isMeta || e.isSidechain) return false;
  const c = e.message?.content;
  if (Array.isArray(c) && c.some((x) => x?.type === 'tool_result')) return false;
  const t = textOf(c).trim();
  return t && !/^<(command-|local-command|system-reminder|task-notification|bash-)/.test(t) && !t.startsWith('[Request interrupted');
};

function readSession(file, stat, now) {
  let title = '', cwd = '', lastPrompt = '', last = null, lastTs = 0;
  for (const line of tailLines(file, stat.size)) {
    if (!line) continue;
    let e; try { e = JSON.parse(line); } catch { continue; }
    if (e.type === 'custom-title' && e.customTitle) title = e.customTitle;
    else if (e.type === 'agent-name' && e.agentName && !title) title = e.agentName;
    if (e.cwd) cwd = e.cwd;
    if ((e.type === 'user' || e.type === 'assistant') && !e.isSidechain && !e.isMeta) {
      if (isRealPrompt(e)) lastPrompt = textOf(e.message.content).trim();
      last = e; lastTs = Date.parse(e.timestamp) || lastTs;
    }
  }
  const age = now - (lastTs || stat.mtimeMs);
  const task = lastPrompt ? { title: clip(lastPrompt, 70) } : null;
  let status = 'idle', activity = 'Waiting for your next prompt', pending = null;
  const c = last?.message?.content;
  if (last?.type === 'assistant') {
    const blocks = Array.isArray(c) ? c : [];
    const tool = [...blocks].reverse().find((b) => b?.type === 'tool_use');
    const said = textOf(c).trim();
    if (tool && age < BUSY_FOR_MS) [status, activity] = describeTool(tool.name, tool.input);
    else if (blocks.some((b) => b?.type === 'thinking') && !said && age < BUSY_FOR_MS) [status, activity] = ['thinking', 'Thinking it through'];
    else if (said) {
      const lastLine = said.split('\n').map((l) => l.trim()).filter(Boolean).pop() || '';
      if (/\?\s*\**\s*$/.test(lastLine) && age < 3 * 3600_000) {
        status = 'needs_you'; activity = 'Has a question for you';
        pending = { id: `${path.basename(file)}:${lastTs}`, kind: 'question', title: 'Has a question for you', detail: clip(lastLine, 220), canResolve: false };
      } else if (age < DONE_FOR_MS) [status, activity] = ['done', `Done: ${clip(said.split('\n')[0], 70)}`];
    }
  } else if (last?.type === 'user' && age < BUSY_FOR_MS) {
    [status, activity] = isRealPrompt(last) ? ['thinking', `Thinking about "${clip(lastPrompt, 60)}"`] : ['thinking', 'Thinking it through'];
  }
  return { title, cwd, task, status, activity, pending, lastAt: lastTs || stat.mtimeMs };
}

// Listing ~/.claude/projects means stat-ing hundreds of old sessions, so do that at most
// every 30 s; in between only re-check files that were recently active.
let listed = { at: 0, files: [] };
function candidates(now, activeMs) {
  if (now - listed.at > 30_000) {
    const files = [];
    let dirs = [];
    try { dirs = fs.readdirSync(PROJECTS); } catch { /* no Claude Code yet */ }
    for (const dir of dirs) {
      if (dir.startsWith('-private-var-') || dir.startsWith('-tmp')) continue; // throwaway temp sessions
      try {
        for (const f of fs.readdirSync(path.join(PROJECTS, dir))) {
          if (!f.endsWith('.jsonl')) continue;
          const file = path.join(PROJECTS, dir, f);
          if (now - fs.statSync(file).mtimeMs < activeMs + 60_000) files.push(file);
        }
      } catch { /* folder vanished */ }
    }
    listed = { at: now, files };
  }
  return listed.files;
}

// Every Claude Code session touched within `activeMs`, as office agents.
export function readClaudeSessions({ activeMs = 2 * 3600_000 } = {}) {
  const now = Date.now(), out = [];
  for (const file of candidates(now, activeMs)) {
    const dir = path.basename(path.dirname(file)), f = path.basename(file);
    {
      let stat; try { stat = fs.statSync(file); } catch { continue; }
      if (now - stat.mtimeMs > activeMs) continue;
      const hit = cache.get(file);
      let state;
      if (hit && hit.mtimeMs === stat.mtimeMs && hit.size === stat.size && now - hit.at < 30_000) state = hit.state;
      else { try { state = readSession(file, stat, now); } catch { continue; } cache.set(file, { mtimeMs: stat.mtimeMs, size: stat.size, at: now, state }); }
      const sessionId = f.replace(/\.jsonl$/, '');
      const project = path.basename(state.cwd || '') || dir.split('-').pop();
      out.push({ id: `claude:${sessionId}`, sessionId, project, ...state });
    }
  }
  return out;
}

export function watchClaudeSessions(onChange) {
  // At most one read every 1.5 s: a busy session appends to its file many times a second.
  let timer = null, last = 0;
  const fire = () => { if (timer) return; timer = setTimeout(() => { timer = null; last = Date.now(); onChange(); }, Math.max(300, 1500 - (Date.now() - last))); };
  try {
    fs.watch(PROJECTS, { recursive: true }, (_, name) => {
      if (!name || !name.endsWith('.jsonl')) return;
      const file = path.join(PROJECTS, name);
      if (!listed.files.includes(file)) listed.files.push(file); // a brand-new session
      fire();
    });
  } catch { /* polling below still works */ }
  setInterval(fire, 5000);
  fire();
}
