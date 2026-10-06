"""Regenerate the cat card wall inside ``docs/pets/index.md`` from ``docs/pets/cats/*.md``.

Run it after adding, editing or removing a cat page::

    python scripts/pets/build_gallery.py          # 重新生成卡牌区
    python scripts/pets/build_gallery.py --check  # 只校验是否需要重新生成（CI 用）

The script owns the region between the two ``pets:deck`` markers in
``docs/pets/index.md`` and nothing else: the page header, the card CSS and the
pager container stay hand-written. Card order follows ``ORDER`` below; a cat that
is not listed is appended at the end, so adding a cat never shuffles the wall.

Every card carries the photo list it needs (``data-photos``), which lets the
front-end open a swipeable viewer for that cat without any API request.

卡牌封面用的是 ``thumbs/`` 里的缩略图（见 ``scripts/images/build_thumbs.py``）：
原图往往 1600~2133px、单张最大 2 MB，而卡牌只有两三百像素宽。缩略图是提交进仓库的
产物，站点构建不需要 Pillow；换图后要重新生成，否则这里会明确报错。
"""

from __future__ import annotations

import argparse
import html
import os
import re
import sys
from pathlib import Path
from urllib.parse import quote, unquote

PROJECT_ROOT = Path(__file__).resolve().parents[2]
PETS_DIR = PROJECT_ROOT / "docs" / "pets"
CATS_DIR = PETS_DIR / "cats"
INDEX_FILE = PETS_DIR / "index.md"

DECK_START = "<!-- pets:deck:start -->"
DECK_END = "<!-- pets:deck:end -->"

# 卡牌展示顺序（写猫猫页面的文件名，不带 .md）。
# 未列出的新猫排在最后并按文件名排序；把名字加进来即可调整位置。
ORDER = (
    "cooler-图书馆学长", "优米", "元老", "公主",
    "凶凶", "口水巾", "团子", "夸夸",
    "奇美拉", "奥利奥", "娓娓", "小白",
    "小破", "小米花", "小糯米", "小花",
    "小花-黑白", "年年", "怕怕", "拽子",
    "捂眼睛", "斜刘海", "暖暖", "树人",
    "橘皮", "爆米花", "猫子", "白白",
    "眯眼大佐", "胖橘", "花卷", "花花",
    "花花-橘版", "花酱", "蛋黄派", "踏雪",
    "阿波罗",
)

HEADING_RE = re.compile(r"^#\s+(?P<title>.+?)\s*$", re.MULTILINE)
IMAGE_RE = re.compile(r"!\[(?P<alt>[^\]]*)\]\((?P<src>[^)]+)\)")
FRONT_MATTER_RE = re.compile(r"^---\s*\n(?P<body>.*?)\n---\s*\n", re.DOTALL)
# H1 里的装饰性 emoji、变体选择符与空白
DECORATION_RE = re.compile(
    "[\U0001f300-\U0001faff\u2600-\u27bf\ufe0f\u200d\u2b00-\u2bff]+"
)


class GalleryError(RuntimeError):
    """卡牌区无法生成时抛出，避免写出半成品页面。"""


def read_page(page: Path) -> str:
    return page.read_text(encoding="utf-8")


def display_name(page: Path, text: str) -> str:
    """取页面 H1 作为卡牌名字，去掉 emoji；没有 H1 时退回文件名。"""
    match = HEADING_RE.search(text)
    raw = match.group("title") if match else page.stem
    name = DECORATION_RE.sub(" ", raw).strip()
    return name or page.stem


def is_hidden(page: Path, text: str) -> bool:
    """页面在 front matter 里声明 navigation.exclude 时不进卡牌墙。"""
    match = FRONT_MATTER_RE.match(text)
    if not match:
        return False
    return bool(re.search(r"^\s*navigation\.exclude\s*:\s*true\s*$", match.group("body"), re.MULTILINE))


def collect_photos(page: Path, text: str, pets_dir: Path) -> list[str]:
    """按出现顺序收集页面内的本地照片，返回相对 docs/pets/ 的 URL。"""
    photos: list[str] = []
    for match in IMAGE_RE.finditer(text):
        src = match.group("src").strip()
        if src.startswith(("http://", "https://", "data:", "//")):
            continue
        target = (page.parent / src).resolve()
        if not target.is_file():
            raise GalleryError(f"{page.name} 引用的图片不存在：{src}")
        # 不能用 os.path.relpath：Windows 上仓库和临时目录可能不在同一个盘符，
        # ntpath 跨盘符算不出相对路径，会退回「一串 ../ 再拼绝对路径」——
        # CI 上 test_card_carries_every_photo_in_page_order 就是这么挂的。
        # 这里改成按「相对 docs 根的路径段」来算，与盘符无关。
        try:
            docs_root = pets_dir.parent
            relative = (
                "../" * len(pets_dir.relative_to(docs_root).parts)
                + target.relative_to(docs_root).as_posix()
            )
        except ValueError:
            relative = os.path.relpath(target, pets_dir).replace(os.sep, "/")
        photos.append(quote(relative, safe="/"))
    return photos


