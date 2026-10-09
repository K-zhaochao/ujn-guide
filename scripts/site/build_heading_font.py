"""把霞鹜文楷（LXGW WenKai）子集化成标题字体。

中文 webfont 全量动辄 20 MB，为了一屏标题让每个访客多下这么多不划算；
所以只取「站点标题里真正出现过的字」，通常能压到几百 KB。

用法::

    python scripts/site/build_heading_font.py            # 生成到 docs/assets/fonts/
    python scripts/site/build_heading_font.py --check    # 只报告体积与字符数
"""

from __future__ import annotations

import argparse
import pathlib
import re
import subprocess
import sys
import urllib.request

ROOT = pathlib.Path(__file__).resolve().parents[2]
SITE = ROOT / "site"
OUT = ROOT / "docs" / "assets" / "fonts" / "lxgw-wenkai-site.woff2"
CACHE = pathlib.Path.home() / ".cache" / "ujn-guide-fonts"
FONT_URL = "https://github.com/lxgw/LxgwWenKai/releases/latest/download/LXGWWenKai-Regular.ttf"

# 标题里可能用到的英文、数字与标点（子集化时一并带上）
EXTRA = (
    "".join(chr(code) for code in range(0x20, 0x7F))
    + "，。、；：？！「」『』（）《》〈〉—…·～＋－×÷％°℃"
    + "①②③④⑤⑥⑦⑧⑨⑩"
)


def page_text() -> str:
    """从构建产物里收集页面上真正显示出来的文字（整页，不只标题）。

    读者要求「全站字体都换成霞鹜文楷」，所以字符集要覆盖正文。
    取的是渲染后的 HTML 里去标签的文字——比扫 Markdown 源文件更准
    （导航、页脚、脚本生成的文案都在里面）。
    """
    chars: set[str] = set()
    for page in sorted(SITE.rglob("*.html")):
        html = page.read_text(encoding="utf-8", errors="ignore")
        html = re.sub(r"<(script|style)[^>]*>.*?</\1>", " ", html, flags=re.S | re.I)
        chars.update(re.sub(r"<[^>]+>", " ", html))
    # Modal text is rendered by JavaScript, so it does not appear in static HTML.
    for ui_script in [ROOT / "docs/javascripts/ujn-ui.js", ROOT / "docs/pets/gallery.js"]:
        if ui_script.is_file():
            chars.update(re.findall(r"[\u3400-\u9fff]", ui_script.read_text(encoding="utf-8")))
    return "".join(sorted(chars))


def ensure_source() -> pathlib.Path:
    CACHE.mkdir(parents=True, exist_ok=True)
    target = CACHE / "LXGWWenKai-Regular.ttf"
    if not target.is_file():
        print(f"下载字体（约 20 MB，只需一次）：{FONT_URL}")
        urllib.request.urlretrieve(FONT_URL, target)
    return target


def main() -> None:
    parser = argparse.ArgumentParser(description="生成标题用子集字体")
    parser.add_argument("--check", action="store_true", help="只报告")
    args = parser.parse_args()

    if not SITE.is_dir():
        print("[font] 先构建站点：npm run build", file=sys.stderr)
        raise SystemExit(1)

    text = page_text() + EXTRA
    print(f"[font] 收集到 {len(set(text))} 个不同字符（站点全部页面文字 + ASCII + 常用标点）")
    if args.check:
        if OUT.is_file():
            print(f"[font] 现有子集：{OUT.relative_to(ROOT)}，{OUT.stat().st_size / 1024:.0f} KB")
        else:
            print("[font] 还没有生成子集字体")
        return

    source = ensure_source()
    text_file = CACHE / "site-text.txt"
    text_file.write_text(text, encoding="utf-8")

    target = OUT
    try:
        import brotli  # noqa: F401
        flavor = "woff2"
    except ImportError:
        flavor = "woff"  # 没有 brotli 就退一步用 woff，体积略大但兼容性一样好
        print("[font] 没装 brotli，改用 woff 输出（pip install brotli 可得到更小的 woff2）")
        target = OUT.with_suffix(".woff")

    command = [
        sys.executable, "-m", "fontTools.subset", str(source),
        f"--text-file={text_file}",
        "--layout-features=*",
        "--flavor=" + flavor,
        f"--output-file={target}",
    ]
    result = subprocess.run(command, check=False, capture_output=True, text=True)
    if result.returncode != 0:
        print(result.stdout[-2000:], result.stderr[-2000:], file=sys.stderr)
        raise SystemExit(1)
    print(f"[font] 已生成 {target.relative_to(ROOT)}：{target.stat().st_size / 1024:.0f} KB"
          f"（源文件 {source.stat().st_size / 1048576:.1f} MB）")


if __name__ == "__main__":
    main()
