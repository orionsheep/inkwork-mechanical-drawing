import type { CameraDef, BoltSetDef, GuideDef, PartDef, StepDef, Vec3 } from '../types';

/**
 * 弹性柱销联轴器 · Pin (Falk-type) Coupling
 *
 * 是什么、讲什么：两个半联轴器分别装在主动轴和从动轴上，用一圈带弹性套的柱销相连，
 *   把转矩从一根轴传到另一根；弹性套缓冲吸振、补偿两轴的小量偏移。
 *   动画让人看懂：主动半联轴器带动柱销 → 柱销挤压弹性套 → 从动半联轴器跟着转。
 *
 * 尺寸来源：通用结构（GB/T 5014 弹性柱销联轴器），按毫米建模，非具体型号。
 *
 * 单位与坐标：毫米。+x 朝前（轴向），+y 朝上，地面 y=0（此件水平放置，轴线在 y=0 附近），
 *   旋转轴线沿 x 轴；左右对称面 z=0。剖视沿 z=0 切开，正好剖到柱销与轴孔。
 *
 * 分级：7 个零件，一级即可（不必做子组件）。
 */

/** 关键尺寸（毫米）。模型与说明共用。 */
export const CP = {
  /** 半联轴器外径、内孔（轴径）、厚度。 */
  discR: 42,
  boreR: 14,
  discT: 22,
  /** 两半联轴器之间的间隙（留补偿量）。 */
  gap: 4,
  /** 柱销数、分布圆半径、柱销半径、柱销长。 */
  pins: 6,
  boltR: 30,
  pinR: 6,
  pinLen: 46,
  /** 弹性套（橡胶）半径。 */
  sleeveR: 11,
  /** 轴伸出长度。 */
  shaftLen: 34,
};

const X0 = -(CP.discT + CP.gap / 2); // 左半联轴器左端面 x
const X1 = CP.discT + CP.gap / 2; // 右半联轴器右端面 x

export const PARTS: PartDef[] = [
  {
    id: 'shaft-a', index: 1, name: '主动轴', en: 'Input Shaft', role: '输入转矩',
    material: '45 钢',
    description: '左端接电机，轴上开键槽，与主动半联轴器轮毂用平键联接。',
    explode: [-150, 0, 0], stage: [0.05, 0.3],
  },
  {
    id: 'shaft-b', index: 2, name: '从动轴', en: 'Output Shaft', role: '输出转矩',
    material: '45 钢',
    description: '右端接工作机，同样用键与从动半联轴器联接，输出转速。',
    explode: [150, 0, 0], stage: [0.05, 0.3],
  },
  {
    id: 'key', index: 3, name: '平键', en: 'Keys', role: '周向定位',
    material: '45 钢（A 型键）',
    description: '嵌在轴与轮毂的键槽里，靠侧面挤压传递转矩，保证轴与半联轴器同步转动。',
    explode: [0, -70, 0], stage: [0.12, 0.34],
  },
  {
    id: 'half-a', index: 4, name: '主动半联轴器', en: 'Driving Half', role: '随主动轴转 · 带柱销',
    material: 'HT200 · 灰铸铁',
    description: '轮毂装在主动轴上，用键传递转矩；法兰盘上一圈孔，柱销的一端固定在它的孔里，带动从动端。',
    explode: [-90, 0, 0], stage: [0.35, 0.66],
  },
  {
    id: 'half-b', index: 5, name: '从动半联轴器', en: 'Driven Half', role: '被柱销带动',
    material: 'HT200 · 灰铸铁',
    description: '另一根轴上的半联轴器，法兰盘上有与柱销对应的通孔，柱销穿过弹性套插入孔中，把转矩带到这根轴。',
    explode: [90, 0, 0], stage: [0.35, 0.66],
  },
  {
    id: 'pins', index: 6, name: '柱销', en: 'Pins', role: '传力 · 6 根',
    material: '45 钢',
    description: '一圈 6 根柱销，一端过盈压入主动端法兰，另一端插入从动端弹性套内；转矩就靠它们剪切传递。',
    explode: [0, 95, 0], stage: [0.6, 0.92],
  },
  {
    id: 'sleeves', index: 7, name: '弹性套', en: 'Rubber Sleeves', role: '缓冲吸振',
    material: '耐油橡胶',
    description: '套在柱销上的橡胶套，缓和冲击、吸收振动，并允许两轴存在微量径向/角向偏移。',
    explode: [0, 40, 0], stage: [0.62, 0.95],
  },
];

