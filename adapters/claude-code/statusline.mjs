#!/usr/bin/env node
// Claude Code status line -> Head Office usage meter. Claude Code pipes the status line's JSON
// (including rate_limits: 5-hour and weekly % used, with reset times) to this script after each
// turn. It saves just those numbers to ~/.head-office/claude-usage.json and prints nothing, so
// the status line stays empty and no tokens are spent (status lines never reach the model).

import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

let raw = '';
process.stdin.on('data', (c) => { raw += c; });
process.stdin.on('end', () => {
  try {
    const { rate_limits } = JSON.parse(raw);
    if (!rate_limits?.five_hour && !rate_limits?.seven_day) return;
    const { five_hour, seven_day } = rate_limits;
    const file = path.join(os.homedir(), '.head-office', 'claude-usage.json');
    fs.mkdirSync(path.dirname(file), { recursive: true });
    fs.writeFileSync(`${file}.tmp`, JSON.stringify({ at: Date.now(), rate_limits: { five_hour, seven_day } }));
    fs.renameSync(`${file}.tmp`, file);
  } catch { /* never break the status line */ }
});
