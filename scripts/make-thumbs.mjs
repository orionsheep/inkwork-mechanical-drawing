/**
 * Catalogue thumbnails: open each top-level machine in headless Edge, close it
 * up (no section, nothing selected), crop the line drawing out of the
 * transparent canvas and save it as public/thumbs/<id>.webp.
 *
 *   npx vite --port 5188   (or a preview server)
 *   node scripts/make-thumbs.mjs http://localhost:5188/ [--only jack,vise] [--jobs 3]
 *
 * Rerun after changing a machine's model or camera.
 */
import { mkdirSync, writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { browser, sleep } from './edge.mjs';

const args = process.argv.slice(2);
const flag = (name) => { const i = args.indexOf(name); return i < 0 ? undefined : args.splice(i, 2)[1]; };
const only = flag('--only')?.split(',');
const jobs = Number(flag('--jobs') ?? 3);
const [base = 'http://localhost:5188/'] = args;
const out = fileURLToPath(new URL('../public/thumbs/', import.meta.url));
mkdirSync(out, { recursive: true });

const W = 560;
const H = 350;

/** In the page: the drawn pixels' bounding box; with `encode`, the W×H WebP crop of it instead. */
const crop = (encode) => `(() => {
  const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0];
  const src = document.createElement('canvas');
  src.width = c.width; src.height = c.height;
  const sx = src.getContext('2d');
  sx.drawImage(c, 0, 0);
  const px = sx.getImageData(0, 0, src.width, src.height).data;
  let x0 = src.width, y0 = src.height, x1 = 0, y1 = 0;
  for (let y = 0; y < src.height; y += 1) for (let x = 0; x < src.width; x += 1) {
    if (px[(y * src.width + x) * 4 + 3] > 24) { if (x < x0) x0 = x; if (x > x1) x1 = x; if (y < y0) y0 = y; if (y > y1) y1 = y; }
  }
  if (x1 <= x0) return null;
  if (!${encode}) return [x0, y0, x1, y1].join(',');
  // Margin, then widen the short side to the card's ${W}:${H}.
  let w = (x1 - x0) * 1.08, h = (y1 - y0) * 1.08;
  if (w / h > ${W / H}) h = w / ${W / H}; else w = h * ${W / H};
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2;
  const dst = document.createElement('canvas');
  dst.width = ${W}; dst.height = ${H};
  const dx = dst.getContext('2d');
  dx.imageSmoothingQuality = 'high';
  dx.drawImage(src, cx - w / 2, cy - h / 2, w, h, 0, 0, ${W}, ${H});
  return dst.toDataURL('image/webp', 0.86);
})()`;

/** Open a machine, close it up and return its cropped drawing (null if nothing was drawn). */
async function capture(b, m) {
  await b.open(m, 5000);
  // Assembled and plain: section off, nothing selected or highlighted.
  await b.eval(`(()=>{const s=[...document.querySelectorAll('.toggles button')].find(b=>b.textContent.trim()==='剖视'); if (s && s.classList.contains('is-on')) s.click();})()`);
  await b.eval(`window.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }))`);
  // Software rendering is slow, so wait for the assembly to stop moving rather than a fixed time.
  const settle = async () => {
    let box = null;
    for (let i = 0, last = ''; i < 40; i += 1) {
      await sleep(1000);
      box = await b.eval(crop(false));
      if (box && box === last) break;
      last = box;
    }
    return box;
  };
  const size = await b.eval(`(() => { const c = [...document.querySelectorAll('canvas')].sort((a, b) => b.width * b.height - a.width * a.height)[0]; return [c.width, c.height]; })()`);
  // A close-up first step can run off the canvas: wheel out until the whole drawing fits.
  for (let i = 0; i < 4; i += 1) {
    const box = await settle();
    if (!box) return null;
    const [x0, y0, x1, y1] = box.split(',').map(Number);
    if (x0 > 2 && y0 > 2 && x1 < size[0] - 3 && y1 < size[1] - 3) break;
    await b.eval(`document.querySelector('.stage canvas').dispatchEvent(new WheelEvent('wheel', { deltaY: 600, clientX: innerWidth / 2, clientY: innerHeight / 2, bubbles: true, cancelable: true }))`);
  }
  return b.eval(crop(true));
}

const first = await browser(base, { width: 1500, height: 940 });
// Thumbnails are for the catalogue: top-level machines only.
const ids = (await first.assemblies()).filter((a) => !a.parent).map((a) => a.id).filter((m) => !only || only.includes(m));
const queue = [...ids];
await Promise.all(Array.from({ length: Math.max(1, Math.min(jobs, ids.length)) }, async (_, i) => {
  const b = i === 0 ? first : await browser(base, { width: 1500, height: 940 });
  for (let m; (m = queue.shift()); ) {
    // A blank canvas now and then (a dev-server reload, a lost context): try once more.
    const url = (await capture(b, m)) ?? (await capture(b, m));
    if (!url) { console.log(`✗ ${m}: nothing drawn`); continue; }
    writeFileSync(`${out}${m}.webp`, Buffer.from(url.split(',')[1], 'base64'));
    console.log(`✓ ${m}`);
  }
  b.close();
}));
