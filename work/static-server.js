const http = require("http");
const fs = require("fs");
const path = require("path");

const root = path.resolve(__dirname, "../outputs");
const localEnvPath = path.resolve(__dirname, ".env.local");
if (fs.existsSync(localEnvPath)) {
  const lines = fs.readFileSync(localEnvPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const eq = trimmed.indexOf("=");
    if (eq <= 0) continue;
    const key = trimmed.slice(0, eq).trim();
    const value = trimmed.slice(eq + 1).trim().replace(/^["']|["']$/g, "");
    if (!process.env[key]) process.env[key] = value;
  }
}
const port = Number(process.env.PORT || 5177);
const zhipuApiKey = process.env.ZHIPU_API_KEY || process.env.ZAI_API_KEY || "";
const zhipuBaseUrl = process.env.ZHIPU_BASE_URL || "https://open.bigmodel.cn/api/paas/v4";
const zhipuModel = process.env.ZHIPU_MODEL || "glm-4.5";

function sendJson(res, status, data) {
  res.writeHead(status, { "content-type": "application/json; charset=utf-8" });
  res.end(JSON.stringify(data));
}

function readJson(req) {
  return new Promise((resolve, reject) => {
    let body = "";
    req.on("data", (chunk) => {
      body += chunk;
      if (body.length > 8 * 1024 * 1024) {
        req.destroy();
        reject(new Error("request body too large"));
      }
    });
    req.on("end", () => {
      try {
        resolve(body ? JSON.parse(body) : {});
      } catch (error) {
        reject(new Error(`请求 JSON 格式错误：${error.message}`));
      }
    });
    req.on("error", reject);
  });
}

function extractJson(text) {
  const cleaned = String(text || "").trim();
  const fenced = cleaned.match(/```(?:json)?\s*([\s\S]*?)```/i);
  const raw = fenced ? fenced[1].trim() : cleaned;
  try {
    return JSON.parse(raw);
  } catch (_) {
    const start = raw.indexOf("{");
    const end = raw.lastIndexOf("}");
    if (start >= 0 && end > start) return JSON.parse(raw.slice(start, end + 1));
    throw new Error("model did not return valid JSON");
  }
}

async function callZhipu(messages, options = {}) {
  if (!zhipuApiKey) {
    const error = new Error("missing ZHIPU_API_KEY");
    error.code = "NO_API_KEY";
    throw error;
  }
  const response = await fetch(`${zhipuBaseUrl.replace(/\/$/, "")}/chat/completions`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      authorization: `Bearer ${zhipuApiKey}`
    },
    body: JSON.stringify({
      model: options.model || zhipuModel,
      messages,
      temperature: options.temperature ?? 0.75,
      top_p: options.top_p ?? 0.9,
      max_tokens: options.max_tokens ?? 2600
    })
  });
  const body = await response.text();
  if (!response.ok) {
    const error = new Error(`Zhipu API ${response.status}: ${body.slice(0, 500)}`);
    error.status = response.status;
    throw error;
  }
  const data = JSON.parse(body);
  return data.choices?.[0]?.message?.content || "";
}

async function callJson(messages, options = {}) {
  const content = await callZhipu(messages, options);
  try {
    return extractJson(content);
  } catch (firstError) {
    const repaired = await callZhipu([
      { role: "system", content: "你是 JSON 修复器。只输出合法 JSON，不要 markdown，不要解释。" },
      {
        role: "user",
        content: `下面内容本应是 JSON，但格式有错误。请在不改变语义的前提下修复为合法 JSON，只输出 JSON：\n\n${content}`
      }
    ], { temperature: 0.1, max_tokens: options.max_tokens || 2200 });
    try {
      return extractJson(repaired);
    } catch (secondError) {
      const error = new Error(`AI 返回内容不是合法 JSON：${firstError.message}`);
      error.raw = content.slice(0, 1200);
      throw error;
    }
  }
}

function systemPrompt() {
  return [
    "你是一个中文网文口味分析与原创代餐生成助手。",
    "目标是提取抽象阅读体验，不复用原文人物、地名、专有设定、具体桥段和原句。",
    "特别重视角色关系、语言口感、口癖、亲密度、互动循环、禁止漂移项。",
    "输出必须满足用户指定格式。"
  ].join("\n");
}

async function handleAnalyze(req, res) {
  const body = await readJson(req);
  const input = {
    bookName: body.bookName || "",
    text: body.text || "",
    thrill: body.thrill || "",
    avoid: body.avoid || "",
    inputMode: body.inputMode || "clips"
  };
  const userPrompt = `
请分析用户喜欢的小说口感，输出严格 JSON，不要写 markdown。

用户作品/口味：${input.bookName}
用户上头原因：${input.thrill}
避雷：${input.avoid}
输入模式：${input.inputMode}

参考文本/抽样片段：
${input.text.slice(0, 18000)}

JSON 结构：
{
  "input_summary": "一句话说明你从输入中看到了什么",
  "thrill": "核心爽点",
  "character_lock": {
    "relationship_dynamic": "抽象角色关系，不要具体人名",
    "role_a": "主动方/主导方人设与行为",
    "role_b": "被动方/反应方人设与行为",
    "interaction": ["反复出现的互动动作/关系循环"],
    "intimacy_level": 1-3,
    "clinginess_level": 1-3,
    "teasing_directness": 1-3,
    "nickname_style": ["可能的亲昵称呼/称呼风格"],
    "forbidden": ["不能漂移成什么"]
  },
  "voice_fingerprint": {
    "rhythm": "句式、对话比例、旁白密度",
    "dialogue_moves": ["常见对话招式"],
    "emotion": "情绪如何表达",
    "highlight_lines": ["可学习的高光句式类型，不要复用原句"],
    "forbidden_tone": ["禁用语气"]
  },
  "avoid": "整合后的避雷项"
}
`;
  const data = await callJson([
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt }
  ], { temperature: 0.35, max_tokens: 1800 });
  sendJson(res, 200, data);
}

