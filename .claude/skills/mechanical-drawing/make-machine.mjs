#!/usr/bin/env node
/**
 * 新建一台机器 / New machine — 脚手架 / scaffold.
 *
 *   node .claude/skills/mechanical-drawing/make-machine.mjs <id> "<中文名>" "<English Name>"
 *
 * 例 / eg:
 *   node .claude/skills/mechanical-drawing/make-machine.mjs coupling "弹性联轴器" "Flexible Coupling"
 *
 * 生成 src/machines/<id>/data.ts 与 index.tsx（含一个能跑的占位模型：底座 + 飞轮），
 * 并打印注册到 src/machines/index.ts 的提示。之后照同目录 SKILL.md 把零件表、几何、
 * 拆解时序、讲解步骤填进去即可。
 *
 * 说明 / notes
 *  - id 用小写字母、数字、连字符（子组件用 父id/名）。
 *  - 生成后自动检查 src/machines/index.ts 是否已注册；没注册会打印要粘贴的代码。
 *  - 同一个 id 已存在时不覆盖（先删旧目录）。
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * 找到 Inkwork 工程根目录：从本脚本位置往上走，直到看见带 src/machines 的 package.json。
 * 这样无论技能被放在 .claude/skills/、~/.claude/skills/ 还是别处，都能定位到工程。
 */
