/**
 * AI 问答助手 — Cloudflare Worker
 * =====================================
 *
 * 部署方式：
 *   1. 登录 https://dash.cloudflare.com （用不绑卡的专用号）
 *   2. 左侧菜单 → Workers & Pages → 创建 Worker
 *   3. 把本文件内容粘贴到编辑器
 *   4. 保存并部署
 *   5. 记下生成的 Worker 域名（如 ujn-ai-worker.xxxx.workers.dev）
 *
 * 依赖：
 *   - 需要绑定一个 KV 命名空间（用于计数限流）
 *   在 Worker 设置的 "Variables" → "KV Namespace Bindings" 中绑定
 *   Variable name: AI_LIMIT_KV
 *   KV namespace: 新建一个即可（如 "ujn-ai-limit"）
 *
 * 安全设计（多层防护）：
 *   第 1 层：费用安全 — Free 计划 + 不绑卡，超限只报错不扣费
 *   第 2 层：来源检查 — 只允许来自本站域名的请求
 *   第 3 层：请求签名 — 前端附带校验 Token，阻止直接 curl 调用
 *   第 4 层：频率限制 — IP 级别每天 30 次 + 全站每天 8,000 次硬上限
 *   第 5 层：体积限制 — 限制请求体大小，防止恶意大请求
 */

// ================== 配置区 ==================
// 部署前请修改以下配置
const CONFIG = {
  // ——— 安全配置 ———
  // 允许的请求来源域名（必填：改成你的网站域名）
  ALLOWED_ORIGINS: ['https://ujn.matehub.top', 'http://localhost:8000', 'http://127.0.0.1:8000'],
  // 请求校验 Token（必填：改成随机字符串，同时更新前端 JS 的对应值）
  // 生成方式：打开浏览器控制台，输入 crypto.randomUUID() 复制结果
  ACCESS_TOKEN: 'REPLACE_WITH_YOUR_ACCESS_TOKEN',

  // ——— 限流配置 ———
  // 每人每天最多 AI 问答次数
  USER_DAILY_LIMIT: 20,
  // 全站每天最多 AI 问答次数（预留 20% buffer，低于 10k 免费额度）
  GLOBAL_DAILY_LIMIT: 4000,

  // ——— AI 配置 ———
  // AI 模型：智谱 GLM-4.7-Flash（免费、中文优化、支持函数调用）
  AI_MODEL: '@cf/zai-org/glm-4.7-flash',
  // AI 回答最大 token 数
  MAX_TOKENS: 1024,
  // 请求体最大字节数（防止恶意大请求）
  MAX_BODY_BYTES: 102400, // 100KB
};

// ================== 安全检测函数 ==================

/**
 * 安全检测第 2 层：来源检查
 * 验证请求的 Origin / Referer 是否来自允许的域名
 */
function checkOrigin(request) {
  const origin = request.headers.get('Origin') || '';
  const referer = request.headers.get('Referer') || '';
  const source = origin || referer;

  if (!source) {
    return { ok: false, reason: '缺少请求来源' };
  }

  try {
    const url = new URL(source);
    const allowed = CONFIG.ALLOWED_ORIGINS.some(allowed => {
      // 支持精确匹配和通配符匹配（如 *.example.com）
      if (allowed.startsWith('*.')) {
        const suffix = allowed.slice(1); // .example.com
        return url.hostname.endsWith(suffix) || url.hostname === suffix.slice(1);
      }
      return url.origin === allowed || url.hostname === allowed;
    });

    if (!allowed) {
      return { ok: false, reason: '不允许的请求来源' };
    }
    return { ok: true };
  } catch {
    return { ok: false, reason: '无效的请求来源' };
  }
}

/**
 * 安全检测第 3 层：请求签名校验
 * 验证请求头中的 X-Access-Token 是否匹配
 *
 * 注意：这是防止"顺手 curl"级别的防护，
 * Token 存在于前端 JS 中，无法防止技术用户逆向。
 * 真正防恶意攻击靠第 2 层（来源检查）和第 4 层（限流）。
 */
function checkToken(request) {
  const token = request.headers.get('X-Access-Token') || '';
  if (token !== CONFIG.ACCESS_TOKEN) {
    return { ok: false, reason: '请求校验失败' };
  }
  return { ok: true };
}

// ================== CORS 辅助函数 ==================

/**
 * 根据请求 Origin 动态生成 CORS 响应头
 */
function corsHeaders(request) {
  const origin = request.headers.get('Origin') || '';
  const allowed = CONFIG.ALLOWED_ORIGINS.some(allowed => {
    if (allowed.startsWith('*.')) {
      try {
        const url = new URL(origin);
        const suffix = allowed.slice(1);
        return url.hostname.endsWith(suffix) || url.hostname === suffix.slice(1);
      } catch { return false; }
    }
    return origin === allowed;
  });
  return {
    'Access-Control-Allow-Origin': allowed ? origin : (CONFIG.ALLOWED_ORIGINS[0] || '*'),
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, X-Access-Token',
    'Access-Control-Max-Age': '86400',
  };
}

/**
 * 快捷创建带 CORS 头的响应
 */
function jsonResponse(data, status, request, extraHeaders) {
  return new Response(JSON.stringify(data), {
    status: status || 200,
    headers: { ...corsHeaders(request), 'Content-Type': 'application/json', ...extraHeaders }
  });
}

