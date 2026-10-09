"""Render the content-aware template, including GitHub Pages base-path handling."""
from pathlib import Path
from types import SimpleNamespace
import unittest
from jinja2 import Environment, DictLoader

ROOT = Path(__file__).resolve().parent.parent

class PageLayoutTests(unittest.TestCase):
    def render(self, src):
        env = Environment(loader=DictLoader({
            'layout': (ROOT / 'overrides/partials/page-layout.html').read_text(encoding='utf-8'),
            'partials/content.html': '<h1>原始标题</h1><p>原始正文</p>',
        }), autoescape=True)
        env.filters['url'] = lambda path: '/ujn-guide/' + path
        return env.get_template('layout').render(page=SimpleNamespace(file=SimpleNamespace(src_uri=src)))

    def test_all_content_types_are_static_and_preserve_content(self):
        cases = {'index.md':'home', 'site-guide/index.md':'hub',
                 'site-guide/main-campus/canteen-1.md':'place',
                 'green-book/academic/score-rules.md':'reading',
                 'phone-book/colleges.md':'directory', 'hometown-groups/index.md':'directory',
                 'campus-life/index.md':'hub', 'clubs/societies/index.md':'hub', 'rules/teaching/student-status.md':'reading',
                 'pets/index.md':'gallery', 'school-calendar/index.md':'calendar',
                 'tools/index.md':'hub', 'contribute/index.md':'community',
                 'changelog.md':'updates', 'green-book/scholarship/zongce-calculator.md':'tool'}
        for src, kind in cases.items():
            with self.subTest(src=src):
                html = self.render(src)
                self.assertIn(f'data-page-kind="{kind}"', html)
                self.assertIn('<h1>原始标题</h1><p>原始正文</p>', html)
                self.assertNotIn('<script', html)

    def test_section_links_respect_deployment_subpath(self):
        self.assertIn('href="/ujn-guide/phone-book/"', self.render('phone-book/colleges.md'))

    def test_unknown_and_404_pages_have_reading_fallback(self):
        self.assertIn('data-page-kind="reading"', self.render('unknown.md'))
        self.assertIn('data-page-kind="reading"', self.render(''))

    def test_home_is_introduction_only_with_mobile_navigation_hint(self):
        home = (ROOT / 'docs/index.md').read_text(encoding='utf-8')
        self.assertIn('ujn-home-about', home)
        self.assertIn('页面左上角的菜单按钮', home)
        self.assertNotIn('ujn-home-nav"', home)
        self.assertNotIn('ujn-home-shortcuts', home)
        self.assertNotIn('grid cards', home)
        self.assertIn('data-ujn-modal="flea"', home)
        self.assertIn('data-ujn-modal="donate"', home)
        self.assertIn('aria-label="参与与联系"', home)
        self.assertNotIn('暂未开源', home)
        self.assertIn('hide: [navigation, toc]', home)

    def test_home_showcase_is_semantic_static_and_not_a_duplicate_menu(self):
        home = (ROOT / 'docs/index.md').read_text(encoding='utf-8')
        self.assertEqual(home.count('<h1 '), 1)
        self.assertIn('aria-labelledby="ujn-home-title"', home)
        self.assertIn('ujn-home-campus', home)
        self.assertIn('focusable="false"', home)
        self.assertIn('class="ujn-home-scene" aria-hidden="true"', home)
        self.assertEqual(home.count('class="ujn-home-story"'), 2)
        self.assertLess(home.index('ujn-home-navigation-hint'), home.index('<section class="ujn-home-hero"'))
        self.assertEqual(home.count('data-ujn-modal='), 2)
        self.assertLess(home.index('data-ujn-modal="flea"'), home.index('class="ujn-home-about"'))
        self.assertNotIn('<script', home)

        self.assertNotIn('<iframe', home)
        self.assertNotIn('site-guide/', home)
        self.assertNotIn('green-book/', home)

    def test_font_subset_covers_script_rendered_modal_copy(self):
        from scripts.site.build_heading_font import page_text
        self.assertTrue(set('腾讯频道二维码长按保存识别闲置流转') <= set(page_text()))

    def test_home_showcase_reflows_and_respects_reduced_motion(self):
        css = (ROOT / 'docs/assets/stylesheets/experience.css').read_text(encoding='utf-8')
        self.assertIn('max-width: 740px', css)
        self.assertIn('.ujn-home-campus__cloud, .ujn-home-campus__plane { animation: none; }', css)
        self.assertIn('grid-template-columns: minmax(0, 1fr)', css)
        self.assertNotIn('backdrop-filter', css)

    def test_motion_and_mobile_styles_are_present(self):
        css = (ROOT / 'docs/assets/stylesheets/experience.css').read_text(encoding='utf-8')
        self.assertIn('prefers-reduced-motion: reduce', css)
        self.assertIn('max-width: 600px', css)
        self.assertIn('overflow-x: auto', css)
        self.assertNotIn('@import', css)
        # Theme variables live on body; tokens defined only on :root freeze light colors.
        self.assertIn(':root, [data-md-color-scheme]', css)
        self.assertIn('--ujn-ui-font: var(--md-text-font-family)', css)

    def test_calendar_and_life_children_have_visible_parent_navigation(self):
        for src in ['school-calendar/index.md', 'clubs/index.md', 'hometown-groups/index.md']:
            self.assertIn('href="/ujn-guide/campus-life/"', self.render(src))
        calendar = (ROOT / 'docs/school-calendar/index.md').read_text(encoding='utf-8')
        self.assertIn('返回校园生活', calendar)
        self.assertNotIn('hide: [navigation]', calendar)

    def test_missing_page_has_working_navigation_not_a_dead_end(self):
        env = Environment(loader=DictLoader({
            'error': (ROOT / 'overrides/404.html').read_text(encoding='utf-8'),
            'main.html': '{% block content %}{% endblock %}',
        }))
        env.filters['url'] = lambda path: '/ujn-guide/' + path
        html = env.get_template('error').render()
        self.assertIn('data-page-kind="error"', html)
        self.assertIn('href="/ujn-guide/"', html)
        self.assertIn('href="/ujn-guide/site-guide/"', html)

if __name__ == '__main__':
    unittest.main()
