#!/bin/bash
# 给「质感书房」这份独立 DSH 再装其他插件。
set -u
export PATH="/opt/homebrew/bin:/usr/local/bin:$HOME/.local/bin:$HOME/.dsh/bin:$PATH"
export DSH_HOME="${DSH_HOME:-$HOME/Library/Application Support/DSH Study}"
cd "$HOME" || exit 1

SPEC="$(/usr/bin/osascript <<'APPLESCRIPT'
try
  set answer to text returned of (display dialog "装进「质感书房」这份 DSH（不是官方 ~/.dsh）。

填写 github:用户/仓库，或本机插件文件夹路径：" default answer "github:" with title "安装其他插件")
  return answer
on error
  return ""
end try
APPLESCRIPT
)"

if [ -z "${SPEC}" ]; then
  exit 0
fi

if ! command -v node >/dev/null 2>&1 || ! command -v pnpm >/dev/null 2>&1; then
  /usr/bin/osascript -e 'display dialog "请先打开一次「DSH Study」，完成 Node / pnpm / 官方 DSH 的首次安装。" buttons {"好"} default button 1 with title "安装其他插件"' >/dev/null
  exit 1
fi

if [ -d "${SPEC}" ]; then
  ARG="link:${SPEC}"
else
  ARG="${SPEC}"
fi

npx --yes @deepseek-ai/dsh plugin --profile web add "$ARG"
status=$?
if [ "$status" -eq 0 ]; then
  /usr/bin/osascript -e 'display dialog "装好了。回到浏览器强制刷新（⌘⇧R）。" buttons {"好"} default button 1 with title "安装其他插件"' >/dev/null
else
  /usr/bin/osascript -e "display dialog \"安装失败（退出码 ${status}）。可看 ~/Library/Application Support/DSH Study/launch.log\" buttons {\"好\"} default button 1 with title \"安装其他插件\"" >/dev/null
fi
exit "$status"
