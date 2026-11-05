import type { BoltSetDef, CameraDef, GuideDef, PartDef, StepDef, Vec3 } from '../types';

/**
 * MacBook Pro 14 英寸 · 装配体分解图
 *
 * 是什么、讲什么：14 英寸轻薄笔记本的分解装配。整机摊平、屏幕朝上，沿厚度方向逐层拆解，
 *   让人看懂内部堆叠的真实结构：底壳(带内腔)→电池(6 块电芯，易拉胶)→主板(靠后，SoC 居中)
 *   +两台风扇+热管鳍片+扬声器→键盘/触控板→上盖(C 面)→屏幕总成(刘海摄像头)→铰链。
 *
 * 尺寸来源：Apple 官方公开外形尺寸（宽 312.6 × 深 221.2 × 厚 15.5 mm，圆角）与官方
 *   「Exploded View and Orderable Parts」分解图的部件划分/iFixit 拆解指南的结构，
 *   内部位置按公开拆解图估读，仅作教学示意；不含任何商标标志。
 *
 * 单位与坐标：毫米。整机平放，屏幕面朝上。
 *   +x 朝前（机身**前缘/掌托一侧**，远离铰链），−x 朝后（铰链/主板一侧）；
 *   +y 朝上（厚度方向，屏幕在上），地面 y=0（底面）；左右对称面 z=0（宽方向）。
 *   剖视沿 z=0 切开——所以内部各层沿 x（前后）、y（厚）铺开，剖视剖面正好看到电池、风扇、触控板的侧剖。
 *
 * 分级：约 16 个零件，一级即可。
 */

/** 关键尺寸（毫米）。模型与说明共用。 */
export const MB = {
  width: 312.6,   // 沿 z（左右）
  depth: 221.2,   // 沿 x（前后）
  thick: 15.5,    // 沿 y（厚）
  corner: 22,     // 四角圆角
  wall: 2.2,      // 底壳侧壁厚
  baseThick: 3.0, // 底壳底板厚（y: 0→3.0）
  lidThick: 3.4,  // 屏幕总成厚
};

/** 场景单位 / 毫米 */
const S = 0.032;

/** 把「画图坐标」(x 前后, y 厚, z 左右) 换算到世界坐标。 */
export const at = (x: number, y: number, z: number): Vec3 => [x * S, y * S, z * S];
export { S };

/** 前后/左右半径（半深、半宽）。 */
export const HX = MB.depth / 2; // 前后半深（x）
export const HZ = MB.width / 2; // 左右半宽（z）

/** 各零件在厚度方向 (y) 的区间，集中定义便于对齐。 */
export const LAYER = {
  base: [0, MB.baseThick] as [number, number],
  battery: [3.6, 9.2] as [number, number],
  board: [3.6, 5.4] as [number, number],
  soc: [5.4, 7.4] as [number, number],
  fan: [3.8, 9.0] as [number, number],
  heat: [8.8, 9.6] as [number, number],
  keyboard: [10.4, 12.6] as [number, number],
  trackpad: [9.4, 10.2] as [number, number],
  topcase: [13.0, 14.4] as [number, number],
  lid: [14.8, 14.8 + MB.lidThick] as [number, number],
};

/** 底壳一圈 P5 螺钉的位置 (x 前, z 左右)，靠铰链(−x)侧两颗是长螺钉。 */
export const SCREW_SEATS: Array<[number, number]> = [
  [HX - 14, -(HZ - 16)], [HX - 14, HZ - 16],
  [HX * 0.55, -(HZ - 4)], [HX * 0.55, HZ - 4],
  [-HX * 0.2, -(HZ - 4)], [-HX * 0.2, HZ - 4],
  [-HX + 14, -(HZ - 16)], [-HX + 14, HZ - 16],
];

