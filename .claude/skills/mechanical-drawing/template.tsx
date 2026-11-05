// Skeleton for src/machines/<id>/index.tsx — copy, rename, fill in.
// Then register it in src/machines/index.ts (GROUPS, and ALL for sub-levels).
import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import type * as THREE from 'three';
import { Part } from '../../scene/Part';
import { Callout } from '../../scene/Overlay';
import { useStudio } from '../../state';
import type { MachineDef, PartDef, StepDef } from '../types';
import { Box, Cyl, level, Turn } from '../kit';

/**
 * <What it is, what the animation shows, where the dimensions come from.>
 * +x forward, y up, ground at y = 0, symmetric about z = 0; metres.
 */

export const thingMotion = { t: 0 };

export function ThingDriver() {
  useFrame((_, dt) => { if (useStudio.getState().running) thingMotion.t += Math.min(dt, 0.05); }, -1);
  return null;
}

/** Turns its children about the y axis through the origin (place it first, then spin). */
function Spinning({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y = thingMotion.t * 1.5; });
  return <group ref={ref}>{children}</group>;
}

export function Thing() {
  return (
    <group>
      <Part id="base">
        <Box c={[0, 0.05, 0]} s={[0.6, 0.1, 0.4]} />
        <Callout id="base" p={[0.25, 0.1, 0.2]} />
      </Part>
      <Part id="wheel">
        <group position={[0, 0.3, 0]}>
          <Spinning>
            <Turn k="th-wheel" profile={[[0.02, -0.02], [0.18, -0.02], [0.18, 0.02], [0.02, 0.02]]} />
            <Cyl c={[0, 0, 0]} r={0.02} len={0.3} />
          </Spinning>
        </group>
        <Callout id="wheel" p={[0.18, 0.32, 0.05]} />
      </Part>
      <Part id="cover">
        <Box c={[0, 0.5, 0]} s={[0.5, 0.02, 0.4]} />
        <Callout id="cover" p={[0.2, 0.51, 0.15]} />
      </Part>
    </group>
  );
}

const PARTS: PartDef[] = [
  { id: 'base', index: 1, name: '底座', en: 'Base', role: '支承', material: '铸铁', description: '……', explode: [0, 0, 0], stage: [1, 1] },
  { id: 'wheel', index: 2, name: '飞轮', en: 'Wheel', role: '储能', material: '钢', description: '……', explode: [0, 0.5, 0], stage: [0.4, 0.8] },
  { id: 'cover', index: 3, name: '盖板', en: 'Cover', role: '防护', material: '钢板', description: '……', explode: [0, 0.6, 0], stage: [0, 0.4] },
];

const STEPS: StepDef[] = [
  {
    title: '整机', en: 'Assembly',
    body: '……一句话讲清原理，再说看哪里。',
    state: { explode: 0, section: false, running: true, select: 'wheel', focus: null },
  },
  {
    title: '拆开', en: 'Teardown',
    body: '先……再……最后……',
    state: { explode: 1, section: false, running: false, select: null, focus: null },
  },
];

export const thing: MachineDef = level({
  id: 'thing',
  unit: 20,
  bounds: [[-0.3, 0, -0.2], [0.3, 0.52, 0.2]],
  name: '示例机器',
  en: 'Example',
  subtitle: '装配体 · ……',
  summary: '3 种零件 · ……，会动',
  drawingNo: 'GW-XX-00',
  scale: '1 : 5',
  parts: PARTS,
  boltSets: {},
  neighbours: {},
  guides: [{ stage: 'wheel', origin: [0, 0.3, 0] }],
  centreLines: [[[0, 0, 0], [0, 0.6, 0], 0.18]],
  steps: STEPS,
  camera: { target: [0, 0.25, 0], offset: [0.8, 0.6, 1.4], orthoDistance: 6, exploded: { target: [0, 0.55, 0], scale: 2.1 } },
  Model: Thing,
  Driver: ThingDriver,
});
