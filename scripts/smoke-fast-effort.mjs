// 冒烟：加载打包后的 lib/index.js，用 stub 的 llm/ctx 走完整 HTTP handler。
// 验证家具交互的「快速档」reasoning effort 链路闭合，且不破坏 NDJSON 输出管线。
//
// 用途：
// - DSH / adapter 升级后重跑一次：node scripts/smoke-fast-effort.mjs
//   第一时间暴露 efforts 形态或 GenerateOptions 契约的变化。
// - 若日后出现第二个「要选档」的调用方，把 resolveFastEffort 上提到 core 后
//   同步更新本脚本的断言。
import { pathToFileURL } from 'node:url'

const mod = await import(new URL('../lib/index.js', import.meta.url).href)
const { apply } = mod
if (typeof apply !== 'function') {
  console.error('FAIL: apply 未导出', Object.keys(mod))
  process.exit(1)
}

let streamSeenEffort = undefined
const calls = { resolveModelInfo: 0, stream: 0 }

// 假 llm：与 deepseek adapter 的档位形态一致（off/high/max，无 low）
const fakeLlm = {
  async resolveModelInfo(provider, model) {
    calls.resolveModelInfo++
    return { reasoning: { efforts: [{ id: 'off', name: 'Off' }, { id: 'high', name: 'High' }, { id: 'max', name: 'Max' }] } }
  },
  async *stream(opts) {
    calls.stream++
    streamSeenEffort = opts.reasoningEffort
    yield { type: 'text-delta', index: 0, text: '书房先生：你好呀。' }
    yield { type: 'finish', reason: 'stop' }
  },
}

const captures = { router: null }
const ctx = {
  get(name) {
    if (name === 'llm') return fakeLlm
    if (name === 'agentDefaultModel') {
      return { currentSelection: () => ({ provider: 'deepseek', model: 'deepseek-v4-flash-0731' }) }
    }
    return undefined
  },
  inject(names, cb) {
    const webCtx = {
      effect: (fn) => fn(),
      webServer: { register(route) { captures.router = route; return () => {} } },
    }
    cb(webCtx)
  },
  effect(fn) { return fn() },
}

apply(ctx)
if (!captures.router) { console.error('FAIL: 未注册路由'); process.exit(1) }

const body = JSON.stringify({ id: 'sofa' })
const listeners = {}
let endFired = false
const req = {
  method: 'POST',
  url: '/dsh-skin-study/api/interact',
  setEncoding() {},
  on(ev, cb) {
    listeners[ev] = cb
    if (ev === 'end' && !endFired) {
      endFired = true
      process.nextTick(() => { if (listeners.data) listeners.data(body); listeners.end() })
    }
  },
}
const out = []
const res = {
  writeHead() {}, end() {},
  write(chunk) { out.push(chunk) },
}
await captures.router.handler(req, res)

const lines = out.join('').split('\n').filter(Boolean).map((l) => JSON.parse(l))
const okMeta = lines.some((l) => l.type === 'meta' && l.id === 'sofa')
const okDelta = lines.some((l) => l.type === 'delta' && typeof l.text === 'string' && l.text.length > 0)
const okDone = lines.some((l) => l.type === 'done')

console.log('calls:', JSON.stringify(calls))
console.log('streamSeenEffort:', streamSeenEffort)
console.log('meta:', okMeta, 'delta:', okDelta, 'done:', okDone)

const pass = calls.resolveModelInfo === 1 && calls.stream === 1
  && streamSeenEffort === 'off' && okMeta && okDelta && okDone
console.log(pass ? '\nSMOKE PASS' : '\nSMOKE FAIL')
process.exit(pass ? 0 : 1)
