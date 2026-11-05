import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { M, Part } from '../../scene/Part';
import { Callout } from '../../scene/Overlay';
import { useStudio } from '../../state';
import type { MachineDef, Vec3 } from '../types';
import { Box, Cyl, Hoop, Plate, Rod, level } from '../kit';
import { AXLE, CAMERA, CENTRE_LINES, GUIDES, HL, HW, MB, NEIGHBOURS, PARTS, S, STEPS } from './data';

/** 车轮转角；只在「运转」时前进。四个轮共用同一个相位。 */
export const m3Motion = { spin: 0 };

export function Model3Driver() {
  useFrame((_, rawDt) => {
    if (!useStudio.getState().running) return;
    m3Motion.spin -= Math.min(rawDt, 0.05) * 2.6;
  }, -1);
  return null;
}

/** 绕 z 轴旋转（车轮）。 */
function Spinning({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.z = m3Motion.spin; });
  return <group ref={ref}>{children}</group>;
}

/* ────────────────────────── 车身轮廓 ────────────────────────── */

/** 圆弧采样点（度）。 */
function arc(cx: number, cy: number, r: number, a0: number, a1: number, n = 16): Array<[number, number]> {
  return Array.from({ length: n + 1 }, (_, i) => {
    const a = ((a0 + ((a1 - a0) * i) / n) * Math.PI) / 180;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)] as [number, number];
  });
}

/** 轮拱切口的两个端点（半径 395，中心在轮心）。 */
const ARCH_R = 420;
const archY = MB.rockerY; // 245
const archHalf = Math.sqrt(ARCH_R ** 2 - (MB.wheelR - archY) ** 2); // 385
const archStart = (Math.atan2(archY - MB.wheelR, -archHalf) * 180) / Math.PI; // ≈193°
const archEnd = (Math.atan2(archY - MB.wheelR, archHalf) * 180) / Math.PI; // ≈-13°

/** 侧围外轮廓（x 前、y 上）。 */
function outerProfile(): Array<[number, number]> {
  return [
    [HL, 320],
    [HL, 706],
    [HL - 140, 790],
    [1050, 892],
    [430, 1398],
    [-760, 1445],
    [-1760, 1088],
    [-2340, 1000],
    [-HL, 968],
    [-HL, 430],
    [-2180, 300],
    [-1900, archY],
    // 后轮拱
    ...arc(-AXLE, MB.wheelR, ARCH_R, archStart, archEnd, 18),
    [-1043, archY],
    [1043, archY],
    // 前轮拱
    ...arc(AXLE, MB.wheelR, ARCH_R, archStart, archEnd, 18),
    [1832, archY],
    [2180, 300],
  ];
}

/** 车窗开孔（侧围上挖掉的两块）。 */
const WINDOW_HOLES: Array<Array<[number, number]>> = [
  [[390, 1322], [-130, 1342], [-130, 1050], [350, 1022]],
  [[-230, 1342], [-900, 1318], [-1090, 1102], [-240, 1052]],
];

const toShape = (outer: Array<[number, number]>, holes: Array<Array<[number, number]>>) => () => {
  const s = new THREE.Shape();
  s.moveTo(...outer[0]);
  outer.slice(1).forEach((p) => s.lineTo(...p));
  s.closePath();
  for (const h of holes) {
    const path = new THREE.Path();
    path.moveTo(...h[0]);
    h.slice(1).forEach((p) => path.lineTo(...p));
    path.closePath();
    s.holes.push(path);
  }
  return s;
};

/** 侧围：一块沿 z 挤出的车身形板（带轮拱与车窗）。 */
function SidePanel({ k, z0, depth = 70 }: { k: string; z0: number; depth?: number }) {
  return <Plate k={k} shape={toShape(outerProfile(), WINDOW_HOLES)} depth={depth} p={[0, 0, z0]} />;
}

/* ────────────────────────── 各零件 ────────────────────────── */

