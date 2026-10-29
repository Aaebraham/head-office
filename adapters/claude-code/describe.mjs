// Turns a Claude Code tool call into an office status and a short human sentence.
// Shared by the hook (live events) and the session reader (transcripts).

import path from 'node:path';

const base = (p) => (p ? path.basename(String(p)) : '');
export const clip = (s, n = 80) => { s = String(s || '').replace(/\s+/g, ' ').trim(); return s.length > n ? s.slice(0, n - 1) + '…' : s; };

export function describeTool(name = '', input = {}) {
  if (name === 'Bash') return ['terminal', `Running: ${clip(input.description || input.command, 70)}`];
  if (name === 'Edit' || name === 'MultiEdit') return ['coding', `Editing ${base(input.file_path)}`];
  if (name === 'Write') return ['coding', `Writing ${base(input.file_path)}`];
  if (name === 'NotebookEdit') return ['coding', `Editing ${base(input.notebook_path)}`];
  if (name === 'Read') return ['reading', `Reading ${base(input.file_path)}`];
  if (name === 'Grep' || name === 'Glob') return ['reading', `Searching the code for "${clip(input.pattern, 40)}"`];
  if (name === 'WebSearch') return ['browsing', `Searching the web: ${clip(input.query, 60)}`];
  if (name === 'WebFetch') { try { return ['browsing', `Reading ${new URL(input.url).hostname}`]; } catch { return ['browsing', 'Reading a web page']; } }
  if (name === 'Task' || name === 'Agent') return ['delegating', `Briefing a helper: ${clip(input.description, 60)}`];
  if (name === 'TodoWrite' || name.endsWith('update_plan')) return ['thinking', 'Updating the plan'];
  if (name.endsWith('wrap_up')) return ['thinking', 'Wrapping up'];
  if (/browser|chrome|navigate|screenshot/i.test(name)) return ['browsing', 'Using the browser'];
  if (name.startsWith('mcp__')) return ['working', `Using ${name.split('__')[1]?.replace(/[-_]/g, ' ') || 'a tool'}`];
  return ['working', `Using ${name}`];
}