async function handleProposals(req, res) {
  const body = await readJson(req);
  const userPrompt = `
基于以下“锁味分析”，生成 3 个原创代餐方向。输出严格 JSON。

锁味分析：
${JSON.stringify(body.analysis || {}, null, 2)}

要求：
- 不复用原文人物、地名、专有设定、具体桥段。
- 三个方向必须明显不同。
- 都要保留用户重点的抽象上头机制。

JSON 结构：
{
  "proposals": [
    {"badge":"熟悉口味","title":"《原创标题》","keep":"保留什么","diff":"变化什么","reader":"适合什么读者","plan":"生成正文时的场景与互动计划"},
    {"badge":"新设定同爽点","title":"《原创标题》","keep":"保留什么","diff":"变化什么","reader":"适合什么读者","plan":"生成正文时的场景与互动计划"},
    {"badge":"反差新口味","title":"《原创标题》","keep":"保留什么","diff":"变化什么","reader":"适合什么读者","plan":"生成正文时的场景与互动计划"}
  ]
}
`;
  const data = await callJson([
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt }
  ], { temperature: 0.8, max_tokens: 1800 });
  sendJson(res, 200, data);
}

async function handleGenerate(req, res) {
  const body = await readJson(req);
  const mode = body.append ? "继续下一段" : "免费试读开篇";
  const userPrompt = `
请生成中文原创网文正文。输出严格 JSON，不要 markdown。

任务：${mode}
所选代餐方向：
${JSON.stringify(body.proposal || {}, null, 2)}

锁味分析：
${JSON.stringify(body.analysis || {}, null, 2)}

已有正文（继续时参考，不要重复）：
${body.currentText ? String(body.currentText).slice(-3500) : "无"}

硬性要求：
1. 只保留抽象关系张力、语言口感和互动循环，不复用原文具体表达。
2. 如果亲密度/黏人度/调侃直白度较高，正文要体现更黏、更直白、更有身体互动的拉扯。
3. 对话要短、自然、有停顿和反问；少写“复杂情感”“命运”等 AI 腔。
4. 每 500 字至少 3 次具体动作互动。
5. 不要写剧情摘要，要写可阅读正文。
6. 字数 1200-1800 中文字。

JSON 结构：
{
  "content": "正文",
  "style_check": {
    "relationship": 0-100,
    "voice": 0-100,
    "interaction": 0-100,
    "originality": 0-100,
    "notes": "简短自检"
  }
}
`;
  const data = await callJson([
    { role: "system", content: systemPrompt() },
    { role: "user", content: userPrompt }
  ], { temperature: 0.88, max_tokens: 3200 });
  sendJson(res, 200, data);
}

async function handleApi(req, res, pathname) {
  try {
    if (req.method !== "POST") return sendJson(res, 405, { error: "method not allowed" });
    if (pathname === "/api/analyze") return await handleAnalyze(req, res);
    if (pathname === "/api/proposals") return await handleProposals(req, res);
    if (pathname === "/api/generate") return await handleGenerate(req, res);
    return sendJson(res, 404, { error: "not found" });
  } catch (error) {
    if (error.code === "NO_API_KEY") {
      return sendJson(res, 500, { error: "后端没有设置 ZHIPU_API_KEY，无法调用智谱 AI。" });
    }
    console.error(error);
    return sendJson(res, 500, { error: error.message || "server error" });
  }
}

http.createServer((req, res) => {
  const pathname = decodeURIComponent((req.url || "/").split("?")[0]);
  if (pathname.startsWith("/api/")) {
    handleApi(req, res, pathname);
    return;
  }

  let staticPath = pathname;
  if (staticPath === "/") staticPath = "/wenhuang-demo.html";
  const file = path.normalize(path.join(root, staticPath));
  if (!file.startsWith(root)) {
    res.writeHead(403);
    res.end("forbidden");
    return;
  }
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404);
      res.end("not found");
      return;
    }
    res.writeHead(200, {
      "content-type": file.endsWith(".html") ? "text/html; charset=utf-8" : "application/octet-stream"
    });
    res.end(data);
  });
}).listen(port, "127.0.0.1", () => {
  console.log(`Serving ${root} at http://127.0.0.1:${port}`);
  console.log(`AI backend: ${zhipuApiKey ? "Zhipu enabled" : "missing ZHIPU_API_KEY"}`);
});