function Body() {
  const inner = HW - 55; // 侧围外表面 z
  return (
    <Part id="body">
      {/* 左右侧围 */}
      <SidePanel k="m3-side-l" z0={inner} />
      <SidePanel k="m3-side-r" z0={-inner - 70} />
      {/* 顶盖：有厚度的实心板，横向拉通（薄带在透视里会"消失"，所以给足厚度） */}
      <Plate k="m3-roof" shape={toShape([[430, 1398], [-760, 1445], [-760, 1295], [430, 1248]], [])} depth={inner * 2} p={[0, 0, -inner]} />
      {/* 前机盖 */}
      <Plate k="m3-hood" shape={toShape([[HL, 706], [HL - 140, 790], [1050, 892], [1050, 752], [HL - 140, 650], [HL, 566]], [])} depth={inner * 2} p={[0, 0, -inner]} />
      {/* 尾门 / 后甲板 */}
      <Plate k="m3-hatch" shape={toShape([[-1760, 1088], [-2340, 1000], [-HL, 968], [-HL, 828], [-2340, 860], [-1760, 948]], [])} depth={inner * 2} p={[0, 0, -inner]} />
      {/* 底板与门槛梁 */}
      <Box c={[0, MB.rockerY - 30, 0]} s={[3800, 60, inner * 2]} />
      <Box c={[0, MB.rockerY + 10, inner - 40]} s={[3800, 80, 80]} />
      <Box c={[0, MB.rockerY + 10, -inner + 40]} s={[3800, 80, 80]} />
      {/* 前保险杠 / 后保险杠 */}
      <Box c={[HL - 62, 480, 0]} s={[120, 500, inner * 2 - 30]} />
      <Box c={[-HL + 62, 560, 0]} s={[120, 500, inner * 2 - 30]} />
      <Callout id="body" p={[AXLE * 0.1, 1420, inner + 10]} />
    </Part>
  );
}

function Glass() {
  const inner = HW - 60;
  return (
    <Part id="glass">
      {/* 前风挡：从机盖根部斜到 A 柱顶 */}
      <Plate k="m3-windshield" shape={toShape([[1042, 900], [436, 1394], [446, 1406], [1052, 912]], [])} depth={inner * 2} p={[0, 0, -inner]} />
      {/* 后风挡 */}
      <Plate k="m3-rearglass" shape={toShape([[-764, 1440], [-1762, 1088], [-1772, 1100], [-774, 1452]], [])} depth={inner * 2} p={[0, 0, -inner]} />
      {/* 侧窗（贴在侧围开孔里） */}
      {[inner - 4, -inner - 56].map((z, i) => (
        <group key={i}>
          <Plate k={`m3-win-f${i}`} shape={toShape(WINDOW_HOLES[0], [])} depth={50} p={[0, 0, z]} />
          <Plate k={`m3-win-r${i}`} shape={toShape(WINDOW_HOLES[1], [])} depth={50} p={[0, 0, z]} />
        </group>
      ))}
      <Callout id="glass" p={[10, 1436, inner - 20]} />
    </Part>
  );
}

function Battery() {
  const [y0, y1] = MB.packY;
  const z = MB.packZ;
  return (
    <Part id="battery">
      {/* 箱体 */}
      <Box c={[0, (y0 + y1) / 2, 0]} s={[MB.packX * 2, y1 - y0, z * 2]} />
      {/* 内部电芯模组：纵向几排，剖视能看到分格 */}
      {[-3, -2, -1, 0, 1, 2, 3].map((i) => (
        <Box key={i} c={[i * (MB.packX / 4), y1 + 12, 0]} s={[MB.packX / 5, 24, z * 1.85]} />
      ))}
      <Callout id="battery" p={[0, y1 + 30, z * 0.9]} />
    </Part>
  );
}