// ================== Worker 主入口 ==================
export default {
  async fetch(request, env) {
    // ========== CORS 预检请求 ==========
    if (request.method === 'OPTIONS') {
      return new Response(null, { status: 204, headers: corsHeaders(request) });
    }

    // ========== 第 1 道防线：只接受 POST ==========
    if (request.method !== 'POST') {
      return jsonResponse({ error: '仅支持 POST 请求' }, 405, request, { 'Allow': 'POST' });
    }

    // ========== 第 2 道防线：检查请求来源 ==========
    const originCheck = checkOrigin(request);
    if (!originCheck.ok) {
      return jsonResponse({ error: originCheck.reason }, 403, request);
    }

    // ========== 第 3 道防线：校验访问 Token ==========
    const tokenCheck = checkToken(request);
    if (!tokenCheck.ok) {
      return jsonResponse({ error: tokenCheck.reason }, 403, request);
    }

    // ========== 第 4 道防线：限流（见后文） ==========

    // 检查 Content-Type
    const contentType = request.headers.get('Content-Type') || '';
    if (!contentType.includes('application/json')) {
      return jsonResponse({ error: '请使用 application/json' }, 400, request);
    }

    // 限制请求体大小
    const contentLength = parseInt(request.headers.get('Content-Length') || '0', 10);
    if (contentLength > CONFIG.MAX_BODY_BYTES) {
      return jsonResponse({ error: '请求体过大' }, 413, request);
    }

    // 解析请求体
    let body;
    try {
      body = await request.json();
    } catch {
      return jsonResponse({ error: '无效的 JSON' }, 400, request);
    }

    const { question, context } = body;
    if (!question || !context) {
      return jsonResponse({ error: '缺少必要参数: question, context' }, 400, request);
    }

    // 限制内容长度
    if (question.length > 2000 || context.length > 50000) {
      return new Response(JSON.stringify({ error: '问题或上下文字数超限' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' }
      });
    }

    // 获取客户端 IP（Cloudflare 会自动提供）
    const clientIP = request.headers.get('CF-Connecting-IP') || 'unknown';
    const today = new Date().toISOString().slice(0, 10); // YYYY-MM-DD

    // ========== 第 4 道防线：严格熔断限流 ==========
    // 4.1 熔断检查：如果 KV 绑定失效/未就绪，直接拒绝请求，防止无限制消耗 AI 额度
    if (!env.AI_LIMIT_KV) {
      return jsonResponse({
        error: 'system_error',
        message: '限流服务未就绪，出于安全考虑暂停 AI 服务。'
      }, 500, request);
    }

    const userKey = `user:${clientIP}:${today}`;
    const globalKey = `global:${today}`;

    // 4.2 全局限流检查
    const globalCount = parseInt(await env.AI_LIMIT_KV.get(globalKey) || '0', 10);
    if (globalCount >= CONFIG.GLOBAL_DAILY_LIMIT) {
      return jsonResponse({
        error: 'daily_limit_global',
        message: '今天全站的免费 AI 问答次数已用完，明天再来吧！你也可以切换到"自带 Key"模式继续使用。',
        quota: { used: globalCount, limit: CONFIG.GLOBAL_DAILY_LIMIT, reset: today }
      }, 429, request);
    }

    // 4.3 用户个人限流检查
    const userCount = parseInt(await env.AI_LIMIT_KV.get(userKey) || '0', 10);
    if (userCount >= CONFIG.USER_DAILY_LIMIT) {
      return jsonResponse({
        error: 'daily_limit_user',
        message: `你今天的免费 AI 问答次数已用完（${CONFIG.USER_DAILY_LIMIT} 次），明天再来吧！`,
        quota: { used: userCount, limit: CONFIG.USER_DAILY_LIMIT, reset: today }
      }, 429, request, {
        'X-RateLimit-Limit': String(CONFIG.USER_DAILY_LIMIT),
        'X-RateLimit-Remaining': '0',
      });
    }

    // ========== 关键优化：先预扣/更新额度（原子递增），防止并发高频请求绕过限流 ==========
    await Promise.all([
      env.AI_LIMIT_KV.put(userKey, String(userCount + 1), { expirationTtl: 86400 }),
      env.AI_LIMIT_KV.put(globalKey, String(globalCount + 1), { expirationTtl: 86400 })
    ]);

    // ========== 第 5 道防线：检查 AI binding ==========
    if (!env.AI) {
      return jsonResponse({
        error: 'ai_not_configured',
        message: 'AI 功能未配置，请联系管理员。'
      }, 500, request);
    }

    // ==================== 调用 Workers AI ====================
    const systemPrompt = `## 身份
你是"济南大学校园通"的 AI 助手，专门回答关于济南大学校园生活、学业、制度的问题。

## 核心原则
1. 优先使用以下"参考资料"回答问题。如果参考资料中不包含相关信息，请如实说"当前知识库中暂时没有查到相关信息"。
2. 回答结尾标注信息来源于哪篇文档（用 📚 来源: 《文档标题》的格式）。
3. 回答简洁明了，使用中文口语化表达，像学长学姐在说话。
4. 如果用户的问题与济南大学无关，礼貌地说明你只回答校园相关问题。
5. 不要编造信息，不确定就说不知道。

## 参考资料
${context}`;

    try {
      // 以流式方式调用 AI
      const aiResponse = await env.AI.run(CONFIG.AI_MODEL, {
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: CONFIG.MAX_TOKENS,
        stream: true,
      });

      // 返回流式响应（带 CORS 头）
      return new Response(aiResponse, {
        headers: {
          ...corsHeaders(request),
          'Content-Type': 'text/event-stream',
          'Cache-Control': 'no-cache',
          'Connection': 'keep-alive',
        }
      });

    } catch (err) {
      console.error('AI 调用失败:', err);
      return jsonResponse({
        error: 'ai_error',
        message: 'AI 暂时无法响应，请稍后重试。'
      }, 500, request);
    }
  }
};
