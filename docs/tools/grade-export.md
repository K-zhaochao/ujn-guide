---
title: 教务成绩导出
---

# 📊 教务成绩导出

把你**自己**在教务系统里的成绩一键导出成 Excel（`.xls`），不用一页页抄。

!!! quote "关于这个工具的来源"
    该工具的参考由**一位不愿意透露信息的学长**提供，仅供大家的便捷 / 学习。

## 怎么用（三步）

**第 1 步**：装一个脚本管理器（选一个就行，都是浏览器扩展）：

- [Tampermonkey](https://www.tampermonkey.net/)（Edge / Chrome / Firefox / Safari 都有）
- 或者 [Violentmonkey](https://violentmonkey.github.io/)

**第 2 步**：点下面的链接安装脚本（装了管理器后，浏览器会弹出安装确认）：

[:octicons-download-24: 安装「济大教务 · 成绩一键导出」](../assets/tools/jwgl-grade-export.user.js){ .md-button .md-button--primary }

**第 3 步**：登录教务系统，进**成绩查询**页面。右下角会出现一个「📊 导出成绩」按钮：

1. 点开，选**学年**和**学期**（第一学期 / 第二学期 / 短学期）；
2. 点「开始导出」，浏览器会直接下载一个 `.xls`；
3. 导出结果会显示在面板里（文件名 + 大小），失败也会告诉你原因。

!!! tip "它长什么样"
    右下角一个小圆角按钮 → 点开是一个小面板（学年 / 学期两个下拉框 + 一个「开始导出」按钮 + 一行状态提示）。
    没有多余的东西，点两次就出文件。

!!! warning "三条底线"
    - **不需要输入账号密码**：脚本用的是你当前的登录会话；本站不接触、不收集、不存储你的凭据与成绩；
    - 只用于**本人的账号与本人的数据**，请遵守学校的信息系统使用规定；
    - 请求频率请克制——一次导出点一次就够，别把它当爬虫用。

!!! note "坦白说明"
    这个脚本我**没有在真实教务系统上跑过**（我没有你的账号，也不该拿别人的账号去试），
    接口与参数是按上面那份说明文档写的。如果导出为空或报错，请把面板里的提示
    （或按 <kbd>F12</kbd> 看到的控制台报错）发到 [反馈与贡献](../contribute/index.md)，我再按实际返回调整。

## 不想装脚本？用控制台也行

打开教务系统的成绩查询页，按 <kbd>F12</kbd> → **Console（控制台）** → 粘贴下面这段 → 回车：

```js
(async () => {
  const YEAR = '';   // 学年，例如 '2025'；留空 = 用页面当前学年
  const TERM = '3';  // 3=第一学期，12=第二学期，16=短学期
  const body = new URLSearchParams({
    gnmkdmKey: 'N305005', xnm: YEAR, xqm: TERM, dcclbh: 'JW_N305005_GLY',
    'exportModel.selectCol': '', 'exportModel.exportWjgs': 'xls', fileName: '成绩单',
  });
  const res = await fetch('/jwglxt/cjcx/cjcx_dcXsKccjList.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(), credentials: 'same-origin',
  });
  if (!res.ok) return console.error('导出失败，HTTP', res.status);
  if ((res.headers.get('Content-Type') || '').includes('text/html')) {
    return console.error('返回的是网页而不是表格，多半是会话过期或该学年学期没有数据');
  }
  const blob = await res.blob();
  const link = document.createElement('a');
  link.href = URL.createObjectURL(blob);
  link.download = 'ujn-grades-' + Date.now() + '.xls';
  document.body.appendChild(link); link.click(); link.remove();
  console.log('已导出，' + Math.round(blob.size / 1024) + ' KB');
})();
```

## 常见问题

| 情况 | 原因与处理 |
| --- | --- |
| 右下角没有出现按钮 | 确认脚本管理器已启用、且当前页面是教务系统域名（脚本只在这些域名上生效） |
| 提示「返回的是网页而不是表格」 | 多半是会话过期（重新登录）或该学年/学期没有成绩记录，换个学年学期再试 |
| 下载的表格是空的 | 同上：先确认这段时间确实有成绩 |
| 想导出的列不对 | 在脚本里改 `exportModel.selectCol`（默认用教务系统的默认列） |
| 中文文件名乱码 | 脚本已统一替换掉 `\ / : * ? " < > |` 这些字符 |

!!! danger "底线"
    - **不要**把它改成批量抓取别人成绩的工具；
    - **不要**在任何第三方网站输入教务系统密码——包括本站，我们永远不会向你索要；
    - 导出文件里是你的个人信息，别随手发到群里。
