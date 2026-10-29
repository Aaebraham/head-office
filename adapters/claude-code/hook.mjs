#!/usr/bin/env node
// Claude Code -> Head Office. Runs as a Claude Code hook, outside the model:
// it reads the hook's JSON from stdin, posts one small status event, and prints
// nothing (stdout from some hooks is added to Claude's context, which would cost tokens).
// The one exception is PermissionRequest, where it may print Allow/Deny chosen in the office.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describeTool, clip } from './describe.mjs';

const DIR = path.join(os.homedir(), '.head-office');
const APPROVAL_WAIT_S = Number(process.env.HEAD_OFFICE_APPROVAL_WAIT || 45);

const read = (f) => { try { return fs.readFileSync(path.join(DIR, f), 'utf8').trim(); } catch { return null; } };
const TOKEN = read('token');
const BASE = read('url') || 'http://127.0.0.1:4317';

async function api(method, route, body, timeoutMs = 2500) { // well inside the hook's 5 s budget
  const res = await fetch(BASE + route, {
    method,
    headers: { 'content-type': 'application/json', 'x-office-token': TOKEN },
    body: body ? JSON.stringify(body) : undefined,
    signal: AbortSignal.timeout(timeoutMs),
  });
  return res.json();
}

const base = (p) => (p ? path.basename(String(p)) : '');

// The last thing Claude said, read straight from the local transcript file (no model call).
function lastAssistantText(transcriptPath) {
  try {
    const fd = fs.openSync(transcriptPath, 'r');
    const size = fs.fstatSync(fd).size;
    const len = Math.min(size, 96_000);
    const buf = Buffer.alloc(len);
    fs.readSync(fd, buf, 0, len, size - len);
    fs.closeSync(fd);
    const lines = buf.toString('utf8').split('\n').reverse();
    for (const line of lines) {
      if (!line.includes('"assistant"')) continue;
      try {
        const msg = JSON.parse(line).message;
        const text = (Array.isArray(msg?.content) ? msg.content : []).filter((c) => c.type === 'text').map((c) => c.text).join('\n').trim();
        if (text) return text;
      } catch { /* partial first line */ }
    }
  } catch { /* no transcript */ }
  return '';
}

async function main() {
  if (!TOKEN) return; // office was never started on this machine
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const h = JSON.parse(input || '{}');
  const project = base(h.cwd) || 'Claude';
  const ev = { agentId: `claude:${h.session_id}`, source: 'claude', name: 'Claude', cwd: h.cwd, viaHook: true };

  switch (h.hook_event_name) {
    case 'SessionStart':
      return api('POST', '/api/event', { ...ev, status: 'idle', activity: `Opened ${project}` });

    case 'UserPromptSubmit': {
      const title = clip(h.prompt, 70);
      return api('POST', '/api/event', { ...ev, status: 'thinking', activity: `Thinking about "${clip(h.prompt, 60)}"`, task: { title, startedAt: Date.now() } });
    }

    case 'PreToolUse': {
      const [status, activity] = describeTool(h.tool_name, h.tool_input);
      return api('POST', '/api/event', { ...ev, status, activity });
    }

    case 'PostToolUse':
      return api('POST', '/api/event', { ...ev, clearPending: true });

    case 'Notification': {
      if (h.notification_type === 'permission_prompt' || /permission/i.test(h.message || '')) {
        return api('POST', '/api/event', { ...ev, pending: { id: `${h.session_id}:prompt`, kind: 'approval', title: 'Needs your permission', detail: clip(h.message, 200), canResolve: false } });
      }
      if (['elicitation_dialog', 'elicitation_url_dialog', 'agent_needs_input'].includes(h.notification_type)) {
        return api('POST', '/api/event', { ...ev, pending: { id: `${h.session_id}:input`, kind: 'question', title: 'Needs your input', detail: clip(h.message, 200), canResolve: false } });
      }
      return; // idle reminders are already covered by Stop
    }

    case 'Stop': {
      const said = h.last_assistant_message || lastAssistantText(h.transcript_path);
      const lastLine = said.split('\n').filter(Boolean).pop() || '';
      if (/\?\s*\**\s*$/.test(lastLine)) {
        return api('POST', '/api/event', { ...ev, pending: { id: `${h.session_id}:question`, kind: 'question', title: 'Has a question for you', detail: clip(lastLine, 220), canResolve: false } });
      }
      return api('POST', '/api/event', { ...ev, status: 'done', activity: `Done: ${clip(said.split('\n')[0], 70) || 'finished the task'}`, clearPending: true });
    }

    case 'SessionEnd':
      return api('POST', '/api/event', { ...ev, remove: true });

    case 'PermissionRequest': {
      const [, doing] = describeTool(h.tool_name, h.tool_input);
      const id = `${h.session_id}:${Date.now()}`;
      const { visibleViewers } = await api('GET', '/api/viewers');
      const remote = visibleViewers > 0;
      await api('POST', '/api/event', {
        ...ev,
        pending: { id, kind: 'approval', title: `Allow ${h.tool_name}?`, detail: doing, canResolve: remote },
      });
      if (!remote) return; // nobody is watching the office: let the normal terminal prompt appear
      const { decision } = await api('GET', `/api/decision/${encodeURIComponent(id)}?wait=${APPROVAL_WAIT_S}`, null, (APPROVAL_WAIT_S + 5) * 1000);
      if (!decision) {
        await api('POST', '/api/event', { ...ev, pending: { id: `${id}:terminal`, kind: 'approval', title: `Allow ${h.tool_name}?`, detail: `${doing} — answer in the terminal`, canResolve: false } });
        return;
      }
      const out = JSON.stringify({
        hookSpecificOutput: {
          hookEventName: 'PermissionRequest',
          decision: decision === 'allow' ? { behavior: 'allow' } : { behavior: 'deny', message: 'Declined from Head Office.' },
        },
      });
      await new Promise((resolve) => process.stdout.write(out, resolve));
    }
  }
}

// Never block or break Claude Code: any failure (office closed, bad JSON) is silent.
main().catch(() => {}).finally(() => process.exit(0));
