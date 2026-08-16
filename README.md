# 质感书房 / dsh-skin-study

DeepSeek Harness Web 的 3D 书房皮肤：奶油墙、浅木家具、第一人称走动，出门是插件内的体素郊野。不依赖 `@linxin666/dsh-web-ui-all`，也不需要插画版皮肤。

当前只发布 **插件**。装进你已经在用的官方 DSH（CLI、源码，或官方自己的桌面包）即可。

---

## 安装（插件）

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
| DeepSeek Harness Web | 你已有的官方安装 |
| 浏览器 WebGL | 系统自带，不是插件 |
| 其它皮肤、全家桶、插画版 | **不要** |

---

## TODO：自包含 DMG

真正有意义的 DMG 应是 **整份可双击运行的 DSH**（运行时、官方 web、书房皮肤打在一起），用户不用先装 Node，也不用 `npx` 再拉官方包。现在还没有做到这一步，**先不发布 DMG**。草稿和缺口见 [desktop/TODO.md](desktop/TODO.md)。

---

## 许可

Apache-2.0。
