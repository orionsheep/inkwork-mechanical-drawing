import type { CameraDef, GuideDef, PartDef, StepDef, Vec3 } from '../types';

/**
 * Tesla Model 3 · 装配体分解图
 *
 * 是什么、讲什么：一台纯电轿车的分解装配。核心是「滑板式底盘」——
 *   电池包平铺在底板里当结构件，前后各一台电机驱动车轴，车身只是一层覆盖件。
 *   动画让人看懂：车轮转动 → 电机经减速器驱动半轴 → 推动车身；以及拆解顺序。
 *
 * 尺寸来源：Tesla Model 3 公开规格（长 4694 × 宽 1850 × 高 1443 mm，轴距 2875 mm，
 *   离地间隙约 140 mm，18 英寸轮）。内部布局按公开拆解资料估读，仅作教学示意；
 *   不含任何商标、标志。
 *
 * 单位与坐标：毫米。车头朝 +x，车顶朝 +y，地面 y = 0，左右对称面 z = 0。
 *   剖视沿 z = 0 纵向剖开（切掉 z > 0 的那半），正好看到电池包、电机、座椅的纵剖面。
 *
 * 分级：约 20 个零件，一级即可。
 */

/** 关键尺寸（毫米）。模型与说明共用。 */
export const MB = {
  length: 4694,
  width: 1850,
  height: 1443,
  wheelbase: 2875,
  /** 车轮半径、胎宽、轮距半宽（轮心到中分面）。 */
  wheelR: 334,
  tyreW: 260,
  trackHalf: 818,
  /** 电池包（滑板底盘）：x 范围、z 半宽、y 上下。 */
  packX: 1500,
  packZ: 720,
  packY: [140, 285] as [number, number],
  /** 底板/门槛梁高度。 */
  rockerY: 250,
};

export const HL = MB.length / 2; // 2347
export const HW = MB.width / 2; // 925
export const AXLE = MB.wheelbase / 2; // 1437.5

/** 场景单位 / 毫米：整机约 9.4 个场景单位。 */
export const S = 0.002;