def detail_url(page: Path) -> str:
    """docs/pets/cats/优米.md -> cats/%E4%BC%98%E7%B1%B3/（与 MkDocs 目录式 URL 一致）。"""
    return quote(f"cats/{page.stem}/", safe="/")


def thumb_url(cover_url: str) -> str:
    """由原图 URL 推出卡牌缩略图 URL：同目录下的 thumbs/ 子目录，同名文件。"""
    head, _, name = cover_url.rpartition("/")
    return f"{head}/thumbs/{name}"


def card_html(name: str, url: str, photos: list[str], cover_thumb: str) -> str:
    safe_name = html.escape(name, quote=True)
    # 卡牌封面用缩略图：原图 1600~2133px、单张最大 2 MB，而卡牌只有两三百像素宽。
    # 相册弹窗仍按 data-photos 里的原图列表加载，点开还是高清。
    # 照片用 <button> 而不是链接：MkDocs Material 的 navigation.instant 会接管站内
    # <a> 的点击并做无刷新跳转，preventDefault 拦不住，会导致照片点不开相册弹窗。
    # 名字铭牌仍保留链接，没有 JS 时也能进入猫猫页面。
    return "\n".join(
        [
            f'  <div class="pet-card" data-name="{safe_name}" data-photos="{"|".join(photos)}">',
            f'    <button class="pet-card__shot" type="button" aria-label="{safe_name}：查看 {len(photos)} 张照片">',
            f'      <img class="pet-photo" src="{cover_thumb}" alt="{safe_name}" loading="lazy" decoding="async">',
            "    </button>",
            f'    <a class="pet-card__plate" href="{url}">'
            f'<span class="pet-card__name">{safe_name}</span></a>',
            "  </div>",
        ]
    )


def sorted_pages(cats_dir: Path, pets_dir: Path) -> tuple[list[Path], list[str]]:
    """返回（参与生成的有照片页面, 被跳过的文件名）。"""
    if not cats_dir.is_dir():
        raise GalleryError(f"找不到猫猫页面目录：{cats_dir}")
    known = {stem: index for index, stem in enumerate(ORDER)}
    ranked: list[tuple[int, str, Path]] = []
    skipped: list[str] = []
    for page in sorted(cats_dir.glob("*.md")):
        text = read_page(page)
        if is_hidden(page, text):
            skipped.append(f"{page.name}（navigation.exclude）")
            continue
        if not collect_photos(page, text, pets_dir):
            skipped.append(f"{page.name}（没有照片）")
            continue
        ranked.append((known.get(page.stem, len(known)), page.stem, page))
    ranked.sort(key=lambda item: (item[0], item[1]))
    return [item[2] for item in ranked], skipped


def render_deck(cats_dir: Path = CATS_DIR, pets_dir: Path = PETS_DIR) -> tuple[str, int, int]:
    pages, skipped = sorted_pages(cats_dir, pets_dir)
    if not pages:
        raise GalleryError("没有任何带照片的猫猫页面，拒绝清空卡牌墙")
    cards = []
    photo_total = 0
    for page in pages:
        text = read_page(page)
        photos = collect_photos(page, text, pets_dir)
        photo_total += len(photos)
        cover_thumb = thumb_url(photos[0])
        if not (pets_dir / unquote(cover_thumb)).resolve().is_file():
            raise GalleryError(
                f"{page.name} 缺少卡牌缩略图：{cover_thumb}\n"
                "        先运行 python scripts/images/build_thumbs.py 生成后一起提交"
            )
        cards.append(card_html(display_name(page, text), detail_url(page), photos, cover_thumb))
    deck = "\n".join([DECK_START, *cards, DECK_END])
    for note in skipped:
        print(f"[pets] 跳过 {note}")
    return deck, len(pages), photo_total


def replace_deck(document: str, deck: str) -> str:
    start = document.find(DECK_START)
    end = document.find(DECK_END)
    if start < 0 or end < 0 or end < start:
        raise GalleryError(f"{INDEX_FILE.name} 缺少 {DECK_START} / {DECK_END} 标记")
    return document[:start] + deck + document[end + len(DECK_END) :]


def main() -> None:
    parser = argparse.ArgumentParser(description="生成猫猫图鉴卡牌墙")
    parser.add_argument("--check", action="store_true", help="只校验卡牌区是否为最新，不写文件")
    args = parser.parse_args()

    try:
        deck, cat_count, photo_count = render_deck()
        current = read_page(INDEX_FILE)
        updated = replace_deck(current, deck)
    except GalleryError as error:
        print(f"[pets] {error}", file=sys.stderr)
        raise SystemExit(1) from error

    if args.check:
        if current != updated:
            print("[pets] 卡牌区不是最新的，请运行 python scripts/pets/build_gallery.py", file=sys.stderr)
            raise SystemExit(1)
        print(f"[pets] 卡牌区已是最新：{cat_count} 只猫 / {photo_count} 张照片")
        return

    if current == updated:
        print(f"[pets] 无需改动：{cat_count} 只猫 / {photo_count} 张照片")
        return
    INDEX_FILE.write_text(updated, encoding="utf-8", newline="\n")
    print(f"[pets] 已更新 {INDEX_FILE.relative_to(PROJECT_ROOT)}：{cat_count} 只猫 / {photo_count} 张照片")


if __name__ == "__main__":
    main()
