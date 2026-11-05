import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { box, cyl, extrude, lathe } from '../scene/geometry';
import { M, usePartDepth } from '../scene/Part';
import { HALF_PI } from '../scene/parts';
import { boltSetDef, stageProgress } from '../scene/explode';
import type { MachineDef, Vec3 } from './types';

/**
 * Shared modelling kit for the Model T and its subassemblies. Everything is
 * drawn in inches, as on Ford's drawings; each level shows itself at its own
 * scale (MachineDef.unit), and a subassembly drawn inside its parent uses
 * the same inches, so the parent only has to place it.
 */

export type Dir = 'x' | '-x' | 'y' | '-y' | 'z' | '-z';
/** Rotations that turn local +Y onto each direction. */
export const TO: Record<Dir, Vec3> = {
  y: [0, 0, 0],
  '-y': [Math.PI, 0, 0],
  x: [0, 0, -HALF_PI],
  '-x': [0, 0, HALF_PI],
  z: [HALF_PI, 0, 0],
  '-z': [-HALF_PI, 0, 0],
};
/** Shape in the (y, z) plane extruded along +x: shape x → world y, shape y → world z. */
export const YZ_X: Vec3 = [0, HALF_PI, HALF_PI];
/** Shape in the (x, y) plane extruded along +z (three's default). */
export const XY_Z: Vec3 = [0, 0, 0];
/** Shape in the (x, −z) plane extruded along +y. */
export const XZ_Y: Vec3 = [-HALF_PI, 0, 0];

/** Box by centre and size. */
export function Box({ c, s, r }: { c: Vec3; s: Vec3; r?: Vec3 }) {
  return <M clip geo={box(s[0], s[1], s[2])} p={c} r={r} />;
}

/** Box between two opposite corners. */
export function Span({ a, b }: { a: Vec3; b: Vec3 }) {
  return (
    <M
      clip
      geo={box(Math.abs(b[0] - a[0]), Math.abs(b[1] - a[1]), Math.abs(b[2] - a[2]))}
      p={[(a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2]}
    />
  );
}

/** Cylinder centred at c, along an axis. */
export function Cyl({ c, r, r2, len, axis = 'y', seg = 32 }: { c: Vec3; r: number; r2?: number; len: number; axis?: Dir; seg?: number }) {
  return <M clip geo={cyl(r, r2 ?? r, len, seg)} p={c} r={TO[axis]} />;
}

const up = new THREE.Vector3(0, 1, 0);

/** Round bar between two points (r at a, r2 at b). */
export function Rod({ a, b, r, r2, seg = 16 }: { a: Vec3; b: Vec3; r: number; r2?: number; seg?: number }) {
  const va = new THREE.Vector3(...a);
  const d = new THREE.Vector3(...b).sub(va);
  const len = d.length();
  const q = new THREE.Quaternion().setFromUnitVectors(up, d.clone().normalize());
  const e = new THREE.Euler().setFromQuaternion(q);
  const mid = va.addScaledVector(d, 0.5);
  return <M clip geo={cyl(r2 ?? r, r, len, seg)} p={[mid.x, mid.y, mid.z]} r={[e.x, e.y, e.z]} />;
}

/** A lathe profile wound counter-clockwise in (r, h), so its faces point out of the material. */
export function ccw(profile: Array<[number, number]>) {
  let area = 0;
  profile.forEach(([r, h], i) => {
    const [r2, h2] = profile[(i + 1) % profile.length];
    area += r * h2 - r2 * h;
  });
  return area >= 0 ? profile : [...profile].reverse();
}

/** Lathe profile (radius, height) turned about an axis through p. */
export function Turn({ k, profile, p = [0, 0, 0], axis = 'y', seg = 48 }: { k: string; profile: Array<[number, number]>; p?: Vec3; axis?: Dir; seg?: number }) {
  return <M clip geo={lathe(`mt-${k}`, ccw(profile), seg)} p={p} r={TO[axis]} />;
}

/** Profiles for thin-walled turned parts (radius, height along the axis). */
export const tube = (r: number, h0: number, h1: number, t = 0.06): Array<[number, number]> => [[r - t, h0], [r, h0], [r, h1], [r - t, h1]];
export const cone = (r0: number, r1: number, h0: number, h1: number, t = 0.06): Array<[number, number]> => [[r0 - t, h0], [r0, h0], [r1, h1], [r1 - t, h1]];
/** Ellipsoidal dome of radius r on the plane h, bulging `depth` toward +h (or −h when depth < 0). */
export function dome(r: number, h: number, depth: number, t = 0.06, n = 14): Array<[number, number]> {
  const outer = Array.from({ length: n + 1 }, (_, i): [number, number] => {
    const a = (i / n) * (Math.PI / 2);
    return [r * Math.cos(a), h + depth * Math.sin(a)];
  });
  const inner = outer.map(([rr, hh]): [number, number] => [Math.max(0, rr - t), h + (hh - h) * (1 - t / Math.abs(depth))]).reverse();
  return [...outer, ...inner];
}

/** Flat shape extruded: see YZ_X / XY_Z / XZ_Y for the plane. */
export function Plate({ k, shape, depth, p = [0, 0, 0], r = XY_Z }: { k: string; shape: () => THREE.Shape; depth: number; p?: Vec3; r?: Vec3 }) {
  return <M clip geo={extrude(`mt-${k}`, shape, depth)} p={p} r={r} />;
}

const tubes = new Map<string, THREE.BufferGeometry>();

/** Round pipe along a smooth path. */
export function Pipe({ k, pts, r, seg = 10 }: { k: string; pts: Vec3[]; r: number; seg?: number }) {
  let g = tubes.get(k);
  if (!g) {
    const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)), false, 'centripetal');
    g = new THREE.TubeGeometry(curve, pts.length * 12, r, seg, false);
    tubes.set(k, g);
  }
  return <M clip geo={g} />;
}

