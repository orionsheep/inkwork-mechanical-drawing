import { currentMachine } from './machines';
import { motion, useStudio } from './state';
import { PALETTE } from './scene/ink';

/**
 * Exports built from the live WebGL canvas: a publication-style plate (PNG)
 * and a teardown animation (WebM). Both composite onto paper in a 2D canvas,
 * because the WebGL canvas itself is transparent.
 */

/** Set by <ExportBridge> inside the R3F canvas. */
export const bridge: { setDpr?: (dpr: number) => void; getDpr?: () => number } = {};

/** Ink at an opacity, in the current palette (exports follow the paper / blueprint theme). */
function inkA(alpha: number) {
  const v = parseInt(PALETTE.ink.slice(1), 16);
  return `rgba(${(v >> 16) & 255}, ${(v >> 8) & 255}, ${v & 255}, ${alpha})`;
}
const ZH = '"Noto Serif SC", "Source Han Serif SC", "Songti SC", SimSun, serif';
const EN = '"Cormorant Garamond", Garamond, Georgia, serif';

const frames = (n: number) => new Promise<void>((resolve) => {
  const tick = (left: number) => (left <= 0 ? resolve() : requestAnimationFrame(() => tick(left - 1)));
  tick(n);
});
const wait = (ms: number) => new Promise((r) => setTimeout(r, ms));

function stageCanvas() {
  return document.querySelector<HTMLCanvasElement>('.stage canvas');
}

function download(name: string, href: string) {
  const link = document.createElement('a');
  link.href = href;
  link.download = name;
  link.click();
}

function paper(ctx: CanvasRenderingContext2D, w: number, h: number, grid: number) {
  ctx.fillStyle = PALETTE.paper;
  ctx.fillRect(0, 0, w, h);
  ctx.strokeStyle = inkA(0.035);
  ctx.lineWidth = 1;
  ctx.beginPath();
  for (let x = 0; x <= w; x += grid) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, h); }
  for (let y = 0; y <= h; y += grid) { ctx.moveTo(0, y + 0.5); ctx.lineTo(w, y + 0.5); }
  ctx.stroke();
}

/** Bounding box of the drawn (non-transparent) pixels. */
function inkBounds(source: HTMLCanvasElement) {
  const probe = document.createElement('canvas');
  probe.width = source.width;
  probe.height = source.height;
  const ctx = probe.getContext('2d', { willReadFrequently: true })!;
  ctx.drawImage(source, 0, 0);
  const { data, width, height } = ctx.getImageData(0, 0, probe.width, probe.height);
  let x0 = width, y0 = height, x1 = 0, y1 = 0;
  for (let y = 0; y < height; y += 2) {
    for (let x = 0; x < width; x += 2) {
      if (data[(y * width + x) * 4 + 3] > 20) {
        if (x < x0) x0 = x;
        if (x > x1) x1 = x;
        if (y < y0) y0 = y;
        if (y > y1) y1 = y;
      }
    }
  }
  return x1 > x0 ? { x: x0, y: y0, w: x1 - x0, h: y1 - y0 } : { x: 0, y: 0, w: width, h: height };
}

/** On-screen callout anchors (part index → canvas pixel position). */
function calloutAnchors(source: HTMLCanvasElement) {
  const rect = source.getBoundingClientRect();
  const sx = source.width / rect.width;
  const sy = source.height / rect.height;
  const out: Array<{ index: number; x: number; y: number }> = [];
  document.querySelectorAll<HTMLElement>('.callout').forEach((el) => {
    const num = Number(el.querySelector('.callout-num')?.textContent);
    const r = el.getBoundingClientRect();
    if (num) out.push({ index: num, x: (r.left - rect.left) * sx, y: (r.top - rect.top) * sy });
  });
  return out;
}

/** Push balloons apart so their circles don't overlap. */
function relax(points: Array<{ x: number; y: number }>, radius: number, bounds: { x0: number; y0: number; x1: number; y1: number }) {
  for (let iter = 0; iter < 60; iter += 1) {
    for (let i = 0; i < points.length; i += 1) {
      for (let j = i + 1; j < points.length; j += 1) {
        const dx = points[j].x - points[i].x;
        const dy = points[j].y - points[i].y;
        const d = Math.hypot(dx, dy) || 1;
        const overlap = radius * 2.4 - d;
        if (overlap > 0) {
          const ux = (dx / d) * overlap * 0.5;
          const uy = (dy / d) * overlap * 0.5;
          points[i].x -= ux; points[i].y -= uy;
          points[j].x += ux; points[j].y += uy;
        }
      }
    }
    for (const p of points) {
      p.x = Math.min(bounds.x1, Math.max(bounds.x0, p.x));
      p.y = Math.min(bounds.y1, Math.max(bounds.y0, p.y));
    }
  }
}