export const PARTS: PartDef[] = [
  {
    id: 'battery', index: 1, name: '电池包', en: 'Battery Pack', role: '滑板底盘 · 结构件',
    material: '2170 圆柱电芯 / 铝合金箱体',
    description: '平铺在车厢底板下方，长 1.5 m 以上、宽 1.4 m，既是能量源也是车身抗扭的结构件。拆掉它车身刚度会明显下降——这就是「滑板底盘」的含义。',
    explode: [0, 0, 0], stage: [1, 1],
  },
  {
    id: 'rear-motor', index: 2, name: '后驱动单元', en: 'Rear Drive Unit', role: '主驱动 · 电机+减速器',
    material: '永磁同步电机 / 铝合金壳体',
    description: '后轴上的三合一电驱：电机、单速减速器、逆变器集成在一个壳体里。电机转速可过万转，经约 9:1 的减速比把扭矩放大后送到半轴。',
    explode: [-520, 40, 0], stage: [0.62, 0.78],
  },
  {
    id: 'front-motor', index: 3, name: '前驱动单元', en: 'Front Drive Unit', role: '前驱动 · 双电机版',
    material: '感应/永磁电机 / 铝合金壳体',
    description: '四驱版前轴上的电驱单元。前后电机可以独立控制扭矩，实现前后轴的动力分配。',
    explode: [520, 40, 0], stage: [0.62, 0.78],
  },
  {
    id: 'susp-front', index: 4, name: '前悬架', en: 'Front Suspension', role: '导向 · 减振',
    material: '铝合金双叉臂 / 钢副车架',
    description: '双叉臂独立悬架：上下两只 A 臂控制车轮的跳动轨迹，减振器与弹簧承担垂直载荷。副车架把悬架和电机一起托在车身下面。',
    explode: [180, -180, 0], stage: [0.54, 0.7],
  },
  {
    id: 'susp-rear', index: 5, name: '后悬架', en: 'Rear Suspension', role: '导向 · 减振',
    material: '铝合金多连杆 / 钢副车架',
    description: '多连杆独立悬架：多根连杆分别约束车轮的各个自由度，让车轮在跳动时保持正确的定位角。',
    explode: [-180, -180, 0], stage: [0.54, 0.7],
  },
  {
    id: 'brakes', index: 6, name: '制动盘与卡钳', en: 'Brakes', role: '制动 · 能量回收补充',
    material: '铸铁通风盘 / 铝合金卡钳',
    description: '四个车轮各一套盘式制动。日常减速主要靠电机的能量回收，机械刹车只在紧急制动和低速时介入。',
    explode: [0, -120, 0], stage: [0.3, 0.44],
  },
  {
    id: 'wheel-fl', index: 7, name: '左前轮', en: 'Wheel FL', role: '行驶 · 转向',
    material: '铝合金轮毂 / 低滚阻轮胎',
    description: '前轮既承担驱动（四驱版）也负责转向。轮胎的滚动阻力直接影响续航，所以电动车普遍用低滚阻胎。',
    explode: [60, 0, 760], stage: [0.05, 0.22],
  },
  {
    id: 'wheel-fr', index: 8, name: '右前轮', en: 'Wheel FR', role: '行驶 · 转向',
    material: '铝合金轮毂 / 低滚阻轮胎',
    description: '与左前轮对称。',
    explode: [60, 0, -760], stage: [0.05, 0.22],
  },
  {
    id: 'wheel-rl', index: 9, name: '左后轮', en: 'Wheel RL', role: '行驶 · 驱动',
    material: '铝合金轮毂 / 低滚阻轮胎',
    description: '后轮是后驱版唯一的驱动轮，电机经半轴直接带动。',
    explode: [-60, 0, 760], stage: [0.05, 0.22],
  },
  {
    id: 'wheel-rr', index: 10, name: '右后轮', en: 'Wheel RR', role: '行驶 · 驱动',
    material: '铝合金轮毂 / 低滚阻轮胎',
    description: '与左后轮对称。',
    explode: [-60, 0, -760], stage: [0.05, 0.22],
  },
  {
    id: 'frunk', index: 11, name: '前备箱', en: 'Front Trunk', role: '储物',
    material: '塑料内衬',
    description: '没有发动机，车头就空出一个行李箱。这是纯电平台带来的空间红利。',
    explode: [520, 460, 0], stage: [0.44, 0.56],
  },
  {
    id: 'trunk', index: 12, name: '后备箱地板', en: 'Rear Trunk', role: '储物',
    material: '塑料/地毯内衬',
    description: '后置电机上方仍留出行李空间，地板下方还有一层隐藏储物格。',
    explode: [-520, 420, 0], stage: [0.44, 0.56],
  },
  {
    id: 'seats', index: 13, name: '座椅', en: 'Seats', role: '乘坐',
    material: '钢骨架 / 发泡 / 仿皮',
    description: '前后排座椅。前排座椅下方留出空间给电池包的厚度，所以电动车坐姿普遍比同级燃油车略高。',
    explode: [0, 700, 0], stage: [0.46, 0.6],
  },
  {
    id: 'dashboard', index: 14, name: '仪表台与中控屏', en: 'Dashboard & Screen', role: '人机交互',
    material: '注塑件 / 15 英寸触屏',
    description: '一块 15 英寸横屏集成了仪表、导航、空调和车辆设置，所以车里几乎没有实体按键。',
    explode: [420, 620, 0], stage: [0.5, 0.64],
  },
  {
    id: 'steering', index: 15, name: '方向盘与转向柱', en: 'Steering Wheel', role: '转向输入',
    material: '镁合金骨架 / 皮革',
    description: '方向盘经转向柱、转向机把转动变成前轮的偏转角。电动助力按车速调节手感。',
    explode: [700, 560, 0], stage: [0.56, 0.68],
  },
  {
    id: 'glass', index: 16, name: '玻璃（前后风挡与侧窗）', en: 'Glass', role: '采光 · 视野',
    material: '夹层玻璃 / 钢化玻璃',
    description: '全景玻璃车顶把前风挡、车顶和后风挡连成一片，少了横梁，头部空间更通透。',
    explode: [0, 1100, 0], stage: [0.16, 0.3],
  },
  {
    id: 'headlights', index: 17, name: '前大灯', en: 'Headlights', role: '照明',
    material: 'LED 模组',
    description: '两侧各一组 LED 大灯，集成日间行车灯与转向灯。',
    explode: [420, 120, 0], stage: [0.12, 0.24],
  },
  {
    id: 'taillights', index: 18, name: '尾灯', en: 'Taillights', role: '照明 · 信号',
    material: 'LED 模组',
    description: '横贯车尾的 LED 尾灯组，同时承担刹车灯与转向灯。',
    explode: [-420, 120, 0], stage: [0.12, 0.24],
  },
  {
    id: 'chargeport', index: 19, name: '充电口', en: 'Charge Port', role: '补能',
    material: '模组',
    description: '左后翼子板上的充电口，支持交流慢充与直流快充。',
    explode: [-260, 60, 620], stage: [0.2, 0.32],
  },
  {
    id: 'body', index: 20, name: '车身（侧围/顶盖/机盖/尾门）', en: 'Body Shell', role: '覆盖件 · 承载',
    material: '钢铝混合 / 铝合金覆盖件',
    description: '车身由左右侧围、顶盖、前机盖、尾门和底板拼焊而成，本身是承载结构；它坐在电池包上，一起构成整车刚度。',
    explode: [0, 1500, 0], stage: [0.24, 0.44],
  },
];

