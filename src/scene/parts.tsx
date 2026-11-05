import { useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import type { Vec3 } from '../machines/types';
import { boltSetDef, stageProgress } from './explode';
import { hexNut, stud } from './geometry';
import { M } from './Part';

/** Rotations that turn a local +Y axis (cylinders, lathes) onto the world axes. */
export const HALF_PI = Math.PI / 2;
export const ALONG_X: Vec3 = [0, 0, -HALF_PI];
export const ALONG_NEG_X: Vec3 = [0, 0, HALF_PI];
export const ALONG_Z: Vec3 = [HALF_PI, 0, 0];

/** Stretch a unit-length bar (along local x) between two points in a z plane. */
export function placeBar(mesh: THREE.Object3D | null, ax: number, ay: number, bx: number, by: number, z: number) {
  if (!mesh) return;
  mesh.position.set((ax + bx) / 2, (ay + by) / 2, z);
  mesh.rotation.set(0, 0, Math.atan2(by - ay, bx - ax));
  mesh.scale.set(Math.hypot(bx - ax, by - ay), 1, 1);
}

export function boltCircle(count: number, radius: number, offset = Math.PI / count) {
  return Array.from({ length: count }, (_, i) => {
    const a = offset + (i * Math.PI * 2) / count;
    return [Math.cos(a) * radius, Math.sin(a) * radius] as const;
  });
}

/**
 * Hex nut on a stud, pointing along its local +y. Bolts in a removable set
 * back out along that axis during the staged explode.
 */
export function Bolt({ p, axis = 'y', flip = false, clip = false, set }: { p: Vec3; axis?: 'x' | 'y' | 'z'; flip?: boolean; clip?: boolean; set?: string }) {
  const rotation: Vec3 = axis === 'x' ? (flip ? ALONG_NEG_X : ALONG_X) : axis === 'z' ? (flip ? [-HALF_PI, 0, 0] : ALONG_Z) : flip ? [Math.PI, 0, 0] : [0, 0, 0];
  const out = useRef<THREE.Group>(null);
  useFrame(() => {
    const def = set ? boltSetDef(set) : null;
    if (def && out.current) out.current.position.y = def.distance * stageProgress(set!);
  });
  return (
    <group position={p} rotation={rotation}>
      <group ref={out}>
        <M geo={hexNut()} p={[0, 0.035, 0]} clip={clip} />
        <M geo={stud()} p={[0, 0.095, 0]} clip={clip} />
      </group>
    </group>
  );
}