/** Torus in the plane normal to an axis. */
export function Hoop({ k, c, R, r, axis = 'y', seg = 64 }: { k: string; c: Vec3; R: number; r: number; axis?: Dir; seg?: number }) {
  let g = tubes.get(`hoop:${k}`);
  if (!g) {
    g = new THREE.TorusGeometry(R, r, 10, seg).rotateX(HALF_PI);
    tubes.set(`hoop:${k}`, g);
  }
  return <M clip geo={g} p={c} r={TO[axis]} />;
}

/** Shape helpers (plane coordinates). */
export function poly(points: Array<[number, number]>, holes: Array<[number, number, number]> = []) {
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

export function roundRect(x0: number, y0: number, x1: number, y1: number, r: number, holes: Array<[number, number, number]> = []) {
  return () => {
    const s = new THREE.Shape();
    s.moveTo(x0 + r, y0);
    s.lineTo(x1 - r, y0);
    s.absarc(x1 - r, y0 + r, r, -HALF_PI, 0, false);
    s.lineTo(x1, y1 - r);
    s.absarc(x1 - r, y1 - r, r, 0, HALF_PI, false);
    s.lineTo(x0 + r, y1);
    s.absarc(x0 + r, y1 - r, r, HALF_PI, Math.PI, false);
    s.lineTo(x0, y0 + r);
    s.absarc(x0 + r, y0 + r, r, Math.PI, Math.PI * 1.5, false);
    for (const [x, y, rr] of holes) {
      const h = new THREE.Path();
      h.absarc(x, y, rr, 0, Math.PI * 2, true);
      s.holes.push(h);
    }
    return s;
  };
}

/** Closed circle of points for a lathe profile (a solid ring of round section). */
export function circleProfile(cr: number, cy: number, rad: number, n = 20): Array<[number, number]> {
  return Array.from({ length: n }, (_, i) => {
    const a = -Math.PI / 2 + (i / n) * Math.PI * 2;
    return [cr + rad * Math.cos(a), cy + rad * Math.sin(a)];
  });
}

/**
 * Hex-head bolt with its head at p, shank running back against dir. In its
 * set's window of the teardown it backs out along dir, then rides with its
 * owner. Drawn inside a parent assembly it stays put.
 */
export function Fastener({ p, dir = 'y', set, d = 0.375, len = 1.2 }: { p: Vec3; dir?: Dir; set?: string; d?: number; len?: number }) {
  const out = useRef<THREE.Group>(null);
  const nested = usePartDepth() > 1;
  useFrame(() => {
    const def = set && !nested ? boltSetDef(set) : null;
    if (def && out.current) out.current.position.y = def.distance * stageProgress(set!);
  });
  const h = d * 0.65;
  return (
    <group position={p} rotation={TO[dir]}>
      <group ref={out}>
        <M clip geo={cyl(d * 0.85, d * 0.85, h, 6)} p={[0, h / 2, 0]} />
        <M clip geo={cyl(d / 2, d / 2, len, 10)} p={[0, -len / 2, 0]} />
      </group>
    </group>
  );
}

/**
 * A level written in inches: scale its framing, guides and bounds into scene
 * units. Explode travel stays in inches (it is applied inside the scaled model).
 */
export function level(def: MachineDef): MachineDef {
  const u = def.unit ?? 1;
  const s = (p: Vec3): Vec3 => [p[0] * u, p[1] * u, p[2] * u];
  const c = def.camera;
  return {
    ...def,
    bounds: [s(def.bounds[0]), s(def.bounds[1])],
    guides: def.guides.map((g) => ({ ...g, origin: s(g.origin) })),
    centreLines: def.centreLines.map(([a, b, r]) => (r === undefined ? [s(a), s(b)] : [s(a), s(b), r * u])),
    camera: {
      target: s(c.target),
      offset: s(c.offset),
      orthoDistance: c.orthoDistance * u,
      exploded: c.exploded && { target: s(c.exploded.target), scale: c.exploded.scale },
      deep: c.deep && { target: s(c.deep.target), scale: c.deep.scale },
      foci: c.foci && Object.fromEntries(Object.entries(c.foci).map(([k, f]) => [k, { target: s(f.target), scale: f.scale }])),
    },
  };
}

/** Rounded rectangle with a rounded-rectangle hole, wall t (plane coordinates). */
export function roundFrame(x0: number, y0: number, x1: number, y1: number, r: number, t: number) {
  return () => {
    const s = roundRect(x0, y0, x1, y1, r)();
    const inner = roundRect(x0 + t, y0 + t, x1 - t, y1 - t, Math.max(0.01, r - t))();
    const hole = new THREE.Path(inner.getPoints(8));
    s.holes.push(hole);
    return s;
  };
}

const arcs = new Map<string, THREE.BufferGeometry>();

/** Part of a lathe: the profile turned from phi0 through phiLen about an axis through p. */
export function ArcTurn({ k, profile, p = [0, 0, 0], axis = 'y', phi0, phiLen, seg = 40 }: { k: string; profile: Array<[number, number]>; p?: Vec3; axis?: Dir; phi0: number; phiLen: number; seg?: number }) {
  let g = arcs.get(k);
  if (!g) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
    pts.push(pts[0].clone());
    g = new THREE.LatheGeometry(pts, seg, phi0, phiLen);
    arcs.set(k, g);
  }
  return <M clip geo={g} p={p} r={TO[axis]} />;
}