/** 局部展开时一起散开的邻居。 */
export const NEIGHBOURS: Record<string, string[]> = {
  battery: ['battery'],
  body: ['glass', 'headlights', 'taillights', 'chargeport', 'body'],
  'rear-motor': ['rear-motor'],
  'front-motor': ['front-motor'],
  'susp-front': ['susp-front'],
  'susp-rear': ['susp-rear'],
  brakes: ['brakes'],
  'wheel-fl': ['brakes', 'wheel-fl'],
  'wheel-fr': ['brakes', 'wheel-fr'],
  'wheel-rl': ['brakes', 'wheel-rl'],
  'wheel-rr': ['brakes', 'wheel-rr'],
  seats: ['seats'],
  dashboard: ['steering', 'dashboard'],
  steering: ['steering'],
  glass: ['glass'],
};

export const GUIDES: GuideDef[] = [
  { stage: 'body', origin: [0, MB.height, 0] },
  { stage: 'glass', origin: [0, MB.height + 10, 0] },
  { stage: 'wheel-fl', origin: [AXLE, MB.wheelR, MB.trackHalf] },
  { stage: 'wheel-fr', origin: [AXLE, MB.wheelR, -MB.trackHalf] },
  { stage: 'wheel-rl', origin: [-AXLE, MB.wheelR, MB.trackHalf] },
  { stage: 'wheel-rr', origin: [-AXLE, MB.wheelR, -MB.trackHalf] },
  { stage: 'rear-motor', origin: [-AXLE - 120, 400, 0] },
  { stage: 'front-motor', origin: [AXLE + 120, 400, 0] },
  { stage: 'battery', origin: [0, (MB.packY[0] + MB.packY[1]) / 2, 0] },
  { stage: 'seats', origin: [260, 900, 0] },
];

export const CENTRE_LINES: Array<[Vec3, Vec3, number?]> = [
  // 两个车轴的轴线（沿 z），在正视/侧视里给车轮画十字中心线
  [[AXLE, MB.wheelR, -HW], [AXLE, MB.wheelR, HW], MB.wheelR],
  [[-AXLE, MB.wheelR, -HW], [-AXLE, MB.wheelR, HW], MB.wheelR],
];

export const STEPS: StepDef[] = [
  {
    title: '整机', en: 'Assembly',
    body: '纯电轿车的核心是滑板式底盘：电池包平铺在底板里当结构件，前后轴各有一台电驱单元，车身只是坐在这块「滑板」上的覆盖件。车轮在转。',
    state: { explode: 0, section: false, running: true, select: 'battery', focus: null },
  },
  {
    title: '纵向剖视', en: 'Section',
    body: '沿车身中分面纵剖：从下往上依次是电池包、车厢地板、座椅，车头是前备箱、车尾是后驱单元。电驱单元就在后轴上方。',
    state: { explode: 0, section: true, running: false, select: 'battery', focus: null },
  },
  {
    title: '滑板底盘', en: 'Skateboard',
    body: '掀掉车身看底盘：电池包、前后副车架与悬架、两台电驱单元、四套制动。这就是所有纯电平台共用的布置方式。',
    state: { explode: 0.62, section: false, running: false, select: 'battery', focus: null },
  },
  {
    title: '拆卸顺序', en: 'Teardown',
    body: '按装配逆序：先拆四个车轮与制动，再掀车身和玻璃，然后取内饰（座椅、仪表台、方向盘），最后落下电池包、抽出前后电驱。',
    state: { explode: 1, section: false, running: false, select: null, focus: null },
  },
];

export const CAMERA: CameraDef = {
  target: [0, 620, 0],
  // 模型单位（毫米）；level() 再乘 S。视线压低到接近平视（约 13°），车轮和侧面才看得见。
  offset: [8600, 2600, 9800],
  orthoDistance: 24000,
  exploded: { target: [0, 1600, 0], scale: 1.5 },
  foci: {
    motor: { target: [-AXLE, 500, 0], scale: 0.5 },
  },
};
