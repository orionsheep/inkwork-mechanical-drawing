import * as THREE from 'three';
import type { Vec3 } from '../machines/types';

/**
 * Three-view layout, first-angle projection (GB/T 14692): the top view sits
 * below the front view and the left view to its right, all at one scale so
 * the projection rules hold on screen: 长对正 (front ↔ top share x),
 * 高平齐 (front ↔ left share y), 宽相等 (top ↔ left share depth, via 45°).
 */

export type DrawingViewId = 'front' | 'top' | 'left' | 'iso';

export interface Rect { x: number; y: number; w: number; h: number }

export interface DrawingView {
  id: DrawingViewId;
  label: string;
  /** CSS pixels, top-left origin, relative to the stage. */
  rect: Rect;
  camera: THREE.OrthographicCamera;
  /** The section applies to the front view only (全剖主视图). */
  section: boolean;
  /** Hidden (dashed) lines: orthographic views only. */
  hidden: boolean;
}

export interface DrawingLayout {
  views: DrawingView[];
  /** Pixels per scene unit, shared by the three orthographic views. */
  scale: number;
  centre: THREE.Vector3;
  /** Screen position of the bounding-box centre in each orthographic view. */
  anchors: { front: THREE.Vector2; top: THREE.Vector2; left: THREE.Vector2 };
  bounds: { min: THREE.Vector3; max: THREE.Vector3 };
  /** Area left for the title block (bottom-right). */
  titleBlock: Rect;
}

/** Live layout, read by the renderer and the picker each frame. */
export const drawing: { layout: DrawingLayout | null } = { layout: null };

const FAR = 60;

function ortho(rect: Rect, scale: number) {
  const w = rect.w / scale / 2;
  const h = rect.h / scale / 2;
  return new THREE.OrthographicCamera(-w, w, h, -h, 0.5, FAR * 2.5);
}

export function computeLayout(
  width: number,
  height: number,
  boundsDef: [Vec3, Vec3],
  insets: { left: number; right: number; top: number; bottom: number },
): DrawingLayout {
  const min = new THREE.Vector3(...boundsDef[0]);
  const max = new THREE.Vector3(...boundsDef[1]);
  const size = max.clone().sub(min);
  const centre = min.clone().add(max).multiplyScalar(0.5);

  const areaW = Math.max(200, width - insets.left - insets.right);
  const areaH = Math.max(200, height - insets.top - insets.bottom);
  const gap = Math.max(36, Math.min(72, areaW * 0.05));
  const pad = 18;
  const scale = Math.min((areaW - gap - pad * 4) / (size.x + size.z), (areaH - gap - pad * 4) / (size.y + size.z));

  // Centre the whole arrangement in the free area.
  const used = { w: (size.x + size.z) * scale + gap + pad * 4, h: (size.y + size.z) * scale + gap + pad * 4 };
  const x0 = insets.left + (areaW - used.w) / 2;
  const y0 = insets.top + (areaH - used.h) / 2;

  const front: Rect = { x: x0, y: y0, w: size.x * scale + pad * 2, h: size.y * scale + pad * 2 };
  const left: Rect = { x: front.x + front.w + gap, y: front.y, w: size.z * scale + pad * 2, h: front.h };
  const top: Rect = { x: front.x, y: front.y + front.h + gap, w: front.w, h: size.z * scale + pad * 2 };
  const iso: Rect = { x: left.x, y: top.y, w: Math.max(left.w, width - insets.right - left.x), h: Math.max(top.h, height - insets.bottom - top.y) };
  const titleBlock: Rect = { x: width - insets.right - 300, y: height - insets.bottom - 64, w: 300, h: 64 };
  // Keep the axonometric clear of the title block.
  iso.h = Math.max(80, Math.min(iso.h, titleBlock.y - iso.y - 8));

  const cFront = ortho(front, scale);
  cFront.position.set(centre.x, centre.y, max.z + FAR);
  cFront.up.set(0, 1, 0);
  cFront.lookAt(centre.x, centre.y, centre.z);

  const cTop = ortho(top, scale);
  cTop.position.set(centre.x, max.y + FAR, centre.z);
  // Screen-up is -z, so the front of the object faces down, away from the front view.
  cTop.up.set(0, 0, -1);
  cTop.lookAt(centre.x, centre.y, centre.z);

  const cLeft = ortho(left, scale);
  cLeft.position.set(min.x - FAR, centre.y, centre.z);
  cLeft.up.set(0, 1, 0);
  cLeft.lookAt(centre.x, centre.y, centre.z);

  // Isometric (正等轴测): fitted to its own cell.
  const isoDir = new THREE.Vector3(1, 1, 1).normalize();
  const cIso = new THREE.OrthographicCamera(-1, 1, 1, -1, 0.5, FAR * 2.5);
  cIso.position.copy(centre).addScaledVector(isoDir, FAR);
  cIso.up.set(0, 1, 0);
  cIso.lookAt(centre);
  cIso.updateMatrixWorld();
  const view = cIso.matrixWorldInverse;
  const box = new THREE.Box3();
  for (let i = 0; i < 8; i += 1) {
    box.expandByPoint(new THREE.Vector3(i & 1 ? max.x : min.x, i & 2 ? max.y : min.y, i & 4 ? max.z : min.z).applyMatrix4(view));
  }
  const isoScale = Math.min((iso.w - pad * 2) / (box.max.x - box.min.x), (iso.h - pad * 2) / (box.max.y - box.min.y));
  const cx = (box.min.x + box.max.x) / 2;
  const cy = (box.min.y + box.max.y) / 2;
  cIso.left = cx - iso.w / isoScale / 2;
  cIso.right = cx + iso.w / isoScale / 2;
  cIso.top = cy + iso.h / isoScale / 2;
  cIso.bottom = cy - iso.h / isoScale / 2;

  for (const c of [cFront, cTop, cLeft, cIso]) {
    c.updateProjectionMatrix();
    c.updateMatrixWorld();
  }

  const mid = (r: Rect) => new THREE.Vector2(r.x + r.w / 2, r.y + r.h / 2);
  return {
    views: [
      { id: 'front', label: '主视图', rect: front, camera: cFront, section: true, hidden: true },
      { id: 'top', label: '俯视图', rect: top, camera: cTop, section: false, hidden: true },
      { id: 'left', label: '左视图', rect: left, camera: cLeft, section: false, hidden: true },
      { id: 'iso', label: '正等轴测图', rect: iso, camera: cIso, section: false, hidden: false },
    ],
    scale,
    centre,
    anchors: { front: mid(front), top: mid(top), left: mid(left) },
    bounds: { min, max },
    titleBlock,
  };
}

/** Screen position of a world point in one orthographic view. */
export function project(layout: DrawingLayout, view: 'front' | 'top' | 'left', p: THREE.Vector3) {
  const { scale: s, centre: c, anchors } = layout;
  if (view === 'front') return new THREE.Vector2(anchors.front.x + (p.x - c.x) * s, anchors.front.y - (p.y - c.y) * s);
  if (view === 'top') return new THREE.Vector2(anchors.top.x + (p.x - c.x) * s, anchors.top.y + (p.z - c.z) * s);
  return new THREE.Vector2(anchors.left.x + (p.z - c.z) * s, anchors.left.y - (p.y - c.y) * s);
}
