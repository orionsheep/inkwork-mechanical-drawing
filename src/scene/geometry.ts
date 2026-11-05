import * as THREE from 'three';
import { toCreasedNormals } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/**
 * Geometry is static and shared; parts reference these by key. Normals are
 * creased so hard edges stay sharp in the normal buffer (and therefore get
 * an ink line) while round surfaces shade smoothly.
 */
const cache = new Map<string, THREE.BufferGeometry>();

function memo(key: string, build: () => THREE.BufferGeometry): THREE.BufferGeometry {
  let geometry = cache.get(key);
  if (!geometry) {
    geometry = build();
    cache.set(key, geometry);
  }
  return geometry;
}

const crease = (geometry: THREE.BufferGeometry) => toCreasedNormals(geometry, Math.PI / 5);

export function box(x: number, y: number, z: number) {
  return memo(`box:${x}:${y}:${z}`, () => new THREE.BoxGeometry(x, y, z));
}

/** Cylinder along local Y. */
export function cyl(rTop: number, rBottom: number, h: number, segments = 40) {
  return memo(`cyl:${rTop}:${rBottom}:${h}:${segments}`, () => crease(new THREE.CylinderGeometry(rTop, rBottom, h, segments)));
}

export function sphere(r: number) {
  return memo(`sphere:${r}`, () => new THREE.SphereGeometry(r, 40, 24));
}

/**
 * Closed lathe profile of (radius, height) pairs, counter-clockwise in the
 * r/y plane so faces point out of the material (the renderer paints back
 * faces as cut section).
 */
export function lathe(key: string, profile: Array<[number, number]>, segments = 72) {
  return memo(`lathe:${key}`, () => {
    const points = profile.map(([r, y]) => new THREE.Vector2(r, y));
    points.push(points[0].clone());
    return crease(new THREE.LatheGeometry(points, segments));
  });
}

export function extrude(key: string, shape: () => THREE.Shape, depth: number) {
  return memo(`extrude:${key}`, () => crease(new THREE.ExtrudeGeometry(shape(), { depth, bevelEnabled: false, curveSegments: 36 })));
}

/** Hexagon nut, axis along Y. */
export const hexNut = () => memo('hex', () => crease(new THREE.CylinderGeometry(0.052, 0.052, 0.07, 6)));
export const stud = () => memo('stud', () => crease(new THREE.CylinderGeometry(0.024, 0.024, 0.06, 12)));

/** Outline of two circles joined by their outer tangents (crank web). */
export function webShape(r1: number, r2: number, d: number) {
  const alpha = Math.acos((r1 - r2) / d);
  const shape = new THREE.Shape();
  shape.absarc(d, 0, r2, -alpha, alpha, false);
  shape.absarc(0, 0, r1, alpha, Math.PI * 2 - alpha, false);
  shape.closePath();
  return shape;
}

/** Machine-bed I-section in the (z, y) plane. */
export function bedSection() {
  const s = new THREE.Shape();
  const pts: Array<[number, number]> = [
    [-0.7, 0], [0.7, 0], [0.7, 0.08], [0.42, 0.11], [0.42, 0.27], [0.55, 0.27], [0.55, 0.35],
    [-0.55, 0.35], [-0.55, 0.27], [-0.42, 0.27], [-0.42, 0.11], [-0.7, 0.08],
  ];
  s.moveTo(...pts[0]);
  pts.slice(1).forEach((p) => s.lineTo(...p));
  s.closePath();
  return s;
}

/**
 * Square thread: a rectangular tooth (radial r0→r1, axial width pitch/2)
 * swept along a helix of the given pitch, along local +Y from 0 to length.
 */
