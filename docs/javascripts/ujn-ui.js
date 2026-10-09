/**
 * 济南大学校园通 — 站点交互脚本
 * =====================================
 *
 * 原先内联在 overrides/main.html 的 {% block scripts %} 里，现改为独立文件：
 *
 *   - 公告栏关闭、页脚按钮注入、跳蚤市场与赞助弹窗、即时导航滚动修复；
 *   - 站点根路径由脚本自身地址反推，不再依赖模板里的 {{ base_url }}；
 *   - 跳蚤市场配置从页面上的 <script type="application/json" id="ujn-flea-config"> 读取，
 *     模板只提供数据，不再拼接代码。
 *
 * 由模板以 <script src="{{ base_url }}/javascripts/ujn-ui.js"></script> 引入（每个页面都有）。
 */

/* ===== 站点根路径 =====
   支持部署在子路径下（例如 GitHub Pages 项目站点 /ujn-guide/）。
   本文件由模板以 <script src="<站点根>/javascripts/ujn-ui.js"> 引入，
   因此从脚本自身的地址反推站点根，加载时固定下来；
   即使 navigation.instant 之后页面深度变了，资源地址也不会错。 */
var UJN_SITE_ROOT = (function () {
  try {
    var self = document.currentScript && document.currentScript.src;
    if (!self) return "/";
    // 脚本位于 <站点根>/javascripts/ujn-ui.js，上一级就是站点根
    return new URL("../", self).pathname;
  } catch (error) {
    return "/";
  }
})();

