/**
 * 质感书房 (Cozy Study) — 宿主半：家具交互能力服务器。
 *
 * 客户端（3D 书房）点击可交互家具（窗户/沙发/床/书架/书桌摆设）后，
 * POST /dsh-skin-study/api/interact 到此宿主半；宿主半按家具 id 查能力
 * 注册表，用当前默认模型（agentDefaultModel.currentSelection()）经
 * ctx.llm.stream() 生成叙述性回复，并以 NDJSON 流式回传客户端浮层。
 * 部分能力（窗户天气）先走 web.search 拿真实数据再让模型拟人化叙述，
 * 绝不凭空编造。模型/联网不可用或超时（AbortController 60s，实际值见 TIMEOUT_MS）时，回退
 * 到内置离线文案池，保证点击永远有反馈。家具闲聊默认用当前模型的
 * 「快速档」reasoning effort（优先 low，其次 minimal/off，按模型能力降级，
 * 无匹配则省略走默认），避免 reasoning 模型长思维链拖慢首字。
 *
 * 纯 CTRL/apply 宿主加载方式与 dsh-tempmon 一致：ctx.inject(['webServer'])
 * 动态注入（headless/TUI 永远不挂起等待），一切监听都在 ctx.effect 的
 * disposer 里收回。
 */

/** 交互超时：60 秒（官方 reasoning 模型先输出很长思维链，30s 常不够）。 */
const TIMEOUT_MS = 60_000
/** 模型空输出/失败时的自动重试次数（偶发空 text，重试通常成功）。 */
const MAX_RETRIES = 1

/**
 * 家具闲聊「快速档」偏好：按序尝试这些 reasoning effort id（大小写不敏感）。
 * 语义是「这个交互要快」，而非精确的 low：pi-ai 模型命中 low/minimal，
 * deepseek 无 low 时命中 off（关闭思考 = 它唯一的提速手段）；全都不支持
 * 则省略参数走 provider 默认。改策略只改这个数组，不动匹配逻辑。
 */
const FAST_EFFORT_PREFERENCE = ['low', 'minimal', 'off'] as const

/** llm 服务对象的最小接口（与 LlmRuntime 对齐，只取用到的两个方法）。 */
interface LlmService {
  stream?: (o: unknown) => AsyncIterable<{ type: string; text?: string }>
  resolveModelInfo?: (
    provider: string, model: string, signal?: AbortSignal,
  ) => Promise<{
    reasoning?: { efforts?: ReadonlyArray<{ id: string; name: string }> }
  }>
}

/** 快速档解析结果缓存：key = provider\u0000model → 解析 Promise（resolve 值=最终要传的 effort id，undefined=省略）。 */
const fastEffortCache = new Map<string, Promise<string | undefined>>()
/** 已记录过 notice 的模型集合，避免每种模型反复打日志。 */
const fastEffortLogged = new Set<string>()

/** 主题默认城市（客户端可在 localStorage dsh.study.city 覆盖，请求里带 city 参数）。 */
const DEFAULT_CITY = '杭州滨江区'

/** 一次家具交互的角色设定头——所有能力共用同一 persona，保持「书房先生」世界观。 */
const PERSONA = [
  '你是 DSH 书房里一位温和、博学又不失风趣的「书房先生」。',
  '你住在一间温馨的 3D 书房里（书房皮肤 dsh-skin-study）。',
  '用户点击了书房里的家具，请你以书房先生的角色，用自然、温暖的中文回应。',
  '每句回复不超过 180 字；可以带一点诗意的拟人，但不要堆砌华丽辞藻；',
  '不要使用 Markdown 语法（除非是极简的换行）；不要自称 AI 或语言模型。',
].join('\n')

/** 客户端可交互家具 id 白名单。 */
const ABILITY_IDS = new Set([
  'window', 'sofa', 'bed', 'shelf',
  'tea', 'globe', 'notepad', 'scroll',
])

