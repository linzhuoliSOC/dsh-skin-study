/**
 * 手柄输入桥（Gamepad API → 语义动作）— 自包含、故障隔离版。
 *
 * 独立于皮肤渲染循环：内部自持 rAF 轮询，不存在"拖垮 3D"的可能。
 * 唯一的副作用是通过 window 挂在两个 gamepad 事件 + blur/visibility 事件，
 * 全部在 stop() 时收回。任何内部错误只 console.error + 自动停，绝不向上抛。
 *
 * 映射（standard 布局，已在浏览器实测）：
 *   十字键 buttons[12..15] = 移动（数字档）
 *   左摇杆 axes[0/1]      = 移动（模拟档，含死区）
 *   右摇杆 axes[2/3]      = 视角 look
 *   A buttons[0]          = 动作/挖
 *   B buttons[1]          = 返回/取消挖放
 *   LB buttons[4] RB[5]   = 选栏 prev/next
 */

const DEADZONE = 0.15
const EDGE = 0.5

export interface GamepadBridge {
  /** 移动方向变化：key ∈ forward/back/left/right；down=true 按下，false 松开。 */
  onMoveKey?: (key: 'forward' | 'back' | 'left' | 'right', down: boolean) => void
  /** 视角增量（像素/帧），由右摇杆产生；dx>0 右转，dy>0 抬头。 */
  onLook?: (dx: number, dy: number) => void
  /** 动作键（A）上升沿：挖/确认。 */
  onAction?: () => void
  /** 动作键（A）下降沿（松开）：停止挖矿/确认结束。 */
  onActionRelease?: () => void
  /** 返回键（B）上升沿：退出/取消。 */
  onBack?: () => void
  /** 选栏上一格（LB）。 */
  onSlotPrev?: () => void
  /** 选栏下一格（RB）。 */
  onSlotNext?: () => void
}

export interface GamepadBridgeHandle {
  /** 配置语义回调（可在 start 后任意时刻调用）。 */
  setHooks: (h: Partial<GamepadBridge>) => void
  /** 启动轮询（幂等，可重复调用）。 */
  start: () => void
  /** 停止轮询并收回事件监听、兜底松开移动键（幂等）。 */
  stop: () => void
}

const gp = (): (Gamepad | null)[] | null => {
  try {
    const n = navigator as Navigator & { getGamepads?: () => (Gamepad | null)[] }
    return typeof n.getGamepads === 'function' ? n.getGamepads() : null
  } catch {
    return null
  }
}

export function createGamepadBridge(): GamepadBridgeHandle {
  let hooks: GamepadBridge = {}
  let raf = 0
  let last = 0
  let running = false
  // 上一帧按键状态
  let hadAction = false
  let hadBack = false
  let hadSlotPrev = false
  let hadSlotNext = false
  const moveState: Record<'forward' | 'back' | 'left' | 'right', boolean> = {
    forward: false, back: false, left: false, right: false,
  }

  const releaseMoveKeys = () => {
    for (const k of ['forward', 'back', 'left', 'right'] as const) {
      if (moveState[k]) {
        moveState[k] = false
        hooks.onMoveKey?.(k, false)
      }
    }
  }

  const onBlur = () => { try { releaseMoveKeys() } catch { /* noop */ } }

  function loop(now: number): void {
    raf = requestAnimationFrame(loop)
    const dt = now - last
    last = now
    try {
      const pads = gp()
      if (!pads) return
      const pad = [...pads].find((p) => p && p.connected)
      if (!pad) { releaseMoveKeys(); return }

      // 移动：十字键 + 左摇杆（死区）合一
      // 左摇杆 x=axes[0]（右+），y=axes[1]（上推 -1）
      const ax = pad.axes[0] ?? 0
      const ay = pad.axes[1] ?? 0
      const want: Record<'forward' | 'back' | 'left' | 'right', boolean> = {
        forward: !!pad.buttons[12]?.pressed || (ay < -DEADZONE),
        back: !!pad.buttons[13]?.pressed || (ay > DEADZONE),
        left: !!pad.buttons[14]?.pressed || (ax < -DEADZONE),
        right: !!pad.buttons[15]?.pressed || (ax > DEADZONE),
      }

      for (const k of ['forward', 'back', 'left', 'right'] as const) {
        if (want[k] !== moveState[k]) {
          moveState[k] = want[k]
          hooks.onMoveKey?.(k, want[k])
        }
      }

      // 视角：右摇杆连续增量（死区 + 平方曲线调手感）
      const rx = pad.axes[2] ?? 0
      const ry = pad.axes[3] ?? 0
      const rxn = Math.abs(rx) > DEADZONE ? rx : 0
      const ryn = Math.abs(ry) > DEADZONE ? ry : 0
      const lookDX = rxn * rxn * Math.sign(rxn) * 3.2
      const lookDY = ryn * ryn * Math.sign(ryn) * 3.2
      if (lookDX !== 0 || lookDY !== 0) hooks.onLook?.(lookDX, lookDY)

      // 按钮上升沿/下降沿
      const act = !!pad.buttons[0]?.pressed
      if (act && !hadAction) hooks.onAction?.()
      if (!act && hadAction) hooks.onActionRelease?.()
      hadAction = act
      const back = !!pad.buttons[1]?.pressed
      if (back && !hadBack) hooks.onBack?.()
      hadBack = back
      const sp = !!pad.buttons[4]?.pressed
      if (sp && !hadSlotPrev) hooks.onSlotPrev?.()
      hadSlotPrev = sp
      const sn = !!pad.buttons[5]?.pressed
      if (sn && !hadSlotNext) hooks.onSlotNext?.()
      hadSlotNext = sn
    } catch (e) {
      console.error('[dsh-skin-study] gamepad loop error, disabling:', e)
      stop()
    }
  }

  function start(): void {
    if (running) return
    running = true
    window.addEventListener('blur', onBlur)
    document.addEventListener('visibilitychange', onBlur)
    window.addEventListener('gamepadconnected', onBlur)
    window.addEventListener('gamepaddisconnected', onBlur)
    last = performance.now()
    raf = requestAnimationFrame(loop)
  }

  function stop(): void {
    running = false
    if (raf) cancelAnimationFrame(raf)
    raf = 0
    window.removeEventListener('blur', onBlur)
    document.removeEventListener('visibilitychange', onBlur)
    window.removeEventListener('gamepadconnected', onBlur)
    window.removeEventListener('gamepaddisconnected', onBlur)
    try { releaseMoveKeys() } catch { /* noop */ }
  }

  return {
    setHooks: (h) => { hooks = { ...hooks, ...h } },
    start,
    stop,
  }
}
