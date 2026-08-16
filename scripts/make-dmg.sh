#!/bin/bash
# 把插件打进 DSH Study.app，再压成 UDZO DMG。
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

VERSION="$(node -p "require('./package.json').version")"
STAGE="$ROOT/desktop/stage"
APP="$STAGE/DSH Study.app"
CONTENTS="$APP/Contents"
DIST="$ROOT/dist"
DMG="$DIST/DSH-Study-${VERSION}.dmg"
ICON_SRC="$ROOT/desktop/icon-source.jpg"

if [ ! -f "$ROOT/lib/client.js" ] || [ ! -f "$ROOT/lib/index.js" ]; then
  echo "missing lib/ — run npm run build first" >&2
  exit 1
fi

rm -rf "$STAGE"
mkdir -p "$CONTENTS/MacOS" "$CONTENTS/Resources/plugin" "$DIST"

cp "$ROOT/desktop/Info.plist" "$CONTENTS/Info.plist"
cp "$ROOT/desktop/dsh-study" "$CONTENTS/MacOS/dsh-study"
chmod 755 "$CONTENTS/MacOS/dsh-study"

# 运行时只带预构建插件，不带 src / three
cp "$ROOT/package.json" "$ROOT/cordis.patch.yml" "$ROOT/skin.json" \
  "$ROOT/LICENSE" "$ROOT/NOTICE" "$CONTENTS/Resources/plugin/"
cp -R "$ROOT/lib" "$CONTENTS/Resources/plugin/lib"

if [ -f "$ICON_SRC" ]; then
  ICONSET="$ROOT/desktop/icon.iconset"
  rm -rf "$ICONSET"
  mkdir -p "$ICONSET"
  sips -s format png "$ICON_SRC" --out "$ROOT/desktop/icon.png" >/dev/null
  for size in 16 32 64 128 256 512 1024; do
    sips -z "$size" "$size" "$ROOT/desktop/icon.png" --out "$ICONSET/icon_${size}x${size}.png" >/dev/null
  done
  cp "$ICONSET/icon_32x32.png" "$ICONSET/icon_16x16@2x.png"
  cp "$ICONSET/icon_64x64.png" "$ICONSET/icon_32x32@2x.png"
  cp "$ICONSET/icon_256x256.png" "$ICONSET/icon_128x128@2x.png"
  cp "$ICONSET/icon_512x512.png" "$ICONSET/icon_256x256@2x.png"
  cp "$ICONSET/icon_1024x1024.png" "$ICONSET/icon_512x512@2x.png"
  iconutil -c icns "$ICONSET" -o "$CONTENTS/Resources/AppIcon.icns"
  rm -rf "$ICONSET"
fi

cp "$ROOT/desktop/install-plugin.command" "$STAGE/安装其他插件.command"
chmod 755 "$STAGE/安装其他插件.command"
cp "$ROOT/desktop/使用说明.txt" "$STAGE/使用说明.txt"
ln -s /Applications "$STAGE/Applications"

# 去掉隔离属性，再做 ad-hoc 签名（未公证，用户仍需右键打开）
xattr -cr "$APP" || true
if command -v codesign >/dev/null 2>&1; then
  codesign --force --deep -s - "$APP" 2>/dev/null || true
fi

rm -f "$DMG"
hdiutil create \
  -volname "DSH Study" \
  -srcfolder "$STAGE" \
  -ov -format UDZO \
  "$DMG"

echo "wrote $DMG"
ls -lh "$DMG"
