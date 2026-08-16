# TODO：自包含 macOS DMG

目标：双击就能用的「质感书房」DSH，普通用户 **不必安装 Node**，也 **不必 `npx` 下载官方包**。别人若要再装插件，是往这份打包好的 DSH 里装，不是再装一套开发环境。

当前 `desktop/` 里的启动器 **不算完成**，不要当发行物。它只是壳：还要本机 Node + pnpm，首次再拉 `@deepseek-ai/dsh`。对普通用户没意义。

还缺：

- [ ] 把官方 DSH（Node 运行时 + `@deepseek-ai/dsh` 及 web profile 依赖）打进 `.app`，离线可启动
- [ ] 书房插件预装在这份 profile 里，不依赖用户全局 `~/.dsh`
- [ ] 体积、更新、签名 / 公证
- [ ] 在这份 DSH 里继续 `dsh plugin add` 装别人的插件
- [ ] README 恢复「方式一：DMG」并提供 Release 资源

在此之前：只发布插件；不要把 `dist/*.dmg` 挂到 Release。
