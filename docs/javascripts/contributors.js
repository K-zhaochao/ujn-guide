(function () {
  'use strict';
  var active = null;
  function init() {
    var host = document.querySelector('[data-contributors]');
    if (!host || host === active) return;
    active = host;
    var control = host.querySelector('[role="tablist"]');
    var tabs = Array.from(control.querySelectorAll('[role="tab"]'));
    var panels = Array.from(host.querySelectorAll('[role="tabpanel"]'));
    function choose(index, focus) {
      index = (index + tabs.length) % tabs.length;
      control.style.setProperty('--platform-index', String(index));
      tabs.forEach(function (tab, i) {
        tab.setAttribute('aria-selected', String(i === index));
        tab.tabIndex = i === index ? 0 : -1;
      });
      panels.forEach(function (panel) { panel.hidden = panel.dataset.platform !== tabs[index].dataset.platform; });
      if (focus) tabs[index].focus();
    }
    tabs.forEach(function (tab, index) {
      tab.addEventListener('click', function () { choose(index, false); });
      tab.addEventListener('keydown', function (event) {
        if (!['ArrowLeft', 'ArrowRight', 'Home', 'End'].includes(event.key)) return;
        event.preventDefault();
        choose(event.key === 'Home' ? 0 : event.key === 'End' ? tabs.length - 1 : index + (event.key === 'ArrowRight' ? 1 : -1), true);
      });
    });
    control.hidden = false;
    choose(0, false);
    host.dataset.ready = 'true';
  }
  if (typeof document$ !== 'undefined') document$.subscribe(init);
  else if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', init);
  else init();
})();