/**
 * A4-landscape plate at 300 dpi: title, the current 3D view with numbered
 * balloons and leaders, the parts list and a title block.
 */
export async function exportPlate() {
  const source = stageCanvas();
  if (!source) return;
  const machine = currentMachine();
  const state = useStudio.getState();
  const restoreLabels = state.labels;
  const restoreDpr = bridge.getDpr?.() ?? window.devicePixelRatio;
  state.set({ labels: true, hovered: null });
  bridge.setDpr?.(Math.min(3, Math.max(2, 2600 / source.clientWidth)));
  await document.fonts.ready;
  await frames(4);

  const W = 3508;
  const H = 2480;
  const out = document.createElement('canvas');
  out.width = W;
  out.height = H;
  const ctx = out.getContext('2d')!;
  paper(ctx, W, H, 70);
  ctx.strokeStyle = inkA(0.35);
  ctx.lineWidth = 2;
  ctx.strokeRect(60, 60, W - 120, H - 120);
  ctx.lineWidth = 1;
  ctx.strokeRect(76, 76, W - 152, H - 152);

  // Title column.
  ctx.fillStyle = PALETTE.ink;
  ctx.textBaseline = 'alphabetic';
  ctx.font = `900 230px ${ZH}`;
  ctx.fillText('格物', 150, 380);
  ctx.fillRect(150, 440, 640, 2);
  ctx.font = `500 54px ${EN}`;
  ctx.letterSpacing = '12px';
  ctx.fillText('INKWORK', 150, 530);
  ctx.font = `400 46px ${ZH}`;
  ctx.letterSpacing = '16px';
  ctx.fillText(`${machine.name} · 爆炸图`, 150, 620);
  ctx.letterSpacing = '4px';
  ctx.fillStyle = PALETTE.rust;
  ctx.font = `500 40px ${EN}`;
  ctx.fillText('FIG. 01', 150, 720);
  ctx.fillStyle = inkA(0.4);
  ctx.fillRect(330, 707, 460, 1.5);
  ctx.letterSpacing = '0px';

  // The drawing, cropped to its ink and fitted into the main field.
  const box = inkBounds(source);
  const field = { x: 640, y: 200, w: W - 640 - 900, h: H - 200 - 170 };
  const scale = Math.min(field.w / box.w, field.h / box.h) * 0.9;
  const dw = box.w * scale;
  const dh = box.h * scale;
  const dx = field.x + (field.w - dw) / 2;
  const dy = field.y + (field.h - dh) / 2;
  ctx.drawImage(source, box.x, box.y, box.w, box.h, dx, dy, dw, dh);

  // Balloons: pushed radially out from the drawing's centre, then relaxed.
  const cx = dx + dw / 2;
  const cy = dy + dh / 2;
  const anchors = calloutAnchors(source).map((a) => ({ index: a.index, x: dx + (a.x - box.x) * scale, y: dy + (a.y - box.y) * scale }));
  const balloons = anchors.map((a) => {
    const vx = a.x - cx;
    const vy = a.y - cy;
    const d = Math.hypot(vx, vy) || 1;
    return { x: a.x + (vx / d) * 230, y: a.y + (vy / d) * 230 };
  });
  const R = 34;
  relax(balloons, R, { x0: field.x - 60, y0: field.y, x1: field.x + field.w + 60, y1: field.y + field.h + 60 });
  anchors.forEach((a, i) => {
    const b = balloons[i];
    const d = Math.hypot(b.x - a.x, b.y - a.y) || 1;
    ctx.strokeStyle = PALETTE.rust;
    ctx.lineWidth = 2;
    ctx.setLineDash([7, 6]);
    ctx.beginPath();
    ctx.moveTo(a.x, a.y);
    ctx.lineTo(b.x - ((b.x - a.x) / d) * R, b.y - ((b.y - a.y) / d) * R);
    ctx.stroke();
    ctx.setLineDash([]);
    ctx.fillStyle = PALETTE.rust;
    ctx.beginPath();
    ctx.arc(a.x, a.y, 6, 0, Math.PI * 2);
    ctx.fill();
    ctx.fillStyle = PALETTE.paper;
    ctx.beginPath();
    ctx.arc(b.x, b.y, R, 0, Math.PI * 2);
    ctx.fill();
    ctx.lineWidth = 2.5;
    ctx.stroke();
    ctx.fillStyle = PALETTE.rust;
    ctx.font = `600 38px ${EN}`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(String(a.index).padStart(2, '0'), b.x, b.y + 2);
    ctx.textAlign = 'left';
    ctx.textBaseline = 'alphabetic';
  });

  // Parts list.
  const tx = W - 820;
  let ty = 760;
  ctx.fillStyle = inkA(0.55);
  ctx.font = `500 34px ${EN}`;
  ctx.letterSpacing = '6px';
  ctx.fillText('零件明细 · PARTS', tx, ty - 30);
  ctx.letterSpacing = '0px';
  const rowH = 82;
  machine.parts.forEach((part, i) => {
    const y = ty + i * rowH;
    ctx.fillStyle = inkA(0.16);
    ctx.fillRect(tx, y, 700, 1.5);
    ctx.fillStyle = PALETTE.rust;
    ctx.font = `500 38px ${EN}`;
    ctx.fillText(String(part.index).padStart(2, '0'), tx, y + 54);
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `400 38px ${ZH}`;
    ctx.fillText(part.name, tx + 80, y + 54);
    ctx.fillStyle = inkA(0.5);
    ctx.font = `italic 500 34px ${EN}`;
    ctx.textAlign = 'right';
    ctx.fillText(part.en, tx + 700, y + 54);
    ctx.textAlign = 'left';
  });
  ty += machine.parts.length * rowH;
  ctx.fillStyle = inkA(0.45);
  ctx.fillRect(tx, ty, 700, 2);

  // Title block.
  const bx = tx;
  const by = H - 330;
  ctx.strokeStyle = inkA(0.45);
  ctx.lineWidth = 2;
  ctx.strokeRect(bx, by, 700, 190);
  ctx.beginPath();
  ctx.moveTo(bx, by + 95);
  ctx.lineTo(bx + 700, by + 95);
  ctx.moveTo(bx + 350, by + 95);
  ctx.lineTo(bx + 350, by + 190);
  ctx.stroke();
  ctx.fillStyle = PALETTE.ink;
  ctx.font = `600 40px ${ZH}`;
  ctx.fillText(`格物 · ${machine.name}`, bx + 28, by + 62);
  ctx.font = `400 30px ${ZH}`;
  ctx.fillStyle = inkA(0.7);
  ctx.fillText(`图号 ${machine.drawingNo}`, bx + 28, by + 152);
  ctx.fillText(`比例 ${machine.scale}`, bx + 378, by + 152);

  // Restore the live view before the (slow) PNG encode.
  bridge.setDpr?.(restoreDpr);
  useStudio.getState().set({ labels: restoreLabels });
  download(`gewu-${machine.id}-plate.png`, out.toDataURL('image/png'));
}

