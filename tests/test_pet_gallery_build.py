"""Unit tests for the cat card wall generator (scripts/pets/build_gallery.py)."""

from __future__ import annotations

import re
import tempfile
import unittest
from pathlib import Path
from urllib.parse import unquote

from scripts.pets import build_gallery

PAGE_TEMPLATE = """---
tags:
  - 宠物收集录
---

:arrow_left: [返回宠物收集录](../index.md)

---

# 🐱 {name}

介绍。

{images}
"""

INDEX_TEMPLATE = """---
tags:
  - 宠物收集录
---

# 🐾 宠物收集录

<div class="pet-deck" id="pet-deck">
{start}
{end}
</div>
"""


class PetGalleryBuildTests(unittest.TestCase):
    def setUp(self) -> None:
        self._directory = tempfile.TemporaryDirectory()
        root = Path(self._directory.name)
        self.pets = root / "docs" / "pets"
        self.cats = self.pets / "cats"
        # 页面里用 ../../assets/images/... 引用照片，因此照片位于 docs/assets/images/
        self.photos = root / "docs" / "assets" / "images"
        self.cats.mkdir(parents=True)
        self.photos.mkdir(parents=True)
        self.index = self.pets / "index.md"
        self.index.write_text(
            INDEX_TEMPLATE.format(start=build_gallery.DECK_START, end=build_gallery.DECK_END),
            encoding="utf-8",
        )

    def tearDown(self) -> None:
        self._directory.cleanup()

    def add_cat(self, stem: str, name: str | None = None, photos: int = 1, body: str | None = None,
                thumbs: bool = True) -> None:
        images = "\n".join(
            f"![{name or stem}](../../assets/images/{stem}{index + 1}.webp)"
            for index in range(photos)
        )
        text = body if body is not None else PAGE_TEMPLATE.format(name=name or stem, images=images)
        (self.cats / f"{stem}.md").write_text(text, encoding="utf-8")
        for index in range(photos):
            (self.photos / f"{stem}{index + 1}.webp").write_bytes(b"webp")
        if thumbs and photos:
            # 卡牌封面用 thumbs/ 里的缩略图，由 scripts/images/build_thumbs.py 生成
            thumb_dir = self.photos / "thumbs"
            thumb_dir.mkdir(exist_ok=True)
            for index in range(photos):
                (thumb_dir / f"{stem}{index + 1}.webp").write_bytes(b"webp")

    def deck(self) -> str:
        return build_gallery.render_deck(self.cats, self.pets)[0]

    def test_card_carries_every_photo_in_page_order(self) -> None:
        self.add_cat("优米", "优米", photos=3)
        deck, cats, photos = build_gallery.render_deck(self.cats, self.pets)
        self.assertEqual((cats, photos), (1, 3))
        self.assertIn('data-name="优米"', deck)
        self.assertIn('alt="优米"', deck)
        self.assertIn('href="cats/%E4%BC%98%E7%B1%B3/"', deck)
        # 照片触发器必须是 <button>：Material 的 navigation.instant 会接管站内 <a>，
        # 用链接会导致点击照片直接跳转、打不开相册弹窗。
        self.assertIn('<button class="pet-card__shot" type="button"', deck)
        # URL 中的中文与括号会被百分号编码，比较前先解码
        self.assertEqual(
            [unquote(item) for item in re.search(r'data-photos="([^"]+)"', deck).group(1).split("|")],
            ["../assets/images/优米1.webp", "../assets/images/优米2.webp", "../assets/images/优米3.webp"],
        )
        # 封面取页面里的第一张，但用 thumbs/ 里的缩略图（相册弹窗仍按 data-photos 加载原图）
        cover = re.search(r'class="pet-photo" data-pet-src="([^"]+)"', deck).group(1)
        self.assertEqual(unquote(cover), "../assets/images/thumbs/优米1.webp")

    def test_missing_thumbnail_fails_with_instruction(self) -> None:
        self.add_cat("缺缩略图", photos=1, thumbs=False)
        with self.assertRaisesRegex(build_gallery.GalleryError, "build_thumbs.py"):
            build_gallery.render_deck(self.cats, self.pets)

    def test_cover_loading_is_deferred_with_no_script_fallback(self) -> None:
        self.add_cat("优米", photos=1)
        deck = self.deck()
        main = re.sub(r"<noscript>.*?</noscript>", "", deck, flags=re.S)
        self.assertIn('data-pet-src="', main)
        self.assertNotRegex(main, r"<img\b[^>]*\s+src=")
        self.assertRegex(deck, r'<noscript><img src="[^"]+"[^>]*loading="lazy"')

    def test_heading_decoration_is_stripped_from_card_name(self) -> None:
        self.add_cat("新猫", "🐱 新猫 ✨", photos=1)
        deck = self.deck()
        self.assertIn('<span class="pet-card__name">新猫</span>', deck)

    def test_pages_without_photos_or_marked_hidden_are_skipped(self) -> None:
        self.add_cat("有照片", photos=1)
        self.add_cat("只有视频", body=PAGE_TEMPLATE.format(name="只有视频", images="> 📹 只有视频"))
        self.add_cat(
            "隐藏的猫",
            photos=1,
            body="---\nnavigation.exclude: true\n---\n\n# 🐱 隐藏的猫\n\n"
            "![隐藏的猫](../../assets/images/隐藏的猫1.webp)\n",
        )
        deck, cats, photos = build_gallery.render_deck(self.cats, self.pets)
        self.assertEqual((cats, photos), (1, 1))
        self.assertNotIn("只有视频", deck)
        self.assertNotIn("隐藏的猫", deck)

    def test_order_list_wins_and_new_cats_go_last(self) -> None:
        self.add_cat("元老", photos=1)
        self.add_cat("优米", photos=1)
        self.add_cat("阿猫", photos=1)
        deck = self.deck()
        self.assertLess(deck.index("优米"), deck.index("元老"))
        self.assertLess(deck.index("元老"), deck.index("阿猫"))

    def test_missing_photo_fails_loudly(self) -> None:
        (self.cats / "缺图.md").write_text(
            PAGE_TEMPLATE.format(name="缺图", images="![缺图](../../assets/images/缺图1.webp)"),
            encoding="utf-8",
        )
        with self.assertRaisesRegex(build_gallery.GalleryError, "图片不存在"):
            build_gallery.render_deck(self.cats, self.pets)

    def test_replace_deck_is_idempotent_and_keeps_surrounding_page(self) -> None:
        self.add_cat("优米", photos=2)
        first = build_gallery.replace_deck(self.index.read_text(encoding="utf-8"), self.deck())
        second = build_gallery.replace_deck(first, self.deck())
        self.assertEqual(first, second)
        self.assertIn("# 🐾 宠物收集录", second)
        self.assertIn('<div class="pet-deck" id="pet-deck">', second)
        self.assertEqual(second.count(build_gallery.DECK_START), 1)
        self.assertEqual(second.count(build_gallery.DECK_END), 1)

    def test_missing_markers_fail(self) -> None:
        with self.assertRaisesRegex(build_gallery.GalleryError, "标记"):
            build_gallery.replace_deck("# 没有标记的页面\n", "deck")

    def test_repository_deck_is_up_to_date(self) -> None:
        """仓库里的卡牌区必须与脚本输出一致（等价于 build_gallery.py --check）。"""
        deck, cats, photos = build_gallery.render_deck()
        document = build_gallery.INDEX_FILE.read_text(encoding="utf-8")
        self.assertGreater(cats, 0)
        self.assertGreater(photos, cats)
        self.assertEqual(
            build_gallery.replace_deck(document, deck),
            document,
            "卡牌区不是最新的，请运行 python scripts/pets/build_gallery.py",
        )

    def test_repository_card_covers_exist(self) -> None:
        """每张卡牌的封面（thumbs/ 缩略图）都必须真实存在。"""
        deck, _, _ = build_gallery.render_deck()
        covers = [unquote(src) for src in re.findall(r'class="pet-photo" data-pet-src="([^"]+)"', deck)]
        self.assertTrue(covers)
        missing = [cover for cover in covers if not (build_gallery.PETS_DIR / cover).resolve().is_file()]
        self.assertEqual(missing, [], "卡牌缩略图缺失，请运行 python scripts/images/build_thumbs.py 后一起提交")


if __name__ == "__main__":
    unittest.main()
