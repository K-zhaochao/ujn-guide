const { existsSync } = require('node:fs');
const { resolve } = require('node:path');
const { defineConfig } = require('vitest/config');

// server/ 是私有后端，在 .gitignore 里，公开仓库不含它。
// 它不在时就跳过依赖它的 admin-* 套件——否则公开 CI 里必然 MODULE_NOT_FOUND，
// 把整条校验流水线拖红（这些测试在私有仓库里照常运行）。
const hasServer = existsSync(resolve(__dirname, 'server', 'public'));

module.exports = defineConfig({
  test: {
    environment: 'jsdom',
    include: ['tests/frontend/**/*.test.js'],
    // 这里的 exclude 会覆盖 vitest 默认值，但 include 已限定在 tests/frontend/ 下，
    // 不会误收 node_modules，所以是安全的。
    exclude: hasServer ? [] : ['tests/frontend/admin-*.test.js'],
    clearMocks: true,
    restoreMocks: true,
  },
});
