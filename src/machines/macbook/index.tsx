import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { box, cyl, extrude } from '../../scene/geometry';
import { M, Part } from '../../scene/Part';
import { Callout } from '../../scene/Overlay';
import { HALF_PI } from '../../scene/parts';
import { useStudio } from '../../state';
import type { MachineDef, Vec3 } from '../types';
import { Box, Cyl, level } from '../kit';
import { BOLT_SETS, CAMERA, CENTRE_LINES, GUIDES, HX, HZ, LAYER, MB, NEIGHBOURS, PARTS, S, SCREW_SEATS, STEPS } from './data';

/** 风扇叶轮相位；只在"运转"时前进。 */
export const mbMotion = { fan: 0 };

export function MacbookDriver() {
  useFrame((_, rawDt) => {
    if (!useStudio.getState().running) return;
    mbMotion.fan += Math.min(rawDt, 0.05) * 5;
  }, -1);
  return null;
}

function Spinning({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y = mbMotion.fan; });
  return <group ref={ref}>{children}</group>;
}

/** 形状在 (x, z) 平面（画图坐标），沿 +y 挤出给定厚度，底面落在 y0。 */
const FLAT: Vec3 = [-HALF_PI, 0, 0];

/** 圆角矩形（画图坐标 mm）→ Shape。 */
function rr(x0: number, x1: number, z0: number, z1: number, r: number, holes: Array<[number, number, number, number, number?]> = []) {
  return () => {
    const s = new THREE.Shape();
    const bx0 = x0, bx1 = x1, bz0 = z0, bz1 = z1, br = r;
    s.moveTo(bx0 + br, bz0);
    s.lineTo(bx1 - br, bz0);
    s.absarc(bx1 - br, bz0 + br, br, -HALF_PI, 0, false);
    s.lineTo(bx1, bz1 - br);
    s.absarc(bx1 - br, bz1 - br, br, 0, HALF_PI, false);
    s.lineTo(bx0 + br, bz1);
    s.absarc(bx0 + br, bz1 - br, br, HALF_PI, Math.PI, false);
    s.lineTo(bx0, bz0 + br);
    s.absarc(bx0 + br, bz0 + br, br, Math.PI, HALF_PI * 3, false);
    for (const [hx0, hx1, hz0, hz1, hr = 0] of holes) {
      const p = new THREE.Path();
      const p0 = hx0, p1 = hx1, q0 = hz0, q1 = hz1, pr = hr;
      if (pr <= 0) {
        p.moveTo(p0, q0); p.lineTo(p1, q0); p.lineTo(p1, q1); p.lineTo(p0, q1); p.closePath();
      } else {
        p.moveTo(p0 + pr, q0);
        p.lineTo(p1 - pr, q0); p.absarc(p1 - pr, q0 + pr, pr, -HALF_PI, 0, false);
        p.lineTo(p1, q1 - pr); p.absarc(p1 - pr, q1 - pr, pr, 0, HALF_PI, false);
        p.lineTo(p0 + pr, q1); p.absarc(p0 + pr, q1 - pr, pr, HALF_PI, Math.PI, false);
        p.lineTo(p0, q0 + pr); p.absarc(p0 + pr, q0 + pr, pr, Math.PI, HALF_PI * 3, false);
      }
      s.holes.push(p);
    }
    return s;
  };
}

/** 一块圆角板：画图坐标 x0..x1 / z0..z1，y 从 y0 起厚 t。 */
function Slab({ k, x0, x1, z0, z1, r, holes, y0, t }: {
  k: string; x0: number; x1: number; z0: number; z1: number; r: number;
  holes?: Array<[number, number, number, number, number?]>; y0: number; t: number;
}) {
  return <M clip geo={extrude(`mb-${k}`, rr(x0, x1, z0, z1, r, holes), t)} p={[0, y0, 0]} r={FLAT} />;
}

const HXW = HX, HZW = HZ;
void HXW; void HZW;

