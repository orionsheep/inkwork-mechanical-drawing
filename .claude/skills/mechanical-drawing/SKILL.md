---
name: mechanical-drawing
description: 生成线稿风格的机械制图 / 装配体工程图。在 Inkwork（格物）引擎里新建一台"能拆解、能剖视、能出三视图"的机械装配体：3D 几何建模 → 透视轴测图版 + 第一角三视图（粗实线/细虚线/点画线/45°剖面线/标题栏）+ 分层爆炸拆解 + 联动动画 + PNG/视频导出。用户说"画一台 X 的机械图""做个爆炸图/装配图""把 Y 做成能拆的模型""生成三视图""出个剖视图"时使用。
---

# 机械制图 · Inkwork 技能

把「一台机器」变成「一套工程图」。渲染、剖视、三视图、爆炸拆解、导出**引擎已经写好**，
你只写**三样数据**：零件表、几何、MachineDef。

> **核心认知（决定了后面每一步）**
> 这个引擎不画 2D 线。它摆真实的 3D 几何，再从**法线 / 深度 / 零件 ID 的不连续处**自动"提炼"出线。
> 所以：**几何摆对了，图就对了；几何错了，线一定跟着错。**
> 想要"装配图每个零件轮廓分明"，靠的是把零件分对（`<Part id>`）；想要"剖视里能看到内部"，靠的是真的把内部结构建出来。

---

## 第 0 步：准备工程（只在第一次做）

本技能需要一个 Inkwork 工程目录（有 `package.json`、`src/machines/`、`src/scene/`）。

**如果当前目录已经是 Inkwork 工程**（能看到 `src/scene/ink.ts`），跳到第 1 步。

**如果不是**，先脚手架一个：

```bash
node <技能目录>/create-project.mjs ./my-drawing    # 生成一个完整可跑的工程
cd ./my-drawing && npm install
```

（`<技能目录>` 就是本 SKILL.md 所在的目录，通常是 `.claude/skills/mechanical-drawing/`
或 `~/.claude/skills/mechanical-drawing/`。）

工程里自带三台范例，**直接抄它们**：

| 范例 | 学什么 |
|---|---|
| `src/machines/coupling/` | 最小完整例子：7 零件、会转、可全剖 |
| `src/machines/macbook/` | 超薄分层堆叠体（笔记本电脑）：分层拆解、厚度放大技巧 |
| `src/machines/model3/` | 侧视轮廓拉伸的复杂装配（汽车）：滑板底盘、纵剖视、20 零件 |

---

## 第 1 步：定题（先写这五句话，放进 data.ts 文件头注释）

1. **是什么、讲什么**：一句话说清原理 + 动画要让人看懂的那个**因果**。
   （例："滑板底盘——电池包当结构件"；"螺旋传动——转一圈升一个导程"）
2. **尺寸来源**：公开图纸 / 公开规格 / 通用布局。真实产品**只用公开尺寸、不画商标**，来源写进注释和 README。
3. **单位与坐标**：一台机器**只用一种长度单位**（mm / m / 英寸）。
   **+x 朝前，+y 朝上，地面 y = 0，左右对称面放在 z = 0。**
   因为**剖视固定沿 z = 0 切掉 z > 0 的那一半（朝镜头那半）**——
   所以想让谁被剖开，就把它放在关于 z = 0 对称的位置。
   > 例外：像汽车、笔记本这种"沿长边更该剖"的东西，把**长度方向放在 x**，剖视自然就是纵剖。
4. **分级**：零件 > 约 15 个、或某个大件本身值得单独拆，就做**子组件**（见第 5 步）。
   单级零件数上限 **31**（线稿渲染器的零件编号上限）。
5. **它怎么动**：哪个零件转、哪个平移、谁和谁联动（同一相位按比例算）。

---

## 第 2 步：零件表 `PARTS: PartDef[]`

```ts
{
  id: 'casing', index: 1, name: '机匣', en: 'Engine Casing',
  role: '承力 · 包住燃气通道', material: '钛合金',
  description: '为什么这样设计：受力、定位、密封、材料选择……给具体数字。',
  explode: [0, 0, 0],   // 拆开时往哪挪（模型单位），朝"真实拆卸会拿出去的方向"
  stage: [1, 1]         // 0–1 拆解滑杆里的移动时间窗
}
```

- `index`：**1 起连续、不重复**，就是图上的零件编号（也是渲染器的零件 ID）。
- **基座零件**（不动的那个）：`explode: [0,0,0], stage: [1,1]`。
- `stage: [a,b]` 按**装配逆序**排：先拆外面的（窗早），最后拆基座附近的（窗晚）；相邻可略重叠。
- 文字：中文、短句、给数字。`role` 四到八个字。
- 螺栓组：`boltSets` + kit 的 `<Fastener set=…>`；`neighbours` 写"局部展开"时一起散的邻居。