export const PARTS: PartDef[] = [
  {
    id: 'bottom-case', index: 1, name: '底壳', en: 'Bottom Case', role: '支承 · 结构主体',
    material: '6000 系铝合金（阳极氧化）',
    description: '整块铝 CNC 铣削的机身底壳，四角圆角 22 mm、边缘倒棱；内腔有电池托盘和加强筋，底面四个橡胶脚垫。既是结构件也是散热面。',
    explode: [0, -18, 0], stage: [0.84, 1.0],
  },
  {
    id: 'battery', index: 2, name: '电池', en: 'Battery', role: '供电 · 锂聚合物',
    material: '锂离子聚合物',
    description: '机身里最大的一块，六块电芯拼成「前部一大块 + 后部两侧两块」以塞满空间，约 70 Wh。用带易拉胶的拉条粘在底壳上，维修先拉胶再取下。',
    explode: [0, 5, 0], stage: [0.58, 0.78],
  },
  {
    id: 'logic-board', index: 3, name: '主板', en: 'Logic Board', role: '计算核心 · SoC',
    material: '印制电路板 / M 系列芯片',
    description: '机身靠铰链一侧（−x）的长条形主板。正中是 SoC（CPU+GPU+统一内存同封装），周围是 SSD 颗粒、供电电感、接口座与去耦电容。',
    explode: [-24, 9, 0], stage: [0.5, 0.64],
  },
  {
    id: 'fan-left', index: 4, name: '散热风扇（左）', en: 'Left Fan', role: '主动散热',
    material: '铝合金外壳 / 塑料叶轮',
    description: '离心风扇：叶轮高速旋转把空气甩向外缘，经机身侧壁的鳍片吹出，带走 SoC 热量。两台风扇按温度独立调速。',
    explode: [-10, 12, 46], stage: [0.44, 0.58],
  },
  {
    id: 'fan-right', index: 5, name: '散热风扇（右）', en: 'Right Fan', role: '主动散热',
    material: '铝合金外壳 / 塑料叶轮',
    description: '与左风扇对称，负责另一侧风道。',
    explode: [-10, 12, -46], stage: [0.44, 0.58],
  },
  {
    id: 'heat-pipe', index: 6, name: '热管与散热鳍片', en: 'Heat Pipes & Fins', role: '导热',
    material: '铜热管 / 铝鳍片',
    description: '两根铜热管把 SoC 的热量导到机身两侧的铝鳍片，风扇再把鳍片间的热气吹出。热管靠内部工质相变高效导热，等效导热率远高于铜。',
    explode: [-6, 13, 0], stage: [0.48, 0.62],
  },
  {
    id: 'speakers', index: 7, name: '扬声器', en: 'Speakers', role: '外放 · 六扬声器',
    material: '模组',
    description: '左右两组成对的高/中/低音单元共六只，藏在键盘两侧与电池边缘；利用机身内部空腔增强低频。',
    explode: [10, 8, 62], stage: [0.56, 0.7],
  },
  {
    id: 'touchpad', index: 8, name: '触控板', en: 'Force Touch Trackpad', role: '指针输入',
    material: '玻璃面 / 金属支架',
    description: '一块无物理按键的玻璃触控板，用四角线性马达（Taptic）模拟"按下"触感，按压力度可分四级识别。位于掌托前部（+x）。',
    explode: [16, 7, 0], stage: [0.5, 0.64],
  },
  {
    id: 'keyboard', index: 9, name: '键盘', en: 'Keyboard', role: '字符输入',
    material: '塑料键帽 / 金属底板',
    description: '剪刀脚结构、约 1mm 键程的键盘；键帽下是金属底板和薄膜电路。整个键盘总成从 C 面装进上盖。',
    explode: [0, 13, 0], stage: [0.38, 0.54],
  },
  {
    id: 'top-case', index: 10, name: '机身上盖（掌托）', en: 'Top Case', role: '键盘托 · C 面',
    material: '铝合金',
    description: '键盘、触控板、扬声器都装在上盖里；上盖既是 C 面外观，也是这些总成的骨架，与底壳用卡扣和 P5 螺钉合拢。',
    explode: [0, 19, 0], stage: [0.28, 0.44],
  },
  {
    id: 'display', index: 11, name: '屏幕总成', en: 'Display Assembly', role: 'Liquid Retina XDR',
    material: 'mini-LED 面板 / 玻璃',
    description: '14.2 英寸 mini-LED 屏，顶部居中有刘海藏前置摄像头与环境光传感器，支持 ProMotion 自适应刷新。合盖摊平时是最上面一层。',
    explode: [0, 31, 0], stage: [0.1, 0.3],
  },
  {
    id: 'hinge', index: 12, name: '铰链', en: 'Hinge', role: '连接 · 开合',
    material: '不锈钢',
    description: '两个阻尼铰链把屏幕和机身连在后缘（−x），可在一定角度内任意停位，靠内部摩擦片提供阻尼力矩。',
    explode: [-HX - 26, 22, 0], stage: [0.06, 0.16],
  },
  {
    id: 'screws', index: 13, name: '底壳螺钉', en: 'Bottom Screws', role: '紧固底壳',
    material: '五角 P5 不锈钢',
    description: '底壳四周共 8 颗专用五角螺钉（P5），靠铰链一侧的两颗更长。拆机第一步就是用 P5 起子卸下它们。',
    explode: [0, -26, 0], stage: [0.9, 1.0],
  },
  {
    id: 'ports', index: 14, name: '接口（雷电 / MagSafe / HDMI / SD）', en: 'I/O Ports', role: '外接',
    material: '模组',
    description: '左侧 2×雷电4 + MagSafe3 + 3.5mm 耳机孔；右侧 SD 卡槽 + HDMI + 第三个雷电4。分别焊在主板上或独立小板上。',
    explode: [0, 6, -HZ - 30], stage: [0.54, 0.66],
  },
  {
    id: 'camera', index: 15, name: '前置摄像头', en: 'Front Camera', role: '视频通话 · 环境光',
    material: '模组',
    description: '藏在屏幕顶部刘海里：1080p 摄像头 + 环境光传感器，用于视频会议与自动亮度。',
    explode: [HX * 0.55, 35, 0], stage: [0.12, 0.24],
  },
  {
    id: 'wifi', index: 16, name: '无线天线与模块', en: 'Wi-Fi / Bluetooth', role: '无线连接',
    material: '模组',
    description: 'Wi-Fi 6E / 蓝牙模块与天线，天线贴在上盖侧壁内侧、避开金属屏蔽。',
    explode: [6, 6, HZ + 28], stage: [0.54, 0.66],
  },
];