/** 电驱单元：电机（横置圆柱）+ 减速器箱体 + 两根半轴。 */
function DriveUnit({ id, x, flip, note }: { id: string; x: number; flip: boolean; note: Vec3 }) {
  const cy = 430;
  const body: ReactNode[] = [
    <Cyl key="motor" c={[x, cy, 0]} r={150} len={420} axis="z" seg={28} />,
    <Box key="case" c={[x, cy - 40, 0]} s={[420, 200, 460]} />,
    <Cyl key="inv" c={[x + (flip ? -170 : 170), cy + 120, 0]} r={110} len={180} axis="z" seg={20} />,
  ];
  return (
    <Part id={id}>
      {body}
      {/* 半轴：伸到两侧车轮 */}
      {[1, -1].map((s) => (
        <Rod key={s} a={[x, cy, s * 120]} b={[x, MB.wheelR, s * 700]} r={34} seg={12} />
      ))}
      <Callout id={id} p={[x, cy + 190, 0]} />
      <group position={note} />
    </Part>
  );
}

/** 悬架：上下 A 臂 + 减振器。 */
function Suspension({ id, x }: { id: string; x: number }) {
  const cy = MB.wheelR;
  return (
    <Part id={id}>
      {/* 副车架 */}
      <Box c={[x, cy - 40, 0]} s={[520, 90, 900]} />
      {[1, -1].map((s) => (
        <group key={s}>
          {/* 上、下横臂 */}
          <Rod a={[x, cy - 60, s * 200]} b={[x, cy, s * 780]} r={26} seg={10} />
          <Rod a={[x, cy + 120, s * 190]} b={[x, cy + 60, s * 770]} r={22} seg={10} />
          {/* 减振器 + 弹簧 */}
          <Rod a={[x - 40, cy + 140, s * 640]} b={[x - 40, cy + 420, s * 560]} r={30} seg={12} />
          <Hoop k={`m3-spring-base`} c={[x - 40, cy + 160, s * 630]} R={55} r={9} axis="y" seg={24} />
        </group>
      ))}
      <Callout id={id} p={[x, cy + 200, 700]} />
    </Part>
  );
}

/** 车轮：轮胎 + 轮辋 + 辐条。 */
function Wheel({ id, x, z }: { id: string; x: number; z: number }) {
  const r = MB.wheelR;
  return (
    <Part id={id}>
      <group position={[x, r, z]}>
        <Spinning>
          <Cyl c={[0, 0, 0]} r={r} len={MB.tyreW} axis="z" seg={36} />
          <Cyl c={[0, 0, 0]} r={r * 0.66} len={MB.tyreW + 6} axis="z" seg={28} />
          {Array.from({ length: 5 }, (_, i) => {
            const a = (i / 5) * Math.PI * 2;
            return <Box key={i} c={[Math.cos(a) * r * 0.38, Math.sin(a) * r * 0.38, 0]} s={[r * 0.62, 54, MB.tyreW + 8]} r={[0, 0, a]} />;
          })}
        </Spinning>
      </group>
      <Callout id={id} p={[x + r * 0.6, r + r * 0.6, z + (z > 0 ? MB.tyreW / 2 : -MB.tyreW / 2)]} />
    </Part>
  );
}

function Brakes() {
  return (
    <Part id="brakes">
      {[[AXLE, 1], [AXLE, -1], [-AXLE, 1], [-AXLE, -1]].map(([x, s], i) => (
        <group key={i}>
          <Cyl c={[x as number, MB.wheelR, (s as number) * 690]} r={250} len={30} axis="z" seg={28} />
          <Box c={[x as number - 120, MB.wheelR + 150, (s as number) * 700]} s={[90, 120, 70]} />
        </group>
      ))}
      <Callout id="brakes" p={[AXLE - 120, MB.wheelR + 190, 720]} />
    </Part>
  );
}

function Frunk() {
  return (
    <Part id="frunk">
      <Box c={[HL - 500, 520, 0]} s={[660, 260, 1180]} />
      <Callout id="frunk" p={[HL - 500, 660, 620]} />
    </Part>
  );
}

function Trunk() {
  return (
    <Part id="trunk">
      <Box c={[-HL + 430, 700, 0]} s={[820, 480, 1400]} />
      <Callout id="trunk" p={[-HL + 430, 790, 700]} />
    </Part>
  );
}

