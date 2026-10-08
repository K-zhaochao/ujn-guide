# 网页成绩导出

## 本地启动

需要 Node 22 和已安装的主站构建依赖。在仓库根目录运行：

```powershell
npm run build
npm run dev:site
```

打开 <http://127.0.0.1:8787/tools/grade-export/>。独立 Node 服务同时提供静态产物和 `/api/grade-export/`，先填写账号密码登录，再从当前学生的教务查询页面读取学年、学期；选择范围后浏览器下载 XLS。

默认「统一身份认证」对应用户提供的 `http://jwgl.ujn.edu.cn/sso/driotlogin`；「正方直接登录」对应说明文档中的 `/jwglxt/xtgl/login_slogin.html`。两者可能使用不同密码，不自动重试另一种密码流程。

`mkdocs serve` 和 GitHub Pages 仅提供静态页面，没有 API 时表单禁用并显示未连接服务，不会向学校域名直接发起跨域登录。

## GitHub Pages 前端连接

Pages 只发布静态文件，成绩登录与导出进程需要单独的 HTTPS 服务。本站页面仍只有账密登录这一种操作，不要求同学安装软件。

1. 部署下方的 Node 服务与 HTTPS 反向代理，确保该主机能访问学校教务系统。
2. 服务设置 `GRADE_ALLOWED_ORIGINS` 为 Pages 的实际源（如 `https://k-zhaochao.github.io`，不含仓库路径）；自定义域名则填写实际域名。默认不启用跨域，支持逗号分隔多个准确源，无通配符。
3. GitHub 仓库 Settings → Secrets and variables → Actions → Variables 新增 `GRADE_EXPORT_API_URL`，值为已部署服务的 HTTPS `/api/grade-export/` 地址，保留末尾斜杠。该值是公开地址，不是密钥。
4. 重新运行 Pages workflow。页面先检查该服务，再开放账密输入。

允许来源只获得显式 CORS，POST 仍要求 JSON 与本站请求头，下载暴露 `Content-Disposition`；不使用浏览器跨站 Cookie。未配置服务时，页面显示简短状态并支持重连，不展示开发验收记录。

## 生产部署

不需要宠物投稿后台、数据库或上传目录。保持整个项目中的 `tools/grade-export/` 模块目录完整，运行服务的工作目录是项目根目录。

```bash
GRADE_PUBLIC_ORIGIN=https://ujn.matehub.top \
GRADE_TRUST_PROXY=1 GRADE_PORT=8787 \
node tools/grade-export/server.mjs
```

服务固定监听 `127.0.0.1`。进程用 systemd、pm2 或 1Panel 保持运行；外部只开放现有 HTTPS 网站。`GRADE_PUBLIC_ORIGIN` 必须准确匹配浏览器地址的协议和域名，不含尾斜杠。`GRADE_TRUST_PROXY=1` 仅适用于下方 Nginx 覆盖 `X-Real-IP` 的部署。

在 Nginx **http 层**定义：

```nginx
limit_req_zone $binary_remote_addr zone=grade_export:10m rate=60r/m;
```

在本站 HTTPS **server 层**增加下面的状态接口和严格匹配的操作接口，保留原来的静态网站配置：

```nginx
location = /api/grade-export/status {
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_hide_header Set-Cookie;
    access_log off;
}
location ~ ^/api/grade-export/(login|periods|export|logout)$ {
    limit_req zone=grade_export burst=5 nodelay;
    limit_req_status 429;
    client_max_body_size 8k;
    proxy_pass http://127.0.0.1:8787;
    proxy_set_header Host $host;
    proxy_set_header X-Real-IP $remote_addr;
    proxy_read_timeout 90s;
    proxy_request_buffering off;
    proxy_buffering off;
    proxy_max_temp_file_size 0;
    proxy_hide_header Set-Cookie;
    access_log off;
}
```

现有 CSP 的 `connect-src` 需包含 `'self'`，`form-action` 可保持 `'self'`；页面脚本为自托管。不要在代理、APM、调试工具中记录请求体或下载文件。Nginx 配置先运行 `nginx -t` 再 reload。

学校公开统一认证入口目前会跳转到 **HTTP** 的 `sso.ujn.edu.cn/tpass/login`，学校加密字段不等于端到端 HTTPS。这里保持学校的真实协议；本站浏览器至服务的连接在生产环境使用 HTTPS。若学校提供等价 HTTPS SSO 入口，先验证完整跳转再调整客户端。

## 账号查询与短时会话

- POST /api/grade-export/login：账号密码只用于此次登录，响应包含学校下拉框返回的 years / terms / year / term 和随机 sessionToken。
- POST /api/grade-export/periods：提交内存 token 和所选 year，读取该学年的学校学期选项，清除前端旧选项后再允许导出。
- POST /api/grade-export/export：仅接受服务已为当前账号返回的学年和学期组合，直接透传学校原始值，不自行映射为固定三个学期。
- POST /api/grade-export/logout：销毁当前学校 CookieJar，token 立即失效。

密码不保留；学校 CookieJar 仅在内存保留最多 10 分钟，每账号会话隔离，最多 100 个会话、同一来源 IP 最多 2 个。token 只在当前页面闭包内存中使用，不写 Cookie/localStorage/sessionStorage，不写 DOM。显式退出、页面离开、超时或学校会话错误会清理；服务重启后需重新登录。多实例部署需粘性路由，或只运行一个成绩服务实例。

登录限额 6 次/10 分钟/IP，总操作限额 60 次/10 分钟/IP；4 个并发、每会话单操作锁、75 秒整体超时、8 KB 请求体、20 MB 导出上限。仅信任显式配置的环回代理 X-Real-IP。

选项来自登录后的成绩筛选页面，学校返回空列表时显示明确错误，不使用当前年份补位。学校提供的“可查询”选项不等同于此学期已经公布成绩；没有成绩时提示学校返回的导出状态。

CAS/RSA 登录协议保持原实现；导出使用 export_exportConfig.html、JW_N305005_XSCXCJ 学生模板和 23 列。服务只提供本站网页操作；旧脚本、命令行、安装器与二进制发布流程保存在 _archive/grade-export-legacy/，不随主站发布。

## 验证与当前边界

```bash
npm run test:grades
npm run test:frontend
npm run test:build
npm run build
```

模拟系统覆盖 CAS、原生 RSA、学生对应的学年与学期、联动更新、token 隔离、到期与退出、重复操作锁、导出、错误网页、请求校验、超时、限流、键盘下拉框、前端取消与导航清理。

没有使用真实账号进行登录与成绩导出；公开页面访问和模拟测试只证明协议实现及本地链路。验证码、扫码、二次认证需在学校入口处理，不自动绕过。校外访问取决于运行服务的网络。历史 Release 附件本轮未修改；二进制发布工作流已归档。

## 回滚

停止成绩导出进程，移除上述 API location 并 reload Nginx，静态主站和宠物图鉴继续运行。源码级回滚材料在本次 `reports/grade-export-ui-20261008/`，包含原始哈希、补丁和只针对本次改动的脚本，保留用户此前未提交内容。