/** 离线/失败兜底文案池：模型不可用、超时、异常时逐条随机。 */
const OFFLINE_LINES = [
  '书房先生低头咳嗽了一声：「今天状态不佳，先失陪啦。」（联网开小差了，稍后再点我）',
  '「书房的灯忽明忽暗——现在不方便聊天，我记下了，回头补上。」（服务暂不可用）',
  '窗外的云把信号挡住了……书房先生摆摆手：「明天再来，我给你讲个好故事。」',
  '「嗯……这段话我酝酿到一半就卡住了。」书房先生歉意地合上书。（请求超时）',
  '书房先生轻轻摇铃：「今日打烊，请明日再访。」（模型暂时缺席）',
]

/** 一次模型调用的输入。 */
interface CallInput {
  system: string
  user: string
}

/** 把文本直接回写 HTTP（NDJSON 流）。 */
type Emit = (chunk: { type: string; text?: string; reason?: string }) => void

/** 宿主侧方法集合（在 apply 内组装，供能力读取实时服务）。 */
interface HostMethods {
  searchWeather: (query: string) => Promise<{ content?: string; sources: readonly unknown[] } | null>
  currentModel: () => { provider: string; model: string } | null
  now: () => string
  todaySessionTitles: (n: number) => Promise<string[]>
}

/** 装载/服务上下文的最小接口。 */
type CordisCtx = { get: (name: string) => unknown }

/** 沙发（灵感泡一壶）：随机思维实验/冷知识/金句，面向大模型泛化。 */
const SOFA_PROMPTS = [
  '给一个有趣又不容易想到的思维实验（比如关于时间、意识、语言的），用 60 字以内说清，再补一句让人思考的话。',
  '讲一个冷门但真实的历史小知识或科学事实，60 字以内，结尾抛一个值得琢磨的问题。',
  '送一句原创的、有质感的短句（可以是关于专注、生活或学习），并解释它在书房里为什么合适，共 80 字以内。',
]

/**
 * 提交一次 llm.stream 并流式转发给 emit。
 * @returns 是否成功产出非空文本（模型不可用/异常/超时均为 false）。
 */
