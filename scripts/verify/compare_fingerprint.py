"""指纹比对：把两次 `node scripts/verify/fingerprint.mjs <标签>` 的结果逐项对比。

用法::

    python scripts/verify/compare_fingerprint.py before after [输出目录]

- 截图：逐像素比较，差异超过 0.5% 视为「看得出来」（抗锯齿的微小抖动不算）；
- computed style：11 个关键元素的 16 项属性逐个比，任何一项不同都报出来。

为什么要比 computed style 而不只是截图：截图对「颜色微调」不敏感，
而 computed style 对「形状变了但颜色没变」不敏感，两者互补。
"""

from __future__ import annotations

import json
import sys
from pathlib import Path

from PIL import Image, ImageChops

OUT_DIR = Path(sys.argv[3]) if len(sys.argv) > 3 else Path.cwd()
BEFORE_LABEL = sys.argv[1] if len(sys.argv) > 1 else "before"
AFTER_LABEL = sys.argv[2] if len(sys.argv) > 2 else "after"
TOLERANCE = 0.005


def main() -> None:
    before = json.loads((OUT_DIR / f"fp-{BEFORE_LABEL}.json").read_text(encoding="utf-8"))
    after = json.loads((OUT_DIR / f"fp-{AFTER_LABEL}.json").read_text(encoding="utf-8"))
    problems = 0

    print("== computed style ==")
    for selector, props in before["styles"].items():
        other = after["styles"].get(selector)
        if props is None and other is None:
            continue  # 两次都没有这个元素（例如弹窗没打开），不算差异
        if props is None or other is None:
            print(f"  ✗ {selector}: 一侧缺失（{props is not None} / {other is not None}）")
            problems += 1
            continue
        for prop, value in props.items():
            if other.get(prop) != value:
                print(f"  ✗ {selector} {prop}: {value!r} -> {other.get(prop)!r}")
                problems += 1
    if problems == 0:
        print("  0 处差异")

    print("== 截图 ==")
    for name in before["shots"]:
        first = OUT_DIR / f"fp-{BEFORE_LABEL}-{name}.png"
        second = OUT_DIR / f"fp-{AFTER_LABEL}-{name}.png"
        if not (first.is_file() and second.is_file()):
            print(f"  ? {name}: 缺少截图，跳过")
            continue
        a, b = Image.open(first).convert("RGB"), Image.open(second).convert("RGB")
        if a.size != b.size:
            print(f"  ✗ {name}: 尺寸不同 {a.size} -> {b.size}")
            problems += 1
            continue
        diff = ImageChops.difference(a, b).convert("L")
        changed = sum(1 for pixel in diff.getdata() if pixel > 8)
        ratio = changed / (a.size[0] * a.size[1])
        ok = ratio < TOLERANCE
        print(f"  {'✓' if ok else '✗'} {name}: 明显不同像素 {changed}（{ratio * 100:.2f}%）")
        if not ok:
            problems += 1

    print("\n结论：" + ("完全一致" if problems == 0 else f"发现 {problems} 处差异"))
    raise SystemExit(0 if problems == 0 else 1)


if __name__ == "__main__":
    main()
