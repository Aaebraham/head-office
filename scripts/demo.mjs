#!/usr/bin/env node
// Fills the office with pretend agents so you can see every state. Ctrl+C removes them.
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const DIR = path.join(os.homedir(), '.head-office');
const TOKEN = fs.readFileSync(path.join(DIR, 'token'), 'utf8').trim();
const BASE = fs.readFileSync(path.join(DIR, 'url'), 'utf8').trim();
const post = (ev) => fetch(`${BASE}/api/event`, { method: 'POST', headers: { 'content-type': 'application/json', 'x-office-token': TOKEN }, body: JSON.stringify(ev) }).catch(() => {});

const CAST = [
  { agentId: 'demo:juniper', name: 'Juniper', role: 'Research', theme: 'research', shape: 'star', color: '#2DD4BF', script: [
    ['browsing', 'Reading 6 competitor pricing pages'], ['reading', 'Pulling quotes from the interview notes'], ['thinking', 'Comparing plans side by side'], ['done', 'Done: pricing summary is in the shared folder'], ['idle', 'Free for a new task'] ] },
  { agentId: 'demo:bolt', name: 'Bolt', role: 'Code', theme: 'code', shape: 'hex', color: '#F5C04A', script: [
    ['terminal', 'Running: npm test'], ['coding', 'Editing checkout.ts'], ['terminal', 'Running: npm test'], ['error', 'npm test failed: 2 tests'], ['coding', 'Fixing the date parser'], ['done', 'Done: all 148 tests pass'] ] },
  { agentId: 'demo:tally', name: 'Tally', role: 'Finance', theme: 'finance', shape: 'pumpkin', color: '#A78BFA', script: [
    ['idle', 'Free for a new task'], ['reading', 'Matching October receipts to invoices'], ['thinking', 'Spotted 3 duplicate charges'], ['idle', 'Free for a new task'] ] },
  { agentId: 'demo:herald', name: 'Herald', role: 'Social', theme: 'social', shape: 'flower', color: '#F472B6', script: [
    ['browsing', 'Checking what is trending this morning'], ['thinking', 'Drafting a 5-post thread'], ['needs_you', 'Thread draft is ready. Post it?'], ['working', 'Posting the thread'], ['done', 'Done: thread is live'] ] },
  { agentId: 'demo:mosaic', name: 'Mosaic', role: 'Design', theme: 'design', shape: 'heart', color: '#E05D8A', script: [
    ['thinking', 'Sketching three logo directions'], ['coding', 'Exporting the icon set'], ['done', 'Done: icons exported'], ['idle', 'Free for a new task'] ] },
  { agentId: 'claude:demo-1', source: 'claude', name: 'Claude', role: 'head-office', cwd: '~/Projects/head-office', script: [
    ['thinking', 'Thinking about "add a lounge to the office"'], ['reading', 'Reading app.js'], ['coding', 'Editing app.js'], ['needs_you', 'Allow Bash?|Running: npm run build'], ['terminal', 'Running: npm run build'], ['done', 'Done: the lounge is in'] ] },
  { agentId: 'claude:demo-2', source: 'claude', name: 'Claude', role: 'blog', cwd: '~/Projects/blog', script: [
    ['browsing', 'Searching the web: best static site hosts 2026'], ['coding', 'Writing deploy.md'], ['done', 'Done: deploy guide written'] ] },
  { agentId: 'codex:demo-1', source: 'codex', name: 'Codex', role: 'api-server', cwd: '~/Projects/api-server', script: [
    ['thinking', 'Thinking about "add rate limiting to the API"'], ['terminal', 'Running: rg "router.use" src'], ['coding', 'Editing middleware.ts'], ['needs_you', 'Allow shell?|Running: npm install express-rate-limit'], ['terminal', 'Running: npm test'], ['done', 'Done: rate limiting is in'] ] },
  { agentId: 'codex:demo-2', source: 'codex', name: 'Codex', role: 'docs', cwd: '~/Projects/docs', script: [
    ['reading', 'Reading README.md'], ['coding', 'Editing getting-started.md'], ['done', 'Done: docs updated'] ] },
];

const step = new Map(CAST.map((c) => [c.agentId, 0]));
for (const c of CAST) post({ agentId: c.agentId, source: c.source || 'demo', name: c.name, role: c.role, theme: c.theme, shape: c.shape, color: c.color, cwd: c.cwd, status: 'idle', activity: 'Arriving' });

function advance(c) {
  const i = step.get(c.agentId) % c.script.length; step.set(c.agentId, i + 1);
  const [status, text] = c.script[i];
  const base = { agentId: c.agentId, source: c.source || 'demo', task: { title: c.script.find(([s]) => s === 'done')?.[1].replace('Done: ', '') } };
  if (status === 'needs_you') {
    const [title, detail] = text.includes('|') ? text.split('|') : ['Needs you', text];
    return post({ ...base, pending: { id: `${c.agentId}:${Date.now()}`, kind: 'approval', title, detail, canResolve: true } });
  }
  post({ ...base, status, activity: text });
}

CAST.forEach((c, i) => setTimeout(function tick() { advance(c); setTimeout(tick, 4000 + Math.random() * 5000); }, 1500 + i * 700));

process.on('SIGINT', async () => { await Promise.all(CAST.map((c) => post({ agentId: c.agentId, remove: true }))); process.exit(0); });
console.log('Demo running. Ctrl+C to clear the demo agents.');
