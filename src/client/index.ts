/**
 * 质感书房 (Cozy Study) 第四轮：新增用户可调设置面板。
 * 背景为 Three.js 3D 互动书房（study-3d.ts），磨砂面板浮在 3D 房间之上。
 * 「3D 漫游」悬浮按钮 / Esc 切换 body[data-dsh-study-roam]：漫游时容器
 * pointer-events:auto、面板 pointer-events:none，可拖拽旋转、滚轮缩放。
 * MutationObserver 监听 body[data-ds-dark-theme] 切换 3D 主题；页面隐藏暂停
 * 渲染循环。WebGL 失败时回退到内联 SVG 背景，不白屏。
 * 第四轮：localStorage dsh.study.opts 持久化用户设置——遮罩透明度/磨砂走
 * body CSS 变量 --dsh-skin-frame-alpha/--dsh-skin-frame-blur（study.css 磨砂
 * 规则消费），OrbitControls 灵敏度/自动巡航走 room.applyControls()；左下角
 * 「⚙ 设置」按钮弹浮层，拖动即时生效并持久化。
 * 第五轮：零学习成本交互——方向键旋转、+/- 缩放、R 重置（input/textarea/
 * contenteditable 里不响应）；Alt+拖拽旋转、Alt+滚轮缩放（window 级，
 * preventDefault 防选中）；3D 首次生效弹底部提示条（约 7 秒淡出、可关，
 * 本页会话只弹一次）；漫游按钮文案改「3D 漫游 · 拖拽/滚轮」。
 * 第六轮：自动巡航改钟摆式往返摆动（study-3d.ts updateCruise，弃用
 * OrbitControls.autoRotate）；设置面板 autoRotate 字段语义改为摆动开关
 * （兼容旧值），新增「摆动幅度」滑块 cruiseAmplitude 0.4~1.2（默认 1.0=
 * 摆满方位角限位）；交互/漫游暂停摆动、松手后从当前方位继续。
 * 第九轮：巡航按真实时间推进，背景限 30fps、漫游/拖拽 60fps；静止且
 * 未巡航时跳过 submit。观感几乎不变，避开 ProMotion 120Hz 空转。
 * 第十轮：一键收起工作区（左栏/中间/右栏）进入书房；点击书桌或 Esc
 * 再展开。body[data-dsh-study-immersed] 驱动 CSS，偏好写入 localStorage。
 * 第十一轮：书房里第一人称走动（WASD + 鼠标锁定），无角色模型。
 * 第十二轮：点/走近房门淡入插件内体素郊野（不跳页、不复用外部 html），
 * 屋外木门再回书房。会话仍在，回屋点书桌即可打开工作区。
 * apply/dispose 契约：一切注入物与监听都在 ctx.effect 的 disposer 里收回。
 */
import css from './study.css'
import { STUDY_ART_DARK, STUDY_ART_LIGHT } from './study-art'
import { createStudyRoom } from './study-3d'
import { createOutsideWorld, OUTSIDE_HOTBAR, type OutsideWorld } from './outside-world'
import { createGamepadBridge, type GamepadBridgeHandle } from './gamepad-input'

/** Cordis 上下文的最小结构：本皮肤只用到 effect 的生命周期。 */
interface SkinContext {
  effect: (fn: () => () => void, title: string) => unknown
}

/** 把内联 SVG 转成 CSS 可用的 url("data:image/svg+xml,...") 值（无静态资源文件）。 */
function toArtUrl(svg: string): string {
  return `url("data:image/svg+xml;utf8,${encodeURIComponent(svg)}")`
}

/* ---- 用户设置（localStorage dsh.study.opts） ---- */

/** 可调字段与默认值（与插画版皮肤共用的协议）。 */
interface StudyOpts {
  frameAlpha: number // 遮罩透明度 0~0.35
  frameBlur: number // 磨砂模糊 px 0~30
  rotateSpeed: number // OrbitControls 旋转灵敏度（1=默认）
  zoomSpeed: number // OrbitControls 缩放灵敏度（1=默认）
  autoRotate: boolean // 自动巡航开关（第六轮起=钟摆式往返摆动）
  autoRotateSpeed: number // 巡航速度 0.1~2
  cruiseAmplitude: number // 摆动幅度 0.4~1.2（1.0=摆满方位角限位）
}
const DEFAULT_OPTS: StudyOpts = {
  frameAlpha: 0.05, frameBlur: 8, rotateSpeed: 1.0, zoomSpeed: 1.0,
  autoRotate: true, autoRotateSpeed: 0.35, cruiseAmplitude: 1.0,
}
const OPTS_KEY = 'dsh.study.opts'
const IMMERSED_KEY = 'dsh.study.immersed'
const WORLD_KEY = 'dsh.study.world'

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v))

/** 读 localStorage 并合并默认值：字段缺失/类型不对就回退默认，数字做范围钳制。 */
function loadOpts(): StudyOpts {
  const o = { ...DEFAULT_OPTS }
  try {
    const raw = localStorage.getItem(OPTS_KEY)
    if (!raw) return o
    const s = JSON.parse(raw) as Partial<Record<keyof StudyOpts, unknown>> | null
    if (!s || typeof s !== 'object') return o
    if (typeof s.frameAlpha === 'number' && Number.isFinite(s.frameAlpha)) o.frameAlpha = clamp(s.frameAlpha, 0, 0.35)
    if (typeof s.frameBlur === 'number' && Number.isFinite(s.frameBlur)) o.frameBlur = clamp(s.frameBlur, 0, 30)
    if (typeof s.rotateSpeed === 'number' && Number.isFinite(s.rotateSpeed)) o.rotateSpeed = clamp(s.rotateSpeed, 0.1, 3)
    if (typeof s.zoomSpeed === 'number' && Number.isFinite(s.zoomSpeed)) o.zoomSpeed = clamp(s.zoomSpeed, 0.25, 4)
    if (typeof s.autoRotate === 'boolean') o.autoRotate = s.autoRotate
    if (typeof s.autoRotateSpeed === 'number' && Number.isFinite(s.autoRotateSpeed)) o.autoRotateSpeed = clamp(s.autoRotateSpeed, 0.1, 2)
    if (typeof s.cruiseAmplitude === 'number' && Number.isFinite(s.cruiseAmplitude)) o.cruiseAmplitude = clamp(s.cruiseAmplitude, 0.4, 1.2)
  } catch { /* localStorage 不可用/JSON 损坏：用默认值 */ }
  return o
}

/** 持久化（失败静默：隐私模式等场景下降级为仅本次会话生效）。 */
function saveOpts(o: StudyOpts): void {
  try {
    localStorage.setItem(OPTS_KEY, JSON.stringify(o))
  } catch { /* ignore */ }
}

/**
 * Apply the Cozy Study skin: body attribute, fallback illustration CSS
 * variables, inlined stylesheet, ambience layer, the 3D study-room canvas,
 * and the roam toggle button. Everything written here is retracted by the
 * effect disposer on dispose. No services, no events — the skin only ever
 * touches the DOM.
 * @param ctx - owning context (the effect lifecycle owns retraction).
 */
