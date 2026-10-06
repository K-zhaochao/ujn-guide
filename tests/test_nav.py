"""导航结构的守卫：标签数量、目标文件存在、没有重复入口。

读者在顶栏一眼能扫完的标签数是有限的（第 17 轮把 12 个并成了 8 个），
这两条约束很容易在「顺手加一个入口」时被破坏，所以用测试守住。
"""

from __future__ import annotations

import unittest
from collections import Counter
from pathlib import Path

import yaml

PROJECT_ROOT = Path(__file__).resolve().parent.parent
CONFIG = PROJECT_ROOT / "mkdocs.yml"
DOCS = PROJECT_ROOT / "docs"
MAX_TABS = 10


class _Loader(yaml.SafeLoader):
    """mkdocs.yml 里有 !ENV 之类的自定义标签，统一忽略。"""


_Loader.add_multi_constructor("!", lambda loader, suffix, node: None)
_Loader.add_multi_constructor("tag:yaml.org,2002:python/name:", lambda loader, suffix, node: None)


def load_nav() -> list:
    config = yaml.load(CONFIG.read_text(encoding="utf-8"), Loader=_Loader) or {}
    return config.get("nav") or []


def collect_targets(node: object, out: list[str]) -> list[str]:
    if isinstance(node, list):
        for item in node:
            collect_targets(item, out)
    elif isinstance(node, dict):
        for value in node.values():
            if isinstance(value, str):
                out.append(value)
            else:
                collect_targets(value, out)
    return out


class NavigationTests(unittest.TestCase):
    def setUp(self) -> None:
        self.nav = load_nav()
        self.targets = collect_targets(self.nav, [])

    def test_tab_count_stays_small(self) -> None:
        self.assertLessEqual(
            len(self.nav),
            MAX_TABS,
            f"顶级标签有 {len(self.nav)} 个，超过约定的 {MAX_TABS} 个；"
            "新内容请挂进已有分组（见 BUILDING.md 的导航约定）",
        )

    def test_every_nav_target_exists(self) -> None:
        missing = [
            target
            for target in self.targets
            if not target.startswith(("http://", "https://")) and not (DOCS / target).is_file()
        ]
        self.assertEqual(missing, [], "导航里指向了不存在的文件")

    def test_no_duplicate_targets(self) -> None:
        duplicates = [target for target, count in Counter(self.targets).items() if count > 1]
        self.assertEqual(duplicates, [], "同一个页面在导航里出现了多次")

    def test_reader_facing_pages_are_top_level(self) -> None:
        """读者会主动找的页面必须自己占一个 tab。
        曾经把「反馈与贡献」「最近更新」塞进「关于」分组，手机端要展开抽屉才知道有这些页面，
        靠页面里写一句「这一组还有别的页面」补救更绕——已改回独立标签。"""
        top = collect_targets(self.nav, [])
        for page in ["contribute/index.md", "changelog.md"]:
            self.assertIn(page, top, f"{page} 应该是顶级标签")

    def test_only_meta_pages_are_grouped(self) -> None:
        """「关于」分组只放联系作者、免责声明这类常规元信息。"""
        about = next((item for item in self.nav if isinstance(item, dict) and "关于" in next(iter(item))), None)
        self.assertIsNotNone(about, "找不到「关于」分组")
        targets = collect_targets(about, [])
        self.assertIn("disclaimer.md", targets)
        self.assertNotIn("contribute/index.md", targets)


if __name__ == "__main__":
    unittest.main()