/** 局部展开时一起散开的邻居。 */
export const NEIGHBOURS: Record<string, string[]> = {
  'half-a': ['key', 'pins', 'shaft-a', 'half-a'],
  'half-b': ['key', 'sleeves', 'pins', 'shaft-b', 'half-b'],
  pins: ['sleeves', 'pins'],
  sleeves: ['pins', 'sleeves'],
  'shaft-a': ['key', 'shaft-a'],
  'shaft-b': ['key', 'shaft-b'],
  key: ['key'],
};

export const GUIDES: GuideDef[] = [
  { stage: 'shaft-a', origin: [-(CP.discT + CP.gap / 2) - CP.shaftLen, 0, 0] },
  { stage: 'half-a', origin: [-(CP.discT / 2 + CP.gap / 2), 0, CP.discR * 0.7] },
  { stage: 'half-b', origin: [CP.discT / 2 + CP.gap / 2, 0, CP.discR * 0.7] },
  { stage: 'sleeves', origin: [0, 0, CP.sleeveR] },
  { stage: 'pins', origin: [0, CP.boltR, 0] },
  { stage: 'shaft-b', origin: [CP.discT + CP.gap / 2 + CP.shaftLen, 0, 0] },
];

export const CENTRE_LINES: Array<[Vec3, Vec3, number?]> = [
  [[X0 - CP.shaftLen - 6, 0, 0], [X1 + CP.shaftLen + 6, 0, 0], CP.discR],
];

export const STEPS: StepDef[] = [
  {
    title: '装配体', en: 'Assembly',
    body: '弹性柱销联轴器把两根轴连起来：左端主动半联轴器带着一圈柱销转动，柱销穿过橡胶弹性套，插进右端从动半联轴器的孔里，转矩就这样传到从动轴。',
    state: { explode: 0, section: false, running: true, select: 'pins', focus: null },
  },
  {
    title: '全剖', en: 'Full Section',
    body: '沿轴线剖开：两侧轮毂内孔与轴配合、平键嵌在键槽里；柱销一端压在主动端、一端插入从动端弹性套中，中间间隙留出了补偿量。',
    state: { explode: 0, section: true, running: true, select: 'pins', focus: null },
  },
  {
    title: '柱销传动', en: 'Pin Drive',
    body: '主动端法兰孔的柱销随轴转动，靠剪切把力传给从动端；橡胶套受压变形，缓和启动冲击、吸收振动。',
    state: { explode: 0, section: false, running: true, select: 'sleeves', focus: 'pins' },
  },
  {
    title: '拆卸顺序', en: 'Disassembly',
    body: '先抽两根轴和平键，再取下弹性套与柱销，两个半联轴器即可分离。',
    state: { explode: 1, section: false, running: false, select: null, focus: null },
  },
];

export const BOLT_SETS: Record<string, BoltSetDef> = {};

export const CAMERA: CameraDef = {
  target: [0, 0, 0],
  // 这些是"模型单位"（毫米），level() 会按 unit 换算成场景单位。
  // offset 长度约为最大尺寸(~380mm)的 2 倍，从右前上方看。
  offset: [430, 380, 700],
  orthoDistance: 1600,
  exploded: { target: [0, 45, 0], scale: 1.8 },
  foci: {
    pins: { target: [0, 25, 40], scale: 0.55 },
  },
};