---

## 第 3 步：几何（用 `src/machines/kit.tsx` 的积木）

每个零件一个 `<Part id>`（id 与 `PARTS` 对应），里面放几何 + 一个 `<Callout>`（引线气泡，`p` 放在零件朝镜头一侧的表面上）：

```tsx
<Part id="casing">
  <Turn k="th-casing" profile={[[r0,h0],[r1,h1],…]} axis="x" />   {/* 车削回转体 */}
  <Box c={[x,y,z]} s={[w,h,d]} />
  <Callout id="casing" p={[x,y,z]} />
</Part>
```

积木：`Box` `Span` `Cyl` `Rod`(两点间圆杆) `Turn`(车削回转体) `ArcTurn`(部分回转)
`Plate`+`poly`/`roundRect`(拉伸板) `Pipe`(沿曲线的管) `Hoop`(圆环) `Fastener`(螺栓)。
齿轮用 `src/scene/geometry.ts` 的 `gearShape`，螺纹用 `squareThread`，弹簧用 `coil`。

### ⚠️ 单位铁律（我踩过两次的坑）

**`unit` 是"模型单位 → 场景单位"的比例，引擎外层已经用它缩放过一次了。**
所以 `<Part>` 里的所有坐标和尺寸**一律写原始模型单位（mm）**，**绝对不要再乘一遍 `S`**：

```tsx
// ❌ 错：extrude 的 depth 又乘了 S，引擎再乘一次 unit → 板子小了 31 倍，看起来"消失"
<Plate depth={t * S} p={[0, y0 * S, 0]} />
// ✅ 对：全部用 mm
<Plate depth={t} p={[0, y0, 0]} />
```

判据：如果某块板/某个零件"明明建了却看不见"、或零件飞出画面，**先查这里**。

### 其他几何纪律

- **几何缓存键 `k` 全局唯一**，加机器前缀（`cp-`、`mb-`、`m3-`）。换形状必须换 `k`。
- `Turn` 的 profile 是 `(半径, 轴向位置)` 的闭合轮廓；薄壁件给外轮廓再反向接内轮廓（看 `tube()`/`cone()`/`dome()`）。
- **薄壁/空心一定要真的挖空**，否则剖开是一坨实心色块。
- **要剖开讲的内部（齿轮、流道、座椅）一定要真的建出来**，不建就什么都看不到。
- 形状在 (x,y) 平面、沿 z 拉伸的板，用 `Plate` 默认朝向（`XY_Z`）；放到某个 z 位置用 `p={[0,0,z]}`。

### ⚠️ 薄板会"消失"

沿轮廓走的**顶盖/机盖/尾门**如果只有几十毫米厚，在 3/4 透视里会退化成一条线，整车看起来像"货斗敞开"。
**给足厚度（100 mm 以上）**，并让它**严格贴合外轮廓的边**，否则会露出一条"护墙"。

---

## 第 4 步：让它动起来

- 运动状态放模块级可变对象：`export const xxxMotion = { t: 0 }`，
  由一个 `Driver` 在 `useFrame(…, -1)` 里推进，**只在 `useStudio.getState().running` 时前进**，
  `dt` 用 `Math.min(dt, 0.05)` 截断。
- 动的零件包一层 `group`，在 `useFrame` 里设 `rotation`/`position`。
  **旋转组要放在旋转中心上**：转轴偏离原点时，先用外层 group 平移到轴心再转（否则会绕原点公转）。
- 多件联动：从**同一个相位量**按比例算（主旋翼 ψ、尾桨 6ψ…），**不要各自计时**。
- 运动学写成**导出的纯函数**（`wheelAngle(s)`、`pinPosition(i, angle)`），在
  `src/machines/kinematics.test.ts` 里加测试：极限位置、对称、行程、单调性、和文字里的数字一致。
- 机器专属开关放 `Controls`（左栏），用现成样式 `<div className="strokes gears">` + `<p className="gear-note">`。

---

## 第 5 步：子组件（多层次拆解，可选）

- 子组件单独一个文件，导出**画它的组件** + 它的 `MachineDef`（`id: '<父id>/<名>'`，`parent: '<父id>'`）。
  子组件与父级用**同一种长度单位**。
- 父级里用 `<Part id="engine"><group position={…}><Turboshaft /></group></Part>` 包起来。
  嵌套的 Part 自动不上色、不显示标注，"全部展开"时按子组件自己的 `explode` 散开。
- 父级 `children: { engine: 'helicopter/engine' }`；可给这零件加 `deep: [x,y,z]`（全线展开时拉到旁边）。
- 文件末尾 `export const XXX_LEVELS = [子级们]`，在 `src/machines/index.ts` 的 `ALL` 里展开。

---

## 第 6 步：MachineDef 与注册