/** 底壳：圆角浅盘（底板 + 侧壁 + 内腔），剖视看到腔体与加强筋。 */
function BottomCase() {
  const wall = MB.wall;
  const t = MB.baseThick;
  return (
    <Part id="bottom-case">
      {/* 底板（整块圆角） */}
      <Slab k="base-floor" x0={-HX} x1={HX} z0={-HZ} z1={HZ} r={MB.corner} y0={0} t={t} />
      {/* 侧壁：一圈圆角方框（外圆角 - 内圆角孔） */}
      <Slab k="base-wall" x0={-HX} x1={HX} z0={-HZ} z1={HZ} r={MB.corner}
        holes={[[-HX + wall, HX - wall, -HZ + wall, HZ - wall, MB.corner - wall]]}
        y0={t} t={12 - t} />
      {/* 内部两条纵向加强筋（示意） */}
      <Box c={[0, (t + 8) / 2, -HZ * 0.5]} s={[MB.depth * 0.85, 8, 2]} />
      <Box c={[0, (t + 8) / 2, HZ * 0.5]} s={[MB.depth * 0.85, 8, 2]} />
      {/* 四个脚垫 */}
      {[[-HX * 0.82, -HZ * 0.7], [-HX * 0.82, HZ * 0.7], [HX * 0.82, -HZ * 0.7], [HX * 0.82, HZ * 0.7]].map(([x, z], i) => (
        <Cyl key={i} c={[x, -1.2, z]} r={6} len={2.4} axis="y" seg={16} />
      ))}
      <Callout id="bottom-case" p={[-HX * 0.5, 2, HZ * 0.55]} />
    </Part>
  );
}

/** 电池：六块电芯——前部一大块(横跨) + 后部左右两块，留出主板位。 */
function Battery() {
  const [y0, y1] = LAYER.battery;
  const t = y1 - y0;
  return (
    <Part id="battery">
      {/* 前部大块 */}
      <Slab k="bat-front" x0={-HX * 0.15} x1={HX - 6} z0={-HZ + 8} z1={HZ - 8} r={6} y0={y0} t={t} />
      {/* 后部左右两块（中间给主板让位） */}
      <Slab k="bat-back-l" x0={-HX + 6} x1={-HX * 0.2} z0={-HZ + 8} z1={-HZ * 0.32} r={5} y0={y0} t={t} />
      <Slab k="bat-back-r" x0={-HX + 6} x1={-HX * 0.2} z0={HZ * 0.32} z1={HZ - 8} r={5} y0={y0} t={t} />
      {/* 易拉胶拉条（薄片，示意） */}
      <Box c={[0, y1 + 0.3, HZ * 0.6]} s={[30, 0.6, 14]} />
      <Box c={[0, y1 + 0.3, -HZ * 0.6]} s={[30, 0.6, 14]} />
      <Callout id="battery" p={[HX * 0.4, y1, HZ * 0.3]} />
    </Part>
  );
}

/** 主板：靠后(−x) 的长条，中央 SoC，周边 SSD/电感。 */
function LogicBoard() {
  const [y0, y1] = LAYER.board;
  const [sy0, sy1] = LAYER.soc;
  return (
    <Part id="logic-board">
      <Slab k="pcb" x0={-HX + 10} x1={-HX * 0.2} z0={-HZ * 0.9} z1={HZ * 0.9} r={3} y0={y0} t={y1 - y0} />
      {/* SoC 封装（居中偏后） */}
      <Box c={[-HX * 0.6, (sy0 + sy1) / 2, 0]} s={[34, sy1 - sy0, 30]} />
      {/* SSD 颗粒 + 电感 + 接口座 */}
      <Box c={[-HX * 0.85, y1 + 0.6, -HZ * 0.5]} s={[16, 1.2, 12]} />
      <Box c={[-HX * 0.85, y1 + 0.6, HZ * 0.5]} s={[16, 1.2, 12]} />
      <Box c={[-HX * 0.3, y1 + 0.5, -HZ * 0.7]} s={[10, 1.0, 8]} />
      <Callout id="logic-board" p={[-HX * 0.55, sy1, 0]} />
    </Part>
  );
}

