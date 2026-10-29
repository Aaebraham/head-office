#!/usr/bin/env node
// Adds (or with --remove, removes) the Head Office hooks in ~/.codex/hooks.json, the user-level
// hooks file that both the Codex CLI and the Codex app read. Backs the file up first and leaves
// every other hook untouched. config.toml (and its `notify` command) is never changed.

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HOOK = path.join(path.dirname(fileURLToPath(import.meta.url)), 'hook.mjs');
const CODEX = process.env.CODEX_HOME || path.join(os.homedir(), '.codex');
const FILE = path.join(CODEX, 'hooks.json');
const MARK = 'head-office';
const remove = process.argv.includes('--remove');

const EVENTS = {
  SessionStart: 5, UserPromptSubmit: 5, PreToolUse: 5, PostToolUse: 5, Stop: 5, SessionEnd: 5,
  PermissionRequest: 60, // waits up to 45s for Approve/Decline in the office
};

if (!remove && !fs.existsSync(CODEX)) {
  console.log(`No Codex folder at ${CODEX}. Install Codex (CLI or app) first, then run this again.`);
  process.exit(1);
}

const file = fs.existsSync(FILE) ? JSON.parse(fs.readFileSync(FILE, 'utf8')) : {};
if (fs.existsSync(FILE)) fs.copyFileSync(FILE, `${FILE}.bak-head-office`);
file.hooks ||= {};

for (const [event, timeout] of Object.entries(EVENTS)) {
  const groups = (file.hooks[event] || [])
    .map((g) => ({ ...g, hooks: (g.hooks || []).filter((h) => !String(h.command || '').includes(MARK)) }))
    .filter((g) => g.hooks.length);
  if (!remove) {
    groups.push({
      ...(['PreToolUse', 'PostToolUse', 'PermissionRequest'].includes(event) ? { matcher: '*' } : {}),
      hooks: [{ type: 'command', command: `node "${HOOK}" # ${MARK}`, timeout }],
    });
  }
  if (groups.length) file.hooks[event] = groups; else delete file.hooks[event];
}
if (!Object.keys(file.hooks).length) delete file.hooks;

fs.writeFileSync(FILE, JSON.stringify(file, null, 2) + '\n');
console.log(remove ? 'Removed Head Office hooks from' : 'Installed Head Office hooks into', FILE);
if (fs.existsSync(`${FILE}.bak-head-office`)) console.log('Backup:', `${FILE}.bak-head-office`);
if (!remove) {
  console.log('\nOne more step: Codex asks you to review new hooks before it runs them.');
  console.log('Open Codex (the app or `codex` in a terminal), choose "Review hooks" when it says');
  console.log('"Hooks need review", and trust the Head Office ones. Until then the office still lists');
  console.log('your Codex sessions, just without live steps or Approve/Decline.');
}
