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

    /* ===== 跳蚤市场弹窗 ===== */
    var fleaOverlay = document.createElement("div");
    fleaOverlay.id = "flea-modal-overlay";
    fleaOverlay.className = "ujn-overlay flea-overlay";
    fleaOverlay.onclick = function (e) {
      if (e.target === fleaOverlay) {
        fleaOverlay.classList.remove("flea-overlay--open");
      }
    };

    document.addEventListener("keydown", function fleaKeydown(e) {
      if (e.key === "Escape" && fleaOverlay.classList.contains("flea-overlay--open")) {
        fleaOverlay.classList.remove("flea-overlay--open");
      }
    });

    var fleaCard = document.createElement("div");
    fleaCard.className = "ujn-modal flea-card";

    var fleaClose = document.createElement("button");
    fleaClose.className = "flea-close";
    fleaClose.textContent = "\u2715";
    fleaClose.title = "关闭";
    fleaClose.onclick = function () {
      fleaOverlay.classList.remove("flea-overlay--open");
    };
    fleaCard.appendChild(fleaClose);

    var fleaTitle = document.createElement("div");
    fleaTitle.className = "flea-title";
    fleaTitle.textContent = "\uD83D\uDED2 \u626B\u7801\u52A0\u5165\u8DF3\u86A4\u5E02\u573A";
    fleaCard.appendChild(fleaTitle);

    var fleaRow = document.createElement("div");
    fleaRow.className = "flea-qr-row";

    /* 微信小程序 */
    var fleaWx = document.createElement("div");
    fleaWx.className = "flea-qr-item";
    var fleaWxWrap = document.createElement("div");
    fleaWxWrap.className = "flea-qr-img-wrap";
    var fleaWxImg = document.createElement("img");
    fleaWxImg.src = UJN_SITE_ROOT + "assets/images/\u8DF3\u86A4\u5E02\u573A/\u8DF3\u86A4\u5E02\u573A-\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u7248.webp";
    fleaWxImg.alt = "\u5FAE\u4FE1\u5C0F\u7A0B\u5E8F\u4E8C\u7EF4\u7801";
    fleaWxImg.loading = "lazy";
    fleaWxWrap.appendChild(fleaWxImg);
    fleaWx.appendChild(fleaWxWrap);
    var fleaWxLabel = document.createElement("div");
    fleaWxLabel.className = "flea-qr-label flea-qr-label--wechat";
    fleaWxLabel.textContent = "\uD83D\uDCAC \u5FAE\u4FE1 \u00B7 \u817E\u8BAF\u9891\u9053\u5C0F\u7A0B\u5E8F";
    fleaWx.appendChild(fleaWxLabel);
    fleaRow.appendChild(fleaWx);

    /* QQ 频道 */
    var fleaQq = document.createElement("div");
    fleaQq.className = "flea-qr-item flea-qr-item--qq";
    var fleaQqWrap = document.createElement("div");
    fleaQqWrap.className = "flea-qr-img-wrap";
    var fleaQqLink = document.createElement("a");
    fleaQqLink.href = "https://pd.qq.com/s/a41e8nsi6?b=5";
    fleaQqLink.target = "_blank";
    fleaQqLink.rel = "noopener";
    var fleaQqImg = document.createElement("img");
    fleaQqImg.src = UJN_SITE_ROOT + "assets/images/\u8DF3\u86A4\u5E02\u573A/\u8DF3\u86A4\u5E02\u573A-QQ\u9891\u9053.webp";
    fleaQqImg.alt = "QQ\u9891\u9053\u4E8C\u7EF4\u7801";
    fleaQqImg.loading = "lazy";
    fleaQqLink.appendChild(fleaQqImg);
    fleaQqWrap.appendChild(fleaQqLink);
    fleaQq.appendChild(fleaQqWrap);
    var fleaQqLabel = document.createElement("div");
    fleaQqLabel.className = "flea-qr-label flea-qr-label--qq";
    var fleaQqLabelLink = document.createElement("a");
    fleaQqLabelLink.href = "https://pd.qq.com/s/a41e8nsi6?b=5";
    fleaQqLabelLink.target = "_blank";
    fleaQqLabelLink.rel = "noopener";
    fleaQqLabelLink.textContent = "\uD83D\uDC27 QQ \u9891\u9053 \u00B7 \u70B9\u51FB\u52A0\u5165 \u2192";
    fleaQqLabelLink.style.textDecoration = "none";
    fleaQqLabelLink.style.color = "#1677ff";
    fleaQqLabel.appendChild(fleaQqLabelLink);
    fleaQq.appendChild(fleaQqLabel);
    fleaRow.appendChild(fleaQq);

    fleaCard.appendChild(fleaRow);

    var fleaTip = document.createElement("div");
    fleaTip.className = "flea-tip";
    fleaTip.textContent = "\uD83D\uDCA1 \u957F\u6309\u6216\u626B\u4E00\u626B\u4E0A\u65B9\u4E8C\u7EF4\u7801\u5373\u53EF\u52A0\u5165 \u00B7 \u8BF7\u9075\u5B88\u5E73\u53F0\u4EA4\u6613\u89C4\u5219\uFF0C\u8C28\u9632\u8BC8\u9A97";
    fleaCard.appendChild(fleaTip);

    fleaWxImg.addEventListener("pointerdown", function (e) { e.preventDefault(); });
    fleaWxImg.addEventListener("touchstart", function (e) { e.preventDefault(); });
    fleaWxImg.addEventListener("dragstart", function (e) { e.preventDefault(); });
    fleaQqImg.addEventListener("dragstart", function (e) { e.preventDefault(); });

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
    injectFooterSignature();
  });
}
});