export function squareThread(key: string, r0: number, r1: number, pitch: number, length: number, segmentsPerTurn = 48) {
  return memo(`thread:${key}`, () => {
    const turns = (length - pitch / 2) / pitch;
    const rings = Math.max(2, Math.round(turns * segmentsPerTurn) + 1);
    const w = pitch / 2;
    const positions: number[] = [];
    // Tooth outline in the (r, y) half-plane, counter-clockwise.
    const profile: Array<[number, number]> = [[r0, 0], [r1, 0], [r1, w], [r0, w]];
    for (let i = 0; i < rings; i += 1) {
      const a = (i / segmentsPerTurn) * Math.PI * 2;
      const lift = (a / (Math.PI * 2)) * pitch;
      for (const [r, y] of profile) positions.push(r * Math.sin(a), y + lift, r * Math.cos(a));
    }
    const index: number[] = [];
    for (let i = 0; i < rings - 1; i += 1) {
      for (let k = 0; k < 4; k += 1) {
        const a = i * 4 + k;
        const b = i * 4 + ((k + 1) % 4);
        const c = a + 4;
        const d = b + 4;
        index.push(a, c, b, b, c, d);
      }
    }
    // End caps.
    const last = (rings - 1) * 4;
    index.push(0, 1, 2, 0, 2, 3, last, last + 2, last + 1, last, last + 3, last + 2);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3));
    g.setIndex(index);
    g.computeVertexNormals();
    // Make sure the outer face points away from the axis (winding depends on the sweep direction).
    const n = g.getAttribute('normal');
    const p = g.getAttribute('position');
    const probe = 1 * 4 + 1;
    const radial = new THREE.Vector3(p.getX(probe), 0, p.getZ(probe)).normalize();
    const normal = new THREE.Vector3(n.getX(probe), n.getY(probe), n.getZ(probe));
    if (normal.dot(radial) < 0) {
      const idx = g.getIndex()!;
      for (let i = 0; i < idx.count; i += 3) {
        const t = idx.getX(i + 1);
        idx.setX(i + 1, idx.getX(i + 2));
        idx.setX(i + 2, t);
      }
    }
    return crease(g.toNonIndexed());
  });
}

/** Spur gear outline (simple trapezoid teeth) with a centre bore, in the xy plane. */
export function gearShape(teeth: number, pitchR: number, addendum: number, bore: number) {
  const s = new THREE.Shape();
  const rOut = pitchR + addendum;
  const rRoot = pitchR - addendum * 1.25;
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i += 1) {
    const a = i * step;
    const pts: Array<[number, number]> = [
      [rRoot, a - step * 0.3], [rOut, a - step * 0.16], [rOut, a + step * 0.16], [rRoot, a + step * 0.3],
    ];
    pts.forEach(([r, t], k) => {
      const x = Math.cos(t) * r;
      const y = Math.sin(t) * r;
      if (i === 0 && k === 0) s.moveTo(x, y);
      else s.lineTo(x, y);
    });
  }
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, bore, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

/** Helical coil spring along local +Y from 0 to length (scale y to compress it). */
export function coil(key: string, radius: number, wire: number, length: number, turns: number) {
  return memo(`coil:${key}`, () => {
    const steps = Math.round(turns * 24);
    const points = Array.from({ length: steps + 1 }, (_, i) => {
      const t = i / steps;
      const a = t * turns * Math.PI * 2;
      return new THREE.Vector3(Math.cos(a) * radius, t * length, Math.sin(a) * radius);
    });
    return new THREE.TubeGeometry(new THREE.CatmullRomCurve3(points), steps, wire, 6, false);
  });
}

/** Shape builder for extrude(): a closed polygon with optional round holes [x, y, r]. */
export function outline(points: Array<[number, number]>, holes: Array<[number, number, number]> = []) {
  return () => {
    const s = new THREE.Shape();
    s.moveTo(...points[0]);
    points.slice(1).forEach((p) => s.lineTo(...p));
    s.closePath();
    for (const [x, y, r] of holes) {
      const h = new THREE.Path();
      h.absarc(x, y, r, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return s;
  };
}
