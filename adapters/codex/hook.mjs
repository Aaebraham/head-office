#!/usr/bin/env node
// Codex -> Head Office. Runs as a Codex hook (CLI or desktop app), outside the model:
// it reads the hook's JSON from stdin, posts one small status event, and prints nothing
// (stdout from some hooks is added to the model's context, which would cost tokens).
// The one exception is PermissionRequest, where it may print Allow/Deny chosen in the office.
// Codex's hook payloads and replies follow Claude Code's, so this mirrors ../claude-code/hook.mjs.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describeCodexTool, clip } from './describe.mjs';

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

async function main() {
  if (!TOKEN) return; // office was never started on this machine
  let input = '';
  for await (const chunk of process.stdin) input += chunk;
  const h = JSON.parse(input || '{}');
  if (!h.session_id) return;
  if (h.agent_id) return; // a helper agent's hooks: its parent session already shows as busy
  const project = path.basename(String(h.cwd || '')) || 'Codex';
  const ev = { agentId: `codex:${h.session_id}`, source: 'codex', name: 'Codex', cwd: h.cwd, viaHook: true };

  switch (h.hook_event_name) {
    case 'SessionStart':
      return api('POST', '/api/event', { ...ev, status: 'idle', activity: `Opened ${project}` });

    case 'UserPromptSubmit':
      return api('POST', '/api/event', { ...ev, status: 'thinking', activity: `Thinking about "${clip(h.prompt, 60)}"`, task: { title: clip(h.prompt, 70), startedAt: Date.now() } });

    case 'PreToolUse': {
      const [status, activity] = describeCodexTool(h.tool_name, h.tool_input);
      return api('POST', '/api/event', { ...ev, status, activity });
    }

    case 'PostToolUse':
      return api('POST', '/api/event', { ...ev, clearPending: true });

    case 'Stop': {
      const said = String(h.last_assistant_message || '').trim();
      const lastLine = said.split('\n').filter(Boolean).pop() || '';
      if (/\?\s*\**\s*$/.test(lastLine)) {
        return api('POST', '/api/event', { ...ev, pending: { id: `${h.session_id}:question`, kind: 'question', title: 'Has a question for you', detail: clip(lastLine, 220), canResolve: false } });
      }
      return api('POST', '/api/event', { ...ev, status: 'done', activity: `Done: ${clip(said.split('\n')[0], 70) || 'finished the task'}`, clearPending: true });
    }

    case 'SessionEnd':
      return api('POST', '/api/event', { ...ev, remove: true });

    case 'PermissionRequest': {
      const [, doing] = describeCodexTool(h.tool_name, h.tool_input);
      const id = `${h.session_id}:${Date.now()}`;
      const { visibleViewers } = await api('GET', '/api/viewers');
      const remote = visibleViewers > 0;
      await api('POST', '/api/event', {
        ...ev,
        pending: { id, kind: 'approval', title: `Allow ${h.tool_name}?`, detail: doing, canResolve: remote },
      });
      if (!remote) return; // nobody is watching the office: let Codex ask as usual
      const { decision } = await api('GET', `/api/decision/${encodeURIComponent(id)}?wait=${APPROVAL_WAIT_S}`, null, (APPROVAL_WAIT_S + 5) * 1000);
      if (!decision) {
        await api('POST', '/api/event', { ...ev, pending: { id: `${id}:terminal`, kind: 'approval', title: `Allow ${h.tool_name}?`, detail: `${doing} — answer in Codex`, canResolve: false } });
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

// Never block or break Codex: any failure (office closed, bad JSON) is silent.
main().catch(() => {}).finally(() => process.exit(0));
