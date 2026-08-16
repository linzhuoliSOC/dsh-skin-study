# 质感书房 / dsh-skin-study

DeepSeek Harness Web 的 3D 书房皮肤：奶油墙、浅木家具、第一人称走动，出门是插件内的体素郊野。不依赖 `@linxin666/dsh-web-ui-all`，也不需要插画版皮肤。

两种安装方式，选一种即可。

---

## 方式一：DMG（自带一份独立的 DSH）

适合还没装官方 DSH，或想单独开一份「带书房」的 DSH。别人也可以再往这份里装别的插件。

1. 下载本仓库 [Releases](https://github.com/linzhuoliSOC/dsh-skin-study/releases) 里的 `DSH-Study-0.1.0.dmg`，或用仓库里的 `dist/DSH-Study-0.1.0.dmg`。
2. 打开 DMG，把 **DSH Study** 拖进「应用程序」。
3. 第一次打开：按住 Control 点图标 →「打开」（未做 Apple 公证）。
4. 本机需要 [Node.js 22+](https://nodejs.org/) 和网络。首次启动会用 `npx` 下载官方 `@deepseek-ai/dsh`，可能要一两分钟。
5. 浏览器打开 [http://127.0.0.1:3180/](http://127.0.0.1:3180/)（故意不用 3080，以免和官方那份抢端口）。

这份 App 的数据在：

```text
~/Library/Application Support/DSH Study/
```

和官方默认的 `~/.dsh` **完全分开**，互不影响。

### 给这份 DMG 再装其他插件

DMG 里有 **「安装其他插件.command」**，双击后填：

```text
github:用户名/仓库
```

或本机路径，例如 `/Users/你/某个插件`。

也可以自己在终端执行：

```sh
export DSH_HOME="$HOME/Library/Application Support/DSH Study"
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
npx --yes @deepseek-ai/dsh plugin --profile web add github:用户名/仓库
```

装完刷新浏览器即可。

---

## 方式二：只当插件，装进已有的官方 DSH

适合已经在用官方 CLI、官方 DMG、或 `npx @deepseek-ai/dsh web` 的人。书房会进你现有的 `web` profile。

```sh
git clone https://github.com/linzhuoliSOC/dsh-skin-study.git
cd dsh-skin-study
dsh plugin --profile web add "link:$PWD"
```

没有 `dsh` 命令时：

```sh
npx --yes @deepseek-ai/dsh plugin --profile web add "link:$PWD"
```

重启 DSH（或等补丁热加载），然后 **强制刷新浏览器**（⌘⇧R）。右下角应出现「进入书房」。

`lib/` 已经预构建，安装时不用编译，也不用再装 `three`。

---

## 怎么用

| 操作 | 说明 |
|---|---|
| 进入书房 | 点右下角「进入书房」，收起工作区 |
| 走动 / 跳跃 | WASD / 空格 |
| 转头 | 点一下画面锁定鼠标后移动；Esc 解开（浏览器会提示） |
| 打开工作区 | 走进去后 **点书桌** |
| 去屋外 | 走到门边（点门只会砸门，要走近才出门） |
| 屋外 | 左键挖、右键放、1–6 选格子、滚轮切格子 |

没有 WebGL 时会退回内置插画背景，不会白屏。

---

## 依赖

| 要什么 | 谁提供 |
|---|---|
| DeepSeek Harness Web | 官方 CLI / 官方 DMG / 本仓库 DMG 首次启动下载 |
| 浏览器 WebGL | 系统自带，不是插件 |
| 其它皮肤、全家桶、插画版 | **不要** |

---

## 自己打 DMG

在 macOS 上：

```sh
bash scripts/make-dmg.sh
```

产物：`dist/DSH-Study-0.1.0.dmg`。改皮肤源码后先 `npm run build`（需要本机有一份 DSH 源码或 esbuild），再打 DMG。

---

## 许可

皮肤本身是 Apache-2.0。DMG 启动器会在运行时下载官方 DeepSeek Harness（MIT，DeepSeek），不把官方程序打进镜像。
