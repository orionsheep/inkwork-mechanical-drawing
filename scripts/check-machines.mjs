/**
 * Smoke test: open every assembly (and subassembly) in headless Edge, step to
 * its last study step and the three-view drawing, and report console errors.
 *
 *   npm run build && npx vite preview --port 5199
 *   node scripts/check-machines.mjs http://localhost:5199/ [--only watch,model-t] [--jobs 3] [--shots dir]
 *
 * --only   test just these assemblies (an id, or a prefix such as model-t/)
 * --jobs   browsers to run side by side (default 3)
 * --shots  save a screenshot of each assembly at its last step, for eyeballing framing
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { browser, sleep } from './edge.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const only = flag('--only')?.split(',');
const jobs = Number(flag('--jobs') ?? 3);
const shots = flag('--shots');
const [base = 'http://localhost:5199/'] = args;
if (shots) mkdirSync(shots, { recursive: true });

async function check(b, m) {
  b.errors = [];
  await b.open(m);
  const name = await b.eval(`document.querySelector('.subject h2')?.textContent`);
  await b.eval(`(()=>{const s=[...document.querySelectorAll('.step-num')];s[s.length-1]?.closest('button').click()})()`);
  await sleep(2500);
  if (shots) {
    const shot = await b.send('Page.captureScreenshot', { format: 'png' });
    writeFileSync(join(shots, `${m.replace(/\//g, '_')}.png`), Buffer.from(shot.result.data, 'base64'));
  }
  await b.eval(`[...document.querySelectorAll('.views button')].find(b=>b.textContent.trim()==='三视图')?.click()`);
  await sleep(2000);
  await b.eval(`[...document.querySelectorAll('.views button')].find(b=>b.textContent.trim()==='透视')?.click()`);
  await sleep(500);
  const uniq = [...new Set(b.errors)];
  console.log(`${uniq.length ? '✗' : '✓'} ${m} (${name})${uniq.length ? '\n    ' + uniq.join('\n    ') : ''}`);
  return uniq.length === 0;
}

const first = await browser(base);
const ids = (await first.assemblies()).map((a) => a.id).filter((m) => !only || only.some((o) => m === o || m.startsWith(o)));
const queue = [...ids];
let bad = 0;
await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, ids.length)) }, async (_, i) => {
  const b = i === 0 ? first : await browser(base);
  for (let m; (m = queue.shift()); ) if (!(await check(b, m))) bad += 1;
  b.close();
}));
console.log(`\n${ids.length - bad}/${ids.length} clean`);
process.exit(bad ? 1 : 0);