/** 螺钉组：底壳一圈 P5 螺钉，沿各自轴线先飞出，再随底壳走。 */
export const BOLT_SETS: Record<string, BoltSetDef> = {
  'bottom-screws': { owner: 'screws', distance: 12, stage: [0.02, 0.12] },
};

/** 局部展开时一起散开的邻居。 */
export const NEIGHBOURS: Record<string, string[]> = {
  'bottom-case': ['screws', 'battery', 'bottom-case'],
  battery: ['battery'],
  'logic-board': ['logic-board'],
  'fan-left': ['fan-left'],
  'fan-right': ['fan-right'],
  'heat-pipe': ['heat-pipe'],
  'top-case': ['keyboard', 'touchpad', 'speakers', 'top-case'],
  keyboard: ['keyboard'],
  touchpad: ['touchpad'],
  display: ['camera', 'display', 'hinge'],
  hinge: ['hinge'],
  speakers: ['speakers'],
};

export const GUIDES: GuideDef[] = [
  { stage: 'display', origin: [0, LAYER.lid[0], 0] },
  { stage: 'top-case', origin: [0, LAYER.topcase[0], HZ * 0.6] },
  { stage: 'keyboard', origin: [0, LAYER.keyboard[0], HZ * 0.4] },
  { stage: 'battery', origin: [0, LAYER.battery[0], 0] },
  { stage: 'logic-board', origin: [-HX * 0.6, LAYER.board[1], 0] },
  { stage: 'fan-left', origin: [-HX * 0.2, LAYER.fan[1], HZ * 0.28] },
  { stage: 'fan-right', origin: [-HX * 0.2, LAYER.fan[1], -HZ * 0.28] },
  { stage: 'bottom-case', origin: [0, 0, 0] },
  { stage: 'touchpad', origin: [HX * 0.55, LAYER.trackpad[1], 0] },
  ...SCREW_SEATS.map(([x, z]): GuideDef => ({ stage: 'bottom-screws', origin: [x, 0, z], axis: [0, -1, 0] })),
];

export const CENTRE_LINES: Array<[Vec3, Vec3, number?]> = [
  [[0, -4, 0], [0, MB.thick + 40, 0]],
];

export const STEPS: StepDef[] = [
  {
    title: '整机', en: 'Assembly',
    body: 'MacBook Pro 14 英寸合盖平放。机身是整块铝 CNC 铣出的底壳加铝合金上盖，屏幕是最上面一层。拆开看里面是电池、主板、两台风扇和键盘。',
    state: { explode: 0, section: false, running: true, select: 'display', focus: null },
  },
  {
    title: '全剖', en: 'Full Section',
    body: '沿中分面剖开：从下往上依次是底壳、电池、主板与风扇、键盘、上盖、屏幕；电池最厚，占据机身大半厚度，主板与风扇集中在靠铰链的后部。',
    state: { explode: 0, section: true, running: true, select: 'battery', focus: null },
  },
  {
    title: '散热', en: 'Cooling',
    body: '剖开看风道：SoC 的热量经两根铜热管导到机身两侧的铝鳍片，两台风扇（离心式）把热空气从侧壁吹出。风扇在运转。',
    state: { explode: 0, section: true, running: true, select: 'fan-left', focus: null },
  },
  {
    title: '分层拆解', en: 'Layer Teardown',
    body: '按厚度方向一层层掀开：屏幕→上盖→键盘→主板/风扇/热管→电池→底壳。这就是拆一台笔记本从外到里的顺序。',
    state: { explode: 1, section: false, running: false, select: null, focus: null },
  },
];

export const CAMERA: CameraDef = {
  // 厚度方向已被放大（见 index.tsx 的 TY=3.4）。视线压低一些，从右前上方偏侧看，能读出层厚。
  target: [0, 32, 0],
  offset: [600, 340, 820],
  orthoDistance: 2800,
  exploded: { target: [0, 90, 0], scale: 1.55 },
  foci: {
    fan: { target: [-HX * 0.2, 8, HZ * 0.28], scale: 0.5 },
  },
};
