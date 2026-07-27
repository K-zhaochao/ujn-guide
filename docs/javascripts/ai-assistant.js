/**
 * AI 问答助手 — 前端 JavaScript
 * ====================================
 * 集成到 MkDocs Material + Pagefind 搜索中。
 * 
 * 功能：
 *   - AI 增强搜索开关
 *   - 三级模式：纯本地搜索 / 免费共享 AI / 自带 Key
 *   - AI 回答与全文检索结果分标签页展示
 *   - 流式输出 AI 回答
 *   - 免费额度显示与限流提示
 */

(function () {
  'use strict';

  // ==================== 配置 ====================
  const CONFIG = {
    // Cloudflare Worker 地址（部署后替换为实际地址）
    WORKER_URL: 'https://ujn-ai-worker.draven323.workers.dev',
    // 访问校验 Token（与 Worker 中的 ACCESS_TOKEN 保持一致）
    // 生成方式：浏览器控制台输入 crypto.randomUUID()，复制结果
    ACCESS_TOKEN: 'REPLACED_WORKER_ACCESS_TOKEN',
    // localStorage Key
    STORAGE_KEY: 'ujn_ai_config',
    // 流式文字刷新间隔（ms）
    STREAM_FLUSH_INTERVAL: 50,
  };

  // ==================== 状态管理 ====================
  const State = {
    // 上次 Pagefind 原始搜索结果（供 AI 上下文使用）
    lastRawResults: null,
    // AI 是否正在回答
    isAnswering: false,
    // 当前 AI 回答的 AbortController
    abortController: null,
    // 免费共享模式是否可用（Worker 返回非 429 即可用）
    freeModeAvailable: true,
    // 开关关闭前记忆的非 off 模式（恢复时用）
    lastNonOffMode: 'free',
  };

  // ==================== 配置持久化 ====================
  const Settings = {
    load() {
      try {
        const raw = localStorage.getItem(CONFIG.STORAGE_KEY);
        if (raw) return JSON.parse(raw);
      } catch (e) { /* ignore */ }
      return { mode: 'off', provider: 'deepseek', apiKey: '' };
    },

    save(settings) {
      localStorage.setItem(CONFIG.STORAGE_KEY, JSON.stringify(settings));
    },

    get() {
      return this.load();
    },

    setMode(mode) {
      const s = this.load();
      s.mode = mode;
      this.save(s);
    },

    setApiKey(key, provider) {
      const s = this.load();
      s.apiKey = key;
      s.provider = provider || 'deepseek';
      this.save(s);
    },

    clearApiKey() {
      const s = this.load();
      s.apiKey = '';
      this.save(s);
    },

    hasApiKey() {
      return !!this.load().apiKey;
    }
  };

  // ==================== AI 供应商配置 ====================
  const PROVIDERS = {
    deepseek: {
      name: 'DeepSeek',
      baseUrl: 'https://api.deepseek.com/v1',
      model: 'deepseek-chat',
      docs: 'https://platform.deepseek.com/api_keys',
    },
    openai: {
      name: 'OpenAI',
      baseUrl: 'https://api.openai.com/v1',
      model: 'gpt-4o-mini',
      docs: 'https://platform.openai.com/api-keys',
    },
    dashscope: {
      name: '通义千问',
      baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1',
      model: 'qwen-turbo',
      docs: 'https://bailian.console.aliyun.com/?apiKey=1',
    },
    openrouter: {
      name: 'OpenRouter',
      baseUrl: 'https://openrouter.ai/api/v1',
      model: 'deepseek/deepseek-chat',
      docs: 'https://openrouter.ai/keys',
    }
  };

  // ==================== Free AI（Level 1）：调 Worker ====================
  async function askFreeAI(question, context) {
    const response = await fetch(CONFIG.WORKER_URL + '/api/chat', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Access-Token': CONFIG.ACCESS_TOKEN,
      },
      body: JSON.stringify({ question, context }),
    });

    if (response.status === 429) {
      const data = await response.json();
      return { type: 'error', error: data.error, message: data.message, quota: data.quota };
    }

    if (!response.ok) {
      return { type: 'error', message: 'AI 服务暂时不可用，请稍后重试。' };
    }

    return { type: 'stream', body: response.body };
  }

  // ==================== BYOK（Level 2）：调用户自己的 API ====================
  async function askBYOK(question, context, settings) {
    const provider = PROVIDERS[settings.provider] || PROVIDERS.deepseek;
    const systemPrompt = `你是"济南大学校园通"的 AI 助手，专门回答关于济南大学校园生活、学业、制度的问题。

核心原则：
1. **必须基于以下"参考资料"来回答问题**。这些资料已经包含了你需要的全部信息，请直接从中提取答案。
2. 回答结尾用 📚 来源: 《文档标题》的格式标注信息来源。
3. 回答简洁明了，使用中文口语化表达，像学长学姐在说话。
4. 如果用户的问题与济南大学无关，礼貌地说明你只回答校园相关问题。
5. 不要编造信息。

参考资料：
${context}`;

    const response = await fetch(`${provider.baseUrl}/chat/completions`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${settings.apiKey}`,
      },
      body: JSON.stringify({
        model: provider.model,
        messages: [
          { role: 'system', content: systemPrompt },
          { role: 'user', content: question }
        ],
        max_tokens: 2048,
        stream: true,
      }),
    });

    if (!response.ok) {
      let msg = 'AI 请求失败';
      try {
        const data = await response.json();
        msg = data.error?.message || msg;
      } catch (e) { /* ignore */ }
      return { type: 'error', message: msg };
    }

    return { type: 'stream', body: response.body };
  }

  // ==================== 轻量级 Markdown 渲染 ====================
  function renderMarkdown(text) {
    if (!text) return '';
    // 转义 HTML
    var html = text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // 代码块 (```) — 必须在其他行内规则之前处理
    html = html.replace(/```(\w*)\n([\s\S]*?)```/g, function (_, lang, code) {
      return '<pre><code class="language-' + lang + '">' + code.replace(/</g, '&lt;').replace(/>/g, '&gt;') + '</code></pre>';
    });

    // 行内代码
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');

    // 加粗
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');

    // 斜体
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');

    // 链接 [text](url)
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // 无序列表项（- 或 * 开头）
    html = html.replace(/^(?:[-*])\s+(.+)$/gm, '<li>$1</li>');

    // 有序列表项（数字. 开头）
    html = html.replace(/^(\d+)\.\s+(.+)$/gm, '<li>$2</li>');

    // 将连续的 <li> 包裹在 <ul> 或 <ol> 中
    html = html.replace(/((?:<li>.*?<\/li>\n?)+)/g, function (match) {
      return '<ul>' + match + '</ul>';
    });

    // 段落（双换行分割）
    var paragraphs = html.split(/\n\n+/);
    html = paragraphs.map(function (p) {
      p = p.trim();
      if (!p) return '';
      // 已经是块级元素的不再包裹 <p>
      if (/^<(?:ul|ol|li|pre|blockquote|h[1-6])/.test(p)) return p;
      return '<p>' + p.replace(/\n/g, '<br>') + '</p>';
    }).join('\n');

    return html;
  }

  // ==================== 流式渲染 ====================
  function renderStream(reader, outputEl, onComplete) {
    const decoder = new TextDecoder();
    let buffer = '';
    let isDone = false;
    // 累积纯文本用于最终 markdown 渲染
    var rawText = '';
    var timedOut = false;

    // 60 秒无新 chunk 超时 — 防止 Worker 卡死
    var timeoutTimer;
    function resetTimeout() {
      if (timeoutTimer) clearTimeout(timeoutTimer);
      timeoutTimer = setTimeout(function () {
        timedOut = true;
        isDone = true;
        reader.cancel();
        if (typeof onComplete === 'function') onComplete('timeout');
      }, 60000);
    }
    resetTimeout();

    function processChunk(chunk) {
      buffer += chunk;
      const lines = buffer.split('\n');
      buffer = lines.pop() || ''; // 保留未完成的行

      for (const line of lines) {
        const trimmed = line.trim();
        if (!trimmed || trimmed === 'data: [DONE]') {
          if (trimmed === 'data: [DONE]') isDone = true;
          continue;
        }
        if (trimmed.startsWith('data: ')) {
          try {
            const data = JSON.parse(trimmed.slice(6));
            const delta = data.choices?.[0]?.delta || {};
            // 仅使用 delta.content，跳过 reasoning_content（DeepSeek 的思考过程）
            const content = delta.content || '';
            if (content) {
              rawText += content;
              // 实时渲染 markdown
              outputEl.innerHTML = renderMarkdown(rawText);
              // 收到新内容就重置超时计时器
              resetTimeout();
            }
            if (data.choices?.[0]?.finish_reason === 'stop') {
              isDone = true;
            }
          } catch (e) { /* 忽略解析错误 */ }
        }
      }
    }

    function readNext() {
      if (timedOut) return;
      reader.read().then(({ done, value }) => {
        if (done) {
          isDone = true;
          clearTimeout(timeoutTimer);
          // 最终渲染一次
          outputEl.innerHTML = renderMarkdown(rawText);
          if (typeof onComplete === 'function') onComplete(null);
          return;
        }
        processChunk(decoder.decode(value, { stream: true }));
        if (timedOut) return;
        if (!isDone) {
          setTimeout(readNext, CONFIG.STREAM_FLUSH_INTERVAL);
        } else {
          clearTimeout(timeoutTimer);
          outputEl.innerHTML = renderMarkdown(rawText);
          if (typeof onComplete === 'function') onComplete(null);
        }
      }).catch(function () {
        clearTimeout(timeoutTimer);
        outputEl.innerHTML = renderMarkdown(rawText);
        if (typeof onComplete === 'function') onComplete(null);
      });
    }

    readNext();
  }

  // ==================== 搜索入口 ====================
  async function handleSearch(question) {
    if (State.isAnswering) {
      // 如果正在回答中，先中止之前的请求
      if (State.abortController) {
        State.abortController.abort();
      }
      // 等一小段时间重置状态
      await new Promise(function (r) { setTimeout(r, 100); });
      State.isAnswering = false;
    }

    if (!question || !question.trim()) return;

    const settings = Settings.get();
    const mode = settings.mode;
    const searchResultArea = document.getElementById('pagefind-search-list');
    if (!searchResultArea) return;

    // 清空旧结果
    searchResultArea.innerHTML = '';

    if (mode === 'off') {
      // 纯本地搜索 — 交给 Pagefind 处理（通过触发 input 事件）
      return;
    }

    // AI 模式：先搜索，再用 AI 回答
    State.isAnswering = true;
    State.abortController = new AbortController();

    try {
      // 1. 用 Pagefind 检索 — 关键词提取 + 双重搜索，避免"怎么"/"如何"等词淹没结果
      let pagefindResults = [];
      const pagefindMod = window.__pagefindMod;
      if (pagefindMod && window.__pagefindReady) {
        // 常见中文疑问词，去除后得到核心关键词
        var stopWords = ['怎么', '如何', '什么是', '什么是', '哪个', '哪些', '哪里', '什么', '为什么',
          '怎么办', '怎么做', '咋', '咋样', '怎样', '怎么样', '有没有', '能否', '是否', '多少',
          '怎么查', '怎么找', '怎么去'];
        // 常见语气词/助词 — 完全去掉
        var particles = ['了', '的', '吗', '吧', '呢', '啊', '呀', '哦', '嘛', '哈'];
        // 同义词映射 — 将用户说的词替换为文档中实际使用的词
        var synonyms = {
          '挂科': '补考 重修',
          '挂科了': '补考 重修',
          '学费': '收费 缴费',
          '宿舍': '公寓',
          '寝室': '公寓',
          '毕业': '毕业 结业',
          '考研': '研究生 推免',
          '保研': '推免',
        };

        var keywords = question;
        for (var w = 0; w < stopWords.length; w++) {
          keywords = keywords.replace(stopWords[w], ' ');
        }
        // 去掉语气词/助词
        for (var p = 0; p < particles.length; p++) {
          keywords = keywords.replace(particles[p], ' ');
        }
        // 同义词替换（替换原词，不是追加 — Pagefind 要求所有词都匹配）
        for (var syn in synonyms) {
          if (keywords.indexOf(syn) !== -1) {
            keywords = keywords.replace(syn, synonyms[syn]);
          }
        }
        keywords = keywords.replace(/\s+/g, ' ').trim();
        // 如果关键词为空，保留原问题
        if (!keywords) keywords = question;

        // 第一轮搜索：原始问题
        var search1 = await pagefindMod.search(question, {});
        var results1 = (search1.results || []).slice(0, 5);

        // 第二轮搜索：关键词（如果和原始问题不同）
        var results2 = [];
        if (keywords !== question) {
          var search2 = await pagefindMod.search(keywords, {});
          results2 = (search2.results || []).slice(0, 5);
        }

        // 兜底：如果关键词搜索结果太少，对每个词单独搜索
        if ((results1.length + results2.length) < 4) {
          var extraTerms = keywords.split(/\s+/);
          for (var et = 0; et < extraTerms.length; et++) {
            var term = extraTerms[et].trim();
            if (term.length < 2) continue;
            var extraSearch = await pagefindMod.search(term, {});
            var extraResults = (extraSearch.results || []).slice(0, 4);
            for (var er = 0; er < extraResults.length; er++) {
              results2.push(extraResults[er]);
            }
          }
        }

        // 合并去重 — 关键词结果优先（排在前面），原始结果作为补充
        var seenUrls = {};
        var uniqueArr = [];

        // 先 resolve 所有结果再统一去重
        async function resolveAndAdd(arr, maxCount) {
          for (var i = 0; i < arr.length && uniqueArr.length < maxCount; i++) {
            try {
              var d = await arr[i].data();
              if (!seenUrls[d.url]) {
                seenUrls[d.url] = true;
                uniqueArr.push(d);
              }
            } catch (e) { /* skip */ }
          }
        }

        // 先加关键词结果（更相关）
        await resolveAndAdd(results2, 5);
        // 再加原始结果（补充）
        await resolveAndAdd(results1, 7);
        pagefindResults = uniqueArr;
      }

      if (pagefindResults.length === 0) {
        showAIResult(searchResultArea, '未找到相关文档，请换个关键词试试。', []);
        State.isAnswering = false;
        return;
      }

      // 2. 构建上下文 — 包含强引导指令 + 多条目的标题/摘要/内容
      var contextIntro = '以下是校园通知识库中与问题相关的文档内容。请基于这些文档内容回答问题，不要说自己不知道或查不到——信息就在下面的资料中。\n\n';
      const context = contextIntro + pagefindResults.map(function (r, i) {
        var title = r.meta.title || '无标题';
        var excerpt = r.excerpt || '';
        var content = (r.content || '').slice(0, 2000);
        return '【来源' + (i + 1) + '：《' + title + '》】\n' + (excerpt || content);
      }).join('\n\n---\n\n');

      // 3. 创建结果容器
      const container = createResultContainer(searchResultArea, question);
      const aiOutput = container.querySelector('.ai-answer-content');
      const stopBtn = container.querySelector('#ai-stop-btn');

      // 绑定停止按钮
      if (stopBtn) {
        stopBtn.style.display = '';
        stopBtn.onclick = function () {
          if (State.abortController) {
            State.abortController.abort();
          }
          State.isAnswering = false;
          var statusText = container.querySelector('.ai-answer-status-text');
          if (statusText) statusText.textContent = '⏹ 已停止生成';
          if (stopBtn) stopBtn.style.display = 'none';
        };
      }

      // 4. 调用 AI
      let result;
      if (mode === 'free') {
        result = await askFreeAI(question, context);
      } else if (mode === 'byok') {
        if (!settings.apiKey) {
          showAPIKeyPrompt(container);
          State.isAnswering = false;
          return;
        }
        result = await askBYOK(question, context, settings);
      } else {
        State.isAnswering = false;
        return;
      }

      // 5. 处理结果
      if (result.type === 'error') {
        // 存原始结果（AI 失败时用户仍可看相关文档）
        State.lastRawResults = pagefindResults;
        handleAIError(container, result, question, context);
        State.isAnswering = false;
        // AI 失败时自动切到"相关文档"标签
        switchTab(container, 'pages');
        return;
      }

      // 存原始结果供"全文检索"标签页使用 — 必须在 AI 调用之前设置
      State.lastRawResults = pagefindResults;

      if (result.type === 'stream') {
        aiOutput.innerHTML = '';
        renderStream(result.body.getReader(), aiOutput, function (err) {
          State.isAnswering = false;
          // 隐藏停止按钮
          var sb = container.querySelector('#ai-stop-btn');
          if (sb) sb.style.display = 'none';
          var st = container.querySelector('.ai-answer-status-text');
          if (st) {
            st.textContent = err === 'timeout' ? '⏱ AI 回答超时' : '✅ 回答完成';
            st.style.animation = 'none';
          }
          // 显示来源
          showSources(container, pagefindResults);
          // 超时或内容为空时，自动切到"相关文档"标签
          if (err === 'timeout' || !aiOutput.textContent.trim()) {
            switchTab(container, 'pages');
          }
        });
      }

    } catch (err) {
      console.error('AI 搜索失败:', err);
      showAIResult(searchResultArea, 'AI 回答出错，请稍后重试。', []);
      State.isAnswering = false;
    }
  }

  // ==================== UI 工具函数 ====================

  function createResultContainer(parent, question) {
    // 创建标签页容器
    const container = document.createElement('li');
    container.className = 'md-search-result__item ai-result-container';

    container.innerHTML = `
      <div class="ai-tabs">
        <button class="ai-tab ai-tab--active" data-tab="ai">
          🧠 AI 回答
        </button>
        <button class="ai-tab" data-tab="pages">
          📖 相关文档
        </button>
      </div>
      <div class="ai-tab-content ai-tab-content--ai">
        <div class="ai-answer-header">💬 ${escapeHtml(question)}</div>
        <div class="ai-answer-content"></div>
        <div class="ai-answer-status">
          <span class="ai-answer-status-text">⏳ AI 正在回答...</span>
          <button class="ai-btn ai-btn--stop" id="ai-stop-btn" title="停止生成">■ 停止</button>
        </div>
        <div class="ai-sources"></div>
      </div>
      <div class="ai-tab-content ai-tab-content--pages" style="display:none;">
        <div class="ai-pages-list"></div>
      </div>
    `;

    parent.appendChild(container);

    // 标签页切换
    const tabs = container.querySelectorAll('.ai-tab');
    tabs.forEach(tab => {
      tab.addEventListener('click', function () {
        tabs.forEach(t => t.classList.remove('ai-tab--active'));
        this.classList.add('ai-tab--active');
        const target = this.dataset.tab;
        container.querySelectorAll('.ai-tab-content').forEach(el => {
          el.style.display = el.classList.contains('ai-tab-content--' + target) ? '' : 'none';
        });
        // 切换到"相关文档"时填充内容
        if (target === 'pages' && State.lastRawResults) {
          fillPagesTab(container, State.lastRawResults);
        }
      });
    });

    return container;
  }

  // ==================== 标签页切换（供自动降级调用） ====================
  function switchTab(container, tabName) {
    var tabs = container.querySelectorAll('.ai-tab');
    var contents = container.querySelectorAll('.ai-tab-content');
    tabs.forEach(function (t) {
      t.classList.toggle('ai-tab--active', t.dataset.tab === tabName);
    });
    contents.forEach(function (c) {
      c.style.display = c.classList.contains('ai-tab-content--' + tabName) ? '' : 'none';
    });
    // 切到 pages 时如果还没渲染就渲染
    if (tabName === 'pages' && State.lastRawResults) {
      fillPagesTab(container, State.lastRawResults);
    }
  }

  function fillPagesTab(container, results) {
    const list = container.querySelector('.ai-pages-list');
    if (!list || list.children.length > 0) return;

    list.innerHTML = results.map(r => {
      var title = r.meta.title || '无标题';
      var excerpt = r.excerpt || '';
      var contentSnippet = (r.content || '').slice(0, 150);
      var displayText = excerpt || contentSnippet || '暂无摘要';
      return '<a href="' + r.url + '" class="ai-page-item">' +
        '<div class="ai-page-title">' + escapeHtml(title) + '</div>' +
        '<div class="ai-page-excerpt">' + escapeHtml(displayText) + '</div>' +
        '</a>';
    }).join('');
  }

  function showSources(container, results) {
    const sourcesEl = container.querySelector('.ai-sources');
    if (!sourcesEl || results.length === 0) return;

    sourcesEl.innerHTML = `
      <div class="ai-sources-title">📚 信息来源</div>
      <div class="ai-sources-list">
        ${results.map(r => `
          <a href="${r.url}" class="ai-source-item" target="_blank">
            📄 ${escapeHtml(r.meta.title)}
          </a>
        `).join('')}
      </div>
    `;
  }

  function showAIResult(parent, text, sources) {
    const container = createResultContainer(parent, '');
    const content = container.querySelector('.ai-answer-content');
    const status = container.querySelector('.ai-answer-status');
    content.textContent = text;
    if (status) status.style.display = 'none';
    if (sources.length > 0) showSources(container, sources);
  }

  function handleAIError(container, result, question, context) {
    const status = container.querySelector('.ai-answer-status');
    const content = container.querySelector('.ai-answer-content');

    if (result.error === 'daily_limit_user' || result.error === 'daily_limit_global') {
      // 免费额度用完了 — 显示 BYOK 引导
      status.style.display = 'none';
      content.innerHTML = `
        <div class="ai-limit-card">
          <div class="ai-limit-title">📢 今日免费 AI 问答已用完</div>
          <div class="ai-limit-desc">${result.message}</div>
          <div class="ai-limit-actions">
            <button class="ai-btn ai-btn--primary" onclick="window.__openAISettings()">
              🔑 配置自己的 API Key 继续使用
            </button>
            <button class="ai-btn ai-btn--secondary" onclick="window.__turnOffAI()">
              📖 关闭 AI，使用普通搜索
            </button>
          </div>
        </div>
      `;
    } else if (result.error === 'ai_not_configured') {
      status.style.display = 'none';
      content.textContent = 'AI 功能暂未开放，请稍后再试。';
    } else {
      status.style.display = 'none';
      content.textContent = result.message || 'AI 回答出错，请稍后重试。';
      // 尝试 BYOK 兜底
      content.innerHTML += `
        <div style="margin-top:1rem;">
          <button class="ai-btn ai-btn--primary" onclick="window.__retryWithBYOK('${escapeHtml(question)}')">
            🔑 切换到自己 Key 重试
          </button>
        </div>
      `;
    }
  }

  function showAPIKeyPrompt(container) {
    const status = container.querySelector('.ai-answer-status');
    const content = container.querySelector('.ai-answer-content');
    if (status) status.style.display = 'none';
    content.innerHTML = `
      <div class="ai-limit-card">
        <div class="ai-limit-title">🔑 需要配置 API Key</div>
        <div class="ai-limit-desc">你选择了"自带 Key"模式，请先配置你的 API Key。</div>
        <div class="ai-limit-actions">
          <button class="ai-btn ai-btn--primary" onclick="window.__openAISettings()">
            ⚙️ 去配置
          </button>
        </div>
      </div>
    `;
  }

  // ==================== 设置面板 ====================

  function createSettingsUI() {
    // 检查是否已存在
    if (document.getElementById('ai-settings-panel')) return;

    const settings = Settings.get();

    const overlay = document.createElement('div');
    overlay.id = 'ai-settings-panel';
    overlay.className = 'ai-settings-overlay';
    overlay.innerHTML = `
      <div class="ai-settings-card">
        <button class="ai-settings-close" onclick="window.__closeAISettings()">✕</button>
        <div class="ai-settings-title">🤖 AI 问答设置</div>

        <div class="ai-settings-section">
          <label class="ai-settings-label">AI 后端选择</label>
          <div class="ai-mode-options">
            <label class="ai-mode-option ${settings.mode === 'free' || settings.mode === 'off' ? 'ai-mode--selected' : ''}">
              <input type="radio" name="ai-mode" value="free" ${settings.mode === 'free' || settings.mode === 'off' ? 'checked' : ''}>
              <span class="ai-mode-name">✨ 免费共享 AI</span>
              <span class="ai-mode-desc">每日 30 次，零配置使用</span>
            </label>
            <label class="ai-mode-option ${settings.mode === 'byok' ? 'ai-mode--selected' : ''}">
              <input type="radio" name="ai-mode" value="byok" ${settings.mode === 'byok' ? 'checked' : ''}>
              <span class="ai-mode-name">🔑 自带 Key</span>
              <span class="ai-mode-desc">使用自己的 API Key，不限次数</span>
            </label>
          </div>
        </div>

        <div class="ai-settings-section" id="ai-byok-config" style="${settings.mode === 'byok' ? '' : 'display:none'}">
          <label class="ai-settings-label">API Key 配置</label>
          <select id="ai-provider-select" class="ai-input">
            ${Object.entries(PROVIDERS).map(([key, p]) =>
              `<option value="${key}" ${settings.provider === key ? 'selected' : ''}>${p.name}</option>`
            ).join('')}
          </select>
          <input type="password" id="ai-api-key-input" class="ai-input"
            placeholder="粘贴你的 API Key"
            value="${settings.apiKey || ''}"
            style="margin-top:0.5rem;">
          <div class="ai-settings-hint">
            没有 API Key？
            <a href="${PROVIDERS[settings.provider]?.docs || '#'}" target="_blank" id="ai-key-link">
              去 ${PROVIDERS[settings.provider]?.name || 'DeepSeek'} 获取 →
            </a>
          </div>
        </div>

        <div class="ai-settings-actions">
          <button class="ai-btn ai-btn--primary" onclick="window.__saveAISettings()">💾 保存设置</button>
          <button class="ai-btn ai-btn--secondary" onclick="window.__closeAISettings()">取消</button>
        </div>
      </div>
    `;

    document.body.appendChild(overlay);

    // 模式切换联动
    overlay.querySelectorAll('input[name="ai-mode"]').forEach(radio => {
      radio.addEventListener('change', function () {
        overlay.querySelectorAll('.ai-mode-option').forEach(el => {
          el.classList.toggle('ai-mode--selected', el.querySelector('input').checked);
        });
        const byokConfig = overlay.querySelector('#ai-byok-config');
        byokConfig.style.display = this.value === 'byok' ? '' : 'none';
      });
    });

    // 供应商切换联动
    const providerSelect = overlay.querySelector('#ai-provider-select');
    if (providerSelect) {
      providerSelect.addEventListener('change', function () {
        const link = overlay.querySelector('#ai-key-link');
        const p = PROVIDERS[this.value];
        if (link && p) {
          link.textContent = `去 ${p.name} 获取 →`;
          link.href = p.docs;
        }
      });
    }
  }

  // ==================== 全局函数（供 HTML onclick 调用） ====================

  window.__openAISettings = function () {
    createSettingsUI();
    document.getElementById('ai-settings-panel').classList.add('ai-settings--open');
    // 弹窗打开期间禁用搜索输入框，防止 MkDocs 抢焦点
    var searchInput = document.getElementById('pagefind-search-input');
    if (searchInput) searchInput.disabled = true;
  };

  window.__closeAISettings = function () {
    const panel = document.getElementById('ai-settings-panel');
    if (panel) panel.classList.remove('ai-settings--open');
    // 恢复搜索输入框
    var searchInput = document.getElementById('pagefind-search-input');
    if (searchInput) searchInput.disabled = false;
  };

  window.__saveAISettings = function () {
    const panel = document.getElementById('ai-settings-panel');
    if (!panel) return;

    const mode = panel.querySelector('input[name="ai-mode"]:checked')?.value || 'free';
    const provider = panel.querySelector('#ai-provider-select')?.value || 'deepseek';
    // 只有在模式为 byok 时才保存 API Key；否则清空密钥（防止隐藏 input 残留旧值）
    const apiKey = mode === 'byok' ? (panel.querySelector('#ai-api-key-input')?.value || '') : '';

    Settings.save({ mode, provider, apiKey });
    window.__closeAISettings();

    // 更新搜索框上的模式指示
    updateModeIndicator();

    // 提示用户
    const modeNames = { off: '📖 本地搜索', free: '✨ 免费 AI', byok: '🔑 自带 Key' };
    showToast(`已切换为 ${modeNames[mode] || mode} 模式`);
  };

  window.__turnOffAI = function () {
    Settings.setMode('off');
    updateModeIndicator();
    // 清空搜索结果重新搜索
    const input = document.getElementById('pagefind-search-input');
    if (input) {
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);
    }
  };

  window.__retryWithBYOK = async function (question) {
    Settings.setMode('byok');
    const settings = Settings.get();
    if (!settings.apiKey) {
      window.__openAISettings();
      return;
    }
    // 触发重新搜索
    const input = document.getElementById('pagefind-search-input');
    if (input) {
      input.value = question;
      const event = new KeyboardEvent('keydown', { key: 'Enter' });
      input.dispatchEvent(event);
    }
  };

  // ==================== 模式指示器 ====================

  function updateModeIndicator() {
    const settings = Settings.get();
    const metaEl = document.getElementById('pagefind-search-meta');
    if (!metaEl) return;

    if (settings.mode === 'off') {
      metaEl.textContent = '📖 本地搜索模式';
      metaEl.className = 'md-search-result__meta ai-mode-indicator ai-mode-off';
    } else if (settings.mode === 'free') {
      metaEl.textContent = '✨ 免费 AI 模式';
      metaEl.className = 'md-search-result__meta ai-mode-indicator ai-mode-free';
    } else if (settings.mode === 'byok') {
      metaEl.textContent = '🔑 自带 Key 模式';
      metaEl.className = 'md-search-result__meta ai-mode-indicator ai-mode-byok';
    }
  }

  // ==================== Toast 提示 ====================

  function showToast(msg) {
    const existing = document.querySelector('.ai-toast');
    if (existing) existing.remove();

    const toast = document.createElement('div');
    toast.className = 'ai-toast';
    toast.textContent = msg;
    document.body.appendChild(toast);

    setTimeout(() => toast.classList.add('ai-toast--show'), 10);
    setTimeout(() => {
      toast.classList.remove('ai-toast--show');
      setTimeout(() => toast.remove(), 300);
    }, 2500);
  }

  // ==================== 工具函数 ====================

  function escapeHtml(text) {
    if (!text) return '';
    const div = document.createElement('div');
    div.textContent = text;
    return div.innerHTML;
  }

  // ==================== 快捷提问 ====================
  var quickQuestionsList = [
    '怎么转专业？',
    '奖学金有哪些？',
    '辅修有什么要求？',
  ];

  function createQuickQuestions() {
    // 移除旧的快捷提问
    var oldQ = document.getElementById('ai-quick-questions');
    if (oldQ) oldQ.remove();

    var qDiv = document.createElement('div');
    qDiv.id = 'ai-quick-questions';
    qDiv.style.cssText = 'padding:0.4rem 0.8rem 0.2rem;display:none;';
    var qTitle = document.createElement('div');
    qTitle.style.cssText = 'font-size:0.62rem;font-weight:700;color:var(--md-default-fg-color);margin-bottom:0.35rem;text-transform:uppercase;letter-spacing:0.05em;';
    qTitle.textContent = '💡 试试这些问题';
    qDiv.appendChild(qTitle);
    var qRow = document.createElement('div');
    qRow.style.cssText = 'display:flex;flex-wrap:wrap;gap:0.35rem;';
    quickQuestionsList.forEach(function (q) {
      var btn = document.createElement('button');
      btn.textContent = q;
      btn.style.cssText = 'font-size:0.68rem;padding:0.25rem 0.6rem;background:var(--md-accent-fg-color--transparent);border:1px solid var(--md-accent-fg-color--transparent);border-radius:6px;cursor:pointer;color:var(--md-accent-fg-color);font-weight:600;transition:all 0.15s;';
      btn.onmouseover = function () { btn.style.background = 'var(--md-accent-fg-color)'; btn.style.color = '#fff'; };
      btn.onmouseout = function () { btn.style.background = 'var(--md-accent-fg-color--transparent)'; btn.style.color = 'var(--md-accent-fg-color)'; };
      btn.onclick = function () {
        var inp = document.getElementById('pagefind-search-input');
        if (!inp) return;
        inp.value = q;
        var settings = Settings.get();
        if (settings.mode !== 'off') {
          handleSearch(q);
        } else {
          var evt = new Event('input', { bubbles: true });
          inp.dispatchEvent(evt);
        }
      };
      qRow.appendChild(btn);
    });
    qDiv.appendChild(qRow);
    var meta = document.getElementById('pagefind-search-meta');
    if (meta && meta.parentNode) {
      meta.parentNode.insertBefore(qDiv, meta.nextSibling);
    }
  }

  // ==================== 接管 Pagefind 搜索 ====================

  function setupAISearch() {
    const input = document.getElementById('pagefind-search-input');
    const form = document.getElementById('pagefind-search-form');
    if (!input || !form) return;

    // 注入控制栏到 .md-search__output 内部（滚动区域顶部）
    // 这样手机全屏搜索时自然可见，随搜索结果一起滚动
    const searchOutput = document.querySelector('.md-search__output');
    if (searchOutput && !document.getElementById('ai-control-bar')) {
      const controlBar = document.createElement('div');
      controlBar.id = 'ai-control-bar';
      controlBar.className = 'ai-control-bar';
      controlBar.innerHTML = [
        '<div class="ai-control-left">',
        '  <label class="ai-toggle" id="ai-toggle-label">',
        '    <input type="checkbox" id="ai-toggle-switch"',
        '      ' + (Settings.get().mode !== 'off' ? 'checked' : '') + '>',
        '    <span class="ai-toggle-track"></span>',
        '    <span class="ai-toggle-label">AI 增强</span>',
        '  </label>',
        '</div>',
        '<div class="ai-control-right">',
        '  <button class="ai-settings-btn" id="ai-settings-btn" title="AI 设置" aria-label="AI 设置">',
        '    <svg width="14" height="14" viewBox="0 0 24 24" fill="none"',
        '      stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">',
        '      <circle cx="12" cy="12" r="3"></circle>',
        '      <path d="M12 1v2M12 21v2M4.22 4.22l1.42 1.42M18.36 18.36l1.42 1.42M1 12h2M21 12h2M4.22 19.78l1.42-1.42M18.36 5.64l1.42-1.42"></path>',
        '    </svg>',
        '  </button>',
        '</div>'
      ].join('\n');
      // 插入到 .md-search__output 最前面（在 scrollwrap 之前）
      // 这样手机端全屏搜索时控制栏在搜索列表顶部，可见可点
      searchOutput.insertBefore(controlBar, searchOutput.firstChild);
    }

    // ——— AI 开关事件（同时支持 click + touchend） ———
    var toggle = document.getElementById('ai-toggle-switch');
    if (toggle) {
      var toggleHandler = function () {
        // 延迟执行让 checkbox 状态先更新
        setTimeout(function () {
          if (toggle.checked) {
            // 开 → 恢复上次非 off 模式
            var s = Settings.get();
            if (s.mode === 'off') {
              Settings.setMode(State.lastNonOffMode || 'free');
            }
          } else {
            // 关 → 记忆当前模式，切为 off
            var s = Settings.get();
            if (s.mode !== 'off') {
              State.lastNonOffMode = s.mode;
              Settings.setMode('off');
            }
          }
          updateModeIndicator();
        }, 50);
      };
      // 桌面端用 change，手机端用 click（touch 设备 click 也会触发）
      toggle.addEventListener('change', toggleHandler);
      // 兼容某些移动浏览器 change 不触发的情况
      toggle.addEventListener('click', function (e) {
        // 部分 Android WebView 需要手动 stopPropagation
        e.stopPropagation();
      });
    }

    // ——— 设置按钮绑定（不用 onclick 属性，更可靠的移动端兼容） ———
    var settingsBtn = document.getElementById('ai-settings-btn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.__openAISettings();
      });
      // 移动端 touch 兼容
      settingsBtn.addEventListener('touchend', function (e) {
        e.preventDefault();
        e.stopPropagation();
        window.__openAISettings();
      }, { passive: false });
    }

    // ——— 拦截 Enter 键（keydown 级别，在 MkDocs 导航之前拦截） ———
    // MkDocs Material 在 keydown 时就会导航到第一个结果，
    // 等到 form submit 事件就太晚了。
    input.addEventListener('keydown', function (e) {
      if (e.key === 'Enter') {
        var settings = Settings.get();
        if (settings.mode !== 'off') {
          e.preventDefault();
          e.stopPropagation();
          handleSearch(input.value);
          return false;
        }
      }
    }, true);

    // ——— 拦截表单提交（备选拦截，兼容非 Enter 触发的提交） ———
    form.addEventListener('submit', function (e) {
      var settings = Settings.get();
      if (settings.mode !== 'off') {
        e.preventDefault();
        e.stopPropagation();
        return false;
      }
    }, true);

    // ——— 快捷提问 ———
    createQuickQuestions();

    // 搜索框聚焦/失焦时显示/隐藏快捷提问
    input.addEventListener('focus', function () {
      var qDiv = document.getElementById('ai-quick-questions');
      if (qDiv && !input.value.trim()) {
        qDiv.style.display = '';
      }
    });
    input.addEventListener('blur', function () {
      // 延迟隐藏，让点击按钮有机会触发
      setTimeout(function () {
        var qDiv = document.getElementById('ai-quick-questions');
        if (qDiv) qDiv.style.display = 'none';
      }, 200);
    });
    input.addEventListener('input', function () {
      var qDiv = document.getElementById('ai-quick-questions');
      if (qDiv) {
        qDiv.style.display = input.value.trim() ? 'none' : '';
      }
    });

    // 初始化模式指示
    updateModeIndicator();
  }

  // ==================== 移动端搜索 ====================

  function setupMobileSearch() {
    var input = document.getElementById('pagefind-search-input');
    if (!input) return;

    // 移动端键盘"搜索"按钮触发 search 事件
    input.addEventListener('search', function (e) {
      var settings = Settings.get();
      if (settings.mode !== 'off' && input.value.trim()) {
        handleSearch(input.value);
      }
    });

    // 移动端失焦时自动触发（用户点键盘"前往"后输入框失焦）
    // 只在有内容且 mode 非 off 时触发，避免干扰普通点击
    var lastVal = '';
    input.addEventListener('blur', function () {
      var val = input.value.trim();
      if (val && val !== lastVal) {
        lastVal = val;
        var settings = Settings.get();
        if (settings.mode !== 'off') {
          handleSearch(val);
        }
      }
    });
  }

  // ==================== 启动 ====================

  // 等待 DOM 加载
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      setupAISearch();
      setupMobileSearch();
    });
  } else {
    setupAISearch();
    setupMobileSearch();
  }

  // 兼容 MkDocs navigation.instant 重新绑定
  if (typeof document$ !== 'undefined') {
    document$.subscribe(function () {
      // 重新绑定设置按钮
      var oldBtn = document.getElementById('ai-settings-btn');
      if (oldBtn) {
        oldBtn.onclick = null;
        oldBtn.addEventListener('click', function (e) {
          e.preventDefault();
          e.stopPropagation();
          window.__openAISettings();
        });
      }

      // 重新同步开关状态
      var toggle = document.getElementById('ai-toggle-switch');
      if (toggle) {
        var s = Settings.get();
        toggle.checked = s.mode !== 'off';
      }

      // 重新创建快捷提问
      createQuickQuestions();

      // 重新绑定快捷提问的显示逻辑
      var input = document.getElementById('pagefind-search-input');
      if (input) {
        // 移除旧监听器（通过克隆替换来清除所有事件）
        // 使用已有的事件监听 — 因为 DOM 节点保留，旧监听器还在
        // 重新触发一次状态同步
        var qDiv = document.getElementById('ai-quick-questions');
        if (qDiv && !input.value.trim()) {
          // 如果搜索对话框是打开的，则显示
          var dialog = input.closest('[data-md-component="search"]');
          if (dialog && dialog.hasAttribute('open')) {
            qDiv.style.display = '';
          } else {
            qDiv.style.display = 'none';
          }
        }
      }

      updateModeIndicator();
    });
  }

})();