export function apply(ctx: SkinContext): void {
  const body = document.body
  body.dataset.dshStudy = ''
  try { localStorage.setItem('dsh.study.mode', '3d') } catch { /* ignore */ }

  // 手柄桥初始化器：提升到 try 外声明，try 内赋值，调用处判空——
  // 避免 3D 初始化失败（try 中途 throw）时 "initGamepad is not defined"。
  let initGamepad: (() => void) | null = null

  // WebGL 失败时用内联图当背景，不白屏。
  body.style.setProperty('--dsh-study-art-light', toArtUrl(STUDY_ART_LIGHT))
  body.style.setProperty('--dsh-study-art-dark', toArtUrl(STUDY_ART_DARK))

  const styles = document.createElement('style')
  styles.dataset.plugin = 'dsh-skin-study'
  styles.dataset.pluginCss = 'dsh-skin-study/study.css'
  styles.textContent = css
  document.head.appendChild(styles)

  // 房间氛围层：左上暖光 + 四角轻暗角，让各区域像处在同一束光里。
  const ambience = document.createElement('div')
  ambience.dataset.dshStudyAmbience = ''
  ambience.dataset.skinChrome = 'ambience'
  ambience.setAttribute('aria-hidden', 'true')
  body.appendChild(ambience)

  /* ---- 3D 书房：WebGL 可用才接管背景；失败则留下内联图，不白屏 ---- */
  type Room = ReturnType<typeof createStudyRoom>
  let room: Room | null = null
  let container: HTMLDivElement | null = null
  let roamBtn: HTMLButtonElement | null = null
  let hideBtn: HTMLButtonElement | null = null
  let observer: MutationObserver | null = null
  let raf = 0
  let onVis: (() => void) | null = null
  let onKey: ((e: KeyboardEvent) => void) | null = null
  let onEscStudy: ((e: KeyboardEvent) => void) | null = null
  let onBtn: (() => void) | null = null
  let onHideBtn: (() => void) | null = null
  let onCanvasDown: ((e: PointerEvent) => void) | null = null
  let onCanvasUp: ((e: PointerEvent) => void) | null = null
  let onCanvasMove: ((e: PointerEvent) => void) | null = null
  let onWalkKey: ((e: KeyboardEvent) => void) | null = null
  let onLookMove: ((e: MouseEvent) => void) | null = null
  let onLockChange: (() => void) | null = null
  // 第五轮：键盘 / Alt+拖拽 / Alt+滚轮 监听器与提示条资源（仅 3D 就绪后挂上）
  let onKeys: ((e: KeyboardEvent) => void) | null = null
  let onAltDown: ((e: PointerEvent) => void) | null = null
  let onAltMove: ((e: PointerEvent) => void) | null = null
  let onAltUp: ((e: PointerEvent) => void) | null = null
  let onAltWheel: ((e: WheelEvent) => void) | null = null
  let altDragId = -1
  let hint: HTMLDivElement | null = null
  let hintTimer = 0
  let hintGoneTimer = 0
  let canvasDrag = false
  let ptrDownX = 0
  let ptrDownY = 0
  let world: 'study' | 'outside' = 'study'
  let outside: OutsideWorld | null = null
  let gamepad: GamepadBridgeHandle | null = null
  let fadeEl: HTMLDivElement | null = null
  let crosshairEl: HTMLDivElement | null = null
  let toastEl: HTMLDivElement | null = null
  let hotbarEl: HTMLDivElement | null = null
  let onHotbarWheel: ((e: WheelEvent) => void) | null = null
  let onPointerUpWin: ((e: PointerEvent) => void) | null = null
  let syncAim: () => void = () => {}
  let toastTimer = 0
  let doorLockUntil = 0
  let fading = false
  let ignoreHotspotUntil = 0

  /* ---- 第十三轮：家具交互（模拟人生式）。desk/door 保持原有行为，其余家具触发 LLM 能力 ---- */
  /** 可交互家具 id → 展示信息。desk/door 是原有导航行为，不在 LLM 交互范围内。 */
  const FURNITURE: Record<string, { name: string; hint: string }> = {
    window: { name: '窗户', hint: '看看窗外天气' },
    sofa: { name: '沙发', hint: '泡点灵感' },
    bed: { name: '小床', hint: '睡前复盘' },
    shelf: { name: '书架', hint: '抽一本书' },
    tea: { name: '茶杯', hint: '饮一盏茶' },
    globe: { name: '地球仪', hint: '看看世界' },
    notepad: { name: '便签', hint: '今日建议' },
    scroll: { name: '卷轴', hint: '今日一帖' },
    desk: { name: '书桌', hint: '打开工作区' },
    door: { name: '房门', hint: '出门走走' },
  }
  let interactBusy = false // 单飞锁：请求中屏蔽其他家具交互
  let interactionEl: HTMLDivElement | null = null // 当前正在生成的家具飘字
  let interactionLayerEl: HTMLDivElement | null = null
  const interactionTimers = new Set<number>()
  let labelEl: HTMLDivElement | null = null // 准星下方的家具名牌

  /* ---- 用户设置：⚙ 按钮 + 浮层（纯 DOM），拖动即时生效并写 localStorage ---- */
  const opts = loadOpts()

  /** 把当前 opts 套到页面：CSS 变量到 body，3D 参数到 room（漫游态靠 pauseCruise 保持暂停，无需额外处理）。 */
  const applyOpts = () => {
    body.style.setProperty('--dsh-skin-frame-alpha', String(opts.frameAlpha))
    body.style.setProperty('--dsh-skin-frame-blur', `${opts.frameBlur}px`)
    room?.applyControls(opts)
  }
  const onOptsChange = () => {
    applyOpts()
    saveOpts(opts)
  }

  const settingsBtn = document.createElement('button')
  settingsBtn.type = 'button'
  settingsBtn.textContent = '⚙ 设置'
  settingsBtn.dataset.dshStudySettingsBtn = ''
  settingsBtn.dataset.skinChrome = 'settings-btn'
  settingsBtn.setAttribute('aria-label', '书房皮肤设置')
  settingsBtn.setAttribute('aria-expanded', 'false')

  const panel = document.createElement('div')
  panel.dataset.dshStudySettings = ''
  panel.dataset.skinChrome = 'settings-panel'
  panel.setAttribute('role', 'dialog')
  panel.setAttribute('aria-label', '书房皮肤设置')
  panel.hidden = true
  const panelTitle = document.createElement('div')
  panelTitle.dataset.dshStudySettingsTitle = ''
  panelTitle.textContent = '书房设置'
  panel.appendChild(panelTitle)

  /** 造一行滑块：标签 + 当前值 + range；get/set 以滑块坐标读写 opts，fmt 渲染当前值。 */
  const mkSlider = (
    label: string, min: number, max: number, step: number,
    get: () => number, set: (v: number) => void, fmt: (v: number) => string,
  ) => {
    const row = document.createElement('label')
    row.dataset.dshStudySettingsRow = ''
    const name = document.createElement('span')
    name.dataset.dshStudySettingsName = ''
    name.textContent = label
    const val = document.createElement('span')
    val.dataset.dshStudySettingsVal = ''
    const input = document.createElement('input')
    input.type = 'range'
    input.min = String(min)
    input.max = String(max)
    input.step = String(step)
    const sync = () => {
      const v = get()
      input.value = String(v)
      val.textContent = fmt(v)
    }
    input.addEventListener('input', () => {
      set(Number(input.value))
      val.textContent = fmt(get())
      onOptsChange()
    })
    sync()
    row.append(name, val, input)
    panel.appendChild(row)
    return { sync, input }
  }

  // 遮罩透明度：滑块 0~100 映射 0~0.35，显示实际透明度百分比
  const alphaSlider = mkSlider(
    '遮罩透明度', 0, 100, 1,
    () => Math.round((opts.frameAlpha / 0.35) * 100),
    (v) => { opts.frameAlpha = (v / 100) * 0.35 },
    (v) => `${Math.round(v * 0.35)}%`,
  )
  const blurSlider = mkSlider(
    '磨砂模糊', 0, 30, 1,
    () => Math.round(opts.frameBlur),
    (v) => { opts.frameBlur = v },
    (v) => `${v}px`,
  )
  const rotateSlider = mkSlider(
    '旋转灵敏度', 0.1, 3, 0.05,
    () => opts.rotateSpeed,
    (v) => { opts.rotateSpeed = v },
    (v) => `×${Number(v.toFixed(2))}`,
  )
  const zoomSlider = mkSlider(
    '缩放灵敏度', 0.25, 4, 0.05,
    () => opts.zoomSpeed,
    (v) => { opts.zoomSpeed = v },
    (v) => `×${Number(v.toFixed(2))}`,
  )

  // 自动巡航：checkbox + 速度滑块（关掉巡航时速度禁用）
  const autoRow = document.createElement('label')
  autoRow.dataset.dshStudySettingsRow = ''
  const autoName = document.createElement('span')
  autoName.dataset.dshStudySettingsName = ''
  autoName.textContent = '自动巡航'
  const autoCheck = document.createElement('input')
  autoCheck.type = 'checkbox'
  autoCheck.checked = opts.autoRotate
  autoRow.append(autoName, autoCheck)
  panel.appendChild(autoRow)
  const speedSlider = mkSlider(
    '巡航速度', 0.1, 2, 0.05,
    () => opts.autoRotateSpeed,
    (v) => { opts.autoRotateSpeed = v },
    (v) => `×${Number(v.toFixed(2))}`,
  )
  // 第六轮：摆动幅度滑块（0.4~1.2，默认 1.0=摆满方位角限位范围）
  const ampSlider = mkSlider(
    '摆动幅度', 0.4, 1.2, 0.05,
    () => opts.cruiseAmplitude,
    (v) => { opts.cruiseAmplitude = v },
    (v) => `×${Number(v.toFixed(2))}`,
  )
  const syncAuto = () => {
    autoCheck.checked = opts.autoRotate
    speedSlider.input.disabled = !opts.autoRotate
    ampSlider.input.disabled = !opts.autoRotate
  }
  autoCheck.addEventListener('change', () => {
    opts.autoRotate = autoCheck.checked
    syncAuto()
    onOptsChange()
  })
  syncAuto()

  const resetBtn = document.createElement('button')
  resetBtn.type = 'button'
  resetBtn.dataset.dshStudySettingsReset = ''
  resetBtn.textContent = '恢复默认'
  resetBtn.addEventListener('click', () => {
    Object.assign(opts, DEFAULT_OPTS)
    alphaSlider.sync()
    blurSlider.sync()
    rotateSlider.sync()
    zoomSlider.sync()
    speedSlider.sync()
    ampSlider.sync()
    syncAuto()
    onOptsChange()
  })
  panel.appendChild(resetBtn)

  const setPanelOpen = (open: boolean) => {
    panel.hidden = !open
    settingsBtn.setAttribute('aria-expanded', String(open))
  }
  const onSettingsBtn = () => setPanelOpen(panel.hidden)
  settingsBtn.addEventListener('click', onSettingsBtn)
  // Esc 关浮层；本监听先于漫游的 Esc 监听注册，浮层打开时
  // stopImmediatePropagation 拦住后续监听，避免同一次 Esc 又退出漫游
  const onSettingsKey = (e: KeyboardEvent) => {
    if (e.key !== 'Escape' || panel.hidden) return
    setPanelOpen(false)
    e.stopImmediatePropagation()
  }
  document.addEventListener('keydown', onSettingsKey)
  body.appendChild(settingsBtn)
  body.appendChild(panel)

  try {
    container = document.createElement('div')
    container.setAttribute('data-dsh-study-3d-container', '')
    container.dataset.skinChrome = '3d-room'
    container.setAttribute('aria-hidden', 'true')
    body.appendChild(container) // 先入 DOM，createStudyRoom 才能读到真实尺寸
    room = createStudyRoom(container)
    body.setAttribute('data-dsh-study-3d', '') // 与 CSS 选择器对齐（dataset.dshStudy3d 会生成 data-dsh-study3d，无法匹配）

    // 亮暗主题跟随官方 body[data-ds-dark-theme]
    const syncTheme = () => room?.setTheme(body.hasAttribute('data-ds-dark-theme'))
    observer = new MutationObserver(syncTheme)
    observer.observe(body, { attributes: true, attributeFilter: ['data-ds-dark-theme'] })
    syncTheme()

    fadeEl = document.createElement('div')
    fadeEl.dataset.dshStudyFade = ''
    fadeEl.dataset.skinChrome = 'world-fade'
    body.appendChild(fadeEl)
    crosshairEl = document.createElement('div')
    crosshairEl.dataset.dshStudyCrosshair = ''
    crosshairEl.dataset.skinChrome = 'crosshair'
    body.appendChild(crosshairEl)
    const placeCross = (x?: number, y?: number) => {
      if (!crosshairEl) return
      if (x == null || y == null || document.pointerLockElement) {
        crosshairEl.style.left = '50%'
        crosshairEl.style.top = '50%'
      } else {
        crosshairEl.style.left = `${x}px`
        crosshairEl.style.top = `${y}px`
      }
    }
    toastEl = document.createElement('div')
    toastEl.dataset.dshStudyToast = ''
    toastEl.dataset.skinChrome = 'toast'
    body.appendChild(toastEl)
    hotbarEl = document.createElement('div')
    hotbarEl.dataset.dshStudyHotbar = ''
    hotbarEl.dataset.skinChrome = 'hotbar'
    for (let i = 0; i < OUTSIDE_HOTBAR.length; i += 1) {
      const spec = OUTSIDE_HOTBAR[i]
      const slot = document.createElement('button')
      slot.type = 'button'
      slot.dataset.slot = String(i)
      slot.innerHTML = `<span data-key>${i + 1}</span><span data-sw style="background:${spec.swatch}"></span><span data-nm>${spec.name}</span>`
      slot.addEventListener('click', (ev) => {
        ev.preventDefault()
        ev.stopPropagation()
        outside?.selectSlot(i)
        paintHotbar()
        room?.renderer.domElement.requestPointerLock?.()
      })
      hotbarEl.appendChild(slot)
    }
    body.appendChild(hotbarEl)
    const paintHotbar = () => {
      if (!hotbarEl) return
      const cur = outside?.getSelected() ?? 0
      Array.from(hotbarEl.children).forEach((node, i) => {
        if (node instanceof HTMLElement) node.classList.toggle('active', i === cur)
      })
    }
    paintHotbar()
    const paintPixelText = (text: string) => {
      const scale = 3
      const src = document.createElement('canvas')
      const g = src.getContext('2d')
      if (!g) return null
      g.font = '12px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
      const w = Math.ceil(g.measureText(text).width) + 6
      const h = 16
      src.width = w
      src.height = h
      g.font = '12px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
      g.textBaseline = 'top'
      g.fillStyle = '#1a1008'
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
        g.fillText(text, 3 + dx, 2 + dy)
      }
      g.fillStyle = '#fff3c4'
      g.fillText(text, 3, 2)
      const out = document.createElement('canvas')
      out.width = w * scale
      out.height = h * scale
      const og = out.getContext('2d')
      if (!og) return null
      og.imageSmoothingEnabled = false
      og.drawImage(src, 0, 0, out.width, out.height)
      return out
    }
    /** 与屋外门提示同源的像素字，多行版本供家具回复使用。 */
    const paintPixelParagraph = (text: string) => {
      const scale = 2
      const maxWidth = Math.max(120, Math.min(300, Math.floor(window.innerWidth * 0.78 / scale)))
      const padX = 4
      const lineHeight = 15
      const measure = document.createElement('canvas').getContext('2d')
      if (!measure) return null
      const font = '11px "PingFang SC","Microsoft YaHei","Noto Sans SC",sans-serif'
      measure.font = font
      const lines: string[] = []
      for (const paragraph of text.split('\n')) {
        let line = ''
        for (const char of Array.from(paragraph)) {
          if (line && measure.measureText(line + char).width > maxWidth - padX * 2) {
            lines.push(line)
            line = char
          } else {
            line += char
          }
        }
        if (line || paragraph === '') lines.push(line)
      }
      const width = Math.max(12, Math.ceil(Math.min(maxWidth, Math.max(...lines.map((line) => measure.measureText(line).width), 0) + padX * 2)))
      const height = Math.max(lineHeight, lines.length * lineHeight + 2)
      const src = document.createElement('canvas')
      src.width = width
      src.height = height
      const g = src.getContext('2d')
      if (!g) return null
      g.font = font
      g.textBaseline = 'top'
      g.fillStyle = '#1a1008'
      lines.forEach((line, i) => {
        for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1]]) {
          g.fillText(line, padX + dx, 1 + i * lineHeight + dy)
        }
      })
      g.fillStyle = '#fff3c4'
      lines.forEach((line, i) => g.fillText(line, padX, 1 + i * lineHeight))
      const out = document.createElement('canvas')
      out.width = width * scale
      out.height = height * scale
      const og = out.getContext('2d')
      if (!og) return null
      og.imageSmoothingEnabled = false
      og.drawImage(src, 0, 0, out.width, out.height)
      return out
    }
    const showToast = (text: string) => {
      if (!toastEl) return
      toastEl.replaceChildren()
      const pix = paintPixelText(text)
      if (pix) toastEl.appendChild(pix)
      else toastEl.textContent = text
      toastEl.removeAttribute('data-on')
      void toastEl.offsetWidth
      toastEl.dataset.on = ''
      if (toastTimer) clearTimeout(toastTimer)
      toastTimer = window.setTimeout(() => {
        toastEl?.removeAttribute('data-on')
        toastTimer = 0
      }, 2000)
    }

    /* ---- 第十三轮：家具交互飘字（非模态 DOM overlay，流式打字机） ---- */
    labelEl = document.createElement('div')
    labelEl.dataset.dshStudyLabel = ''
    labelEl.dataset.skinChrome = 'furniture-label'
    body.appendChild(labelEl)
    interactionLayerEl = document.createElement('div')
    interactionLayerEl.dataset.dshStudyInteractionLayer = ''
    interactionLayerEl.dataset.skinChrome = 'interaction-layer'
    body.appendChild(interactionLayerEl)

    /** 清掉指定飘字；其他仍在上浮的回复不受影响。 */
    const removeInteraction = (panel: HTMLDivElement | null) => {
      panel?.remove()
      if (interactionEl === panel) interactionEl = null
    }
    /** 回复完成后用六秒向上漂移并淡出。 */
    const scheduleInteractionFade = (panel: HTMLDivElement) => {
      panel.dataset.floating = ''
      const timer = window.setTimeout(() => {
        interactionTimers.delete(timer)
        removeInteraction(panel)
      }, 6000)
      interactionTimers.add(timer)
    }
    /** 开始一次家具交互：POST /dsh-skin-study/api/interact，读 NDJSON 流式渲染。 */
    const startInteraction = async (id: string) => {
      const f = FURNITURE[id]
      if (!f) return
      interactBusy = true
      if (crosshairEl) crosshairEl.dataset.loading = ''
      syncLabel(null)

      // 飘字不接收鼠标/键盘事件，也不打断第一人称操作。
      const panel = document.createElement('div')
      panel.dataset.dshStudyInteraction = ''
      panel.dataset.skinChrome = 'interaction'
      panel.setAttribute('role', 'status')
      panel.setAttribute('aria-live', 'polite')
      const head = document.createElement('div')
      head.dataset.dshStudyInteractionHead = ''
      const title = document.createElement('span')
      title.dataset.dshStudyInteractionTitle = ''
      let currentTitle = f.name
      const renderTitle = (text: string) => {
        currentTitle = text
        title.replaceChildren(paintPixelText(text) ?? text)
      }
      renderTitle(currentTitle)
      head.append(title)
      const bodyEl = document.createElement('div')
      bodyEl.dataset.dshStudyInteractionBody = ''
      const renderBody = (text: string) => {
        bodyEl.replaceChildren(paintPixelParagraph(text) ?? text)
        panel.setAttribute('aria-label', `${currentTitle}：${text}`)
      }
      renderBody('书房先生正在凝神……')
      panel.append(head, bodyEl)
      interactionLayerEl?.prepend(panel)
      interactionEl = panel

      let finalText = ''

      try {
        const res = await fetch('/dsh-skin-study/api/interact', {
          method: 'POST',
          headers: { 'content-type': 'application/json' },
          body: JSON.stringify({ id }),
        })
        if (!res.ok || !res.body) {
          const text = await res.json().catch(() => ({}))
          if ((text as { reason?: string }).reason === 'cooldown') {
            showToast('书房先生刚回应过，稍等片刻')
            removeInteraction(panel)
          } else {
            renderBody('书房先生没听到……' + ((text as { reason?: string }).reason ?? ''))
          }
          return
        }
        // NDJSON 流式读取
        const reader = res.body.getReader()
        const decoder = new TextDecoder()
        let buf = ''
        for (;;) {
          const { done, value } = await reader.read()
          if (done) break
          buf += decoder.decode(value, { stream: true })
          const lines = buf.split('\n')
          buf = lines.pop() ?? ''
          for (const line of lines) {
            if (!line.trim()) continue
            let cc: { type?: string; text?: string; title?: string }
            try { cc = JSON.parse(line) } catch { continue }
            if (cc.type === 'meta' && typeof cc.title === 'string') {
              renderTitle(cc.title)
            }
            else if (cc.type === 'delta' && typeof cc.text === 'string') {
              finalText += cc.text
              renderBody(finalText)
            } else if (cc.type === 'error' && typeof cc.text === 'string') {
              renderBody((finalText ? finalText + '\n\n' : '') + `（书房先生说了句悄悄话：${cc.text}）`)
            }
          }
        }
        if (crosshairEl) delete crosshairEl.dataset.loading
      } catch {
        renderBody(finalText || '书房先生打了个盹，稍后再试试。')
      } finally {
        interactBusy = false
        if (crosshairEl) delete crosshairEl.dataset.loading
        if (interactionEl === panel) {
          interactionEl = null
          syncLabel(room?.pickHotspot(aimCenter().x, aimCenter().y) ?? null)
          scheduleInteractionFade(panel)
        }
      }
    }

    const wait = (ms: number) => new Promise<void>((resolve) => { window.setTimeout(resolve, ms) })
    const travel = async (to: 'study' | 'outside') => {
      if (!room || fading || world === to) return
      fading = true
      doorLockUntil = performance.now() + 1600
      fadeEl!.dataset.on = ''
      await wait(380)
      world = to
      if (to === 'outside') {
        room.enterWalk()
        if (!outside) outside = createOutsideWorld()
        const canvas = room.renderer.domElement
        outside.setAspect(canvas.clientWidth / Math.max(1, canvas.clientHeight))
        outside.placeOutside()
        outside.enterWalk()
        body.dataset.dshStudyOutside = ''
      } else {
        outside?.saveNow()
        delete body.dataset.dshStudyOutside
        room.placeAtDoor()
      }
      try { localStorage.setItem(WORLD_KEY, to) } catch { /* ignore */ }
      syncPlayChrome()
      paintHotbar()
      syncAim()
      await wait(50)
      delete fadeEl!.dataset.on
      fading = false
      placeCross()
      room.renderer.domElement.requestPointerLock?.()
      if (to === 'study') showWalkHint()
    }

    // ---- 手柄桥：延迟初始化，故障隔离（独立 rAF，不影响 3D 渲染循环） ----
    // tapCenter：书房内 A 键等效"点击画面中央"——与鼠标 up 判定一致。
    const tapCenter = () => {
      if (!room || !inWorld()) return
      if (performance.now() < ignoreHotspotUntil) { lockLook(); return }
      const c = aimCenter()
      const hit = world === 'outside' && outside
        ? outside.pickHotspot(c.x, c.y, room.renderer.domElement)
        : room.pickHotspot(c.x, c.y)
      if (hit === 'desk' && world === 'study') { setImmersed(false); return }
      if (hit === 'door' && world === 'study') { void travel('outside'); return }
      if (world === 'study' && hit && FURNITURE[hit] && hit !== 'desk' && hit !== 'door') {
        if (interactBusy) { showToast('书房先生正在忙别的'); lockLook(); return }
        void startInteraction(hit)
        return
      }
      lockLook()
    }
    const cycleSlot = (dir: number) => {
      const n = OUTSIDE_HOTBAR.length
      if (n === 0) return
      const cur = outside?.getSelected() ?? 0
      const next = ((cur + dir) % n + n) % n
      outside?.selectSlot(next)
      paintHotbar()
    }
    initGamepad = () => {
      try {
        if (gamepad) gamepad.stop()
        const b = createGamepadBridge()
        b.setHooks({
          onMoveKey: (key, down) => {
            if (world === 'outside' && outside) outside.setMoveKey(key, down)
            else room?.setMoveKey(key, down)
          },
          onLook: (dx, dy) => lookBy(dx, dy),
          onAction: () => {
            if (world === 'outside' && outside) {
              const hit = outside.tryPunch()
              if (hit === 'door') showToast('门没了你还想回去吗')
              outside.setMining(true)
              lockLook()
            } else if (room && inWorld()) {
              if (interactBusy) { showToast('书房先生正在忙别的'); return }
              tapCenter()
            }
          },
          onActionRelease: () => {
            // A 松开：停止挖矿/放下，镜像鼠标 onCanvasUp 的行为
            outside?.setMining(false)
            outside?.setPlacing(false)
          },
          onBack: () => {
            if (world === 'outside' && outside) {
              outside.setMining(false)
              outside.setPlacing(false)
              void travel('study')
            } else if (room && inWorld()) {
              room.exitWalk()
              setImmersed(false)
            }
          },
          onSlotPrev: () => cycleSlot(-1),
          onSlotNext: () => cycleSlot(1),
        })
        b.start()
        gamepad = b
      } catch (e) {
        console.error('[dsh-skin-study] gamepad init failed:', e)
        gamepad?.stop()
        gamepad = null
      }
    }
    // 渲染循环：巡航按真实时间推进，所以限帧不会拖慢摆动。
    // 背景 30fps 足够慢镜头；漫游/走动/屋外 60fps。页面隐藏暂停。
    const CRUISE_MS = 1000 / 30
    const INTERACT_MS = 1000 / 60
    let lastDraw = 0
    const tick = (now: number) => {
      raf = requestAnimationFrame(tick)
      if (!room) return
      const roaming = body.hasAttribute('data-dsh-study-roam')
      const immersed = 'dshStudyImmersed' in body.dataset
      const outdoors = world === 'outside' && !!outside
      const walking = outdoors || room.isWalking()
      const interacting = roaming || walking || (immersed && canvasDrag) || altDragId !== -1
      const interval = interacting || outdoors ? INTERACT_MS : CRUISE_MS
      if (lastDraw && now - lastDraw < interval) return
      lastDraw = now
      if (outdoors && outside) {
        const canvas = room.renderer.domElement
        outside.setAspect(canvas.clientWidth / Math.max(1, canvas.clientHeight))
        outside.updateWalk()
        if (outside.takeDoorHint()) showToast('门没了你还想回去吗')
        room.renderer.render(outside.scene, outside.camera)
        syncAim()
        if (!fading && now > doorLockUntil && (immersed || outdoors) && outside.isNearDoor()) {
          void travel('study')
        }
        return
      }
      if (immersed && !room.isWalking()) room.enterWalk()
      const fps = immersed || room.isWalking()
      if (fps) room.updateWalk()
      else room.updateCruise()
      const damping = fps || !room.controls.enabled ? false : room.controls.update()
      if (!opts.autoRotate && !interacting && !damping && !fps) return
      room.renderer.render(room.scene, room.camera)
      syncAim()
      if (!fading && immersed && now > doorLockUntil && room.isNearDoor()) void travel('outside')
    }
    onVis = () => {
      if (document.hidden) {
        outside?.saveNow()
        if (raf) cancelAnimationFrame(raf)
        raf = 0
      } else if (!raf) {
        tick()
      }
    }
    document.addEventListener('visibilitychange', onVis)
    tick()

    // 漫游模式：点按钮或 Esc 切换 body[data-dsh-study-roam]
    roamBtn = document.createElement('button')
    roamBtn.type = 'button'
    roamBtn.dataset.dshStudyRoamBtn = ''
    roamBtn.dataset.skinChrome = 'roam-button'
    roamBtn.textContent = '3D 漫游 · 拖拽/滚轮'
    roamBtn.title = '进入/退出 3D 漫游（Esc 退出）；平时可用方向键/Alt+拖拽旋转'
    roamBtn.setAttribute('aria-pressed', 'false')
    const setRoam = (on: boolean) => {
      if (on) body.dataset.dshStudyRoam = ''
      else delete body.dataset.dshStudyRoam
      // 漫游时暂停巡航（占一层 pause），退出后从当前方位继续摆
      if (room) { if (on) room.pauseCruise(); else room.resumeCruise() }
      roamBtn?.setAttribute('aria-pressed', String(on))
    }
    onBtn = () => setRoam(!('dshStudyRoam' in body.dataset))
    onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && 'dshStudyRoam' in body.dataset) setRoam(false)
    }
    roamBtn.addEventListener('click', onBtn)
    document.addEventListener('keydown', onKey)
    body.appendChild(roamBtn)

    /* ---- 第十轮：收起整块工作区（左栏/中间/右栏），点书桌或 Esc 展开 ---- */
    const chromeSel = '#root, [data-pane], [data-dsh-frame], .aionui-root, [data-aionui-explorer-col], [data-aionui-preview-col], .aionui-floating-expand'
    const setChromeInert = (on: boolean) => {
      document.querySelectorAll(chromeSel).forEach((node) => {
        if (node instanceof HTMLElement) node.inert = on
      })
    }
    const playing = () => 'dshStudyImmersed' in body.dataset || world === 'outside'
    const syncPlayChrome = () => {
      if (!hideBtn) return
      const on = playing()
      hideBtn.hidden = on
      hideBtn.inert = on
      hideBtn.setAttribute('aria-pressed', String(on))
      if (on) hideBtn.blur()
    }
    const showWalkHint = () => {
      if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0 }
      if (hintGoneTimer) { clearTimeout(hintGoneTimer); hintGoneTimer = 0 }
      hint?.remove()
      hint = document.createElement('div')
      hint.dataset.dshStudyHint = ''
      hint.dataset.skinChrome = '3d-hint'
      hint.setAttribute('role', 'status')
      const hintText = document.createElement('span')
      hintText.textContent = 'WASD 走动 · 空格跳跃 · 点门去屋外 · 点书桌打开工作区'
      const hintClose = document.createElement('button')
      hintClose.type = 'button'
      hintClose.dataset.dshStudyHintClose = ''
      hintClose.textContent = '×'
      hintClose.setAttribute('aria-label', '关闭提示')
      const dismissHint = () => {
        if (!hint) return
        if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0 }
        hint.dataset.fading = ''
        hintGoneTimer = window.setTimeout(() => { hint?.remove(); hint = null }, 450)
      }
      hintClose.addEventListener('click', dismissHint)
      hint.append(hintText, hintClose)
      body.appendChild(hint)
      hintTimer = window.setTimeout(dismissHint, 7000)
    }
    const setImmersed = (on: boolean) => {
      if (on) {
        body.dataset.dshStudyImmersed = ''
        if ('dshStudyRoam' in body.dataset) setRoam(false)
        if (world === 'study') room?.placeAtSpawn()
        doorLockUntil = performance.now() + 2200
        placeCross()
        room?.renderer.domElement.requestPointerLock?.()
        showWalkHint()
      } else {
        if (world === 'outside') return
        delete body.dataset.dshStudyImmersed
        canvasDrag = false
        if (document.pointerLockElement) document.exitPointerLock()
        if (world === 'study') room?.exitWalk()
      }
      setChromeInert(on || world === 'outside')
      syncPlayChrome()
      try { localStorage.setItem(IMMERSED_KEY, on || world === 'outside' ? '1' : '0') } catch { /* ignore */ }
    }
    hideBtn = document.createElement('button')
    hideBtn.type = 'button'
    hideBtn.dataset.dshStudyHideBtn = ''
    hideBtn.dataset.skinChrome = 'hide-ui'
    hideBtn.setAttribute('aria-pressed', 'false')
    hideBtn.textContent = '进入书房'
    hideBtn.title = '收起工作区，走进房间；点书桌回来'
    onHideBtn = () => {
      if (playing()) return
      setImmersed(true)
    }
    hideBtn.addEventListener('click', onHideBtn)
    body.appendChild(hideBtn)
    syncPlayChrome()

    const prevOnKey = onKey
    onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && playing()) return
      prevOnKey?.(e)
    }
    document.removeEventListener('keydown', prevOnKey)
    document.addEventListener('keydown', onKey)
    onEscStudy = (e: KeyboardEvent) => {
      if (e.key !== 'Escape') return
      if (world !== 'study' || !('dshStudyImmersed' in body.dataset)) return
      // 不能 preventDefault：Chrome 会弹出 “press Esc to exit fullscreen”，再按就把锁解开并卡住视角
      e.stopPropagation()
    }
    document.addEventListener('keydown', onEscStudy, true)

    const inWorld = () => 'dshStudyImmersed' in body.dataset || world === 'outside'
    const aimCenter = () => {
      const rect = room!.renderer.domElement.getBoundingClientRect()
      return { x: rect.left + rect.width / 2, y: rect.top + rect.height / 2 }
    }
    const lookBy = (dx: number, dy: number) => {
      if (!room || !inWorld() || (!dx && !dy)) return
      if (world === 'outside' && outside) outside.look(dx, dy)
      else room.look(dx, dy)
    }
    const lookLocked = () => {
      if (!room) return false
      const el = room.renderer.domElement
      return document.pointerLockElement === el || document.pointerLockElement === container
    }
    syncAim = () => {
      if (!crosshairEl || !room) return
      if (world !== 'study' || !inWorld()) {
        delete crosshairEl.dataset.aim
        syncLabel(null)
        return
      }
      const c = aimCenter()
      const hit = room.pickHotspot(c.x, c.y)
      if (hit) {
        crosshairEl.dataset.aim = hit
        syncLabel(hit)
      } else {
        delete crosshairEl.dataset.aim
        syncLabel(null)
      }
    }
    /** 准星下方家具名牌：命中可交互家具时显示中文名 + 提示。 */
    const syncLabel = (hit: string | null) => {
      if (!labelEl || interactBusy) {
        if (labelEl && interactBusy) labelEl.removeAttribute('data-on')
        return
      }
      if (hit && FURNITURE[hit]) {
        labelEl.textContent = `${FURNITURE[hit].name} · ${FURNITURE[hit].hint}`
        labelEl.dataset.on = ''
      } else {
        labelEl.removeAttribute('data-on')
      }
    }
    const lockLook = () => {
      if (!inWorld()) return
      room?.renderer.domElement.requestPointerLock?.()
    }
    onCanvasDown = (e: PointerEvent) => {
      if (!inWorld() || !room) return
      if (world === 'outside' && outside && e.button === 0) {
        e.preventDefault()
        const hit = outside.tryPunch()
        if (hit === 'door') showToast('门没了你还想回去吗')
        outside.setMining(true)
        lockLook()
        return
      }
      if (world === 'outside' && outside && e.button === 2) {
        e.preventDefault()
        outside.tryPlace()
        outside.setPlacing(true)
        lockLook()
        return
      }
      if (e.button !== 0) return
      canvasDrag = true
      lockLook()
    }
    onCanvasUp = (e: PointerEvent) => {
      outside?.setMining(false)
      outside?.setPlacing(false)
      canvasDrag = false
      if (!room || !inWorld() || e.button !== 0) return
      if (performance.now() < ignoreHotspotUntil) {
        lockLook()
        return
      }
      const c = aimCenter()
      const hit = world === 'outside' && outside
        ? outside.pickHotspot(c.x, c.y, room.renderer.domElement)
        : room.pickHotspot(c.x, c.y)
      if (hit === 'desk' && world === 'study') {
        setImmersed(false)
        return
      }
      if (hit === 'door' && world === 'study') {
        void travel('outside')
        return
      }
      if (world === 'study' && hit && FURNITURE[hit] && hit !== 'desk' && hit !== 'door') {
        if (interactBusy) {
          showToast('书房先生正在忙别的')
          lockLook()
          return
        }
        void startInteraction(hit)
        return
      }
      lockLook()
    }
    onCanvasMove = (e: PointerEvent) => {
      if (!inWorld()) return
      placeCross()
      if (lookLocked()) return
      lookBy(e.movementX, e.movementY)
    }
    container.addEventListener('pointerdown', onCanvasDown)
    container.addEventListener('pointerup', onCanvasUp)
    container.addEventListener('pointermove', onCanvasMove)
    container.oncontextmenu = (e) => { if (world === 'outside') e.preventDefault() }
    onPointerUpWin = () => {
      outside?.setMining(false)
      outside?.setPlacing(false)
    }
    window.addEventListener('pointerup', onPointerUpWin)
    onHotbarWheel = (e: WheelEvent) => {
      if (world !== 'outside' || !outside || !inWorld()) return
      e.preventDefault()
      outside.selectSlot(outside.getSelected() + (e.deltaY > 0 ? 1 : -1))
      paintHotbar()
    }
    container.addEventListener('wheel', onHotbarWheel, { passive: false })

    onLookMove = (e: MouseEvent) => {
      if (!room || document.pointerLockElement !== container && document.pointerLockElement !== room.renderer.domElement) return
      if (world === 'outside' && outside) outside.look(e.movementX, e.movementY)
      else room.look(e.movementX, e.movementY)
    }
    onLockChange = () => {
      if (!room || !container) return
      const locked = document.pointerLockElement === container || document.pointerLockElement === room.renderer.domElement
      if (locked) {
        if (world === 'outside') outside?.enterWalk()
        else room.enterWalk()
        placeCross()
        return
      }
      if (world === 'study' && 'dshStudyImmersed' in body.dataset) room.enterWalk()
    }
    document.addEventListener('mousemove', onLookMove)
    document.addEventListener('pointerlockchange', onLockChange)

    const typing = (t: EventTarget | null) =>
      t instanceof HTMLElement && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable)
    onWalkKey = (e: KeyboardEvent) => {
      if (!room || typing(e.target) || typing(document.activeElement)) return
      if (world !== 'outside' && !('dshStudyImmersed' in body.dataset) && !('dshStudyRoam' in body.dataset)) return
      const down = e.type === 'keydown'
      if (e.code === 'Space' || e.key === ' ') {
        e.preventDefault()
        e.stopPropagation()
      }
      if (world === 'outside' && outside && down && e.code.startsWith('Digit')) {
        const n = Number(e.code.slice(5))
        if (n >= 1 && n <= OUTSIDE_HOTBAR.length) {
          e.preventDefault()
          e.stopPropagation()
          outside.selectSlot(n - 1)
          paintHotbar()
          return
        }
      }
      const letter = e.key.length === 1 ? e.key.toLowerCase() : ''
      let key: 'forward' | 'back' | 'left' | 'right' | 'sprint' | 'jump' | null = null
      if (e.code === 'KeyW' || letter === 'w') key = 'forward'
      else if (e.code === 'KeyS' || letter === 's') key = 'back'
      else if (e.code === 'KeyA' || letter === 'a') key = 'left'
      else if (e.code === 'KeyD' || letter === 'd') key = 'right'
      else if (e.code === 'ShiftLeft' || e.code === 'ShiftRight' || e.key === 'Shift') key = 'sprint'
      else if (e.code === 'Space' || e.key === ' ') key = 'jump'
      else return
      e.preventDefault()
      e.stopPropagation()
      if (e.repeat && down) return
      if (world === 'outside' && outside) outside.setMoveKey(key, down)
      else room.setMoveKey(key, down)
    }
    document.addEventListener('keydown', onWalkKey, true)
    document.addEventListener('keyup', onWalkKey, true)

    let startImmersed = false
    let startOutside = false
    try { startImmersed = localStorage.getItem(IMMERSED_KEY) === '1' } catch { /* ignore */ }
    try { startOutside = localStorage.getItem(WORLD_KEY) === 'outside' } catch { /* ignore */ }
    if (startOutside && room) {
      world = 'outside'
      if (!outside) outside = createOutsideWorld()
      const canvas = room.renderer.domElement
      outside.setAspect(canvas.clientWidth / Math.max(1, canvas.clientHeight))
      outside.enterWalk()
      body.dataset.dshStudyOutside = ''
      setImmersed(true)
      paintHotbar()
    } else {
      setImmersed(startImmersed)
    }

    /* ---- 第五轮：键盘随时可用（无需漫游）。守卫：打字目标/修饰键不响应 ---- */
    const isTypingTarget = (t: EventTarget | null): boolean => {
      if (!(t instanceof HTMLElement)) return false
      return t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.tagName === 'SELECT' || t.isContentEditable
    }
    onKeys = (e: KeyboardEvent) => {
      if (!room || isTypingTarget(e.target) || e.metaKey || e.ctrlKey || e.altKey) return
      const rotStep = 0.09 * opts.rotateSpeed
      switch (e.key) {
        case 'ArrowLeft': room.rotateBy(rotStep, 0); break
        case 'ArrowRight': room.rotateBy(-rotStep, 0); break
        case 'ArrowUp': room.rotateBy(0, rotStep); break // 抬头（相机略降，受限位钳制）
        case 'ArrowDown': room.rotateBy(0, -rotStep); break
        case '+': case '=': room.dollyBy(Math.pow(0.88, opts.zoomSpeed)); break
        case '-': case '_': room.dollyBy(Math.pow(0.88, -opts.zoomSpeed)); break
        case 'r': case 'R':
          if (world === 'outside') outside?.placeOutside()
          else room.resetView()
          break
        default: return
      }
      e.preventDefault() // 拦住方向键滚动页面
    }
    document.addEventListener('keydown', onKeys)

    /* ---- 第五轮：Alt+拖拽旋转、Alt+滚轮缩放（window 级，随时可用）。
       pointerdown preventDefault 防选中文字；普通点击不带 Alt，完全不受影响 ---- */
    let altLastX = 0
    let altLastY = 0
    onAltDown = (e: PointerEvent) => {
      if (!room || !e.altKey || e.button !== 0 || altDragId >= 0) return
      altDragId = e.pointerId
      altLastX = e.clientX
      altLastY = e.clientY
      e.preventDefault()
    }
    onAltMove = (e: PointerEvent) => {
      if (!room || e.pointerId !== altDragId) return
      const k = 0.005 * opts.rotateSpeed
      room.rotateBy(-(e.clientX - altLastX) * k, -(e.clientY - altLastY) * k)
      altLastX = e.clientX
      altLastY = e.clientY
      e.preventDefault()
    }
    onAltUp = (e: PointerEvent) => {
      if (e.pointerId === altDragId) altDragId = -1
    }
    onAltWheel = (e: WheelEvent) => {
      if (!room || !e.altKey) return
      const dy = e.deltaMode === 1 ? e.deltaY * 33 : e.deltaY // 兼容按行滚动的浏览器
      room.dollyBy(Math.exp(dy * 0.001 * opts.zoomSpeed))
      e.preventDefault()
    }
    window.addEventListener('pointerdown', onAltDown)
    window.addEventListener('pointermove', onAltMove)
    window.addEventListener('pointerup', onAltUp)
    window.addEventListener('wheel', onAltWheel, { passive: false })

  } catch {
    // 无 WebGL / 初始化报错：清掉半成品，保留第二轮插画背景
    room?.dispose()
    room = null
    container?.remove()
    container = null
    roamBtn?.remove()
    roamBtn = null
    hideBtn?.remove()
    hideBtn = null
    body.removeAttribute('data-dsh-study-3d')
    body.removeAttribute('data-dsh-study-immersed')
  }

  // 初次套用：CSS 变量到 body（插画后备也生效），3D 就绪时同步 OrbitControls
  applyOpts()

  // 手柄桥延迟启动：apply 同步路径跑完（3D 已建立）后再接，绝不阻塞/破坏 3D。
  // initGamepad 可能因 3D 初始化异常而保持 null（try 内未赋值），此时跳过。
  window.setTimeout(() => { try { initGamepad?.() } catch (e) { console.error('[dsh-skin-study] gamepad init:', e) } }, 0)

  ctx.effect(() => () => {
    document.removeEventListener('keydown', onSettingsKey)
    settingsBtn.removeEventListener('click', onSettingsBtn)
    settingsBtn.remove()
    panel.remove()
    body.style.removeProperty('--dsh-skin-frame-alpha')
    body.style.removeProperty('--dsh-skin-frame-blur')
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    if (onVis) document.removeEventListener('visibilitychange', onVis)
    if (onKey) document.removeEventListener('keydown', onKey)
    if (onEscStudy) document.removeEventListener('keydown', onEscStudy, true)
    if (roamBtn && onBtn) roamBtn.removeEventListener('click', onBtn)
    if (hideBtn && onHideBtn) hideBtn.removeEventListener('click', onHideBtn)
    hideBtn?.remove()
    hideBtn = null
    if (container && onCanvasDown) container.removeEventListener('pointerdown', onCanvasDown)
    if (container && onCanvasUp) container.removeEventListener('pointerup', onCanvasUp)
    if (container && onCanvasMove) container.removeEventListener('pointermove', onCanvasMove)
    if (container && onHotbarWheel) container.removeEventListener('wheel', onHotbarWheel)
    if (onPointerUpWin) window.removeEventListener('pointerup', onPointerUpWin)
    hotbarEl?.remove()
    hotbarEl = null
    if (onWalkKey) {
      document.removeEventListener('keydown', onWalkKey, true)
      document.removeEventListener('keyup', onWalkKey, true)
    }
    if (onLookMove) document.removeEventListener('mousemove', onLookMove)
    if (onLockChange) document.removeEventListener('pointerlockchange', onLockChange)
    if (document.pointerLockElement) document.exitPointerLock()
    fadeEl?.remove()
    fadeEl = null
    crosshairEl?.remove()
    crosshairEl = null
    toastEl?.remove()
    toastEl = null
    if (toastTimer) { clearTimeout(toastTimer); toastTimer = 0 }
    outside?.dispose()
    outside = null
    delete body.dataset.dshStudyOutside
    document.querySelectorAll('#root, [data-pane], [data-dsh-frame], .aionui-root, [data-aionui-explorer-col], [data-aionui-preview-col], .aionui-floating-expand').forEach((node) => {
      if (node instanceof HTMLElement) node.inert = false
    })
    delete body.dataset.dshStudyImmersed
    // 第五轮新监听与提示条全部收回
    if (onKeys) document.removeEventListener('keydown', onKeys)
    if (onAltDown) window.removeEventListener('pointerdown', onAltDown)
    if (onAltMove) window.removeEventListener('pointermove', onAltMove)
    if (onAltUp) window.removeEventListener('pointerup', onAltUp)
    if (onAltWheel) window.removeEventListener('wheel', onAltWheel)
    altDragId = -1
    if (hintTimer) { clearTimeout(hintTimer); hintTimer = 0 }
    if (hintGoneTimer) { clearTimeout(hintGoneTimer); hintGoneTimer = 0 }
    hint?.remove()
    hint = null
    labelEl?.remove()
    labelEl = null
    for (const timer of interactionTimers) clearTimeout(timer)
    interactionTimers.clear()
    interactionLayerEl?.remove()
    interactionLayerEl = null
    interactionEl = null
    interactBusy = false
    observer?.disconnect()
    gamepad?.stop()
    gamepad = null
    room?.dispose()
    container?.remove()
    roamBtn?.remove()
    delete body.dataset.dshStudy
    body.removeAttribute('data-dsh-study-3d')
    delete body.dataset.dshStudyRoam
    body.style.removeProperty('--dsh-study-art-light')
    body.style.removeProperty('--dsh-study-art-dark')
    styles.remove()
    ambience.remove()
  }, 'ui-skin-study: cozy study 3d chrome')
}