/** Records assembled → exploded → assembled as a WebM on paper. */
export async function recordTeardown(onProgress: (seconds: number | null) => void) {
  const source = stageCanvas();
  if (!source || typeof MediaRecorder === 'undefined') return;
  const machine = currentMachine();
  const out = document.createElement('canvas');
  out.width = source.width;
  out.height = source.height;
  const ctx = out.getContext('2d')!;
  const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
  const mimeType = types.find((t) => MediaRecorder.isTypeSupported(t)) ?? '';
  const stream = out.captureStream(30);
  const recorder = new MediaRecorder(stream, { mimeType, videoBitsPerSecond: 8_000_000 });
  const chunks: Blob[] = [];
  recorder.ondataavailable = (e) => { if (e.data.size) chunks.push(e.data); };

  let drawing = true;
  const started = performance.now();
  const draw = () => {
    if (!drawing) return;
    paper(ctx, out.width, out.height, Math.round(28 * (out.width / source.clientWidth)));
    ctx.drawImage(source, 0, 0);
    const s = out.width / source.clientWidth;
    ctx.fillStyle = PALETTE.ink;
    ctx.font = `600 ${Math.round(22 * s)}px ${ZH}`;
    ctx.fillText(`格物 · ${machine.name}`, 32 * s, out.height - 34 * s);
    ctx.fillStyle = PALETTE.rust;
    ctx.font = `500 ${Math.round(16 * s)}px ${EN}`;
    ctx.fillText('INKWORK · FIG. 01', 32 * s, out.height - 64 * s);
    onProgress((performance.now() - started) / 1000);
    requestAnimationFrame(draw);
  };

  const studio = useStudio.getState();
  const restore = { explode: studio.explode, localExplode: studio.localExplode };
  studio.set({ explode: 0, localExplode: null });
  motion.explodeRate = 0.2;
  await frames(2);
  recorder.start();
  draw();
  await wait(1200);
  useStudio.getState().set({ explode: 1 });
  await wait(5600);
  useStudio.getState().set({ explode: 0 });
  await wait(5600);
  const stopped = new Promise((r) => { recorder.onstop = r; });
  recorder.stop();
  await stopped;
  drawing = false;
  motion.explodeRate = 0.55;
  useStudio.getState().set(restore);
  onProgress(null);
  download(`gewu-${machine.id}-teardown.webm`, URL.createObjectURL(new Blob(chunks, { type: 'video/webm' })));
}
