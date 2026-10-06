/**
 * 贡献者名单的来源切换（GitHub / Gitee）。
 *
 * 渐进增强：没有这个脚本时，两个面板**都显示**（CSS 的默认态），谁也不会被藏起来。
 * 脚本生效后才给 <html> 加 ujn-js，由 CSS 收起面板、改用标签栏切换。
 *
 * 无障碍：标签用 role="tablist"/tab/tabpanel，支持 ← → Home End 键盘操作，
 * 并同步 aria-selected 与 tabindex（未选中的 tab 用 -1 移出 Tab 键序列）。
 */
(function () {
  "use strict";

  function initTabs(root) {
    if (root.dataset.ujnTabsReady === "1") return;
    root.dataset.ujnTabsReady = "1";

    var bar = root.querySelector(".ujn-contributors-tabs__bar");
    var tabs = Array.prototype.slice.call(root.querySelectorAll("[data-ujn-tab]"));
    var panels = Array.prototype.slice.call(root.querySelectorAll("[data-ujn-panel]"));
    if (!bar || tabs.length < 2 || !panels.length) return;

    document.documentElement.classList.add("ujn-js");

    function activate(key, focus) {
      tabs.forEach(function (tab) {
        var selected = tab.dataset.ujnTab === key;
        tab.setAttribute("aria-selected", selected ? "true" : "false");
        tab.tabIndex = selected ? 0 : -1;
        if (selected && focus) tab.focus();
      });
      panels.forEach(function (panel) {
        panel.hidden = panel.dataset.ujnPanel !== key;
      });
      root.dataset.ujnActive = key;
      // 让滑动高亮跟着走（两个标签时就是 0% / 100%）
      var index = tabs.findIndex(function (tab) {
        return tab.dataset.ujnTab === key;
      });
      root.style.setProperty("--ujn-tab-index", String(Math.max(index, 0)));
      root.style.setProperty("--ujn-tab-count", String(tabs.length));
    }

    bar.addEventListener("click", function (event) {
      var tab = event.target.closest("[data-ujn-tab]");
      if (tab && root.contains(tab)) activate(tab.dataset.ujnTab, false);
    });

    bar.addEventListener("keydown", function (event) {
      var current = tabs.findIndex(function (tab) {
        return tab.getAttribute("aria-selected") === "true";
      });
      if (current < 0) return;
      var next = null;
      if (event.key === "ArrowRight") next = (current + 1) % tabs.length;
      else if (event.key === "ArrowLeft") next = (current - 1 + tabs.length) % tabs.length;
      else if (event.key === "Home") next = 0;
      else if (event.key === "End") next = tabs.length - 1;
      if (next === null) return;
      event.preventDefault();
      activate(tabs[next].dataset.ujnTab, true);
    });

    // 支持 #github / #gitee 这类锚点直达（比如从外部链接跳过来）
    var hash = (window.location.hash || "").replace("#", "");
    var initial = tabs.some(function (tab) { return tab.dataset.ujnTab === hash; }) ? hash : tabs[0].dataset.ujnTab;
    // 一定要在初始化时切一次：HTML 里**没有** hidden 属性（那样无 JS 就会藏人），
    // 收起面板这件事只能由脚本来做。
    activate(initial, false);
  }

  function boot() {
    document.querySelectorAll("[data-ujn-tabs]").forEach(initTabs);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", boot);
  } else {
    boot();
  }
  // Material 的即时导航会换掉正文，换完要重新接管
  if (window.document$ && typeof window.document$.subscribe === "function") {
    window.document$.subscribe(boot);
  }
})();
