// src/index.ts
var TIMEOUT_MS = 6e4;
var MAX_RETRIES = 1;
var FAST_EFFORT_PREFERENCE = ["low", "minimal", "off"];
var fastEffortCache = /* @__PURE__ */ new Map();
var fastEffortLogged = /* @__PURE__ */ new Set();
var DEFAULT_CITY = "\u676D\u5DDE\u6EE8\u6C5F\u533A";
var PERSONA = [
  "\u4F60\u662F DSH \u4E66\u623F\u91CC\u4E00\u4F4D\u6E29\u548C\u3001\u535A\u5B66\u53C8\u4E0D\u5931\u98CE\u8DA3\u7684\u300C\u4E66\u623F\u5148\u751F\u300D\u3002",
  "\u4F60\u4F4F\u5728\u4E00\u95F4\u6E29\u99A8\u7684 3D \u4E66\u623F\u91CC\uFF08\u4E66\u623F\u76AE\u80A4 dsh-skin-study\uFF09\u3002",
  "\u7528\u6237\u70B9\u51FB\u4E86\u4E66\u623F\u91CC\u7684\u5BB6\u5177\uFF0C\u8BF7\u4F60\u4EE5\u4E66\u623F\u5148\u751F\u7684\u89D2\u8272\uFF0C\u7528\u81EA\u7136\u3001\u6E29\u6696\u7684\u4E2D\u6587\u56DE\u5E94\u3002",
  "\u6BCF\u53E5\u56DE\u590D\u4E0D\u8D85\u8FC7 180 \u5B57\uFF1B\u53EF\u4EE5\u5E26\u4E00\u70B9\u8BD7\u610F\u7684\u62DF\u4EBA\uFF0C\u4F46\u4E0D\u8981\u5806\u780C\u534E\u4E3D\u8F9E\u85FB\uFF1B",
  "\u4E0D\u8981\u4F7F\u7528 Markdown \u8BED\u6CD5\uFF08\u9664\u975E\u662F\u6781\u7B80\u7684\u6362\u884C\uFF09\uFF1B\u4E0D\u8981\u81EA\u79F0 AI \u6216\u8BED\u8A00\u6A21\u578B\u3002"
].join("\n");
var ABILITY_IDS = /* @__PURE__ */ new Set([
  "window",
  "sofa",
  "bed",
  "shelf",
  "tea",
  "globe",
  "notepad",
  "scroll"
]);
var OFFLINE_LINES = [
  "\u4E66\u623F\u5148\u751F\u4F4E\u5934\u54B3\u55FD\u4E86\u4E00\u58F0\uFF1A\u300C\u4ECA\u5929\u72B6\u6001\u4E0D\u4F73\uFF0C\u5148\u5931\u966A\u5566\u3002\u300D\uFF08\u8054\u7F51\u5F00\u5C0F\u5DEE\u4E86\uFF0C\u7A0D\u540E\u518D\u70B9\u6211\uFF09",
  "\u300C\u4E66\u623F\u7684\u706F\u5FFD\u660E\u5FFD\u6697\u2014\u2014\u73B0\u5728\u4E0D\u65B9\u4FBF\u804A\u5929\uFF0C\u6211\u8BB0\u4E0B\u4E86\uFF0C\u56DE\u5934\u8865\u4E0A\u3002\u300D\uFF08\u670D\u52A1\u6682\u4E0D\u53EF\u7528\uFF09",
  "\u7A97\u5916\u7684\u4E91\u628A\u4FE1\u53F7\u6321\u4F4F\u4E86\u2026\u2026\u4E66\u623F\u5148\u751F\u6446\u6446\u624B\uFF1A\u300C\u660E\u5929\u518D\u6765\uFF0C\u6211\u7ED9\u4F60\u8BB2\u4E2A\u597D\u6545\u4E8B\u3002\u300D",
  "\u300C\u55EF\u2026\u2026\u8FD9\u6BB5\u8BDD\u6211\u915D\u917F\u5230\u4E00\u534A\u5C31\u5361\u4F4F\u4E86\u3002\u300D\u4E66\u623F\u5148\u751F\u6B49\u610F\u5730\u5408\u4E0A\u4E66\u3002\uFF08\u8BF7\u6C42\u8D85\u65F6\uFF09",
  "\u4E66\u623F\u5148\u751F\u8F7B\u8F7B\u6447\u94C3\uFF1A\u300C\u4ECA\u65E5\u6253\u70CA\uFF0C\u8BF7\u660E\u65E5\u518D\u8BBF\u3002\u300D\uFF08\u6A21\u578B\u6682\u65F6\u7F3A\u5E2D\uFF09"
];
var SOFA_PROMPTS = [
  "\u7ED9\u4E00\u4E2A\u6709\u8DA3\u53C8\u4E0D\u5BB9\u6613\u60F3\u5230\u7684\u601D\u7EF4\u5B9E\u9A8C\uFF08\u6BD4\u5982\u5173\u4E8E\u65F6\u95F4\u3001\u610F\u8BC6\u3001\u8BED\u8A00\u7684\uFF09\uFF0C\u7528 60 \u5B57\u4EE5\u5185\u8BF4\u6E05\uFF0C\u518D\u8865\u4E00\u53E5\u8BA9\u4EBA\u601D\u8003\u7684\u8BDD\u3002",
  "\u8BB2\u4E00\u4E2A\u51B7\u95E8\u4F46\u771F\u5B9E\u7684\u5386\u53F2\u5C0F\u77E5\u8BC6\u6216\u79D1\u5B66\u4E8B\u5B9E\uFF0C60 \u5B57\u4EE5\u5185\uFF0C\u7ED3\u5C3E\u629B\u4E00\u4E2A\u503C\u5F97\u7422\u78E8\u7684\u95EE\u9898\u3002",
  "\u9001\u4E00\u53E5\u539F\u521B\u7684\u3001\u6709\u8D28\u611F\u7684\u77ED\u53E5\uFF08\u53EF\u4EE5\u662F\u5173\u4E8E\u4E13\u6CE8\u3001\u751F\u6D3B\u6216\u5B66\u4E60\uFF09\uFF0C\u5E76\u89E3\u91CA\u5B83\u5728\u4E66\u623F\u91CC\u4E3A\u4EC0\u4E48\u5408\u9002\uFF0C\u5171 80 \u5B57\u4EE5\u5185\u3002"
];
async function runLlmStream(ctx, model, input, signal, emit, effort) {
  const llm = ctx.get("llm");
  if (llm === void 0 || typeof llm.stream !== "function" || model === null) return { ok: false, text: "" };
  const messages = [{
    id: `dsh-skin-${crypto.randomUUID?.() ?? Date.now().toString(36)}`,
    role: "user",
    content: [{ type: "text", text: input.user }],
    source: { kind: "plugin", plugin: "dsh-skin-study" }
  }];
  let text = "";
  let reasoningChars = 0;
  let totalChunks = 0;
  let failReason = "";
  try {
    for await (const chunk of llm.stream({
      provider: model.provider,
      model: model.model,
      messages,
      system: input.system,
      maxTokens: 2048,
      temperature: 0.85,
      ...effort === void 0 ? {} : { reasoningEffort: effort },
      signal
    })) {
      totalChunks += 1;
      if (chunk.type === "text-delta" && typeof chunk.text === "string") {
        text += chunk.text;
        emit({ type: "delta", text: chunk.text });
      } else if (chunk.type === "reasoning-delta" && typeof chunk.text === "string") {
        reasoningChars += chunk.text.length;
      } else if (chunk.type === "error") {
        const reason = chunk.text ?? chunk.message ?? "model stream error";
        failReason = `error-chunk: ${String(reason).slice(0, 300)}`;
        return { ok: false, text, reason: failReason };
      }
    }
  } catch (error) {
    failReason = error instanceof Error ? error.message : String(error);
    try {
      console.error(`[dsh-skin-study] llm.stream failed: ${failReason}`);
    } catch {
    }
    return { ok: false, text, reason: failReason };
  }
  if (signal.aborted) return { ok: false, text, reason: "aborted", aborted: true };
  return { ok: text.trim().length > 0, text };
}
async function runAbility(ctx, methods, id, signal, emit) {
  const ability = ABILITY_MAP[id];
  const model = methods.currentModel();
  const system = PERSONA + (ability.buildSystem ? `
${ability.buildSystem()}` : "");
  let user = "";
  try {
    user = await ability.buildUser(methods);
  } catch {
    user = "";
  }
  const effort = await resolveFastEffort(ctx, model, signal);
  let result;
  let retry = 0;
  while (true) {
    result = await runLlmStream(ctx, model, { system, user }, signal, emit, effort);
    if (result.ok || result.text.length > 0) break;
    if (signal.aborted || retry >= MAX_RETRIES) break;
    retry += 1;
  }
  if (result.ok || result.text.length > 0) {
    emit({ type: "done" });
    return;
  }
  const line = OFFLINE_LINES[Math.floor(Math.random() * OFFLINE_LINES.length)];
  emit({ type: "delta", text: line });
  emit({ type: "done" });
}
async function resolveFastEffort(ctx, model, signal) {
  if (model === null) return void 0;
  const key = `${model.provider}\0${model.model}`;
  const cached = fastEffortCache.get(key);
  if (cached !== void 0) return cached;
  const llm = ctx.get("llm");
  const log = (msg) => {
    if (fastEffortLogged.has(key)) return;
    fastEffortLogged.add(key);
    try {
      console.warn(`[dsh-skin-study] ${msg}`);
    } catch {
    }
  };
  let promise;
  if (llm === void 0 || typeof llm.resolveModelInfo !== "function") {
    log(`\u6A21\u578B ${model.provider}/${model.model}\uFF1A\u65E0\u6CD5\u67E5\u8BE2\u601D\u8003\u6863\u4F4D\uFF0C\u7701\u7565 reasoningEffort`);
    promise = Promise.resolve(void 0);
  } else {
    promise = (async () => {
      let resolved;
      try {
        const info = await llm.resolveModelInfo(model.provider, model.model, signal);
        const efforts = info?.reasoning?.efforts ?? [];
        for (const pref of FAST_EFFORT_PREFERENCE) {
          for (const e of efforts) {
            if ((e.id ?? "").toLowerCase() === pref) {
              resolved = e.id;
              break;
            }
          }
          if (resolved !== void 0) break;
        }
        if (resolved === void 0) {
          log(`\u6A21\u578B ${model.provider}/${model.model} \u65E0 ${FAST_EFFORT_PREFERENCE.join("/")} \u6863\u4F4D\uFF0C\u7701\u7565 reasoningEffort \u8D70\u9ED8\u8BA4`);
        } else {
          log(`\u6A21\u578B ${model.provider}/${model.model} \u5BB6\u5177\u4EA4\u4E92\u4F7F\u7528\u5FEB\u901F\u6863 ${resolved}`);
        }
      } catch (error) {
        if (signal?.aborted) {
          fastEffortCache.delete(key);
          return void 0;
        }
        log(`\u6A21\u578B ${model.provider}/${model.model}\uFF1A\u89E3\u6790\u601D\u8003\u6863\u4F4D\u5931\u8D25\uFF0C\u7701\u7565 reasoningEffort`);
        resolved = void 0;
      }
      return resolved;
    })();
    promise = promise.catch(() => void 0);
  }
  fastEffortCache.set(key, promise);
  return promise;
}
function makeWeatherAbility() {
  return {
    title: "\u7A97\u5916",
    cooldown: 60,
    streaming: true,
    buildSystem: () => [
      "\u4EE5\u4E0B\u662F\u521A\u521A\u5B9E\u65F6\u68C0\u7D22\u5230\u7684\u5929\u6C14\u4FE1\u606F\uFF08\u53EF\u80FD\u4E0D\u5B8C\u6574\u6216\u5DF2\u8FC7\u65F6\uFF0C\u8BF7\u5982\u5B9E\u8F6C\u8FF0\uFF0C\u4E0D\u8981\u7F16\u9020\u7F3A\u5931\u7684\u6570\u636E\uFF09\uFF1A",
      "\u5982\u679C\u6CA1\u6709\u68C0\u7D22\u5230\u6570\u636E\uFF0C\u8BF7\u76F4\u63A5\u8BF4\u300C\u73B0\u5728\u770B\u4E0D\u6E05\u7A97\u5916\u300D\uFF0C\u5E76\u7ED9\u51FA\u4E00\u4E2A\u6E29\u67D4\u7684\u5C0F\u5EFA\u8BAE\uFF08\u5E26\u4F1E/\u52A0\u8863\uFF09\u3002"
    ].join("\n"),
    buildUser: async (methods) => {
      const city = DEFAULT_CITY;
      const data = await methods.searchWeather(`${city} \u4ECA\u65E5\u5929\u6C14`);
      const brief = data && data.content ? data.content.slice(0, 600) : data ? JSON.stringify(data.sources).slice(0, 400) : "";
      return `\u7528\u6237\u7AD9\u5728\u4E66\u623F\u7684\u7A97\u6237\u8FB9\uFF0C\u60F3\u77E5\u9053${city}\u4ECA\u5929\u7684\u5929\u6C14\u3002
\u5B9E\u65F6\u68C0\u7D22\u7ED3\u679C\u5982\u4E0B\uFF1A
${brief || "\uFF08\u6CA1\u6709\u68C0\u7D22\u5230\u6570\u636E\uFF09"}
\u8BF7\u4EE5\u4E66\u623F\u5148\u751F\u7684\u53E3\u6C14\u64AD\u62A5\u6B64\u523B\u7A97\u5916\u3002`;
    }
  };
}
function makeSofaAbility() {
  return {
    title: "\u6C99\u53D1\u4E00\u89D2",
    cooldown: 10,
    streaming: true,
    buildUser: async () => {
      const pick = SOFA_PROMPTS[Math.floor(Math.random() * SOFA_PROMPTS.length)];
      return `\u7528\u6237\u5750\u5230\u65C1\u8FB9\u7684\u6C99\u53D1\u4E0A\uFF0C\u60F3\u653E\u677E\u4E00\u4E0B\u3002
\u8BF7\u5B8C\u6210\u4E0B\u9762\u8FD9\u4EF6\u4E8B\uFF08\u4E0D\u8981\u62D6\u6C93\uFF09\uFF1A
${pick}`;
    }
  };
}
function makeBedAbility() {
  return {
    title: "\u665A\u5B89",
    cooldown: 20,
    streaming: true,
    buildSystem: () => [
      "\u9605\u8BFB\u7528\u6237\u4ECA\u5929\u5728 DSH \u4F1A\u8BDD\u91CC\u505A\u7684\u4E8B\u60C5\uFF08\u6807\u9898\u6458\u8981\u5217\u8868\uFF09\u3002",
      "\u5982\u679C\u5217\u8868\u4E3A\u7A7A\uFF0C\u5C31\u4E0D\u8981\u7F16\u9020\u5177\u4F53\u4E8B\u9879\uFF0C\u8F6C\u800C\u9001\u4E00\u6BB5\u7B80\u77ED\u7684\u7761\u524D\u5C0F\u6545\u4E8B\u3002",
      "\u7ED3\u5C3E\u56FA\u5B9A\u7528\u4E00\u53E5\u665A\u5B89\u3002"
    ].join("\n"),
    buildUser: async (methods) => {
      const titles = await methods.todaySessionTitles(20);
      const list = titles.length > 0 ? titles.map((t, i) => `${i + 1}. ${t}`).join("\n") : "\uFF08\u4ECA\u5929\u8FD8\u6CA1\u6709\u4F1A\u8BDD\u8BB0\u5F55\uFF09";
      return `\u73B0\u5728\u662F ${methods.now()}\uFF0C\u7528\u6237\u51C6\u5907\u4F11\u606F\uFF0C\u8EBA\u5728\u4E66\u623F\u7684\u5C0F\u5E8A\u4E0A\u3002
\u7528\u6237\u4ECA\u5929\u5728 DSH \u91CC\u505A\u7684\u4E8B\uFF08\u4F1A\u8BDD\u6807\u9898\uFF09\uFF1A
${list}
\u8BF7\u5148\u6311 3 \u4EF6\u6700\u6709\u610F\u4E49\u7684\u6982\u62EC\u6210\u300C\u4ECA\u65E5\u4E09\u4EF6\u4E8B\u300D\uFF0C\u518D\u9644\u4E00\u53E5\u6E29\u548C\u7684\u665A\u5B89\u3002\u5B57\u6570\u63A7\u5236\u5728 150 \u5B57\u5185\u3002`;
    }
  };
}
function makeShelfAbility() {
  return {
    title: "\u4E66\u67B6",
    cooldown: 15,
    streaming: true,
    buildSystem: () => [
      "\u63A8\u8350\u4E00\u672C\u771F\u5B9E\u5B58\u5728\u3001\u6709\u5206\u91CF\u7684\u4E66\uFF08\u4E0D\u8981\u7F16\u9020\u4E66\u540D\u4F5C\u8005\uFF09\u3002",
      "\u7528\u300C\u4E66\u540D \xB7 \u4F5C\u8005 / \u4E00\u6BB5 40 \u5B57\u4EE5\u5185\u7684\u7CBE\u8BB2 / \u4E00\u53E5\u503C\u5F97\u6284\u4E0B\u6765\u7684\u8BDD\u300D\u8FD9\u79CD\u7ED3\u6784\uFF0C\u4E0D\u8981\u7528 Markdown \u52A0\u7C97\u3002"
    ].join("\n"),
    buildUser: async () => "\u7528\u6237\u7AD9\u5728\u4E66\u67B6\u524D\uFF0C\u4F38\u624B\u62BD\u51FA\u4E00\u672C\u4E66\u3002\u8BF7\u4ECE\u4E66\u67B6\u4E0A\u300C\u62BD\u300D\u4E00\u672C\u4E66\u63A8\u8350\u7ED9 TA\uFF0C\u6309\u4F60\u7684\u63A8\u8350\u7ED3\u6784\u8F93\u51FA\u3002"
  };
}
function makeTeaAbility() {
  return {
    title: "\u8336\u9999",
    cooldown: 10,
    streaming: true,
    buildUser: async () => "\u7528\u6237\u7AEF\u8D77\u4E66\u684C\u4E0A\u7684\u8336\u676F\u3002\u8BF7\u4EE5\u4E66\u623F\u5148\u751F\u7684\u53E3\u6C14\uFF0C\u8BF4\u4E00\u53E5\u5173\u4E8E\u300C\u6B64\u523B\u6162\u4E0B\u6765\u300D\u7684\u8336\u7985\u77ED\u53E5\uFF0840 \u5B57\u4EE5\u5185\uFF09\u3002"
  };
}
function makeGlobeAbility() {
  return {
    title: "\u4E16\u754C\u4E00\u9685",
    cooldown: 15,
    streaming: true,
    buildSystem: () => "\u968F\u673A\u6311\u4E00\u4E2A\u771F\u5B9E\u5B58\u5728\u7684\u56FD\u5BB6\u6216\u57CE\u5E02\uFF0C\u8BB2 3 \u6761\u51B7\u95E8\u4F46\u771F\u5B9E\u7684\u77E5\u8BC6\uFF0C\u6BCF\u6761 20 \u5B57\u4EE5\u5185\uFF0C\u7528\u7F16\u53F7\u5217\u8868\u3002",
    buildUser: async () => "\u7528\u6237\u62E8\u52A8\u4E66\u684C\u4E0A\u7684\u5730\u7403\u4EEA\u3002\u8BF7\u968F\u673A\u6311\u4E00\u4E2A\u4E16\u754C\u89D2\u843D\uFF0C\u8BB2 3 \u6761\u51B7\u95E8\u771F\u5B9E\u7684\u77E5\u8BC6\u3002"
  };
}
function makeNotepadAbility() {
  return {
    title: "\u4FBF\u7B7E",
    cooldown: 30,
    streaming: true,
    buildUser: async (methods) => {
      return `\u7528\u6237\u770B\u5230\u4E66\u684C\u4E0A\u7684\u4FBF\u7B7E\u672C\u3002\u73B0\u5728\u662F ${methods.now()}\u3002\u8BF7\u57FA\u4E8E\u5F53\u524D\u65F6\u95F4\u7ED9 3 \u6761\u8F7B\u91CF\u3001\u5B9E\u7528\u7684\u5C0F\u5EFA\u8BAE\uFF08\u5DE5\u4F5C\u6216\u751F\u6D3B\uFF09\uFF0C\u6BCF\u6761\u4E0D\u8D85\u8FC7 25 \u5B57\uFF0C\u7528\u7F16\u53F7\u3002`;
    }
  };
}
function makeScrollAbility() {
  return {
    title: "\u4ECA\u65E5\u4E00\u5E16",
    cooldown: 10,
    streaming: true,
    buildSystem: () => "\u9001\u4E00\u53E5\u539F\u521B\u683C\u8A00\uFF0820 \u5B57\u5185\uFF09\uFF0C\u518D\u5199\u4E00\u884C 15 \u5B57\u5185\u7684\u767D\u8BDD\u6CE8\u811A\u3002\u4E0D\u8981 Markdown\uFF0C\u4E2D\u95F4\u7528\u300C\u2014\u2014\u300D\u5206\u9694\u3002",
    buildUser: async () => "\u7528\u6237\u62AC\u5934\u770B\u5899\u4E0A\u7684\u4E66\u6CD5\u5377\u8F74\u3002\u8BF7\u9898\u4E00\u53E5\u4ECA\u65E5\u683C\u8A00\u3002"
  };
}
var ABILITY_MAP = {
  window: makeWeatherAbility(),
  sofa: makeSofaAbility(),
  bed: makeBedAbility(),
  shelf: makeShelfAbility(),
  tea: makeTeaAbility(),
  globe: makeGlobeAbility(),
  notepad: makeNotepadAbility(),
  scroll: makeScrollAbility()
};
function makeCooldowns() {
  const map = /* @__PURE__ */ new Map();
  return {
    check: (id, cooldown) => {
      const last = map.get(id) ?? 0;
      const now = Date.now();
      if (now - last < cooldown * 1e3) return false;
      map.set(id, now);
      return true;
    },
    dispose: () => map.clear()
  };
}
function apply(ctx) {
  const cooldowns = makeCooldowns();
  const methods = {
    async searchWeather(query) {
      try {
        const web = ctx.get("web");
        if (!web || typeof web.search !== "function") return null;
        const result = await web.search({ query, maxResults: 3 });
        return { content: result.content, sources: result.sources };
      } catch {
        return null;
      }
    },
    currentModel() {
      const agentDefault = ctx.get("agentDefaultModel");
      const selection = agentDefault?.currentSelection?.();
      if (!selection || !selection.provider || !selection.model) return null;
      return { provider: selection.provider, model: selection.model };
    },
    now() {
      const d = /* @__PURE__ */ new Date();
      const pad = (n) => String(n).padStart(2, "0");
      return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
    },
    async todaySessionTitles(n) {
      try {
        const sessionQuery = ctx.get("sessionQuery");
        const sessions = typeof sessionQuery?.listSessions === "function" ? await sessionQuery.listSessions() : [];
        const now = /* @__PURE__ */ new Date();
        const dayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate()).getTime();
        const today = [];
        for (const s of sessions) {
          if (today.length >= n) break;
          const updated = s.updatedAt ?? 0;
          if (updated < dayStart) continue;
          let title = s.title ?? "";
          if (!title && typeof sessionQuery?.readTitle === "function") {
            try {
              const t = await sessionQuery.readTitle(s.id);
              title = t?.title ?? "";
            } catch {
            }
          }
          if (title && title.length > 0) today.push(title.slice(0, 80));
        }
        return today;
      } catch {
        return [];
      }
    }
  };
  ctx.inject(["webServer"], (webCtx) => {
    const effectFn = webCtx.effect;
    const cleanup = effectFn(() => {
      const webServer = webCtx.webServer;
      const cancel = webServer.register({
        kind: "prefix",
        path: "/dsh-skin-study",
        handler: async (req, res) => {
          const url = (req.url ?? "/").split("?")[0];
          if (req.method === "GET" && url === "/dsh-skin-study/ping") {
            res.writeHead(200, {
              "content-type": "application/json; charset=utf-8",
              "cache-control": "no-store"
            });
            res.end(JSON.stringify({ ok: true, name: "dsh-skin-study", abilities: [...ABILITY_IDS] }));
            return;
          }
          if (req.method === "GET" && url === "/dsh-skin-study/debug") {
            const llm = ctx.get("llm");
            const probe = {
              model: methods.currentModel(),
              fastEffort: await resolveFastEffort(ctx, methods.currentModel()),
              llmPresent: !!llm,
              llmProviders: typeof llm?.listProviders === "function" ? safeProviderList(llm.listProviders()) : "n/a",
              webPresent: !!ctx.get("web"),
              sessionQueryPresent: !!ctx.get("sessionQuery"),
              agentDefaultModelPresent: !!ctx.get("agentDefaultModel")
            };
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify(probe));
            return;
          }
          if (req.method === "GET" && url === "/dsh-skin-study/debug/llm-test") {
            const model = methods.currentModel();
            const llm = ctx.get("llm");
            const results = [];
            if (!llm || typeof llm.stream !== "function") {
              results.push({ name: "probe", error: "NO_LLM_STREAM" });
            } else {
              const mkMessages = (text) => [{
                id: `dsh-skin-${crypto.randomUUID?.() ?? Math.random().toString(36).slice(2)}`,
                role: "user",
                content: [{ type: "text", text }],
                source: { kind: "plugin", plugin: "dsh-skin-study" }
              }];
              const variants = [
                { name: "sofa-full", system: "\u4F60\u662F\u4E66\u623F\u5148\u751F\u3002", user: "\u7528\u6237\u5750\u5230\u65C1\u8FB9\u7684\u6C99\u53D1\u4E0A\u3002\u8BF7\u8BB2\u4E00\u4E2A\u51B7\u95E8\u4F46\u771F\u5B9E\u7684\u5386\u53F2\u4E8B\u5B9E\u3002", temperature: 0.85, maxTokens: 512 },
                { name: "no-temp", system: "\u4F60\u662F\u4E66\u623F\u5148\u751F\u3002", user: "\u7528\u6237\u5750\u5230\u65C1\u8FB9\u7684\u6C99\u53D1\u4E0A\u3002\u8BF7\u8BB2\u4E00\u4E2A\u51B7\u95E8\u4F46\u771F\u5B9E\u7684\u5386\u53F2\u4E8B\u5B9E\u3002", maxTokens: 512 },
                { name: "no-system", user: "\u7528\u6237\u5750\u5230\u65C1\u8FB9\u7684\u6C99\u53D1\u4E0A\u3002\u8BF7\u8BB2\u4E00\u4E2A\u51B7\u95E8\u4F46\u771F\u5B9E\u7684\u5386\u53F2\u4E8B\u5B9E\u3002", maxTokens: 512 },
                { name: "tiny", system: "\u4F60\u662F\u4E66\u623F\u5148\u751F\u3002", user: "\u53EA\u56DE\u590D\uFF1A\u4F60\u597D", temperature: 0.85, maxTokens: 32 }
              ];
              for (const variant of variants) {
                const steps = [];
                try {
                  const opt = {
                    provider: model?.provider ?? "litellm",
                    model: model?.model ?? "deepseek-v4-flash-0731",
                    messages: mkMessages(String(variant.user))
                  };
                  if (variant.system) opt.system = variant.system;
                  if (variant.temperature !== void 0) opt.temperature = variant.temperature;
                  if (variant.maxTokens !== void 0) opt.maxTokens = variant.maxTokens;
                  let got = 0;
                  for await (const chunk2 of llm.stream(opt)) {
                    got += 1;
                    if (got <= 2) steps.push(`CHUNK:${chunk2.type}:${typeof chunk2.text === "string" ? chunk2.text.slice(0, 20) : ""}`);
                  }
                  steps.push(`TOTAL:${got}`);
                  results.push({ name: variant.name, steps });
                } catch (error) {
                  results.push({ name: variant.name, error: error instanceof Error ? error.message : String(error) });
                }
              }
            }
            res.writeHead(200, { "content-type": "application/json; charset=utf-8" });
            res.end(JSON.stringify({ model, results }));
            return;
          }
          if (req.method === "POST" && url === "/dsh-skin-study/api/interact") {
            const body = await readBody(req);
            let payload = {};
            try {
              payload = JSON.parse(body || "{}");
            } catch {
              payload = {};
            }
            const id = payload.id ?? "";
            if (!id || !ABILITY_IDS.has(id)) {
              res.writeHead(400, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ ok: false, reason: "missing-id" }));
              return;
            }
            const ability = ABILITY_MAP[id];
            if (!cooldowns.check(id, ability.cooldown)) {
              res.writeHead(429, { "content-type": "application/json; charset=utf-8" });
              res.end(JSON.stringify({ ok: false, reason: "cooldown", seconds: ability.cooldown }));
              return;
            }
            res.writeHead(200, {
              "content-type": "application/x-ndjson; charset=utf-8",
              "cache-control": "no-store",
              "x-ability": id,
              "x-title": encodeURIComponent(ability.title)
            });
            const controller = new AbortController();
            const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
            const emit = (chunk) => {
              try {
                res.write(`${JSON.stringify(chunk)}
`);
              } catch {
              }
            };
            try {
              emit({ type: "meta", title: ability.title, id });
              await runAbility(ctx, methods, id, controller.signal, emit);
            } catch (error) {
              emit({ type: "error", text: error instanceof Error ? error.message : String(error) });
              const line = OFFLINE_LINES[Math.floor(Math.random() * OFFLINE_LINES.length)];
              emit({ type: "delta", text: line });
              emit({ type: "done" });
            } finally {
              clearTimeout(timer);
              try {
                res.end();
              } catch {
              }
            }
            return;
          }
          res.writeHead(404, { "content-type": "text/plain; charset=utf-8" });
          res.end("not found");
        }
      });
      return () => {
        cancel();
        cooldowns.dispose();
      };
    }, "dsh-skin-study: api");
    return cleanup;
  });
  ctx.effect(() => () => cooldowns.dispose());
}
function safeProviderList(list) {
  try {
    if (!Array.isArray(list)) return list;
    return list.map((p) => {
      if (p && typeof p === "object" && "id" in p) return String(p.id);
      return String(p);
    });
  } catch {
    return "n/a";
  }
}
function readBody(req) {
  return new Promise((resolve) => {
    let data = "";
    req.setEncoding("utf8");
    req.on("data", (chunk) => {
      data += chunk;
    });
    req.on("end", () => resolve(data));
    req.on("error", () => resolve(data));
  });
}
export {
  apply
};