document.addEventListener("DOMContentLoaded", function () {

  /* ===== 修复 navigation.instant 滚动位置问题 ===== */
  if (typeof document$ !== "undefined") {
    document$.subscribe(function () {
      setTimeout(function () {
        var hash = location.hash;
        if (hash && document.querySelector(hash)) {
          document.querySelector(hash).scrollIntoView();
        } else {
          window.scrollTo(0, 0);
        }
      }, 0);
    });
  }

  // ==================== 弹窗创建（仅执行一次）====================
  var MODALS_CREATED = false;
  var openFleaModal;
  var closeFleaModal;

  function createModals() {
    if (MODALS_CREATED) return;
    MODALS_CREATED = true;

    /* 赞助弹窗 */
    var overlay = document.createElement("div");
    overlay.id = "donate-modal-overlay";
    overlay.className = "ujn-overlay donate-overlay";
    overlay.onclick = function (e) {
      if (e.target === overlay) {
        overlay.classList.remove("donate-overlay--open");
      }
    };

    var card = document.createElement("div");
    card.className = "ujn-modal donate-card";

    var closeBtn = document.createElement("button");
    closeBtn.className = "donate-close";
    closeBtn.textContent = "\u2715";
    closeBtn.title = "关闭";
    closeBtn.onclick = function () {
      overlay.classList.remove("donate-overlay--open");
    };
    card.appendChild(closeBtn);

    var title = document.createElement("div");
    title.className = "donate-title";
    title.textContent = "\u2615 \u8BF7\u7AD9\u957F\u559D\u676F\u5976\u8336";
    card.appendChild(title);

    var desc = document.createElement("div");
    desc.className = "donate-desc";
    desc.innerHTML = "\u611F\u8C22\u4F60\u4F7F\u7528\u672C\u6307\u5357 \uD83D\uDC4F<br>\u5982\u679C\u672C\u7AD9\u5BF9\u4F60\u6709\u6240\u5E2E\u52A9<br>\u53EF\u4EE5\u652F\u6301\u4E00\u4E0B\u7AD9\u957F \u2764\uFE0F";
    card.appendChild(desc);

    var img = document.createElement("img");
    img.className = "donate-qrcode";
    img.src = UJN_SITE_ROOT + "assets/images/\u6536\u6B3E\u7801/\u6536\u6B3E\u7801.webp";
    img.alt = "\u6536\u6B3E\u7801";
    img.loading = "lazy";
    card.appendChild(img);

    var tip = document.createElement("div");
    tip.className = "donate-tip";
    tip.textContent = "\u626B\u7801\u540E\u8BF7\u5907\u6CE8\u300C\u6821\u56ED\u901A\u300D\uFF0C\u4E07\u5206\u611F\u8C22\uFF01";
    card.appendChild(tip);

    overlay.appendChild(card);
    document.body.appendChild(overlay);

    /* One QR at a time, with a fixed header and a scrollable body on small screens. */
    var fleaOverlay = document.createElement("div");
    fleaOverlay.id = "flea-modal-overlay";
    fleaOverlay.className = "ujn-overlay flea-overlay";
    var fleaCard = document.createElement("div");
    fleaCard.className = "ujn-modal flea-card";
    fleaCard.setAttribute("role", "dialog");
    fleaCard.setAttribute("aria-modal", "true");
    fleaCard.setAttribute("aria-labelledby", "flea-title");
    fleaCard.setAttribute("aria-describedby", "flea-description");
    fleaCard.innerHTML = `
      <header class="flea-header">
        <div><h2 id="flea-title">校园跳蚤市场</h2><p id="flea-description">选择常用平台，加入校园闲置交流。</p></div>
        <button type="button" class="flea-close" aria-label="关闭跳蚤市场" title="关闭">×</button>
      </header>
      <div class="flea-tabs" role="tablist" aria-label="加入平台">
        <button type="button" id="flea-tab-wechat" role="tab" aria-controls="flea-panel-wechat" aria-selected="true" tabindex="0">微信 · 腾讯频道</button>
        <button type="button" id="flea-tab-qq" role="tab" aria-controls="flea-panel-qq" aria-selected="false" tabindex="-1">QQ 频道</button>
      </div>
      <div class="flea-body">
        <section id="flea-panel-wechat" class="flea-panel" role="tabpanel" aria-labelledby="flea-tab-wechat" tabindex="0">
          <div class="flea-qr-frame"><img alt="微信腾讯频道二维码" draggable="false"></div>
          <p class="flea-caption">用微信扫一扫，或长按保存二维码后识别。</p>
        </section>
        <section id="flea-panel-qq" class="flea-panel" role="tabpanel" aria-labelledby="flea-tab-qq" tabindex="0" hidden>
          <div class="flea-qr-frame"><img alt="QQ频道二维码" draggable="false"></div>
          <a class="flea-join" href="https://pd.qq.com/s/a41e8nsi6?b=5" target="_blank" rel="noopener noreferrer">打开 QQ 频道 ↗</a>
        </section>
      </div>
      <p class="flea-tip">闲置流转，让校园生活轻一点。</p>`;
    var images = fleaCard.querySelectorAll(".flea-qr-frame img");
    images[0].src = UJN_SITE_ROOT + "assets/images/跳蚤市场/跳蚤市场-微信小程序版.webp";
    images[1].src = UJN_SITE_ROOT + "assets/images/跳蚤市场/跳蚤市场-QQ频道.webp";
    var tabs = Array.prototype.slice.call(fleaCard.querySelectorAll('[role="tab"]'));
    var panels = Array.prototype.slice.call(fleaCard.querySelectorAll('[role="tabpanel"]'));
    var fleaClose = fleaCard.querySelector(".flea-close");
    var opener = null;
    var previousOverflow = "";
    function selectPlatform(index, focus) {
      tabs.forEach(function (tab, i) {
        tab.setAttribute("aria-selected", String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
        panels[i].hidden = i !== index;
      });
      fleaCard.querySelector(".flea-body").scrollTop = 0;
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener("click", function () { selectPlatform(index, true); });
      tab.addEventListener("keydown", function (event) {
        var target;
        if (event.key === "ArrowRight" || event.key === "ArrowLeft") target = 1 - index;
        else if (event.key === "Home") target = 0;
        else if (event.key === "End") target = 1;
        else return;
        event.preventDefault();
        selectPlatform(target, true);
      });
    });
    closeFleaModal = function () {
      if (!fleaOverlay.classList.contains("flea-overlay--open")) return;
      fleaOverlay.classList.remove("flea-overlay--open");
      document.body.style.overflow = previousOverflow;
      if (opener && opener.isConnected) opener.focus({ preventScroll: true });
    };
    openFleaModal = function () {
      if (fleaOverlay.classList.contains("flea-overlay--open")) return;
      opener = document.activeElement;
      previousOverflow = document.body.style.overflow;
      selectPlatform(0, false);
      document.body.style.overflow = "hidden";
      fleaOverlay.classList.add("flea-overlay--open");
      fleaClose.focus({ preventScroll: true });
    };
    fleaClose.addEventListener("click", closeFleaModal);
    fleaOverlay.addEventListener("click", function (event) {
      if (event.target === fleaOverlay) closeFleaModal();
    });
    fleaOverlay.addEventListener("keydown", function (event) {
      if (event.key === "Escape") { event.preventDefault(); closeFleaModal(); return; }
      if (event.key !== "Tab") return;
      var focusable = Array.prototype.slice.call(fleaCard.querySelectorAll('button, a[href], [tabindex="0"]')).filter(function (node) {
        return node.tabIndex >= 0 && !node.closest('[hidden]');
      });
      var first = focusable[0], last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) { event.preventDefault(); last.focus(); }
      else if (!event.shiftKey && document.activeElement === last) { event.preventDefault(); first.focus(); }
    });
    fleaOverlay.appendChild(fleaCard);
    document.body.appendChild(fleaOverlay);
  }

  // ==================== 页脚签名（每次导航重新执行）====================
  // 跳蚤市场与赞助不再挂在页脚：它们是"站点级入口"，放在首页的卡片里更好找
  // （点击由下面的 [data-ujn-modal] 代理处理）。页脚只留一行居中签名。
  var marketName = (function () {
      var node = document.getElementById("ujn-flea-config");
      if (!node) return "";
      try {
        return (JSON.parse(node.textContent) || {}).name || "";
      } catch (error) {
        return "";
      }
    })();

function injectFooterSignature() {
  var footerMetaInner = document.querySelector(".md-footer-meta__inner");
  if (!footerMetaInner) return;
  if (footerMetaInner.querySelector(".ujn-footer-signature")) return;

  /* Material 9 用的是 .md-copyright（旧版是 .md-footer-copyright），两个都试 */
  var copyright = footerMetaInner.querySelector(".md-copyright, .md-footer-copyright");
  if (copyright) copyright.style.display = "none";
  var footerSocial = footerMetaInner.querySelector(".md-footer-social");
  if (footerSocial) footerSocial.style.display = "none";

  var signature = document.createElement("p");
  signature.className = "ujn-footer-signature";
  signature.setAttribute("lang", "en");
  signature.textContent = "Giving Sparks For Love";
  footerMetaInner.appendChild(signature);
}

/** 打开首页卡片对应的弹窗：任何带 data-ujn-modal 的元素都能触发。 */
function openModalByName(name) {
  if (name === "flea" && openFleaModal) { openFleaModal(); return true; }
  if (name !== "donate") return false;
  var overlayId = name === "donate" ? "donate-modal-overlay" : "flea-modal-overlay";
  var openClass = name === "donate" ? "donate-overlay--open" : "flea-overlay--open";
  var overlay = document.getElementById(overlayId);
  if (!overlay) return false;
  overlay.classList.add(openClass);
  return true;
}

function onModalTriggerClick(event) {
  var trigger = event.target && event.target.closest ? event.target.closest("[data-ujn-modal]") : null;
  if (!trigger) return;
  if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  if (typeof event.button === "number" && event.button !== 0) return;
  if (openModalByName(trigger.getAttribute("data-ujn-modal"))) {
    event.preventDefault();
  }
}

// 初始化：创建弹窗 + 页脚签名；首页卡片上的入口用事件代理，只绑一次
createModals();
injectFooterSignature();
document.addEventListener("click", onModalTriggerClick);

// 即时导航后：重新注入签名（弹窗与代理监听已存在，不需要重建）
if (typeof document$ !== "undefined") {
  document$.subscribe(function () {
    if (closeFleaModal) closeFleaModal();
    injectFooterSignature();
  });
}
});
