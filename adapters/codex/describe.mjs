// Turns a Codex tool call into an office status and a short human sentence.
// Codex names its tools differently from Claude Code (shell, apply_patch, exec in code mode...),
// so map those first and fall back to the Claude mapping for MCP tools and anything shared.

import path from 'node:path';
import { describeTool, clip } from '../claude-code/describe.mjs';

const base = (p) => (p ? path.basename(String(p)) : '');
const commandOf = (input = {}) => {
  const c = input.command ?? input.cmd ?? input.script ?? '';
  const s = Array.isArray(c) ? c.join(' ') : String(c);
  return s.replace(/^(\/bin\/)?(ba|z)?sh -l?c\s+/, '').replace(/^['"]|['"]$/g, '');
};
const patchedFile = (input = {}) => {
  const text = typeof input === 'string' ? input : input.patch ?? input.input ?? input.command ?? '';
  const m = /\*\*\* (?:Update|Add|Delete) File: (.+)/.exec(Array.isArray(text) ? text.join('\n') : String(text));
  return m ? base(m[1].trim()) : base(input.file_path || input.path);
};

export function describeCodexTool(name = '', input = {}) {
  const n = String(name);
  if (/^(bash|shell|shell_command|local_shell|exec_command|unified_exec|container\.exec)$/i.test(n)) return ['terminal', `Running: ${clip(commandOf(input), 70) || 'a command'}`];
  if (/^exec$/i.test(n)) { // code mode: a short script that calls the other tools, so describe the first one it calls
    const code = typeof input === 'string' ? input : String(input.input ?? input.code ?? input.source ?? '');
    const call = /tools\.(\w+)\(/.exec(code)?.[1];
    const cmd = /\bcmd\s*:\s*(["'`])((?:\\.|(?!\1).)*)\1/.exec(code)?.[2];
    if (cmd && /exec_command|shell/.test(call || '')) return ['terminal', `Running: ${clip(cmd.replace(/\\n/g, ' ').replace(/\\(.)/g, '$1'), 70)}`];
    if (call && call !== 'exec') return describeCodexTool(call, {});
    return ['coding', 'Running code'];
  }
  if (/apply_patch|^(edit|write|multiedit)$/i.test(n)) { const f = patchedFile(input); return ['coding', f ? `Editing ${f}` : 'Editing files']; }
  if (/web_search|^search$/i.test(n)) return ['browsing', `Searching the web${input.query ? `: ${clip(input.query, 60)}` : ''}`];
  if (/view_image|^read/i.test(n)) return ['reading', `Reading ${base(input.path || input.file_path) || 'a file'}`];
  if (/spawn_agent|send_input|^wait$|close_agent/i.test(n)) return ['delegating', 'Working with a helper agent'];
  if (/update_plan/i.test(n)) return ['thinking', 'Updating the plan'];
  return describeTool(n, typeof input === 'object' && input ? input : {});
}

export { clip };