/** 一台离心风扇：外框 + 轮毂 + 叶片（随运转转）。 */
function Fan({ cx, cz }: { cx: number; cz: number }) {
  const [y0, y1] = LAYER.fan;
  const cy = (y0 + y1) / 2;
  const blades = 12;
  return (
    <group position={[cx, cy, cz]}>
      {/* 蜗壳外框 */}
      <Cyl c={[0, 0, 0]} r={26} len={(y1 - y0)} axis="y" seg={32} />
      <Spinning>
        <Cyl c={[0, 0, 0]} r={8} len={(y1 - y0) - 1} axis="y" seg={20} />
        {Array.from({ length: blades }, (_, i) => {
          const a = (i / blades) * Math.PI * 2;
          return <Cyl key={i} c={[Math.cos(a) * 15, 0, Math.sin(a) * 15]} r={2.4} len={(y1 - y0) - 2} axis="y" seg={8} />;
        })}
      </Spinning>
    </group>
  );
}

function FanLeft() {
  return (
    <Part id="fan-left">
      <Fan cx={-HX * 0.25} cz={HZ * 0.3} />
      <Callout id="fan-left" p={[-HX * 0.25, LAYER.fan[1], HZ * 0.3 + 20]} />
    </Part>
  );
}
function FanRight() {
  return (
    <Part id="fan-right">
      <Fan cx={-HX * 0.25} cz={-HZ * 0.3} />
      <Callout id="fan-right" p={[-HX * 0.25, LAYER.fan[1], -HZ * 0.3 - 20]} />
    </Part>
  );
}

/** 热管（两根横跨）+ 两侧鳍片。 */
function HeatPipe() {
  const [y0, y1] = LAYER.heat;
  const cy = (y0 + y1) / 2;
  return (
    <Part id="heat-pipe">
      <Cyl c={[-HX * 0.55, cy, HZ * 0.15]} r={3} len={HX * 0.9} axis="x" seg={12} />
      <Cyl c={[-HX * 0.55, cy, -HZ * 0.15]} r={3} len={HX * 0.9} axis="x" seg={12} />
      {/* 两侧鳍片：一排薄片 */}
      {Array.from({ length: 10 }, (_, i) => (
        <Box key={`l${i}`} c={[-HX * 0.1 + i * 1.6, cy, HZ * 0.55]} s={[0.7, y1 - y0, HZ * 0.28]} />
      ))}
      {Array.from({ length: 10 }, (_, i) => (
        <Box key={`r${i}`} c={[-HX * 0.1 + i * 1.6, cy, -HZ * 0.55]} s={[0.7, y1 - y0, HZ * 0.28]} />
      ))}
      <Callout id="heat-pipe" p={[-HX * 0.5, y1, HZ * 0.15]} />
    </Part>
  );
}

/** 扬声器：键盘两侧各一组。 */
function Speakers() {
  const [y0, y1] = LAYER.battery;
  return (
    <Part id="speakers">
      <Box c={[-HX * 0.05, (y0 + y1) / 2, HZ * 0.82]} s={[MB.depth * 0.5, y1 - y0, 12]} />
      <Box c={[-HX * 0.05, (y0 + y1) / 2, -HZ * 0.82]} s={[MB.depth * 0.5, y1 - y0, 12]} />
      <Callout id="speakers" p={[-HX * 0.05, y1, HZ * 0.82]} />
    </Part>
  );
}

/** 触控板：掌托前部（+x）一块玻璃板。 */
function Touchpad() {
  const [y0, y1] = LAYER.trackpad;
  return (
    <Part id="touchpad">
      <Slab k="trackpad" x0={HX * 0.18} x1={HX * 0.92} z0={-HZ * 0.34} z1={HZ * 0.34} r={4} y0={y0} t={y1 - y0} />
      <Callout id="touchpad" p={[HX * 0.55, y1, 0]} />
    </Part>
  );
}

