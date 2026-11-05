/**
 * Headless Edge over the DevTools protocol, shared by the self-check and the
 * thumbnail scripts.
 */
import { spawn, spawnSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { existsSync } from 'node:fs';

/**
 * Chromium 内核浏览器（Edge / Chrome）。可用环境变量 GEWU_BROWSER 指定路径。
 * Windows 装 Edge、macOS 通常有 Chrome；都没有时打印提示。
 */
const CANDIDATES = [
  process.env.GEWU_BROWSER,
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  'C:/Program Files/Microsoft/Edge/Application/msedge.exe',
  '/Applications/Microsoft Edge.app/Contents/MacOS/Microsoft Edge',
  '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',
  '/Applications/Chromium.app/Contents/MacOS/Chromium',
  '/usr/bin/google-chrome',
  '/usr/bin/chromium',
  '/usr/bin/chromium-browser',
].filter(Boolean);
const EDGE = CANDIDATES.find((p) => existsSync(p));
if (!EDGE) {
  console.error('找不到 Chromium 内核浏览器（Edge/Chrome）。装一个，或用 GEWU_BROWSER=/路径/浏览器 指定。');
  process.exit(1);
}

export const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const launched = [];
// Every headless browser gets a throwaway profile; kill the browsers and delete
// their profiles when the script ends, however it ends (each one is ~80 MB).
process.on('exit', () => {
  for (const { proc, dir } of launched) {
    if (proc.exitCode === null) {
      if (process.platform === 'win32') spawnSync('taskkill', ['/T', '/F', '/PID', String(proc.pid)], { stdio: 'ignore' });
      else { try { process.kill(proc.pid, 'SIGKILL'); } catch {} }
    }
    try { rmSync(dir, { recursive: true, force: true, maxRetries: 10, retryDelay: 200 }); } catch {}
  }
});
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => process.exit(130));

/** Start a headless Edge with its own temporary profile, cleaned up on exit. */
export function spawnEdge(args) {
  const dir = mkdtempSync(join(tmpdir(), 'edge-'));
  const proc = spawn(EDGE, ['--headless=new', `--user-data-dir=${dir}`, ...args], { stdio: 'ignore' });
  launched.push({ proc, dir });
  return proc;
}

/**
 * Start a headless Edge on `base` with the catalogue already dismissed.
 * Console errors and exceptions collect in `errors`.
 */
export async function browser(base, { width = 1280, height = 800 } = {}) {
  const port = 9300 + Math.floor(Math.random() * 500);
  const proc = spawnEdge([`--remote-debugging-port=${port}`,
    '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--hide-scrollbars', `--window-size=${width},${height}`, 'about:blank']);
  let target;
  for (let i = 0; i < 50 && !target; i++) {
    try { target = (await (await fetch(`http://127.0.0.1:${port}/json`)).json()).find((t) => t.type === 'page'); } catch {}
    await sleep(200);
  }
  const ws = new WebSocket(target.webSocketDebuggerUrl);
  await new Promise((r) => ws.addEventListener('open', r));
  let id = 0;
  const pending = new Map();
  const b = { errors: [] };
  ws.addEventListener('message', (e) => {
    const msg = JSON.parse(e.data);
    if (msg.id && pending.has(msg.id)) { pending.get(msg.id)(msg); pending.delete(msg.id); }
    if (msg.method === 'Runtime.exceptionThrown') b.errors.push('EXC ' + (msg.params.exceptionDetails.exception?.description ?? msg.params.exceptionDetails.text).split('\n')[0]);
    if (msg.method === 'Runtime.consoleAPICalled' && (msg.params.type === 'error' || msg.params.type === 'warning')) b.errors.push(msg.params.type + ' ' + msg.params.args.map((a) => a.value ?? a.description).join(' ').slice(0, 200));
  });
  b.send = (method, params = {}) => new Promise((r) => { const i = ++id; pending.set(i, r); ws.send(JSON.stringify({ id: i, method, params })); });
  /** Evaluate an expression in the page and return its (JSON) value. */
  b.eval = async (expression) => (await b.send('Runtime.evaluate', { expression, awaitPromise: true, returnByValue: true })).result?.result?.value;
  /** Open an assembly by id and wait for it to settle. */
  b.open = async (m, wait = 4500) => {
    await b.send('Page.navigate', { url: `${base}?n=${encodeURIComponent(m)}#${m}` });
    await sleep(wait);
  };
  b.close = () => { ws.close(); proc.kill(); };
  /** Every registered assembly as the app lists it: [{ id, parent }], sorted by id. */
  b.assemblies = async () => (await b.eval('window.gewu.assemblies()')).sort((x, y) => (x.id < y.id ? -1 : 1));
  await b.send('Runtime.enable');
  await b.send('Page.enable');
  await b.send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile: false });
  await b.send('Page.navigate', { url: base });
  await sleep(6000);
  await b.eval(`try{localStorage.setItem('gewu-catalogue-seen','1')}catch(e){}`);
  return b;
}
