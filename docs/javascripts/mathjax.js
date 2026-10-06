(function () {
  "use strict";

  // 重复执行配置脚本时，不覆盖运行中的引擎，也不重复订阅导航。
  if (window.__ujnMathJaxInitialized) return;
  window.__ujnMathJaxInitialized = true;

  var ready = false;
  var pageVersion = 0;
  var renderedArticle = null;
  var renderQueue = Promise.resolve();

  // 引擎按需加载：只有当前页面真的出现公式时才去 CDN 取 MathJax（约 1 MB）。
  // 地址与 SRI 只在这里维护一份；overrides/main.html 不再无条件引入引擎。
  var ENGINE = {
    id: "mathjax-script",
    src: "https://cdn.jsdelivr.net/npm/mathjax@3.2.2/es5/tex-mml-chtml.js",
    integrity: "sha384-Wuix6BuhrWbjDBs24bXrjf4ZQ5aFeFWBuKkFekO2t8xFU0iNaLQfp2K6/1Nxveei"
  };
  var engineRequested = false;

  function currentArticle() {
    return document.querySelector(".md-content__inner");
  }

  function pageHasMath() {
    var article = currentArticle();
    return !!(article && article.querySelector(".arithmatex"));
  }

  function loadEngine() {
    if (engineRequested) return;
    engineRequested = true;
    var script = document.createElement("script");
    script.id = ENGINE.id;
    // 用 setAttribute 写属性：SRI 与 crossorigin 必须是真实的内容属性，
    // jsdom 里给 script.integrity 赋值不会反映到 attribute 上。
    script.setAttribute("src", ENGINE.src);
    script.setAttribute("integrity", ENGINE.integrity);
    script.setAttribute("crossorigin", "anonymous");
    script.setAttribute("defer", "");
    script.addEventListener("error", function () {
      reportError(new Error("MathJax 脚本加载失败，请检查网络后重试。"));
    }, { once: true });
    document.head.appendChild(script);
  }

  function reportError(error) {
    console.warn("[MathJax] 公式排版未完成：", error);
  }

  function typesetPage() {
    var version = ++pageVersion;
    // startup.promise 完成后会处理届时的页面，无需轮询或积压旧页面。
    if (!ready) {
      // 引擎尚未就绪：没有公式的页面根本不加载它。
      if (pageHasMath()) loadEngine();
      return;
    }
    var article = currentArticle();

    renderQueue = renderQueue.then(function () {
      if (version !== pageVersion || article === renderedArticle) return;
      if (article && !article.isConnected) return;

      var mathjax = window.MathJax;
      // 即时导航会移除 head 中的动态样式，必须同时丢弃 CHTML 字形缓存。
      mathjax.startup.output.clearCache();
      mathjax.typesetClear();
      mathjax.texReset();

      // 无公式页面也清理旧记录，但不启动排版。
      if (!article || !article.querySelector(".arithmatex")) {
        renderedArticle = article;
        return;
      }

      return mathjax.typesetPromise([article]).then(function () {
        renderedArticle = article;
      });
    }).catch(reportError); // 一次失败不能阻塞后续页面的排版。
  }

  // 本配置由页尾普通脚本执行，早于 extrahead 中 defer 加载的 MathJax 引擎。
  window.MathJax = {
    tex: {
      inlineMath: [["$", "$"], ["\\(", "\\)"]],
      displayMath: [["$$", "$$"], ["\\[", "\\]"]],
      processEscapes: true,
      processEnvironments: true
    },
    options: {
      ignoreHtmlClass: ".*|",
      processHtmlClass: "arithmatex"
    },
    startup: {
      // 首次访问和即时导航共用队列，避免自动排版与导航回调并行。
      typeset: false,
      ready: function () {
        var mathjax = window.MathJax;
        try {
          mathjax.startup.defaultReady();
          mathjax.startup.promise.then(function () {
            ready = true;
            typesetPage();
          }).catch(reportError);
        } catch (error) {
          reportError(error);
        }
      }
    }
  };

  if (typeof document$ !== "undefined") {
    document$.subscribe(typesetPage);
  } else if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", typesetPage);
  } else {
    typesetPage();
  }
})();
