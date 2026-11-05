import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { M, Part } from '../../scene/Part';
import { Callout } from '../../scene/Overlay';
import { useStudio } from '../../state';
import type { MachineDef } from '../types';
import { Box, Cyl, Turn, level } from '../kit';
import { BOLT_SETS, CAMERA, CENTRE_LINES, CP, GUIDES, NEIGHBOURS, PARTS, STEPS } from './data';

/** 转角（弧度）；只有在"运转"时前进。所有转动件共用这一个相位。 */
export const cpMotion = { angle: 0 };

/** 纯函数：第 i 根柱销（共 pins 根）在转角 angle 时的位置 [x, y, z]。用于联动与单元测试。 */
export function pinPosition(i: number, angle: number, n = CP.pins, r = CP.boltR): [number, number, number] {
  const a = (i / n) * Math.PI * 2 + angle;
  return [0, Math.sin(a) * r, Math.cos(a) * r];
}

/** 纯函数：一圈柱销相对初始转过的角度归一化到 [0, 2π)。 */
export const normAngle = (a: number) => ((a % (Math.PI * 2)) + Math.PI * 2) % (Math.PI * 2);

export function CouplingDriver() {
  useFrame((_, rawDt) => {
    if (!useStudio.getState().running) return;
    cpMotion.angle += Math.min(rawDt, 0.05) * 1.1;
  }, -1);
  return null;
}

/** 绕 x 轴（轴线在 y=z=0）转动的组。转轴就在原点，直接转即可。 */
function Spin({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.x = cpMotion.angle; });
  return <group ref={ref}>{children}</group>;
}

const { discR, boreR, discT, gap, pins, boltR, pinR, pinLen, sleeveR, shaftLen } = CP;
const HUB = 8; // 轮毂伸出法兰端面的长度
const xA = -(discT + gap / 2); // 左半联轴器左端面（法兰盘）
const xB = discT + gap / 2; // 右半联轴器右端面（法兰盘）

/** 半联轴器车削轮廓：轮毂（外径 24）+ 法兰盘（外径 discR）+ 轴孔（boreR）。 */
function halfProfile(x0: number, x1: number): Array<[number, number]> {
  return [
    [boreR, x0 - HUB], [24, x0 - HUB], [24, x0], [discR, x0], [discR, x1], [24, x1], [24, x1 + HUB], [boreR, x1 + HUB],
  ];
}

/** 一个半联轴器：车削成一体的轮毂+法兰，带 6 个柱销孔。 */
function HalfCoupling({ id, x0, x1 }: { id: string; x0: number; x1: number }) {
  return (
    <>
      <Turn k={`cp-${id}`} profile={halfProfile(x0, x1)} axis="x" />
      {Array.from({ length: pins }, (_, i) => {
        const a = (i / pins) * Math.PI * 2;
        return (
          <Cyl key={i} c={[(x0 + x1) / 2, Math.sin(a) * boltR, Math.cos(a) * boltR]} r={pinR + 1.5} len={x1 - x0 + 0.2} axis="x" seg={16} />
        );
      })}
    </>
  );
}

/** 轴：从轮毂外侧向里伸进轴孔，长 shaftLen。 */
const shaftCx = (side: -1 | 1) => {
  const end = side < 0 ? xA - HUB : xB + HUB; // 轮毂外侧端面
  return end + side * shaftLen / 2;
};

export function Coupling() {
  return (
    <group>
      <Part id="shaft-a">
        <Cyl c={[shaftCx(-1), 0, 0]} r={boreR - 0.3} len={shaftLen} axis="x" seg={36} />
        <Callout id="shaft-a" p={[shaftCx(-1) - shaftLen * 0.3, boreR * 0.6, 0]} />
      </Part>
      <Part id="shaft-b">
        <Cyl c={[shaftCx(1), 0, 0]} r={boreR - 0.3} len={shaftLen} axis="x" seg={36} />
        <Callout id="shaft-b" p={[shaftCx(1) + shaftLen * 0.3, boreR * 0.6, 0]} />
      </Part>

      <Part id="key">
        <Box c={[shaftCx(-1), boreR - 0.3 + 2, 0]} s={[12, 4, 4]} />
        <Box c={[shaftCx(1), boreR - 0.3 + 2, 0]} s={[12, 4, 4]} />
        <Callout id="key" p={[0, -discR * 0.6, 0]} />
      </Part>

      <Part id="half-a">
        <Spin><HalfCoupling id="half-a" x0={xA} x1={xA + discT} /></Spin>
        <Callout id="half-a" p={[xA + 2, discR * 0.62, 0]} />
      </Part>
      <Part id="half-b">
        <Spin><HalfCoupling id="half-b" x0={xB - discT} x1={xB} /></Spin>
        <Callout id="half-b" p={[xB - 2, discR * 0.62, 0]} />
      </Part>

      <Part id="pins">
        <Spin>
          {Array.from({ length: pins }, (_, i) => {
            const a = (i / pins) * Math.PI * 2;
            return <Cyl key={i} c={[0, Math.sin(a) * boltR, Math.cos(a) * boltR]} r={pinR} len={pinLen} axis="x" seg={16} />;
          })}
        </Spin>
        <Callout id="pins" p={[0, boltR + 8, 0]} />
      </Part>

      <Part id="sleeves">
        <Spin>
          {Array.from({ length: pins }, (_, i) => {
            const a = (i / pins) * Math.PI * 2;
            return <Cyl key={i} c={[0, Math.sin(a) * boltR, Math.cos(a) * boltR]} r={sleeveR} len={gap + 12} axis="x" seg={20} />;
          })}
        </Spin>
        <Callout id="sleeves" p={[0, 0, sleeveR + 8]} />
      </Part>
    </group>
  );
}

export const coupling: MachineDef = level({
  id: 'coupling',
  unit: 0.02,
  bounds: [[xA - HUB - shaftLen, -discR, -discR], [xB + HUB + shaftLen, discR, discR]],
  name: '弹性柱销联轴器',
  en: 'Pin Coupling',
  subtitle: '装配体 · 全剖视 · 传动',
  summary: '7 种零件 · 柱销传转矩，橡胶套缓冲，会转',
  drawingNo: 'GW-CP-00',
  scale: '1 : 2',
  parts: PARTS,
  boltSets: BOLT_SETS,
  neighbours: NEIGHBOURS,
  guides: GUIDES,
  centreLines: CENTRE_LINES,
  steps: STEPS,
  camera: CAMERA,
  Model: Coupling,
  Driver: CouplingDriver,
});
