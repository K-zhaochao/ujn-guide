# 纯静态网页成绩导出

## 同学使用

打开本站「教务成绩导出」→ 打开教务官网 → 在官网完成登录并进入成绩查询 → 回到本站确认登录 → 填写学年、选择学期 → 提交导出。

本站不接收账号密码、不读取学校 Cookie，也不调用本站 API。请求通过浏览器原生表单交给学校在新的顶层页面处理；Excel 文件由学校直接下载。

查询范围默认手动填写，与官网保持一致。可选导入已保存的成绩查询 HTML 页面：只读取 xnm、xqm 下拉选项及选中年份，不加载其中的脚本或资源，不保存、不上传原文件。切换年份、账号或导入失败时清空旧选项，不声称自动读取账号权限。

## 维护与预览

GitHub Pages 发布正常静态构建即可，不设置 GRADE_EXPORT_API_URL，不部署成绩 API。

```powershell
npm run build
python -m mkdocs serve --dev-addr 127.0.0.1:8787
```

入口源码：docs/tools/grade-export.md、docs/javascripts/grade-export.js。下拉菜单保留主题适配、键盘选择、焦点与即时导航清理。

POST 目标为 https://jwgl.ujn.edu.cn/jwglxt/zftal/drdc/export_exportConfig.html?gnmkdm=N305005&layout=default，使用学生模板 JW_N305005_XSCXCJ、23 个重复 exportModel.selectCol 字段及 XLS 格式；字段与 jwgl-endpoint.mjs 对照测试。学期代码 3/12/16 来自现有说明文档，不作为当前学生可查询学期的断言；导入文件时使用文件实际选项值。

server.mjs、jwgl-client.mjs 与加密模块是之前的独立服务实现，留作维护资料；当前页面不引用它们。旧插件、CLI 与安装器继续留在 _archive/grade-export-legacy/，不随主站发布。

## 验证及真实下载验收

```powershell
npm run test:frontend
npm run test:build
npm run build
```

前端测试覆盖原生 POST 地址、全部导出字段、无 API 请求、账号切换、局部 HTML 解析、过期异步读取、键盘与重复导航。模拟测试与公开登录页访问不代表真实账号下载已通过。

真实验收需在同一浏览器登录官网后提交：检查是否下载 XLS，还是打开学校登录页/错误页。本站跨域不读取响应，不以按钮点击或新窗口打开判定下载成功。

跨站 POST 是否携带会话、学校是否接受外站 Origin/Referer，取决于学校 Cookie 与接口策略。公开登录页的 JSESSIONID 当前未显式设置 SameSite，浏览器默认 Lax 对跨站 POST 有限制；部分浏览器只对刚设置的 Cookie 有短时例外。不要把“刚登录可用”视为所有浏览器、所有时段均可用。若学校不接受，使用官网导出，不让同学关闭浏览器保护，也不自动反复提交。

浏览器规则：[跨源导航与读取](https://developer.mozilla.org/en-US/docs/Web/Security/Defenses/Same-origin_policy)、[SameSite](https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Set-Cookie#samesitesamesite-value)。