function findProjectRoot(start) {
  // 环境变量优先（全局安装时由 SKILL.md 指示 agent 传入）
  if (process.env.INKWORK_ROOT) return resolve(process.env.INKWORK_ROOT);
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    const pkg = join(dir, 'package.json');
    if (existsSync(pkg) && existsSync(join(dir, 'src/machines'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const ROOT = findProjectRoot(dirname(fileURLToPath(import.meta.url)));
if (!ROOT) {
  console.error('找不到 Inkwork 工程根目录（需要有 package.json 和 src/machines/）。');
  console.error('请先进入一个 Inkwork 工程目录（用 inkwork 的 create-project 生成），或在命令前设置 INKWORK_ROOT=/path/to/project。');
  process.exit(1);
}
const [id, zh, en] = process.argv.slice(2);

if (!id || !zh || !en) {
  console.error('用法: node .claude/skills/mechanical-drawing/make-machine.mjs <id> "<中文名>" "<English Name>"');
  process.exit(1);
}
if (!/^[a-z0-9][a-z0-9-]*(\/[a-z0-9-]+)?$/.test(id)) {
  console.error('id 只能是小写字母、数字、连字符（子组件形如 parent/child）');
  process.exit(1);
}
const isChild = id.includes('/');
const leaf = id.split('/').pop();
const camel = leaf.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
const pascal = camel.charAt(0).toUpperCase() + camel.slice(1);
const dir = join(ROOT, 'src/machines', leaf);
const fileData = join(dir, 'data.ts');
const fileIndex = join(dir, 'index.tsx');

if (existsSync(dir)) {
  console.error(`目录已存在: ${dir}（先删掉再说）`);
  process.exit(1);
}
mkdirSync(dir, { recursive: true });

const data = `import type { CameraDef, GuideDef, PartDef, StepDef, Vec3 } from '../types';

/**
 * ${zh} · ${en}
 *
 * 写清三件事（照 SKILL.md 第 1 步）：
 *  1. 是什么、讲什么：一句话说清原理与动画要展示的因果。
 *  2. 尺寸来源：公开图纸 / 公开规格 / 通用布局；真实产品只画公开尺寸，不画商标。
 *  3. 单位与坐标：只用一种长度单位；+x 朝前，+y 朝上，地面 y=0，左右对称面 z=0。
 *     剖视固定沿 z=0 切掉 z>0 的一半，所以内部结构要沿这个面展开。
 *
 * 下面是一个可运行的占位：底座 + 飞轮 + 盖板。替换成真实零件。
 */

/** 关键尺寸集中放这里，模型与文字共用。 */
export const ${camel.toUpperCase()} = {
  wheelR: 0.18,
};

export const PARTS: PartDef[] = [
  {
    id: 'base', index: 1, name: '底座', en: 'Base', role: '支承', material: 'HT200 · 灰铸铁',
    description: '……（讲为什么这样设计：承力/定位/材料选择）',
    explode: [0, 0, 0], stage: [1, 1],
  },
  {
    id: 'wheel', index: 2, name: '飞轮', en: 'Flywheel', role: '储能', material: '45 钢',
    description: '……',
    explode: [0, 0.5, 0], stage: [0.4, 0.8],
  },
  {
    id: 'cover', index: 3, name: '盖板', en: 'Cover', role: '防护', material: 'Q235 钢板',
    description: '……',
    explode: [0, 0.6, 0], stage: [0, 0.4],
  },
];

/** 局部展开：选中某零件“拆开此组件”时一起散开的邻居。 */
export const NEIGHBOURS: Record<string, string[]> = {
  base: ['wheel', 'cover'],
  wheel: ['wheel'],
  cover: ['cover'],
};

/** 点画轴线与装配引导线（模型单位）。第三项给半径时，正对它的视图画圆的十字中心线。 */
export const GUIDES: GuideDef[] = [
  { stage: 'wheel', origin: [0, 0.3, 0] },
];
export const CENTRE_LINES: Array<[Vec3, Vec3, number?]> = [
  [[0, 0, 0], [0, 0.6, 0], 0.18],
];

/** 讲解步骤 2–5 步：先装配会动，再剖视讲原理，最后 explode:1 拆开。 */
export const STEPS: StepDef[] = [
  {
    title: '装配体', en: 'Assembly',
    body: '一句话讲清这台机器怎么工作，从哪看起。',
    state: { explode: 0, section: false, running: true, select: 'wheel', focus: null },
  },
  {
    title: '剖视', en: 'Section',
    body: '沿 z=0 剖开，讲内部配合与关键结构。',
    state: { explode: 0, section: true, running: false, select: 'wheel', focus: null },
  },
  {
    title: '拆卸顺序', en: 'Disassembly',
    body: '按装配逆序：先拆外面，最后拆基座附近的零件。',
    state: { explode: 1, section: false, running: false, select: null, focus: null },
  },
];

export const CAMERA: CameraDef = {
  target: [0, 0.25, 0],
  offset: [0.8, 0.6, 1.4],
  orthoDistance: 6,
  exploded: { target: [0, 0.55, 0], scale: 2.1 },
  // 特写镜头（可选）：stub:
  // foci: { head: { target: [0, 0.5, 0], scale: 0.6 } },
};
`;

const index = `import { useRef, type ReactNode } from 'react';
import { useFrame } from '@react-three/fiber';
import * as THREE from 'three';
import { Part } from '../../scene/Part';
import { Callout } from '../../scene/Overlay';
import { useStudio } from '../../state';
import type { MachineDef } from '../types';
import { Box, Cyl, Turn, level } from '../kit';
import { CAMERA, CENTRE_LINES, GUIDES, NEIGHBOURS, PARTS, STEPS, ${camel.toUpperCase()} } from './data';

export const ${camel}Motion = { t: 0 };

export function ${pascal}Driver() {
  useFrame((_, dt) => { if (useStudio.getState().running) ${camel}Motion.t += Math.min(dt, 0.05); }, -1);
  return null;
}

function Spinning({ children }: { children: ReactNode }) {
  const ref = useRef<THREE.Group>(null);
  useFrame(() => { if (ref.current) ref.current.rotation.y = ${camel}Motion.t * 1.5; });
  return <group ref={ref}>{children}</group>;
}

export function ${pascal}() {
  const { wheelR } = ${camel.toUpperCase()};
  return (
    <group>
      <Part id="base">
        <Box c={[0, 0.05, 0]} s={[0.6, 0.1, 0.4]} />
        <Callout id="base" p={[0.25, 0.1, 0.2]} />
      </Part>
      <Part id="wheel">
        <group position={[0, 0.3, 0]}>
          <Spinning>
            <Turn k="${leaf}-wheel" profile={[[0.02, -0.02], [wheelR, -0.02], [wheelR, 0.02], [0.02, 0.02]]} />
            <Cyl c={[0, 0, 0]} r={0.02} len={0.3} />
          </Spinning>
        </group>
        <Callout id="wheel" p={[wheelR, 0.32, 0.05]} />
      </Part>
      <Part id="cover">
        <Box c={[0, 0.5, 0]} s={[0.5, 0.02, 0.4]} />
        <Callout id="cover" p={[0.2, 0.51, 0.15]} />
      </Part>
    </group>
  );
}

export const ${camel}: MachineDef = level({
  id: '${id}',
  unit: 20,
  bounds: [[-0.3, 0, -0.2], [0.3, 0.52, 0.2]],
  name: '${zh}',
  en: '${en}',
  subtitle: '装配体 · ……',
  summary: '3 种零件 · ……，会动',
  drawingNo: 'GW-XX-00',
  scale: '1 : 5',
  parts: PARTS,
  boltSets: {},
  neighbours: NEIGHBOURS,
  guides: GUIDES,
  centreLines: CENTRE_LINES,
  steps: STEPS,
  camera: CAMERA,
  Model: ${pascal},
  Driver: ${pascal}Driver,
});
`;

writeFileSync(fileData, data);
writeFileSync(fileIndex, index);

// 检查是否已在 index.ts 注册
const reg = join(ROOT, 'src/machines/index.ts');
const regText = readFileSync(reg, 'utf8');
const registered = new RegExp(`from '\\./${leaf}'`).test(regText) || new RegExp(`from '\\./${leaf}/`).test(regText);
console.log(`✓ 已生成:`);
console.log(`  src/machines/${leaf}/data.ts`);
console.log(`  src/machines/${leaf}/index.tsx`);
if (!registered) {
  console.log(`\n还没注册到 src/machines/index.ts，粘贴这几行：`);
  console.log(`  import { ${camel} } from './${leaf}';               // 顶部`);
  console.log(`  // GROUPS 里合适的分组末尾加上 ${camel}${isChild ? '（子组件请放进 ALL 数组）' : ''}`);
  if (isChild) console.log(`  // ALL 数组里加 ...${camel.toUpperCase()}_LEVELS（若有多级）或 ${camel}`);
}
console.log(`\n下一步：照同目录 SKILL.md 填零件表与几何，然后\n  npx tsc -b && npm test\n  npm run dev`);
