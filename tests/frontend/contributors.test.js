import { readFileSync } from 'node:fs';
import { beforeEach, describe, expect, it } from 'vitest';
const page = readFileSync('docs/contribute/index.md', 'utf8');
const html = page.split('<!-- contributors:start -->')[1].split('<!-- contributors:end -->')[0];
const css = readFileSync('docs/assets/stylesheets/ujn-contributors.css', 'utf8');
const boot = () => { document.body.innerHTML = html; };
const radio = key => document.getElementById('contributors-platform-' + key);
beforeEach(boot);

describe('contributor platform switch without javascript', () => {
  it('has the default platform checked before any javascript initialization', () => {
    expect(radio('github').checked).toBe(true); expect(radio('gitee').checked).toBe(false);
    expect(document.querySelector('.ujn-contributors__switch').hidden).toBe(false);
    expect(document.querySelectorAll('script:not([type="application/json"])')).toHaveLength(0);
    expect(css).toContain('.ujn-contributors__panel { display:none; }');
    for (const key of ['github', 'gitee']) expect(css).toContain('#contributors-platform-' + key + ':checked ~ #contributors-panel-' + key);
  });
  it('uses mutually exclusive native state for both platform selections', () => {
    radio('gitee').click(); expect(radio('gitee').checked).toBe(true); expect(radio('github').checked).toBe(false);
    radio('github').click(); expect(radio('github').checked).toBe(true); expect(radio('gitee').checked).toBe(false);
  });
  it('labels the controls and includes visible keyboard focus treatment', () => {
    for (const [key,name] of [['github','GitHub'],['gitee','Gitee']]) {
      expect(document.querySelector('label[for="contributors-platform-' + key + '"]').textContent).toBe(name);
      expect(radio(key).getAttribute('aria-controls')).toBe('contributors-panel-' + key);
      expect(css).toContain('#contributors-platform-' + key + ':focus-visible');
    }
    expect(css).not.toMatch(/\.ujn-contributors__radio\s*\{[^}]*display\s*:\s*none/);
  });
  it('starts with the same platform when immediate navigation replaces the markup', () => {
    radio('gitee').click(); boot(); expect(radio('github').checked).toBe(true); expect(radio('gitee').checked).toBe(false);
  });
  it('provides an initial placeholder underneath an eagerly loaded avatar', () => {
    const portrait=document.querySelector('.ujn-contributor__portrait:has(img)');
    expect(portrait.querySelector('.ujn-contributor__initial').textContent).not.toBe('');
    expect(portrait.querySelector('img').getAttribute('loading')).toBe('eager');
    expect(portrait.querySelector('img').classList.contains('off-glb')).toBe(true);
  });
  it('does not add platform counts or depend on a deferred initialization script', () => {
    expect(document.querySelector('.ujn-contributors__count')).toBeNull();
    expect(readFileSync('mkdocs.yml','utf8')).not.toContain('javascripts/contributors.js');
  });
  it('renders the contribution guide without a details wrapper', () => {
    expect(page).not.toContain('<details'); expect(page).not.toContain('<summary');
    expect(page).toContain('## ✏️ 在线修改内容'); expect(page).toContain('## 🐾 新增一只猫');
  });
  it('offers an image conversion button without displaying the website URL', () => {
    document.body.innerHTML=page;
    const link=document.querySelector('.ujn-image-guide__button');
    expect(link.href).toBe('https://webp.royi.net/#playground'); expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener'); expect(link.textContent).toContain('转换图片为 WebP');
    expect(document.querySelector('.ujn-image-guide').textContent).not.toContain('webp.royi.net');
  });
});
