#!/usr/bin/env node
/**
 * 创建一个新的 Inkwork 工程 / scaffold a new Inkwork project.
 *
 *   node .claude/skills/mechanical-drawing/create-project.mjs ./my-drawing
 *   node ~/.claude/skills/mechanical-drawing/create-project.mjs ./my-drawing
 *
 * 两种工作方式：
 *  1. 在 Inkwork 仓库内运行 → 直接复制当前仓库（去掉 node_modules / dist / .git），出图用的引擎与范例一并带走。
 *  2. 全局安装（技能目录不在仓库里）→ 先找本地已克隆的仓库，找不到再 git clone。
 *     可用 INKWORK_ROOT=/path/to/repo 指定本地仓库。
 *
 * 生成后：
 *   cd <目标目录> && npm install && npm run dev
 * 然后照 SKILL.md 用 make-machine.mjs 加新机器。
 */
import { execFileSync } from 'node:child_process';
import { cpSync, existsSync, mkdirSync, readdirSync, rmSync } from 'node:fs';
import { homedir } from 'node:os';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const REPO = 'https://github.com/orionsheep/inkwork-mechanical-drawing.git';

const SKIP = new Set(['node_modules', 'dist', '.git', '.DS_Store', 'tsconfig.app.tsbuildinfo']);

function findWorkspace(start) {
  let dir = start;
  for (let i = 0; i < 8; i += 1) {
    if (existsSync(join(dir, 'src/scene/ink.ts')) && existsSync(join(dir, 'package.json'))) return dir;
    const up = dirname(dir);
    if (up === dir) break;
    dir = up;
  }
  return null;
}

const target = resolve(process.argv[2] ?? './inkwork-project');
if (existsSync(target) && readdirSync(target).length > 0) {
  console.error(`目标目录已存在且非空：${target}`);
  process.exit(1);
}

const here = dirname(fileURLToPath(import.meta.url));

// 依次尝试：环境变量 → 当前目录往上 → 技能目录往上 → 常见克隆位置 → 克隆
const candidates = [
  process.env.INKWORK_ROOT,
  process.cwd(),
  here,
  join(homedir(), 'inkwork-mechanical-drawing'),
  join(homedir(), 'Desktop/inkwork-mechanical-drawing'),
  join(homedir(), 'Documents/inkwork-mechanical-drawing'),
].filter(Boolean);

let workspace = null;
for (const c of candidates) {
  workspace = findWorkspace(c);
  if (workspace) break;
}

if (workspace) {
  console.log(`从本地 Inkwork 仓库复制：${workspace}`);
  mkdirSync(target, { recursive: true });
  for (const entry of readdirSync(workspace)) {
    if (SKIP.has(entry)) continue;
    cpSync(join(workspace, entry), join(target, entry), { recursive: true });
  }
} else {
  console.log(`本地没有 Inkwork 仓库，改为克隆：${REPO}`);
  try {
    execFileSync('git', ['clone', '--depth', '1', REPO, target], { stdio: 'inherit' });
  } catch {
    console.error('克隆失败。请检查网络，或手动 git clone 后再运行本脚本。');
    process.exit(1);
  }
  rmSync(join(target, '.git'), { recursive: true, force: true });
}

console.log(`
✓ 工程已创建：${target}

下一步：
  cd ${target}
  npm install
  npm run dev          # 打开 http://localhost:5173

然后照 .claude/skills/mechanical-drawing/SKILL.md 加一台新机器：
  node .claude/skills/mechanical-drawing/make-machine.mjs <id> "<中文名>" "<English Name>"
`);
