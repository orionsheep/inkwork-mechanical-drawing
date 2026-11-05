# NOTICE · 来源与派生说明

## 上游项目

本仓库的**线稿渲染引擎**（`src/scene/`、`src/drawing/`、`src/components/`、`src/styles/`、
`src/machines/kit.tsx`、`src/machines/types.ts`、`index.html`、`vite.config.mjs`、
`scripts/` 中的自检与缩略图脚本、`public/fonts/` 字体子集）派生自：

- **gewu / Inkwork** — <https://github.com/G1en-114/gewu>
  面向《工程制图》教学的线稿风格 3D 装配体图版。

我们尊重并感谢原作者的工作。上游仓库的许可证以该仓库自身声明为准；
若上游后续声明了不同的许可条款，请以 upstream 为准，并联系我们调整本仓库的许可。

## 本仓库的改动

1. **抽取为可安装技能**：新增 `.claude/skills/mechanical-drawing/`（`SKILL.md`、`reference.md`、
   `make-machine.mjs`、`create-project.mjs`、`template.tsx`）与 `install.sh`。
2. **新增两台范例机器**：
   - `src/machines/macbook/` — MacBook Pro 14"（16 零件，分层拆解 + 全剖 + 厚度放大）
   - `src/machines/model3/` — Tesla Model 3（20 零件，滑板底盘纵剖 + 爆炸拆解）
   （联轴器 `coupling` 亦为新写的最小范例。）
3. **移除**上游的其余 40 余台机器与视频脚本，只保留最小可扩展底座与三台范例。
4. **跨平台**：`scripts/edge.mjs` 支持 macOS / Linux 的 Chrome/Chromium（原为 Windows Edge 专用），
   并支持 `GEWU_BROWSER` 指定浏览器路径。
5. **新增文档**：`docs/GUIDE.md`（核心原理）、本 README、截图。

## 尺寸与商标

仓库内所有机器的尺寸取自**公开规格、公开图纸或公开拆解资料**，用于教学示意：

| 机器 | 尺寸来源 |
|---|---|
| 特斯拉 Model 3 | 公开规格：4694 × 1850 × 1443 mm，轴距 2875 mm；内部布局按公开拆解资料估读 |
| MacBook Pro 14" | 公开外形尺寸 312.6 × 221.2 × 15.5 mm；内部按 Apple 官方爆炸图与 iFixit 拆解指南估读 |
| 弹性柱销联轴器 | GB/T 5014 通用结构，非具体型号 |

**本仓库不包含任何厂商商标、标志或受保护的外观设计**；所有几何均为按公开尺寸重建的示意模型。
相关名称仅用于说明所参照的公开规格，权利归各自所有者。

## 字体

`public/fonts/` 内为 Noto Serif SC 与 Cormorant Garamond 的子集（woff2），
分别以 SIL Open Font License 1.1 发布。
