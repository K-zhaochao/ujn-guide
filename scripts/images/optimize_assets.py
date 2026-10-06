"""把过大的位图资源转成 WebP 并同步改写 Markdown 引用。

用法::

    python scripts/images/optimize_assets.py --check      # 只报告，不改动
    python scripts/images/optimize_assets.py --apply      # 转换 + 改写引用 + 删除原图
    python scripts/images/optimize_assets.py --apply docs/assets/images/xxx.png

设计约定：

* 只处理 ``docs/assets`` 下的位图（png/jpg/jpeg），跳过已经足够小的文件；
* 超过 ``--max-width`` 的按比例缩小；WebP 质量默认 82，无损图（含透明通道但颜色少）仍走有损；
* 引用只在 ``docs/**/*.md`` 里改写，逐条确认新文件存在，避免写坏链接；
* 默认删除原图（git 历史里仍然保留），需要保留时加 ``--keep-original``。
"""

from __future__ import annotations

import argparse
import re
import sys
from pathlib import Path

from PIL import Image

# 站点里有 14000px 级的校区地图，属于正常素材，这里放宽 Pillow 的解压炸弹阈值。
Image.MAX_IMAGE_PIXELS = 300_000_000

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DOCS_DIR = PROJECT_ROOT / "docs"
ASSETS_DIR = DOCS_DIR / "assets"

RASTER_SUFFIXES = {".png", ".jpg", ".jpeg"}
MIN_BYTES = 200 * 1024  # 小于 200 KB 的不折腾


def iter_targets(paths: list[Path], min_bytes: int) -> list[Path]:
    if paths:
        candidates = [p for p in paths if p.is_file()]
    else:
        candidates = [p for p in ASSETS_DIR.rglob("*") if p.is_file()]
    return sorted(
        (
            p
            for p in candidates
            if p.suffix.lower() in RASTER_SUFFIXES and p.stat().st_size >= min_bytes
        ),
        key=lambda p: p.stat().st_size,
        reverse=True,
    )


def convert(source: Path, max_width: int, quality: int, keep_original: bool) -> dict:
    target = source.with_suffix(".webp")
    with Image.open(source) as image:
        original_size = image.size
        image = image.convert("RGBA") if image.mode in ("P", "LA", "RGBA") else image.convert("RGB")
        if image.width > max_width:
            height = round(image.height * max_width / image.width)
            image = image.resize((max_width, height), Image.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "WEBP", quality=quality, method=6)
    if not keep_original and target.stat().st_size < source.stat().st_size:
        source.unlink()
    return {
        "source": source,
        "target": target,
        "before": original_size,
        "after": (image.width, image.height),
        "before_bytes": 0,  # 由调用方补齐
    }


def rewrite_references(old_name: str, new_name: str) -> list[Path]:
    changed = []
    for page in DOCS_DIR.rglob("*.md"):
        text = page.read_text(encoding="utf-8")
        if old_name not in text:
            continue
        updated = text.replace(old_name, new_name)
        page.write_text(updated, encoding="utf-8", newline="\n")
        changed.append(page)
    return changed


def main() -> None:
    parser = argparse.ArgumentParser(description="把过大的位图资源转成 WebP")
    parser.add_argument("paths", nargs="*", type=Path, help="要处理的文件；留空则扫描 docs/assets")
    parser.add_argument("--max-width", type=int, default=2000, help="最大宽度（默认 2000）")
    parser.add_argument("--quality", type=int, default=82, help="WebP 质量（默认 82）")
    parser.add_argument("--min-kb", type=int, default=200, help="小于该体积的文件跳过（默认 200KB）")
    parser.add_argument("--apply", action="store_true", help="真正执行转换与改写")
    parser.add_argument("--keep-original", action="store_true", help="保留原图")
    parser.add_argument("--check", action="store_true", help="只报告（默认行为）")
    args = parser.parse_args()

    targets = iter_targets(args.paths, args.min_kb * 1024)
    if not targets:
        print("[images] 没有需要处理的位图（阈值 %d KB）" % args.min_kb)
        return

    mode = "APPLY" if args.apply and not args.check else "CHECK"
    print(f"[images] {mode}：{len(targets)} 个候选文件，最大宽度 {args.max_width}px，质量 {args.quality}")
    total_before = total_after = 0
    rows = []
    for source in targets:
        before_bytes = source.stat().st_size
        if not args.apply:
            with Image.open(source) as image:
                after = (min(image.width, args.max_width), image.height)
            rows.append((source, before_bytes, None, after))
            continue
        result = convert(source, args.max_width, args.quality, args.keep_original)
        after_bytes = result["target"].stat().st_size
        references = rewrite_references(source.name, result["target"].name)
        total_before += before_bytes
        total_after += after_bytes
        rows.append((source, before_bytes, after_bytes, result["after"]))
        if references:
            print(f"[images]   引用改写：{', '.join(str(p.relative_to(PROJECT_ROOT)) for p in references)}")

    for source, before_bytes, after_bytes, after in rows:
        relative = source.relative_to(PROJECT_ROOT)
        if after_bytes is None:
            print(f"  {before_bytes / 1048576:6.2f} MB  -> 待转换  {relative}")
        else:
            saved = (1 - after_bytes / before_bytes) * 100
            print(
                f"  {before_bytes / 1048576:6.2f} MB  ->  {after_bytes / 1048576:6.2f} MB"
                f"  (-{saved:.0f}%)  {after[0]}x{after[1]}  {relative}"
            )
    if args.apply and total_before:
        print(f"[images] 合计 {total_before / 1048576:.1f} MB -> {total_after / 1048576:.1f} MB，"
              f"省下 {(total_before - total_after) / 1048576:.1f} MB")
    elif not args.apply:
        print("[images] 这是检查模式；加 --apply 才会转换并改写引用")


if __name__ == "__main__":
    sys.exit(main())