```ts
export const thing = level({      // 一定用 kit 的 level() 包，它按 unit 换算镜头/包围盒/轴线
  id: 'thing',
  unit: S,                        // 让整台机器在场景里约 8–14 个单位大（约 9 个单位最好看）
  bounds: [[-HL, 0, -HW], [HL, H, HW]],   // 装配态包围盒（模型单位，三视图排版用）
  name: '…', en: '…', subtitle: '装配体 · …', summary: 'N 种零件 · 一句亮点',
  drawingNo: 'GW-XX-00', scale: '1 : 10',
  parts: PARTS, boltSets: {}, neighbours: {}, guides: GUIDES, centreLines: CENTRE_LINES,
  steps: STEPS,
  camera: { target, offset, orthoDistance, exploded: { target, scale }, foci: {…} },
  Model: Thing, Driver: ThingDriver, Controls: ThingControls,
});
```

- **`unit` 怎么取**：`unit ≈ 10 / 机器最长边(模型单位)`。4694 mm 的汽车 → 0.002；313 mm 的笔记本 → 0.032。
- **镜头**：`offset` 长度 ≈ 机器最长边的 1.8–2.5 倍，从右前上方看。
  **要压低仰角**（`offset[1]` 别太大），否则看到的全是顶面，侧面和车轮会看不见。
  `exploded.scale` 1.4–2.0，按拆开后散布范围调。
- **centreLines**：`[起点, 终点, 半径?]` 给回转体/车轮画点画轴线；给半径时正对它的视图会画圆的十字中心线。
- **steps**：2–5 步。第一步装配好、会动、选中最值得看的零件；中间步 `section: true` 剖开讲原理；
  最后一步 `explode: 1` 拆开。有子组件就加"逐级深入"一步。
  > 剖视步骤**不要**再配 `focus` 特写——合着的东西拍特写什么也看不见。
- 顶层机器加进 `src/machines/index.ts` 的 `GROUPS` 合适分组；子级加进 `ALL`。

---

## 第 7 步：验收（做完一定要看，别凭感觉交）

```bash
npx tsc -b && npm test                       # 类型 + 运动学单测必须过
npm run build && npx vite preview --port 5199
node scripts/check-machines.mjs http://localhost:5199/ --only <id> --shots /tmp/shots
node scripts/make-thumbs.mjs http://localhost:5199/ --only <id>   # 目录缩略图
```

- 自检必须 **0 报错**。然后**逐张看截图**：零件飞出画面 / 被左栏挡住 / 标注叠在一起 / 子组件位置对不上。
  出画就调 `camera.exploded`（`scale` 加大、`target` 往散开方向挪）或零件的 `explode`，再截图，直到干净。
- **配色会影响判断**：蓝图配色下面和背景都是深蓝，看不出"封闭 vs 敞开"。
  **检查几何遮挡是否正确时，先切到"纸面"配色**（顶栏「蓝图」按钮切换）。
- 截图跑在软件渲染里，动画比真机慢几倍，第一步可能停在半拆状态——多等几秒再截。
- 自检脚本需要 Chromium 内核浏览器（Edge/Chrome）；用 `GEWU_BROWSER=/路径` 指定。

---

## 高频坑速查（按出现概率排序）

| 症状 | 原因 | 修法 |
|---|---|---|
| 零件飞出画面 / 板子小得看不见 | **单位双重缩放** | 模型内一律写 mm，别乘 `S` |
| 顶盖/机盖"消失"，车像货斗 | 薄板在透视里退化 | 加厚到 100 mm+，且严格贴合轮廓边 |
| 剖视里看不到内部 | 内部结构没建 / 不在 z=0 对称面 | 真的挖空、真的建、摆到对称面 |
| 剖开了是一坨实心 | 薄壁件建成实心 | 给"外轮廓 + 反向内轮廓"（`tube/cone/dome`） |
| 车轮/轮子看不见 | 被侧围挡住 / 相机仰角太高 | 轮胎略外凸，或压低 `offset[1]`，或加大轮拱切口 |
| 内饰穿出车身 | 部件高度超过覆盖件 | 把内饰压到顶盖/机盖以下 |
| 联动的零件对不上 | 各自计时 | 从同一相位量按比例算 |
| 转的零件绕原点公转 | 旋转组不在轴心上 | 外层 group 先平移到轴心再转 |
| 新加的几何形状串味 | 缓存键 `k` 重名 | 加机器前缀，换形状换 `k` |

---

## 参考

- 完整原理（轮廓提取 / 剖视 / 三视图 / 深度剥离）：本目录 `reference.md`
- 三视图投影：`src/drawing/layout.ts`
- 渲染核心：`src/scene/ink.ts`（看 `compositeFragment` 里的 `edgeAt`、`layerEdge`、`hatchLines`）
- 上游引擎：<https://github.com/G1en-114/gewu>
