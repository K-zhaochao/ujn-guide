
/**
 * 🐾 宠物收集录投稿系统 — 前端脚本
 * ====================================
 *
 * 部署前需修改：
 *   const API_BASE = 'https://ujn-pet-submit.draven323.workers.dev'; // 改成你的 Worker 地址
 *   const ACCESS_TOKEN = 'REPLACED_WORKER_ACCESS_TOKEN'; // Worker ACCESS_TOKEN 环境变量的值
 *
 * 引入方式（在 index.md 中通过 extra_javascript 引入）：
 *   - javascripts/submit.js
 */

(function () {
  'use strict';

  // ================== 配置 ==================
  const API_BASE = 'http://127.0.0.1:3005'; 
  const ACCESS_TOKEN = 'REPLACED_WORKER_ACCESS_TOKEN';
  const MAX_IMAGES = 5;
  const GITHUB_OAUTH_URL = API_BASE + '/auth/github';

  // ================== 状态 ==================
  let approvedNames = []; // [{name, category}]
  let currentEditData = null; // {submitId, email, hasQQ, name, ...}
  let githubUser = null; // { id, login, avatar_url }

  // ================== GitHub OAuth ==================

  async function checkAuth() {
    const savedToken = localStorage.getItem('pet_jwt');
    if (savedToken) {
      try {
        const r = await fetch(API_BASE + '/auth/me', {
          headers: { 'Authorization': 'Bearer ' + savedToken }
        });
        const d = await r.json();
        if (d.authenticated) {
          githubUser = d.user;
          updateAuthUI();
        } else {
          localStorage.removeItem('pet_jwt');
        }
      } catch (e) {
        localStorage.removeItem('pet_jwt');
      }
    }
  }

  function loginWithGitHub() {
    var width = 600, height = 700;
    var left = (screen.width - width) / 2;
    var top = (screen.height - height) / 2;
    window.open(
      GITHUB_OAUTH_URL,
      'github-auth',
      'width=' + width + ',height=' + height + ',left=' + left + ',top=' + top
    );
  }

  function updateAuthUI() {
    var authArea = document.getElementById('pet-auth-area');
    if (!authArea) return;
    var submitBtn = document.getElementById('pet-submit-btn');
    if (githubUser) {
      authArea.innerHTML =
        '<div style="display:flex;align-items:center;gap:8px;padding:10px 12px;background:#f0f9ff;border-radius:8px;font-size:14px">' +
        '<img src="' + githubUser.avatar_url + '" style="width:24px;height:24px;border-radius:50%" alt="">' +
        '<span>✅ 已以 <strong>@' + githubUser.login + '</strong> 身份登录</span>' +
        '<button id="pet-logout-btn" style="margin-left:auto;background:none;border:1px solid #ddd;border-radius:6px;padding:4px 10px;font-size:12px;cursor:pointer;color:#666">退出</button>' +
        '</div>';
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.style.background = '#3b82f6';
        submitBtn.style.cursor = 'pointer';
        submitBtn.textContent = '📤 提交投稿';
      }
    } else {
      authArea.innerHTML =
        '<div style="padding:14px 16px;background:#f8f9fa;border-radius:10px;border:1px dashed #d1d5db;text-align:center">' +
        '<p style="font-size:14px;font-weight:600;margin:0 0 8px;color:#374151">🔑 需要 GitHub 登录才能投稿</p>' +
        '<p style="font-size:13px;color:#6b7280;margin:0 0 10px">登录后自动带出你的身份信息</p>' +
        '<button id="pet-login-btn" style="padding:10px 24px;background:#24292f;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-weight:500">' +
        '以 GitHub 登录投稿</button>' +
        '</div>';
      if (submitBtn) {
        submitBtn.disabled = true;
        submitBtn.style.background = '#9ca3af';
        submitBtn.style.cursor = 'not-allowed';
        submitBtn.textContent = '🔒 请先登录后再投稿';
      }
    }

    // 绑定登录/退出按钮（inline onclick 不适用于 IIFE 作用域）
    var loginBtn = document.getElementById('pet-login-btn');
    if (loginBtn) loginBtn.onclick = loginWithGitHub;
    var logoutBtn = document.getElementById('pet-logout-btn');
    if (logoutBtn) logoutBtn.onclick = function() {
      localStorage.removeItem('pet_jwt');
      githubUser = null;
      updateAuthUI();
    };
  }

  // ================== DOM 工具 ==================

  function createModal(id) {
    // Remove existing modal if any
    const existing = document.getElementById(id);
    if (existing) existing.remove();

    const overlay = document.createElement('div');
    overlay.id = id;
    overlay.className = 'pet-modal-overlay';
    overlay.style.cssText = `
      position: fixed; top: 0; left: 0; right: 0; bottom: 0;
      background: rgba(0,0,0,0.5); z-index: 9999;
      display: flex; align-items: center; justify-content: center;
      opacity: 0; transition: opacity 0.2s;
    `;
    document.body.appendChild(overlay);
    // Trigger animation
    requestAnimationFrame(() => { overlay.style.opacity = '1'; });
    return overlay;
  }

  function closeModal(id) {
    const el = document.getElementById(id);
    if (el) {
      el.style.opacity = '0';
      setTimeout(() => el.remove(), 200);
    }
  }

  function showToast(msg, type = 'success') {
    const t = document.createElement('div');
    t.style.cssText = `
      position: fixed; top: 20px; right: 20px; z-index: 10000;
      background: ${type === 'success' ? '#22c55e' : '#ef4444'};
      color: #fff; padding: 12px 20px; border-radius: 8px;
      font-size: 14px; box-shadow: 0 4px 12px rgba(0,0,0,0.15);
      animation: fadeIn 0.3s; max-width: 360px;
    `;
    t.textContent = msg;
    document.body.appendChild(t);
    setTimeout(() => {
      t.style.opacity = '0';
      t.style.transition = 'opacity 0.3s';
      setTimeout(() => t.remove(), 300);
    }, 4000);
  }

  function formatVerifyCode(code) {
    return code.split('').join(' ');
  }

  function generateVerifyCode() {
    return String(Math.floor(100000 + Math.random() * 900000));
  }

  // ================== 初始化 ==================

  async function init() {
    // Load approved names
    try {
      const r = await fetch(`${API_BASE}/approved`, {
        headers: { 'X-Access-Token': ACCESS_TOKEN },
      });
      const d = await r.json();
      if (d.names) approvedNames = d.names;
    } catch (e) {
      console.warn('Failed to load approved names:', e);
    }

    // Check GitHub auth
    await checkAuth();

    // Listen for postMessage from GitHub OAuth
    window.addEventListener('message', function (event) {
      var data = event.data;
      if (data && data.type === 'github-auth-success') {
        localStorage.setItem('pet_jwt', data.token);
        githubUser = data.user;
        updateAuthUI();
        showToast('✅ 已以 @' + data.user.login + ' 身份登录');
      }
    });

    // Bind submit button
    const submitBtn = document.querySelector('.pet-submit-btn');
    if (submitBtn) {
      submitBtn.addEventListener('click', openSubmitModal);
    }

    // Bind edit buttons (for GitHub JWT users - direct edit/delete)
    document.querySelectorAll('.pet-edit-btn').forEach(btn => {
      btn.addEventListener('click', function () {
        // If logged in with GitHub, try direct JWT edit
        if (githubUser) {
          var submitId = this.dataset.submitId;
          if (submitId) openJwtEditModal(submitId);
        } else {
          var submitId = this.dataset.submitId;
          if (submitId) openVerifyModal(submitId);
        }
      });
    });

    // Bind delete buttons for GitHub users
    document.querySelectorAll('.pet-delete-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        var submitId = this.dataset.submitId;
        if (!submitId) return;
        if (!githubUser) {
          showToast('请先以 GitHub 登录后操作', 'error');
          loginWithGitHub();
          return;
        }
        if (confirm('⚠️ 确认要删除此投稿吗？删除后不可恢复。')) {
          jwtDelete(submitId);
        }
      });
    });
  }

  // ================== 投稿模态框 ==================

  function openSubmitModal() {
    const overlay = createModal('pet-submit-modal');
    overlay.innerHTML = `
      <div class="pet-modal" style="
        background: #fff; border-radius: 16px; padding: 28px 24px;
        width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:22px">
          <h2 style="font-size:20px;margin:0">🐾 投稿新宠物</h2>
          <button onclick="document.getElementById('pet-submit-modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;line-height:1">✕</button>
        </div>

        <div style="display:flex;gap:10px;margin-bottom:16px">
          <div style="flex:1">
            <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">
              种类 <span style="color:#ef4444">*</span>
            </label>
            <select id="pet-category" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;background:#fff;color:#374151;appearance:auto">
              <option value="">请选择</option>
              <option value="猫">🐱 猫</option>
              <option value="狗">🐶 狗</option>
              <option value="兔">🐰 兔</option>
              <option value="仓鼠">🐹 仓鼠</option>
              <option value="龟">🐢 龟</option>
              <option value="鱼">🐟 鱼</option>
              <option value="鸟">🐦 鸟</option>
              <option value="其他">🦋 其他</option>
            </select>
          </div>
          <div style="flex:2">
            <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">
              宠物名称 <span style="color:#ef4444">*</span>
              <span id="pet-name-optional" style="display:none;font-weight:400;color:#9ca3af;font-size:12px">（选填）</span>
            </label>
            <input type="text" id="pet-name" maxlength="20" placeholder="例：小白" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:15px;color:#374151;outline:none">
            <div id="pet-name-status" style="font-size:13px;margin-top:4px;min-height:20px"></div>
          </div>
        </div>

        <div style="margin-bottom:16px">
          <label style="display:block;font-size:14px;font-weight:600;color:#374151;margin-bottom:6px">
            照片 <span style="color:#ef4444">*</span>
            <span style="font-weight:400;color:#9ca3af;font-size:12px">（1~5 张，自动压缩为 WebP）</span>
          </label>
          <div style="display:flex;align-items:center;gap:10px">
            <label for="pet-images" style="display:inline-flex;align-items:center;gap:6px;padding:10px 20px;background:#f0f5ff;color:#2563eb;border:2px dashed #93c5fd;border-radius:10px;font-size:14px;font-weight:500;cursor:pointer;transition:background .15s">
              <span style="font-size:18px">📷</span> 选择文件
            </label>
            <input type="file" id="pet-images" accept="image/*" multiple style="display:none">
            <span id="pet-image-count" style="font-size:13px;color:#9ca3af"></span>
          </div>
          <div id="pet-image-previews" style="display:flex;gap:8px;margin-top:8px;flex-wrap:wrap;min-height:0"></div>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:10px;margin-bottom:16px">
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#6b7280;margin-bottom:4px">📍 地点</label>
            <input type="text" id="pet-location" placeholder="十教门口" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#374151;outline:none">
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#6b7280;margin-bottom:4px">🎨 外貌</label>
            <input type="text" id="pet-appearance" placeholder="白色" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#374151;outline:none">
          </div>
          <div>
            <label style="display:block;font-size:13px;font-weight:500;color:#6b7280;margin-bottom:4px">💕 性格</label>
            <input type="text" id="pet-personality" placeholder="亲人" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px;color:#374151;outline:none">
          </div>
        </div>

        <!-- GitHub 认证区域（投稿必须登录） -->
        <div id="pet-auth-area" style="margin-bottom:14px"></div>

        <button id="pet-submit-btn" disabled style="width:100%;padding:12px;background:#9ca3af;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:not-allowed;font-weight:600">
          🔒 请先以 GitHub 登录后再投稿
        </button>
    `;

    // 更新 GitHub 认证 UI
    updateAuthUI();

    // 当选择"其他"时名称变为选填
    const nameOptional = document.getElementById('pet-name-optional');
    const cateSelect = document.getElementById('pet-category');
    if (cateSelect) {
      cateSelect.addEventListener('change', function(){
        if(this.value === '其他'){
          nameOptional.style.display = 'inline';
        } else {
          nameOptional.style.display = 'none';
        }
      });
    }

    // Image preview
    const imgInput = document.getElementById('pet-images');
    const previews = document.getElementById('pet-image-previews');
    const imageCount = document.getElementById('pet-image-count');
    const uploadedImages = [];

    imgInput.addEventListener('change', async function () {
      const files = Array.from(this.files).slice(0, MAX_IMAGES);
      previews.innerHTML = '';
      uploadedImages.length = 0;

      for (const file of files) {
        try {
          const dataUrl = await fileToWebP(file);
          uploadedImages.push(dataUrl);
          const thumb = document.createElement('div');
          thumb.style.cssText = 'width:80px;height:80px;border-radius:8px;overflow:hidden;border:1px solid #eee';
          thumb.innerHTML = `<img src="${dataUrl}" style="width:100%;height:100%;object-fit:cover">`;
          previews.appendChild(thumb);
        } catch (e) {
          console.warn('Image conversion failed:', e);
        }
      }
      if (imageCount) {
        imageCount.textContent = uploadedImages.length > 0 ? `已选 ${uploadedImages.length} 张` : '';
      }
    });

    // Name duplicate check
    const nameInput = document.getElementById('pet-name');
    const nameStatus = document.getElementById('pet-name-status');

    function checkName() {
      const name = nameInput.value.trim();
      const cate = cateSelect.value;
      if (!name || !cate || cate === '其他') {
        nameStatus.textContent = '';
        nameStatus.style.color = '';
        return;
      }
      // 查重仅检查当前用户自己的已发布宠物（不同用户允许同名）
      const dup = approvedNames.find(n => n.name === name && n.category === cate);
      if (dup) {
        nameStatus.textContent = `⚠️ 您已发布过同名宠物"${name}"`;
        nameStatus.style.color = '#ef4444';
      } else if (name.length >= 2) {
        nameStatus.textContent = '✅ 名称可用';
        nameStatus.style.color = '#22c55e';
      } else {
        nameStatus.textContent = '';
      }
    }

    nameInput.addEventListener('input', checkName);
    cateSelect.addEventListener('change', checkName);

    // Submit
    document.getElementById('pet-submit-btn').addEventListener('click', async function () {
      const name = nameInput.value.trim();
      const category = cateSelect.value;
      const location = document.getElementById('pet-location').value.trim();
      const appearance = document.getElementById('pet-appearance').value.trim();
      const personality = document.getElementById('pet-personality').value.trim();

      // Validate
      if (!category) { showToast('请选择种类', 'error'); return; }
      if (category !== '其他') {
        if (!name || name.length < 2) { showToast('宠物名称需要至少 2 个字符', 'error'); return; }
      }
      if (uploadedImages.length < 1) { showToast('请至少上传 1 张照片', 'error'); return; }

      this.disabled = true;
      this.textContent = '⏳ 提交中...';

      try {
        var headers = {
          'Content-Type': 'application/json'
        };
        var jwt = localStorage.getItem('pet_jwt');
        if (jwt) {
          headers['Authorization'] = 'Bearer ' + jwt;
        } else {
          showToast('请先以 GitHub 登录', 'error');
          this.disabled = false;
          this.textContent = '📤 提交投稿';
          return;
        }

        const r = await fetch(`${API_BASE}/submit`, {
          method: 'POST',
          headers: headers,
          body: JSON.stringify({
            name,
            category,
            location,
            appearance,
            personality,
            images: uploadedImages,
          }),
        });

        const d = await r.json();
        if (d.success) {
          showToast('✅ 投稿提交成功！审核通过后自动发布到页面。');
          closeModal('pet-submit-modal');
        } else {
          showToast(d.message || '提交失败', 'error');
        }
      } catch (e) {
        showToast('网络错误，请重试', 'error');
      } finally {
        this.disabled = false;
        this.textContent = '📤 提交投稿';
      }
    });
  }

  // ================== 邮箱验证模态框 ==================

  function openVerifyModal(submitId) {
    const overlay = createModal('pet-verify-modal');
    overlay.innerHTML = `
      <div class="pet-modal" style="
        background: #fff; border-radius: 16px; padding: 24px;
        width: 90%; max-width: 400px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="font-size:18px;margin:0">🔍 验证身份</h2>
          <button onclick="document.getElementById('pet-verify-modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">✕</button>
        </div>
        <div class="pet-form-group">
          <label>请输入您投稿时填写的邮箱地址：</label>
          <input type="email" id="verify-email" placeholder="example@qq.com" style="width:100%;padding:10px 12px;border:1px solid #ddd;border-radius:8px;font-size:15px;margin-top:8px">
        </div>
        <button id="verify-btn" style="width:100%;padding:12px;margin-top:12px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:16px;cursor:pointer">
          🔍 验证身份
        </button>
        <p style="font-size:12px;color:#888;text-align:center;margin-top:8px">
          💡 不知道邮箱？
          <a href="https://qm.qq.com/q/GbM6rEhNWq" target="_blank" style="color:#3b82f6">加作者 QQ 联系</a>
        </p>
      </div>
    `;

    document.getElementById('verify-btn').addEventListener('click', async function () {
      const email = document.getElementById('verify-email').value.trim();
      if (!email) { showToast('请输入邮箱', 'error'); return; }

      this.disabled = true;
      this.textContent = '⏳ 验证中...';

      try {
        const r = await fetch(`${API_BASE}/verify-email`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submitId, email }),
        });

        const d = await r.json();
        if (d.success) {
          currentEditData = { submitId, email, maskedEmail: d.email, hasQQ: d.hasQQ };
          closeModal('pet-verify-modal');
          openEditModal();
        } else {
          showToast(d.message || '邮箱验证失败', 'error');
        }
      } catch (e) {
        showToast('网络错误', 'error');
      } finally {
        this.disabled = false;
        this.textContent = '🔍 验证身份';
      }
    });
  }

  // ================== 修改/删除模态框 ==================

  async function openEditModal() {
    if (!currentEditData) return;

    // Fetch current submission data
    let subData = null;
    try {
      const counter = await fetch(`${API_BASE}/approved`);
      // We need the data from a different approach - embed in the DOM
      // For now, use the card data
      const card = document.querySelector(`[data-submit-id="${currentEditData.submitId}"]`);
      if (card) {
        const cardContainer = card.closest('.pet-card, [class*="pet"]');
        subData = {
          name: card.dataset.name || '',
          location: card.dataset.location || '',
          appearance: card.dataset.appearance || '',
          personality: card.dataset.personality || '',
        };
      }
    } catch {}

    const verifyCode = generateVerifyCode();
    const maskedEmail = currentEditData.maskedEmail || '已验证';

    const overlay = createModal('pet-edit-modal');
    overlay.innerHTML = `
      <div class="pet-modal" style="
        background: #fff; border-radius: 16px; padding: 24px;
        width: 90%; max-width: 520px; max-height: 90vh; overflow-y: auto;
        box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      ">
        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">
          <h2 style="font-size:18px;margin:0">✏️ 修改投稿信息</h2>
          <button onclick="document.getElementById('pet-edit-modal').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999">✕</button>
        </div>

        <div style="display:grid;grid-template-columns:1fr 1fr;gap:8px">
          <div class="pet-form-group">
            <label>地点</label>
            <input type="text" id="edit-location" value="${subData?.location || ''}" placeholder="常出没地点" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px">
          </div>
          <div class="pet-form-group">
            <label>外貌</label>
            <input type="text" id="edit-appearance" value="${subData?.appearance || ''}" placeholder="外貌特征" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px">
          </div>
          <div class="pet-form-group" style="grid-column:1/-1">
            <label>性格</label>
            <input type="text" id="edit-personality" value="${subData?.personality || ''}" placeholder="性格特点" style="width:100%;padding:8px 10px;border:1px solid #ddd;border-radius:8px;font-size:14px">
          </div>
        </div>

        <div style="margin-top:16px;padding:12px;background:#f8f9fa;border-radius:8px">
          <p style="font-size:13px;margin:0">📧 邮箱：${maskedEmail} ${currentEditData.hasQQ ? '| 💬 QQ：已填写 → 用此 QQ 加作者' : ''}</p>
        </div>

        <div style="margin-top:12px;padding:12px;background:#f0f9ff;border-radius:8px;border:1px dashed #93c5fd">
          <p style="font-size:13px;font-weight:600;margin:0 0 4px">🔑 验证码（提交后将此码发给作者确认身份）</p>
          <p style="font-size:24px;letter-spacing:6px;text-align:center;margin:8px 0;color:#1d4ed8;font-weight:bold" id="edit-verify-code">${formatVerifyCode(verifyCode)}</p>
          <p style="font-size:12px;color:#555;margin:0">
            📌 提交后请用您投稿时填的 QQ 完成验证：<br>
            • 加作者 QQ：<a href="https://qm.qq.com/q/GbM6rEhNWq" target="_blank" style="color:#3b82f6">https://qm.qq.com/q/GbM6rEhNWq</a><br>
            　发送验证码 <strong>${verifyCode}</strong>，作者会核对您的 QQ 号<br>
            • 如未填 QQ，可通过投稿邮箱发送至 <strong>1727369245@qq.com</strong>（附上验证码）
          </p>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button id="edit-submit-btn" style="flex:1;padding:12px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer">
            📤 提交修改申请
          </button>
          <button id="edit-delete-btn" style="padding:12px;background:#fee2e2;color:#dc2626;border:none;border-radius:8px;font-size:15px;cursor:pointer">
            🗑️ 删除
          </button>
        </div>
        <p style="font-size:12px;color:#999;text-align:center;margin-top:8px">💡 作者核实身份后即可批准修改</p>
      </div>
    `;

    // Submit edit
    document.getElementById('edit-submit-btn').addEventListener('click', async function () {
      const edits = {
        location: document.getElementById('edit-location').value.trim(),
        appearance: document.getElementById('edit-appearance').value.trim(),
        personality: document.getElementById('edit-personality').value.trim(),
      };

      this.disabled = true;
      this.textContent = '⏳ 提交中...';

      try {
        const r = await fetch(`${API_BASE}/edit-submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            submitId: currentEditData.submitId,
            verifyCode,
            edits,
          }),
        });

        const d = await r.json();
        if (d.success) {
          showToast('✅ 修改申请已提交！请将验证码发送给作者完成身份验证。');
          closeModal('pet-edit-modal');
        } else {
          showToast(d.message || '提交失败', 'error');
        }
      } catch (e) {
        showToast('网络错误', 'error');
      } finally {
        this.disabled = false;
        this.textContent = '📤 提交修改申请';
      }
    });

    // Delete
    document.getElementById('edit-delete-btn').addEventListener('click', function () {
      if (confirm('⚠️ 确认要申请删除此投稿吗？删除申请提交后需作者审核。')) {
        submitDelete(currentEditData.submitId);
      }
    });
  }

  // ================== 删除 ==================

  async function submitDelete(submitId) {
    const verifyCode = generateVerifyCode();

    const overlay = createModal('pet-delete-modal');
    overlay.innerHTML = `
      <div class="pet-modal" style="
        background: #fff; border-radius: 16px; padding: 24px;
        width: 90%; max-width: 420px; box-shadow: 0 8px 32px rgba(0,0,0,0.12);
      ">
        <h2 style="font-size:18px;margin:0 0 12px">🗑️ 确认删除申请</h2>
        <p style="font-size:14px;color:#666">删除申请提交后需作者审核，审核通过后将不可恢复。</p>

        <div style="margin-top:12px;padding:12px;background:#f0f9ff;border-radius:8px;border:1px dashed #93c5fd">
          <p style="font-size:13px;font-weight:600;margin:0 0 4px">🔑 验证码（提交后将此码发给作者确认身份）</p>
          <p style="font-size:24px;letter-spacing:6px;text-align:center;margin:8px 0;color:#1d4ed8;font-weight:bold">${formatVerifyCode(verifyCode)}</p>
          <p style="font-size:12px;color:#555;margin:0">
            📌 用投稿时填的 QQ 加作者发送：<br>
            • <a href="https://qm.qq.com/q/GbM6rEhNWq" target="_blank" style="color:#3b82f6">https://qm.qq.com/q/GbM6rEhNWq</a><br>
            　发送验证码 <strong>${verifyCode}</strong><br>
            • 或通过投稿邮箱发送至 1727369245@qq.com
          </p>
        </div>

        <div style="display:flex;gap:8px;margin-top:16px">
          <button onclick="document.getElementById('pet-delete-modal').remove()" style="flex:1;padding:12px;background:#e5e7eb;color:#374151;border:none;border-radius:8px;font-size:15px;cursor:pointer">取消</button>
          <button id="delete-confirm-btn" style="flex:1;padding:12px;background:#dc2626;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer">确认删除</button>
        </div>
      </div>
    `;

    document.getElementById('delete-confirm-btn').addEventListener('click', async function () {
      this.disabled = true;
      this.textContent = '⏳ 提交中...';

      try {
        const r = await fetch(`${API_BASE}/delete-submit`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ submitId, verifyCode }),
        });

        const d = await r.json();
        if (d.success) {
          showToast('✅ 删除申请已提交！请将验证码发送给作者完成身份验证。');
          closeModal('pet-delete-modal');
          closeModal('pet-edit-modal');
        } else {
          showToast(d.message || '提交失败', 'error');
        }
      } catch (e) {
        showToast('网络错误', 'error');
      } finally {
        this.disabled = false;
        this.textContent = '确认删除';
      }
    });
  }

  // ================== JWT 直接编辑/删除（GitHub 登录用户）==================

  function openJwtEditModal(submitId) {
    var card = document.querySelector('[data-submit-id="' + submitId + '"]');
    if (!card) { showToast('未找到投稿数据', 'error'); return; }

    var currentLocation = card.dataset.location || '';
    var currentAppearance = card.dataset.appearance || '';
    var currentPersonality = card.dataset.personality || '';

    var overlay = createModal('pet-jwt-edit-modal');
    overlay.innerHTML =
      '<div class="pet-modal" style="background:#fff;border-radius:16px;padding:24px;width:90%;max-width:480px;box-shadow:0 8px 32px rgba(0,0,0,.12)">' +
      '<div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px">' +
      '<h2 style="font-size:18px;margin:0">✏️ 编辑投稿信息</h2>' +
      '<button onclick="document.getElementById(\'pet-jwt-edit-modal\').remove()" style="background:none;border:none;font-size:24px;cursor:pointer;color:#999;line-height:1">✕</button>' +
      '</div>' +
      '<div style="display:flex;align-items:center;gap:8px;margin-bottom:16px;padding:10px 12px;background:#f0f9ff;border-radius:8px;font-size:13px;color:#374151">' +
      '<img src="' + githubUser.avatar_url + '" style="width:20px;height:20px;border-radius:50%">' +
      '<span>✅ 已验证身份 <strong>@' + githubUser.login + '</strong>，修改即时生效</span>' +
      '</div>' +
      '<div style="display:grid;grid-template-columns:1fr;gap:10px;margin-bottom:16px">' +
      '<div><label style="display:block;font-size:13px;font-weight:500;color:#6b7280;margin-bottom:4px">📍 地点</label>' +
      '<input type="text" id="jwt-edit-location" value="' + currentLocation.replace(/"/g,'&quot;') + '" placeholder="常出没地点" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px"></div>' +
      '<div><label style="display:block;font-size:13px;font-weight:500;color:#6b7280;margin-bottom:4px">🎨 外貌</label>' +
      '<input type="text" id="jwt-edit-appearance" value="' + currentAppearance.replace(/"/g,'&quot;') + '" placeholder="外貌特征" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px"></div>' +
      '<div><label style="display:block;font-size:13px;font-weight:500;color:#6b7280;margin-bottom:4px">💕 性格</label>' +
      '<input type="text" id="jwt-edit-personality" value="' + currentPersonality.replace(/"/g,'&quot;') + '" placeholder="性格特点" style="width:100%;padding:10px 12px;border:1px solid #d1d5db;border-radius:8px;font-size:14px"></div>' +
      '</div>' +
      '<button id="jwt-edit-save-btn" style="width:100%;padding:12px;background:#3b82f6;color:#fff;border:none;border-radius:8px;font-size:15px;cursor:pointer;font-weight:600">💾 保存修改</button>' +
      '</div>';

    document.getElementById('jwt-edit-save-btn').addEventListener('click', async function () {
      var jwt = localStorage.getItem('pet_jwt');
      if (!jwt) { showToast('请先登录', 'error'); return; }

      var edits = {
        location: document.getElementById('jwt-edit-location').value.trim(),
        appearance: document.getElementById('jwt-edit-appearance').value.trim(),
        personality: document.getElementById('jwt-edit-personality').value.trim()
      };

      this.disabled = true;
      this.textContent = '⏳ 保存中...';

      try {
        var r = await fetch(API_BASE + '/edit', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
          body: JSON.stringify({ submitId: submitId, edits: edits })
        });
        var d = await r.json();
        if (d.success) {
          showToast('✅ 修改已保存！');
          closeModal('pet-jwt-edit-modal');
          // 刷新页面以显示最新数据
          setTimeout(function(){ location.reload(); }, 1000);
        } else {
          showToast(d.message || '保存失败', 'error');
        }
      } catch (e) {
        showToast('网络错误', 'error');
      } finally {
        this.disabled = false;
        this.textContent = '💾 保存修改';
      }
    });
  }

  async function jwtDelete(submitId) {
    var jwt = localStorage.getItem('pet_jwt');
    if (!jwt) { showToast('请先登录', 'error'); return; }

    try {
      var r = await fetch(API_BASE + '/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', 'Authorization': 'Bearer ' + jwt },
        body: JSON.stringify({ submitId: submitId })
      });
      var d = await r.json();
      if (d.success) {
        showToast('✅ 已删除投稿');
        setTimeout(function(){ location.reload(); }, 1000);
      } else {
        showToast(d.message || '删除失败', 'error');
      }
    } catch (e) {
      showToast('网络错误', 'error');
    }
  }

  // ================== 图片工具 ==================

  function fileToWebP(file) {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = function (e) {
        const img = new Image();
        img.onload = function () {
          const canvas = document.createElement('canvas');
          let w = img.width;
          let h = img.height;
          const maxSize = 1920;
          if (w > maxSize || h > maxSize) {
            const ratio = Math.min(maxSize / w, maxSize / h);
            w = Math.round(w * ratio);
            h = Math.round(h * ratio);
          }
          canvas.width = w;
          canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img, 0, 0, w, h);
          const dataUrl = canvas.toDataURL('image/webp', 0.85);
          resolve(dataUrl);
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  // ================== 启动 ==================

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }

})();
