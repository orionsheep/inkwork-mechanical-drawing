#!/usr/bin/env bash
# 安装 mechanical-drawing 技能到用户级目录，之后任意目录都能用。
#
#   ./install.sh              # 安装到 ~/.claude/skills/（Claude Code）
#   ./install.sh --codex      # 同时安装到 ~/.codex/skills/（Codex）
#   ./install.sh --uninstall  # 卸载
#
# 也可以直接在克隆下来的仓库里工作——仓库自带 `.claude/skills/mechanical-drawing/`，
# 打开这个目录就能被自动发现，无需安装。
set -euo pipefail

SRC="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)/.claude/skills/mechanical-drawing"
NAME="mechanical-drawing"
TARGETS=("$HOME/.claude/skills")
WANT_CODEX=0
UNINSTALL=0

for arg in "$@"; do
  case "$arg" in
    --codex) WANT_CODEX=1 ;;
    --uninstall) UNINSTALL=1 ;;
    -h|--help) sed -n '2,9p' "$0"; exit 0 ;;
    *) echo "未知参数：$arg"; exit 1 ;;
  esac
done

if [ "$WANT_CODEX" = "1" ]; then
  TARGETS+=("$HOME/.codex/skills")
fi

if [ "$UNINSTALL" = "1" ]; then
  for base in "${TARGETS[@]}"; do
    if [ -d "$base/$NAME" ]; then
      rm -rf "$base/$NAME"
      echo "✓ 已卸载：$base/$NAME"
    fi
  done
  exit 0
fi

if [ ! -f "$SRC/SKILL.md" ]; then
  echo "找不到技能源目录：$SRC"
  echo "请在克隆下来的仓库根目录运行 ./install.sh"
  exit 1
fi

for base in "${TARGETS[@]}"; do
  mkdir -p "$base"
  rm -rf "$base/$NAME"
  cp -R "$SRC" "$base/$NAME"
  echo "✓ 已安装：$base/$NAME"
done

cat <<'EOF'

用法：
  1) 新建一个工程（任意目录）：
       node ~/.claude/skills/mechanical-drawing/create-project.mjs ./my-drawing
       cd my-drawing && npm install && npm run dev

  2) 然后在装了技能的这个工程里，直接对 agent 说：
       「画一台 XX 的机械制图」「给这个加个剖视图」「做成爆炸图」

  想在某个已有工程里加机器：
       node ~/.claude/skills/mechanical-drawing/make-machine.mjs <id> "<中文名>" "<English Name>"
     （需要在该工程目录下运行，或先设 INKWORK_ROOT=/path/to/project）

卸载：./install.sh --uninstall
EOF