async function runLlmStream(
  ctx: CordisCtx, model: { provider: string; model: string } | null, input: CallInput,
  signal: AbortSignal, emit: Emit, effort?: string | undefined,
): Promise<{ ok: boolean; text: string }> {
  const llm = ctx.get('llm') as LlmService | undefined
  if (llm === undefined || typeof llm.stream !== 'function' || model === null) return { ok: false, text: '' }

  // Message 需带稳定 id（与 dsh-llm 的 createMessage/createUserMessage 契约一致），
  // 否则适配器/中间件校验失败导致 stream 抛错。
  const messages = [{
    id: `dsh-skin-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
    role: 'user',
    content: [{ type: 'text', text: input.user }],
    source: { kind: 'plugin', plugin: 'dsh-skin-study' },
  }]

  let text = ''
  let reasoningChars = 0
  let totalChunks = 0
  let failReason = ''
  try {
    for await (const chunk of llm.stream({
      provider: model.provider,
      model: model.model,
      messages,
      system: input.system,
      maxTokens: 2048,
      temperature: 0.85,
      ...effort === undefined ? {} : { reasoningEffort: effort },
      signal,
    })) {
      totalChunks += 1
      if (chunk.type === 'text-delta' && typeof chunk.text === 'string') {
        text += chunk.text
        emit({ type: 'delta', text: chunk.text })
      } else if (chunk.type === 'reasoning-delta' && typeof chunk.text === 'string') {
        reasoningChars += chunk.text.length
      } else if (chunk.type === 'error') {
        // 适配器以 error chunk 终止：记录原因供重试/兜底，不直接透传（避免重试时重复）
        const reason = (chunk as { text?: string; message?: string }).text
          ?? (chunk as { text?: string; message?: string }).message
          ?? 'model stream error'
        failReason = `error-chunk: ${String(reason).slice(0, 300)}`
        return { ok: false, text, reason: failReason }
      }
    }
  } catch (error) {
    failReason = error instanceof Error ? error.message : String(error)
    try {
      console.error(`[dsh-skin-study] llm.stream failed: ${failReason}`)
    } catch { /* ignore */ }
    return { ok: false, text, reason: failReason }
  }
  if (signal.aborted) return { ok: false, text, reason: 'aborted', aborted: true }
  return { ok: text.trim().length > 0, text }
}

/**
 * 执行一次家具交互：查能力表 → 构造 prompt → 流式调模型 → 失败回退离线池。
 */
async function runAbility(
  ctx: CordisCtx, methods: HostMethods, id: string, signal: AbortSignal, emit: Emit,
): Promise<void> {
  const ability = ABILITY_MAP[id]
  const model = methods.currentModel()
  const system = PERSONA + (ability.buildSystem ? `\n${ability.buildSystem()}` : '')
  let user = ''
  try {
    user = await ability.buildUser(methods)
  } catch {
    user = ''
  }
  // 闲聊要快：解析当前模型的「快速档」reasoning effort，尽量不思考或少思考
  const effort = await resolveFastEffort(ctx, model, signal)
  // 失败自动重试（仅当完全没有产生正文时才重试，避免部分输出 + 重试造成文本重复）
  let result: { ok: boolean; text: string }
  let retry = 0
  while (true) {
    result = await runLlmStream(ctx, model, { system, user }, signal, emit, effort)
    if (result.ok || result.text.length > 0) break
    if (signal.aborted || retry >= MAX_RETRIES) break
    retry += 1
  }
  if (result.ok || result.text.length > 0) {
    // 有正文（哪怕不完整）就算有反馈，不追加离线文案
    emit({ type: 'done' })
    return
  }
  // 模型不可用 / 超时 / 重试后仍失败：离线兜底，绝不让点击无反馈
  const line = OFFLINE_LINES[Math.floor(Math.random() * OFFLINE_LINES.length)]
  emit({ type: 'delta', text: line })
  emit({ type: 'done' })
}

/**
 * 解析当前默认模型的「快速档」reasoning effort id（无匹配/解析失败→undefined=省略）。
 * 结果按 (provider, model) 缓存——缓存的是解析 Promise，并发首调只解析一次，
 * 解析失败也缓存「省略」结论；进程内 Map 随 DSH 重启自然失效，
 * 无需主动监听 llm 配置变更。
 */
async function resolveFastEffort(
  ctx: CordisCtx, model: { provider: string; model: string } | null,
  signal?: AbortSignal,
): Promise<string | undefined> {
  if (model === null) return undefined
  const key = `${model.provider}\u0000${model.model}`
  const cached = fastEffortCache.get(key)
  if (cached !== undefined) return cached

  const llm = ctx.get('llm') as LlmService | undefined
  const log = (msg: string) => {
    if (fastEffortLogged.has(key)) return
    fastEffortLogged.add(key)
    try { console.warn(`[dsh-skin-study] ${msg}`) } catch { /* ignore */ }
  }

  let promise: Promise<string | undefined>
  if (llm === undefined || typeof llm.resolveModelInfo !== 'function') {
    log(`模型 ${model.provider}/${model.model}：无法查询思考档位，省略 reasoningEffort`)
    promise = Promise.resolve(undefined)
  } else {
    promise = (async (): Promise<string | undefined> => {
      let resolved: string | undefined
      try {
        const info = await llm.resolveModelInfo!(model.provider, model.model, signal)
        const efforts = info?.reasoning?.efforts ?? []
        // 偏好序列在外层，efforts 只在每档里找同 id 项——按 FAST_EFFORT_PREFERENCE
        // 的优先级选择，而不是由 adapter 的展示顺序决定（adapter 顺序无语义）。
        for (const pref of FAST_EFFORT_PREFERENCE) {
          for (const e of efforts) {
            if ((e.id ?? '').toLowerCase() === pref) { resolved = e.id; break }
          }
          if (resolved !== undefined) break
        }
        if (resolved === undefined) {
          log(`模型 ${model.provider}/${model.model} 无 ${FAST_EFFORT_PREFERENCE.join('/')} 档位，省略 reasoningEffort 走默认`)
        } else {
          log(`模型 ${model.provider}/${model.model} 家具交互使用快速档 ${resolved}`)
        }
      } catch (error) {
        // 查询失败按「无此能力」处理：省略参数，宁慢勿崩（未知 id 会让 stream 抛错）。
        // 但若是本次交互被 abort 打断（AbortError），不把它当成模型无快速档的结论
        // 永久缓存，删掉缓存项让下次交互重新解析。
        if (signal?.aborted) {
          fastEffortCache.delete(key)
          return undefined
        }
        log(`模型 ${model.provider}/${model.model}：解析思考档位失败，省略 reasoningEffort`)
        resolved = undefined
      }
      return resolved
    })()
    // 失败也缓存 undefined，避免每条消息重复异常开销；catch 后不 rethrow，
    // 保证缓存里永远是 resolved promise，后续 await 不会抛
    promise = promise.catch(() => undefined)
  }
  fastEffortCache.set(key, promise)
  return promise
}

/** 能力描述：id → 静态配置 + prompt 构造。 */
interface FurnitureAbility {
  title: string
  cooldown: number
  streaming: boolean
  buildSystem?: () => string
  buildUser: (methods: HostMethods) => Promise<string>
}

/** 天气能力：先 search 真实天气，再让模型叙述。 */
function makeWeatherAbility(): FurnitureAbility {
  return {
    title: '窗外',
    cooldown: 60,
    streaming: true,
    buildSystem: () => [
      '以下是刚刚实时检索到的天气信息（可能不完整或已过时，请如实转述，不要编造缺失的数据）：',
      '如果没有检索到数据，请直接说「现在看不清窗外」，并给出一个温柔的小建议（带伞/加衣）。',
    ].join('\n'),
    buildUser: async (methods) => {
      const city = DEFAULT_CITY
      const data = await methods.searchWeather(`${city} 今日天气`)
      const brief = data && data.content ? data.content.slice(0, 600)
        : (data ? JSON.stringify(data.sources).slice(0, 400) : '')
      return `用户站在书房的窗户边，想知道${city}今天的天气。\n实时检索结果如下：\n${brief || '（没有检索到数据）'}\n请以书房先生的口气播报此刻窗外。`
    },
  }
}

/** 沙发（灵感泡一壶）：随机思维实验/冷知识/金句。 */
function makeSofaAbility(): FurnitureAbility {
  return {
    title: '沙发一角',
    cooldown: 10,
    streaming: true,
    buildUser: async () => {
      const pick = SOFA_PROMPTS[Math.floor(Math.random() * SOFA_PROMPTS.length)]
      return `用户坐到旁边的沙发上，想放松一下。\n请完成下面这件事（不要拖沓）：\n${pick}`
    },
  }
}

/** 床（晚安复盘）：读取今日会话标题摘要，生成「今日三件事」+ 晚安。 */
function makeBedAbility(): FurnitureAbility {
  return {
    title: '晚安',
    cooldown: 20,
    streaming: true,
    buildSystem: () => [
      '阅读用户今天在 DSH 会话里做的事情（标题摘要列表）。',
      '如果列表为空，就不要编造具体事项，转而送一段简短的睡前小故事。',
      '结尾固定用一句晚安。',
    ].join('\n'),
    buildUser: async (methods) => {
      const titles = await methods.todaySessionTitles(20)
      const list = titles.length > 0 ? titles.map((t, i) => `${i + 1}. ${t}`).join('\n') : '（今天还没有会话记录）'
      return `现在是 ${methods.now()}，用户准备休息，躺在书房的小床上。\n用户今天在 DSH 里做的事（会话标题）：\n${list}\n请先挑 3 件最有意义的概括成「今日三件事」，再附一句温和的晚安。字数控制在 150 字内。`
    },
  }
}

/** 书架（抽一本书·知识卡）：推荐真实书籍的精讲 + 金句。 */
function makeShelfAbility(): FurnitureAbility {
  return {
    title: '书架',
    cooldown: 15,
    streaming: true,
    buildSystem: () => [
      '推荐一本真实存在、有分量的书（不要编造书名作者）。',
      '用「书名 · 作者 / 一段 40 字以内的精讲 / 一句值得抄下来的话」这种结构，不要用 Markdown 加粗。',
    ].join('\n'),
    buildUser: async () => '用户站在书架前，伸手抽出一本书。请从书架上「抽」一本书推荐给 TA，按你的推荐结构输出。',
  }
}

/** 书桌·茶杯：泡茶禅语。 */
function makeTeaAbility(): FurnitureAbility {
  return {
    title: '茶香',
    cooldown: 10,
    streaming: true,
    buildUser: async () => '用户端起书桌上的茶杯。请以书房先生的口气，说一句关于「此刻慢下来」的茶禅短句（40 字以内）。',
  }
}

/** 书桌·地球仪：世界一隅（随机城市冷知识）。 */
function makeGlobeAbility(): FurnitureAbility {
  return {
    title: '世界一隅',
    cooldown: 15,
    streaming: true,
    buildSystem: () => '随机挑一个真实存在的国家或城市，讲 3 条冷门但真实的知识，每条 20 字以内，用编号列表。',
    buildUser: async () => '用户拨动书桌上的地球仪。请随机挑一个世界角落，讲 3 条冷门真实的知识。',
  }
}

/** 书桌·便签：今日 3 条小建议。 */
function makeNotepadAbility(): FurnitureAbility {
  return {
    title: '便签',
    cooldown: 30,
    streaming: true,
    buildUser: async (methods) => {
      return `用户看到书桌上的便签本。现在是 ${methods.now()}。请基于当前时间给 3 条轻量、实用的小建议（工作或生活），每条不超过 25 字，用编号。`
    },
  }
}

/** 书法卷轴：今日一帖（格言）。 */
function makeScrollAbility(): FurnitureAbility {
  return {
    title: '今日一帖',
    cooldown: 10,
    streaming: true,
    buildSystem: () => '送一句原创格言（20 字内），再写一行 15 字内的白话注脚。不要 Markdown，中间用「——」分隔。',
    buildUser: async () => '用户抬头看墙上的书法卷轴。请题一句今日格言。',
  }
}

/** 能力注册表（id → 能力）。 */
const ABILITY_MAP: Record<string, FurnitureAbility> = {
  window: makeWeatherAbility(),
  sofa: makeSofaAbility(),
  bed: makeBedAbility(),
  shelf: makeShelfAbility(),
  tea: makeTeaAbility(),
  globe: makeGlobeAbility(),
  notepad: makeNotepadAbility(),
  scroll: makeScrollAbility(),
}

/** 每家具冷却记录：id → 上次触发时间戳。 */
function makeCooldowns() {
  const map = new Map<string, number>()
  return {
    check: (id: string, cooldown: number): boolean => {
      const last = map.get(id) ?? 0
      const now = Date.now()
      if (now - last < cooldown * 1000) return false
      map.set(id, now)
      return true
    },
    dispose: () => map.clear(),
  }
}

/**
 * Apply the Cozy Study host half: register the furniture-interaction API over
 * `webServer`. Everything is retracted by the effect disposer.
 * @param ctx - owning Cordis context.
 */
export function apply(ctx: {
  get: (name: string) => unknown
  inject: (names: string[], cb: (c: unknown) => void) => unknown
  effect: (fn: () => () => void, label: string) => unknown
}): void {
  const cooldowns = makeCooldowns()

  const methods: HostMethods = {
    async searchWeather(query) {
      try {
        const web = ctx.get('web') as { search?: (req: { query: string; maxResults?: number }) => Promise<{ content?: string; sources: readonly unknown[] }> } | undefined
        if (!web || typeof web.search !== 'function') return null
        const result = await web.search({ query, maxResults: 3 })
        return { content: result.content, sources: result.sources }
      } catch {
        return null
      }
    },
    currentModel() {
      const agentDefault = ctx.get('agentDefaultModel') as { currentSelection?: () => { provider: string; model: string } } | undefined
      const selection = agentDefault?.currentSelection?.()
      if (!selection || !selection.provider || !selection.model) return null
      return { provider: selection.provider, model: selection.model }
    },
    now() {
      const d = new Date()
      const pad = (n: number) => String(n).padStart(2, '0')
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`
    },
    async todaySessionTitles(n) {
      try {
        const sessionQuery = ctx.get('sessionQuery') as {
          listSessions?: () => Promise<Array<{ id: string; title?: string; updatedAt?: number }>>
          readTitle?: (id: string) => Promise<{ title?: string } | undefined>
        } | undefined
        const sessions = typeof sessionQuery?.listSessions === 'function'
          ? await sessionQuery.listSessions()
          : []
        const now = new Date()
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime()
        const today: string[] = []
        for (const s of sessions) {
          if (today.length >= n) break
          const updated = s.updatedAt ?? 0
          if (updated < dayStart) continue
          let title = s.title ?? ''
          if (!title && typeof sessionQuery?.readTitle === 'function') {
            try {
              const t = await sessionQuery.readTitle(s.id)
              title = t?.title ?? ''
            } catch { /* ignore */ }
          }
          if (title && title.length > 0) today.push(title.slice(0, 80))
        }
        return today
      } catch {
        return []
      }
    },
  }

  ctx.inject(['webServer'], (webCtx) => {
    const effectFn = (webCtx as { effect: (fn: () => () => void, label: string) => unknown }).effect
    const cleanup = effectFn(() => {
      const webServer = (webCtx as { webServer: { register: (r: unknown) => () => void } }).webServer
      const cancel = webServer.register({
        kind: 'prefix',
        path: '/dsh-skin-study',
        handler: async (
          req: import('node:http').IncomingMessage,
          res: import('node:http').ServerResponse,
        ) => {
          const url = (req.url ?? '/').split('?')[0]

          // 健康检查
          if (req.method === 'GET' && url === '/dsh-skin-study/ping') {
            res.writeHead(200, {
              'content-type': 'application/json; charset=utf-8',
              'cache-control': 'no-store',
            })
            res.end(JSON.stringify({ ok: true, name: 'dsh-skin-study', abilities: [...ABILITY_IDS] }))
            return
          }

          // 调试：环境探针（模型/llm/服务可用性），便于排查交互失败
          if (req.method === 'GET' && url === '/dsh-skin-study/debug') {
            const llm = ctx.get('llm') as { listProviders?: () => unknown } | undefined
            const probe = {
              model: methods.currentModel(),
              fastEffort: await resolveFastEffort(ctx, methods.currentModel()),
              llmPresent: !!llm,
              llmProviders: typeof llm?.listProviders === 'function' ? safeProviderList(llm.listProviders()) : 'n/a',
              webPresent: !!ctx.get('web'),
              sessionQueryPresent: !!ctx.get('sessionQuery'),
              agentDefaultModelPresent: !!ctx.get('agentDefaultModel'),
            }
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify(probe))
            return
          }

          // 调试：参数矩阵测 llm.stream，定位家具交互失败原因
          if (req.method === 'GET' && url === '/dsh-skin-study/debug/llm-test') {
            const model = methods.currentModel()
            const llm = ctx.get('llm') as { stream?: (o: unknown) => AsyncIterable<{ type: string; text?: string }> } | undefined
            const results: Array<Record<string, unknown>> = []
            if (!llm || typeof llm.stream !== 'function') {
              results.push({ name: 'probe', error: 'NO_LLM_STREAM' })
            } else {
              const mkMessages = (text: string) => [{
                id: `dsh-skin-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
                role: 'user',
                content: [{ type: 'text', text }],
                source: { kind: 'plugin', plugin: 'dsh-skin-study' },
              }]
              const variants: Array<Record<string, unknown>> = [
                { name: 'sofa-full', system: '你是书房先生。', user: '用户坐到旁边的沙发上。请讲一个冷门但真实的历史事实。', temperature: 0.85, maxTokens: 512 },
                { name: 'no-temp', system: '你是书房先生。', user: '用户坐到旁边的沙发上。请讲一个冷门但真实的历史事实。', maxTokens: 512 },
                { name: 'no-system', user: '用户坐到旁边的沙发上。请讲一个冷门但真实的历史事实。', maxTokens: 512 },
                { name: 'tiny', system: '你是书房先生。', user: '只回复：你好', temperature: 0.85, maxTokens: 32 },
              ]
              for (const variant of variants) {
                const steps: string[] = []
                try {
                  const opt: Record<string, unknown> = {
                    provider: model?.provider ?? 'litellm',
                    model: model?.model ?? 'deepseek-v4-flash-0731',
                    messages: mkMessages(String(variant.user)),
                  }
                  if (variant.system) opt.system = variant.system
                  if (variant.temperature !== undefined) opt.temperature = variant.temperature
                  if (variant.maxTokens !== undefined) opt.maxTokens = variant.maxTokens
                  let got = 0
                  for await (const chunk2 of (llm.stream as (o: unknown) => AsyncIterable<{ type: string; text?: string }>)(opt)) {
                    got += 1
                    if (got <= 2) steps.push(`CHUNK:${chunk2.type}:${typeof chunk2.text === 'string' ? chunk2.text.slice(0, 20) : ''}`)
                  }
                  steps.push(`TOTAL:${got}`)
                  results.push({ name: variant.name, steps })
                } catch (error) {
                  results.push({ name: variant.name, error: error instanceof Error ? error.message : String(error) })
                }
              }
            }
            res.writeHead(200, { 'content-type': 'application/json; charset=utf-8' })
            res.end(JSON.stringify({ model, results }))
            return
          }

          // 家具交互：POST /dsh-skin-study/api/interact {id, city?}
          if (req.method === 'POST' && url === '/dsh-skin-study/api/interact') {
            const body = await readBody(req)
            let payload: { id?: string; city?: string } = {}
            try { payload = JSON.parse(body || '{}') } catch { payload = {} }
            const id = payload.id ?? ''
            if (!id || !ABILITY_IDS.has(id)) {
              res.writeHead(400, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ ok: false, reason: 'missing-id' }))
              return
            }

            const ability = ABILITY_MAP[id]
            if (!cooldowns.check(id, ability.cooldown)) {
              res.writeHead(429, { 'content-type': 'application/json; charset=utf-8' })
              res.end(JSON.stringify({ ok: false, reason: 'cooldown', seconds: ability.cooldown }))
              return
            }

            // NDJSON 流式响应
            res.writeHead(200, {
              'content-type': 'application/x-ndjson; charset=utf-8',
              'cache-control': 'no-store',
              'x-ability': id,
              'x-title': encodeURIComponent(ability.title),
            })
            const controller = new AbortController()
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS)
            const emit: Emit = (chunk) => {
              try { res.write(`${JSON.stringify(chunk)}\n`) } catch { /* client gone */ }
            }
            try {
              emit({ type: 'meta', title: ability.title, id })
              await runAbility(ctx, methods, id, controller.signal, emit)
            } catch (error) {
              emit({ type: 'error', text: error instanceof Error ? error.message : String(error) })
              const line = OFFLINE_LINES[Math.floor(Math.random() * OFFLINE_LINES.length)]
              emit({ type: 'delta', text: line })
              emit({ type: 'done' })
            } finally {
              clearTimeout(timer)
              try { res.end() } catch { /* client gone */ }
            }
            return
          }

          res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
          res.end('not found')
        },
      })
      return () => { cancel(); cooldowns.dispose() }
    }, 'dsh-skin-study: api')
    return cleanup
  })

  ctx.effect(() => () => cooldowns.dispose())
}

/** 把 llm.listProviders() 结果安全转成可 JSON 序列化的字符串数组（调试探针用）。 */
function safeProviderList(list: unknown): unknown {
  try {
    if (!Array.isArray(list)) return list
    return list.map((p) => {
      if (p && typeof p === 'object' && 'id' in p) return String((p as { id: unknown }).id)
      return String(p)
    })
  } catch {
    return 'n/a'
  }
}

function readBody(req: import('node:http').IncomingMessage): Promise<string> {
  return new Promise((resolve) => {
    let data = ''
    req.setEncoding('utf8')
    req.on('data', (chunk: string) => { data += chunk })
    req.on('end', () => resolve(data))
    req.on('error', () => resolve(data))
  })
}