/** 键盘：一块键床 + 浅浅的键帽网格（示意），顶面与 C 面平齐或略低。 */
function Keyboard() {
  const [y0, y1] = LAYER.keyboard;
  const rows = 4, cols = 13;
  const x0 = -HX * 0.58, x1 = HX * 0.44;
  const z0 = -HZ * 0.76, z1 = HZ * 0.76;
  const kw = (x1 - x0) / cols, kd = (z1 - z0) / rows;
  const caps: ReactNode[] = [];
  for (let r = 0; r < rows; r += 1) {
    for (let c = 0; c < cols; c += 1) {
      const cx = x0 + kw * (c + 0.5);
      const cz = z0 + kd * (r + 0.5);
      // 键帽很浅（0.3），间隙小（1.2），整体读作一块键盘面而不是一丛线
      caps.push(<Box key={`${r}-${c}`} c={[cx, y1 - 0.15, cz]} s={[kw - 1.2, 0.3, kd - 1.2]} />);
    }
  }
  return (
    <Part id="keyboard">
      <Slab k="kb-plate" x0={x0 - 3} x1={x1 + 3} z0={z0 - 3} z1={z1 + 3} r={3} y0={y0} t={(y1 - 0.3) - y0} />
      {caps}
      <Callout id="keyboard" p={[HX * 0.1, y1, HZ * 0.5]} />
    </Part>
  );
}

/** 上盖（C 面）：圆角板，中间开键盘孔、前部开触控板孔。 */
function TopCase() {
  const [y0, y1] = LAYER.topcase;
  const wall = MB.wall;
  return (
    <Part id="top-case">
      <Slab k="topcase" x0={-HX} x1={HX} z0={-HZ} z1={HZ} r={MB.corner}
        holes={[
          [-HX * 0.65, HX * 0.53, -HZ * 0.82, HZ * 0.82, 4], // 键盘孔
          [HX * 0.16, HX * 0.94, -HZ * 0.36, HZ * 0.36, 4],   // 触控板孔
        ]}
        y0={y0} t={y1 - y0} />
      {/* C 面边缘一圈竖壁（与底壳合拢） */}
      <Slab k="topcase-wall" x0={-HX} x1={HX} z0={-HZ} z1={HZ} r={MB.corner}
        holes={[[-HX + wall, HX - wall, -HZ + wall, HZ - wall, MB.corner - wall]]}
        y0={13.0} t={1.0} />
      <Callout id="top-case" p={[HX * 0.6, y1, -HZ * 0.7]} />
    </Part>
  );
}

/**
 * 屏幕总成：一块圆角板（屏幕），装在铰链上、向上打开约 105°。
 * 为了有「开盖笔记本」的真实观感，屏幕层在装配后被绕铰链轴（-x 后缘、沿 z）抬起。
 * 旋转放在一个以铰链为支点的 group 里：先平移到铰链，再转，再归位。
 */
const HINGE_PIVOT: Vec3 = [-HX - 3, LAYER.lid[0], 0]; // 铰链轴在屏幕底面的位置
const OPEN_ANGLE = 0; // 摊平分层拆解（合盖），工程图最清晰

function Display() {
  const [y0, y1] = LAYER.lid;
  return (
    <Part id="display">
      {/* 以铰链轴为支点打开 */}
      <group position={HINGE_PIVOT}>
        <group rotation={[0, 0, OPEN_ANGLE]}>
          <group position={[-HINGE_PIVOT[0], -HINGE_PIVOT[1], -HINGE_PIVOT[2]]}>
            <Slab k="lid" x0={-HX} x1={HX} z0={-HZ} z1={HZ} r={MB.corner} y0={y0} t={y1 - y0} />
            {/* 屏幕内侧一圈黑色边框（示意） */}
            <Slab k="lid-bezel" x0={-HX + 6} x1={HX - 6} z0={-HZ + 6} z1={HZ - 6} r={MB.corner - 4}
              y0={y0 - 0.4} t={0.4} />
            {/* 刘海：顶部居中 */}
            <Box c={[-HX + 18, y0 - 0.6, 0]} s={[16, 0.6, 54]} />
            <Callout id="display" p={[0, y1, HZ * 0.55]} />
          </group>
        </group>
      </group>
    </Part>
  );
}

