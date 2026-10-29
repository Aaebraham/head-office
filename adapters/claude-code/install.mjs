#!/usr/bin/env node
// Adds (or with --remove, removes) the Head Office hooks in ~/.claude/settings.json.
// Backs the file up first and leaves every other setting and hook untouched.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hook.mjs');
const SETTINGS = path.join(os.homedir(), '.claude', 'settings.json');
const MARK = 'head-office';
const remove = process.argv.includes('--remove');

const EVENTS = {
  SessionStart: 5, UserPromptSubmit: 5, PreToolUse: 5, PostToolUse: 5,
  Notification: 5, Stop: 5, SessionEnd: 5,
  PermissionRequest: 60, // waits up to 45s for Approve/Decline in the office
};

const settings = fs.existsSync(SETTINGS) ? JSON.parse(fs.readFileSync(SETTINGS, 'utf8')) : {};
if (fs.existsSync(SETTINGS)) fs.copyFileSync(SETTINGS, `${SETTINGS}.bak-head-office`);
settings.hooks ||= {};

for (const [event, timeout] of Object.entries(EVENTS)) {
  const groups = (settings.hooks[event] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
    .filter((g) => g.hooks.length);
  if (!remove) {
    groups.push({
      ...(['PreToolUse', 'PostToolUse', 'PermissionRequest'].includes(event) ? { matcher: '*' } : {}),
      hooks: [{ type: 'command', command: `node "${HOOK}" # ${MARK}`, timeout }],
    });
  }
  if (groups.length) settings.hooks[event] = groups; else delete settings.hooks[event];
}

// Status line feeds the wall usage meter. Only claim it when you don't already have one.
const STATUSLINE = path.join(path.dirname(HOOK), 'statusline.mjs');
const ours = String(settings.statusLine?.command || '').includes(MARK);
if (remove && ours) delete settings.statusLine;
if (!remove && (!settings.statusLine || ours)) settings.statusLine = { type: 'command', command: `node "${STATUSLINE}" # ${MARK}` };
else if (!remove) console.log('You already have a status line, so the Claude usage meter will use the desktop app\'s readings instead.');

fs.mkdirSync(path.dirname(SETTINGS), { recursive: true });
fs.writeFileSync(SETTINGS, JSON.stringify(settings, null, 2) + '\n');
console.log(remove ? 'Removed Head Office hooks from' : 'Installed Head Office hooks into', SETTINGS);
console.log('Backup:', `${SETTINGS}.bak-head-office`);
