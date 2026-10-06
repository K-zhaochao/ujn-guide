---
title: 教务成绩导出
icon: material/file-excel-outline
---

# 📊 教务成绩导出

把**你自己**在教务系统里的成绩一键导出成 Excel（`.xls`），不用一页页抄。

!!! quote "关于这个工具的来源"
    该工具的参考由**一位不愿意透露信息的学长**提供，仅供大家的便捷 / 学习。
    原始说明整理的是「Node 客户端登录 + 导出」的完整流程；本站把它落地成了下面这种
    **不接触账号密码**的浏览器版本。

## 它是怎么工作的

在你**已经登录**教务系统的页面里，用你当前的会话（Cookie）向教务系统自己的导出接口发一次请求，
把返回的表格流存成文件。所以：

- ✅ 不需要输入账号密码，脚本里也没有任何加密/登录逻辑；
- ✅ 数据流向是「学校服务器 → 你的浏览器 → 你的下载目录」，中间没有第三方；
- ⚠️ 只对**本人**账号有效，导出的也是你自己的成绩；
- ⚠️ 请求频率请克制（一次导出点一次就够），别把它当爬虫用。

!!! note "坦白说明"
    这个脚本我**没有在真实教务系统上跑过**（我没有你的账号，也不该拿别人的账号去试）。
    它是按上面那份说明里记录的接口与字段写的。如果导出为空或报错，请把控制台里的报错发到
    [反馈与贡献](../contribute/index.md)，我再按实际返回调整——这正是这一页存在的意义。

## 怎么用（三步）

1. 浏览器登录教务系统，进入**成绩查询**页面（`cjcx_cxXsKccjList.html`）；
2. 按 <kbd>F12</kbd> 打开开发者工具，切到 **Console（控制台）**；
3. 把下面的脚本整个粘贴进去回车，浏览器会下载一个 `.xls`。

```js
/* 教务成绩导出（浏览器版）
 * 用法：登录教务系统 → 打开成绩查询页 → F12 控制台 → 粘贴本段 → 回车
 * 只使用你当前的登录会话，不接触账号密码。 */
(async () => {
  // ==== 想导出别的学年/学期就在这里改 ====
  const YEAR = '';   // 学年，例如 '2025'；留空 = 用成绩页当前展示的学年
  const TERM = '3';  // 学期：3=第一学期，12=第二学期，16=短学期
  const COLUMNS = ''; // 留空 = 用教务系统的默认列；要自定义就填系统里的 selectCol 值

  const body = new URLSearchParams({
    gnmkdmKey: 'N305005',
    xnm: YEAR,
    xqm: TERM,
    dcclbh: 'JW_N305005_GLY',
    'exportModel.selectCol': COLUMNS,
    'exportModel.exportWjgs': 'xls',
    fileName: '成绩单',
  });

  const response = await fetch('/jwglxt/cjcx/cjcx_dcXsKccjList.html', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded; charset=UTF-8' },
    body: body.toString(),
    credentials: 'same-origin', // 带上你自己的登录会话
  });

  if (!response.ok) {
    console.error('导出失败，HTTP', response.status);
    return;
  }
  // 教务系统出错时会返回一个 HTML 错误页，这里挡一下，免得存成坏文件
  const type = response.headers.get('Content-Type') || '';
  if (type.includes('text/html')) {
    console.error('教务系统返回的是网页而不是表格，多半是会话过期或参数不对：');
    console.error((await response.text()).slice(0, 500));
    return;
  }

  const disposition = response.headers.get('Content-Disposition') || '';
  const matched = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(disposition);
  // 文件名里的 \ / : * ? " < > | 在部分系统上存不下来，统一换成下划线
  const name = decodeURIComponent(matched ? matched[1] : `ujn-grades-${Date.now()}.xls`)
    .replace(/[\\/:*?"<>|]/g, '_');

  const blob = await response.blob();
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = name.endsWith('.xls') ? name : name + '.xls';
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  console.log('已导出：' + link.download + '（' + Math.round(blob.size / 1024) + ' KB）');
})();
```

## 参数速查

| 变量 | 说明 |
| --- | --- |
| `YEAR` | 学年（如 `2025`）。留空就用成绩页当前展示的学年 |
| `TERM` | 学期：**3** = 第一学期、**12** = 第二学期、**16** = 短学期 |
| `COLUMNS` | 导出列。留空用系统默认；想自己选列就填系统里的 `selectCol` 值 |

## 常见问题

| 情况 | 原因与处理 |
| --- | --- |
| 控制台报 `教务系统返回的是网页…` | 多半是会话过期（重新登录后再试）或学期参数与当前学年不匹配 |
| 下载的表格是空的 | 该学年/学期确实没有成绩记录；换个 `YEAR`/`TERM` 再试 |
| 想导出的列不对 | 把 `COLUMNS` 填成系统里「导出列」对应的值 |
| 中文文件名变成乱码 | 已在脚本里统一替换非法字符；若仍异常，可自行改 `link.download` |

!!! danger "底线"
    - **不要**把这段脚本改成批量抓取别人成绩的工具；
    - **不要**在任何第三方网站输入教务系统密码——包括本站，我们永远不会向你索要；
    - 导出文件里是你的个人信息，别随手发到群里。