/** 前置摄像头（在屏幕刘海里，随屏幕一起打开）。 */
function Camera() {
  const [y0] = LAYER.lid;
  return (
    <Part id="camera">
      <group position={HINGE_PIVOT}>
        <group rotation={[0, 0, OPEN_ANGLE]}>
          <group position={[-HINGE_PIVOT[0], -HINGE_PIVOT[1], -HINGE_PIVOT[2]]}>
            <Box c={[-HX + 18, y0 - 0.7, 0]} s={[12, 1.4, 10]} />
            <Callout id="camera" p={[-HX + 18, y0, 0]} />
          </group>
        </group>
      </group>
    </Part>
  );
}

/** 铰链：后缘(−x) 两段圆柱。 */
function Hinge() {
  return (
    <Part id="hinge">
      <Cyl c={[-HX - 3, 8, HZ * 0.4]} r={5} len={40} axis="z" seg={16} />
      <Cyl c={[-HX - 3, 8, -HZ * 0.4]} r={5} len={40} axis="z" seg={16} />
      <Callout id="hinge" p={[-HX - 8, 8, HZ * 0.4]} />
    </Part>
  );
}

/** 前置摄像头（在屏幕刘海里）。 */
function CameraOld() {
  const [y0] = LAYER.lid;
  return (
    <Part id="camera">
      <Box c={[-HX + 20, y0 + 0.5, 0]} s={[12, 1.6, 10]} />
      <Callout id="camera" p={[-HX + 20, LAYER.lid[1], 0]} />
    </Part>
  );
}
void CameraOld;

/** 接口：左右侧壁各一排。 */
function Ports() {
  const cy = 5;
  return (
    <Part id="ports">
      <Box c={[0, cy, -HZ - 1]} s={[60, 5, 3]} />
      <Box c={[-HX * 0.2, cy, HZ + 1]} s={[80, 5, 3]} />
      <Callout id="ports" p={[0, cy, -HZ - 4]} />
    </Part>
  );
}

/** 无线模块 + 天线（贴侧壁）。 */
function Wifi() {
  return (
    <Part id="wifi">
      <Box c={[-HX * 0.7, LAYER.board[1] + 0.8, HZ * 0.6]} s={[20, 2, 14]} />
      <Callout id="wifi" p={[-HX * 0.7, LAYER.board[1] + 2, HZ * 0.6]} />
    </Part>
  );
}

/** 底壳螺钉（一圈 P5），沿各自轴线飞出。 */
function Screws() {
  return (
    <Part id="screws">
      {SCREW_SEATS.map(([x, z], i) => (
        <Cyl key={i} c={[x, -0.5, z]} r={2.6} len={4} axis="y" seg={6} />
      ))}
      <Callout id="screws" p={[SCREW_SEATS[0][0], -1, SCREW_SEATS[0][1]]} />
    </Part>
  );
}

/** 机身太薄（厚 15.5 对 313 长），真实比例下分层看不出来；把厚度方向放大 TY 倍，剖面才读得出层次。 */
const TY = 3.4;

export function Macbook() {
  return (
    <group scale={[1, TY, 1]}>
      <BottomCase />
      <Battery />
      <LogicBoard />
      <HeatPipe />
      <FanLeft />
      <FanRight />
      <Speakers />
      <Touchpad />
      <Keyboard />
      <TopCase />
      <Display />
      <Hinge />
      <Camera />
      <Ports />
      <Wifi />
      <Screws />
    </group>
  );
}

export const macbook: MachineDef = level({
  id: 'macbook',
  unit: S,
  bounds: [[-HX, 0, -HZ], [HX, (MB.thick + 6) * TY, HZ]],
  name: 'MacBook Pro 14 英寸',
  en: 'MacBook Pro 14"',
  subtitle: '装配体 · 分层拆解 · 全剖',
  summary: '16 种零件 · 电池主板风扇键盘屏幕逐层拆解，风扇会转',
  drawingNo: 'GW-MBP-00',
  scale: '1 : 2',
  parts: PARTS,
  boltSets: BOLT_SETS,
  neighbours: NEIGHBOURS,
  guides: GUIDES,
  centreLines: CENTRE_LINES,
  steps: STEPS,
  camera: CAMERA,
  Model: Macbook,
  Driver: MacbookDriver,
});
