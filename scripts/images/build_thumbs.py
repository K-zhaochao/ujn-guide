"""给猫猫图集生成卡牌墙用的缩略图。

卡牌在页面上只有两三百像素宽，却会下载 1600~2133px 的原图（单张最大 2 MB）。
这里按固定宽度生成 `thumbs/<同名文件>.webp`，供卡牌墙使用；相册弹窗仍然加载原图。

用法::

    python scripts/images/build_thumbs.py            # 只补缺失/过期的缩略图
    python scripts/images/build_thumbs.py --force    # 全部重生成
    python scripts/images/build_thumbs.py --check    # 只校验（CI 用，缺失即失败）

缩略图是**提交进仓库的产物**：站点构建不需要 Pillow，克隆下来就能构建。
换图后记得重新生成并一起提交，否则卡牌墙会继续用旧缩略图（--check 会提示）。
"""

from __future__ import annotations

import argparse
import sys
from pathlib import Path

from PIL import Image

PROJECT_ROOT = Path(__file__).resolve().parents[2]
DEFAULT_SOURCE = PROJECT_ROOT / "docs" / "assets" / "images" / "宠物收集录" / "猫猫图集"
THUMB_DIR_NAME = "thumbs"
SUFFIXES = {".webp", ".png", ".jpg", ".jpeg"}


def thumb_path(source: Path, thumb_dir: Path) -> Path:
    return thumb_dir / f"{source.stem}.webp"


def is_fresh(source: Path, thumb: Path) -> bool:
    return thumb.is_file() and thumb.stat().st_mtime >= source.stat().st_mtime


def build_thumb(source: Path, target: Path, width: int, quality: int) -> tuple[int, int]:
    with Image.open(source) as image:
        image = image.convert("RGBA") if image.mode in ("P", "LA", "RGBA") else image.convert("RGB")
        if image.width > width:
            height = round(image.height * width / image.width)
            image = image.resize((width, height), Image.LANCZOS)
        target.parent.mkdir(parents=True, exist_ok=True)
        image.save(target, "WEBP", quality=quality, method=6)
    return target.stat().st_size, image.width


def main() -> None:
    parser = argparse.ArgumentParser(description="生成卡牌墙缩略图")
    parser.add_argument("--source", type=Path, default=DEFAULT_SOURCE, help="原图目录")
    parser.add_argument("--width", type=int, default=480, help="缩略图宽度（默认 480）")
    parser.add_argument("--quality", type=int, default=78, help="WebP 质量（默认 78）")
    parser.add_argument("--force", action="store_true", help="全部重新生成")
    parser.add_argument("--check", action="store_true", help="只校验，缺失或过期即失败")
    args = parser.parse_args()

    if not args.source.is_dir():
        print(f"[thumbs] 找不到原图目录：{args.source}", file=sys.stderr)
        raise SystemExit(1)

    thumb_dir = args.source / THUMB_DIR_NAME
    sources = sorted(p for p in args.source.iterdir() if p.is_file() and p.suffix.lower() in SUFFIXES)
    if not sources:
        print(f"[thumbs] {args.source} 下没有图片", file=sys.stderr)
        raise SystemExit(1)

    stale = [p for p in sources if args.force or not is_fresh(p, thumb_path(p, thumb_dir))]
    if args.check:
        if stale:
            print(f"[thumbs] {len(stale)} 张缩略图缺失或过期，请运行 python scripts/images/build_thumbs.py",
                  file=sys.stderr)
            for source in stale[:5]:
                print(f"         - {source.name}", file=sys.stderr)
            raise SystemExit(1)
        print(f"[thumbs] {len(sources)} 张缩略图都是最新的")
        return

    if not stale:
        print(f"[thumbs] 无需处理：{len(sources)} 张缩略图已是最新")
        return

    before = after = 0
    for source in stale:
        target = thumb_path(source, thumb_dir)
        size, width = build_thumb(source, target, args.width, args.quality)
        before += source.stat().st_size
        after += size
        print(f"  {source.stat().st_size / 1024:7.0f} KB -> {size / 1024:5.0f} KB  ({width}px)  {source.name}")
    print(f"[thumbs] 生成 {len(stale)} 张，{before / 1048576:.1f} MB -> {after / 1048576:.1f} MB"
          f"（省 {100 - after / before * 100:.0f}%），输出目录 {thumb_dir.relative_to(PROJECT_ROOT)}")


if __name__ == "__main__":
    main()