function Seats() {
  const seat = (x: number, z: number, back: number) => (
    <group key={`${x}-${z}`} position={[x, 0, z]}>
      <Box c={[0, 560, 0]} s={[480, 120, 480]} />
      <Box c={[back, 760, 0]} s={[120, 500, 460]} />
    </group>
  );
  return (
    <Part id="seats">
      {seat(430, 380, -210)}
      {seat(430, -380, -210)}
      {seat(-620, 400, -170)}
      {seat(-620, -400, -170)}
      <Callout id="seats" p={[430, 1100, 380]} />
    </Part>
  );
}

function Dashboard() {
  return (
    <Part id="dashboard">
      <Box c={[690, 850, 0]} s={[220, 220, 1320]} />
      {/* 15 英寸横屏，略微朝驾驶员倾 */}
      <Box c={[700, 950, 120]} s={[36, 230, 420]} r={[0, 0, 0.18]} />
      <Callout id="dashboard" p={[690, 980, 600]} />
    </Part>
  );
}

function Steering() {
  return (
    <Part id="steering">
      <group position={[560, 940, 380]} rotation={[0, 0, 0.32]}>
        <Hoop k="m3-wheel-rim" c={[0, 0, 0]} R={170} r={22} axis="x" seg={40} />
        <Box c={[0, 0, 0]} s={[20, 320, 40]} />
        <Box c={[0, 0, 0]} s={[20, 40, 300]} />
      </group>
      <Rod a={[560, 940, 380]} b={[700, 870, 380]} r={28} seg={12} />
      <Callout id="steering" p={[560, 1060, 380]} />
    </Part>
  );
}

function Headlights() {
  return (
    <Part id="headlights">
      <Box c={[HL - 90, 640, 640]} s={[70, 110, 360]} />
      <Box c={[HL - 90, 640, -640]} s={[70, 110, 360]} />
      <Callout id="headlights" p={[HL - 120, 640, 800]} />
    </Part>
  );
}

function Taillights() {
  return (
    <Part id="taillights">
      <Box c={[-HL + 70, 830, 0]} s={[60, 110, 1560]} />
      <Callout id="taillights" p={[-HL + 90, 830, 700]} />
    </Part>
  );
}

function ChargePort() {
  return (
    <Part id="chargeport">
      <Box c={[-AXLE - 260, 760, HW - 60]} s={[180, 140, 40]} />
      <Callout id="chargeport" p={[-AXLE - 260, 830, HW - 20]} />
    </Part>
  );
}

export function Model3() {
  return (
    <group>
      <Battery />
      <Body />
      <Glass />
      <DriveUnit id="rear-motor" x={-AXLE - 200} flip note={[-AXLE, 0, 0]} />
      <DriveUnit id="front-motor" x={AXLE + 200} flip={false} note={[AXLE, 0, 0]} />
      <Suspension id="susp-front" x={AXLE} />
      <Suspension id="susp-rear" x={-AXLE} />
      <Brakes />
      <Wheel id="wheel-fl" x={AXLE} z={MB.trackHalf} />
      <Wheel id="wheel-fr" x={AXLE} z={-MB.trackHalf} />
      <Wheel id="wheel-rl" x={-AXLE} z={MB.trackHalf} />
      <Wheel id="wheel-rr" x={-AXLE} z={-MB.trackHalf} />
      <Frunk />
      <Trunk />
      <Seats />
      <Dashboard />
      <Steering />
      <Headlights />
      <Taillights />
      <ChargePort />
    </group>
  );
}

export const model3: MachineDef = level({
  id: 'model3',
  unit: S,
  bounds: [[-HL, 0, -HW], [HL, MB.height, HW]],
  name: '特斯拉 Model 3',
  en: 'Tesla Model 3',
  subtitle: '装配体 · 滑板底盘 · 纵剖视',
  summary: '20 种零件 · 电池包当结构件的滑板底盘，车轮会转',
  drawingNo: 'GW-M3-00',
  scale: '1 : 40',
  parts: PARTS,
  boltSets: {},
  neighbours: NEIGHBOURS,
  guides: GUIDES,
  centreLines: CENTRE_LINES,
  steps: STEPS,
  camera: CAMERA,
  Model: Model3,
  Driver: Model3Driver,
});
