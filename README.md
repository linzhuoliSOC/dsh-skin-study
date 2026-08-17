DeepSeek Harness Web 的 3D 书房皮肤：奶油墙、浅木家具、第一人称走动，可出书房探索。

A 3D study room skin for DeepSeek Harness Web: cream walls, light wood furniture, first-person walking, and you can leave the study to explore.

当前只发布 **插件**。装进你已经在用的官方 DSH 即可：CLI、源码，或 **官方自己的 DMG / 桌面版** 都行。插件写进用户数据目录（一般是 `~/.dsh`），不会改官方 `.app`。

Currently only the **plugin** is released. Install it into your existing official DSH: CLI, source, or the **official DMG/desktop version** all work. The plugin is written into the user data directory (usually `~/.dsh`) and does not modify the official `.app`.

------

## 安装（插件）

## Installation (Plugin)

sh

```
git clone https://github.com/linzhuoliSOC/dsh-skin-study.git
cd dsh-skin-study
dsh plugin --profile web add "link:$PWD"
```



没有 `dsh` 命令时：

If you don't have the `dsh` command:

sh

```
npx --yes @deepseek-ai/dsh plugin --profile web add "link:$PWD"
```



重启 DSH（或等补丁热加载），然后 **强制刷新浏览器**（⌘⇧R）。右下角应出现「进入书房」。建议使用浅色模式。

Restart DSH (or wait for hot reload of the patch), then **force refresh the browser** (⌘⇧R). “Enter Study” should appear in the bottom right corner. Light mode is recommended.

`lib/` 已经预构建，安装时不用编译，也不用再装 `three`。

`lib/` is already prebuilt, so installation requires no compilation and no separate installation of `three`.

### 官方 DMG / 桌面版

### Official DMG / Desktop Version

官方打包好的 DSH 一样可以装这个插件，不必等本仓库做自包含 DMG。

The officially packaged DSH can also install this plugin; you don't need to wait for this repository to produce a self-contained DMG.

1. 先能打开官方那份 DSH Web（桌面版或它打开的浏览器页）。
2. 用官方附带的终端 / 命令行，或本机已有的 `dsh`，执行上面同一组命令。
3. 若桌面版没有把 `dsh` 放进 PATH，用 `npx --yes @deepseek-ai/dsh plugin --profile web add "link:$PWD"`。
4. 重启官方 DSH，浏览器强制刷新。
5. First, make sure you can open the official DSH Web (desktop version or the browser page it opens).
6. Use the terminal / command line that comes with the official version, or an existing local `dsh`, and run the same set of commands above.
7. If the desktop version does not add `dsh` to your PATH, use `npx --yes @deepseek-ai/dsh plugin --profile web add "link:$PWD"`.
8. Restart the official DSH and force refresh the browser.

装上后书房和官方其它插件一起活在 `~/.dsh/profiles/web`，再装别人的插件也是同一条 `dsh plugin --profile web add …`。

After installation, the study room lives together with other official plugins in `~/.dsh/profiles/web`; installing plugins from others uses the same command: `dsh plugin --profile web add …`.

------

## 怎么用

## Usage

| 操作 (Action)             | 说明 (Description)                                           |
| :------------------------ | :----------------------------------------------------------- |
| 进入书房 Enter Study      | 点右下角「进入书房」，收起工作区 Click “Enter Study” in the bottom right corner to collapse the workspace |
| 走动 / 跳跃 Move / Jump   | WASD / 空格 WASD / Space                                     |
| 转头 Look                 | 点一下画面锁定鼠标后移动；Esc 解开（浏览器会提示） Click the scene to lock the mouse and move; press Esc to release (the browser will prompt) |
| 打开工作区 Open Workspace | 走进去后 **点书桌** After walking in, **click the desk**     |
| 去屋外 Go Outside         | 走到门边（点门只会砸门，要走近才出门） Walk to the door (clicking the door only knocks; walk close to go out) |
| 屋外 Outside              | 左键挖、右键放、1–6 选格子、滚轮切格子 Left-click dig, right-click place, 1–6 select slot, scroll wheel switch slot |

没有 WebGL 时会退回内置插画背景，不会白屏。

If WebGL is unavailable, it falls back to the built-in illustration background, so there is no blank screen.

------

## 依赖

## Dependencies

| 要什么 (Requirement)                                         | 谁提供 (Provided by)                                 |
| :----------------------------------------------------------- | :--------------------------------------------------- |
| DeepSeek Harness Web                                         | 你已有的官方安装 Your existing official installation |
| 浏览器 WebGL Browser WebGL                                   | 系统自带，不是插件 System-provided, not a plugin     |
| 其它皮肤、全家桶、插画版 Other skins, bundles, illustration versions | **不要** **Not needed**                              |

------

## TODO：自包含 DMG

## TODO: Self-contained DMG

真正有意义的 DMG 应是 **整份可双击运行的 DSH**（运行时、官方 web、书房皮肤打在一起），用户不用先装 Node，也不用 `npx` 再拉官方包。现在还没有做到这一步，**先不发布 DMG**。草稿和缺口见 [desktop/TODO.md](https://desktop/TODO.md)。

A truly meaningful DMG should be a **complete double-clickable DSH** (runtime, official web, and study skin bundled together), so users don't need to install Node first or use `npx` to pull the official package again. This has not been achieved yet, so **no DMG is released for now**. See [desktop/TODO.md](https://desktop/TODO.md) for drafts and gaps.

------

## 许可

## License

Apache-2.0.
