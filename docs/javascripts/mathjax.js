// MathJax 3 配置（Material for MkDocs 官方推荐写法）
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
  }
};

// 带重试的排版函数：在 MathJax 尚未加载完成时等待重试
function typesetMathJax(retries, delay) {
  retries = retries || 5;
  delay = delay || 500;
  if (typeof MathJax !== "undefined" && MathJax.typesetPromise) {
    MathJax.typesetPromise();
  } else if (retries > 0) {
    setTimeout(function () { typesetMathJax(retries - 1, delay); }, delay);
  }
}

// Material for MkDocs 的 instant navigation 每次导航触发时重新渲染
document$.subscribe(function () {
  typesetMathJax();
});
