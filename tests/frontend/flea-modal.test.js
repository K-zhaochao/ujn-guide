import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import { JSDOM } from 'jsdom';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

const require = createRequire(import.meta.url);
const source = readFileSync(require.resolve('../../docs/javascripts/ujn-ui.js'), 'utf8');
let dom, doc, win, subscribers;
const open = () => {
  doc.querySelector('#market').focus();
  doc.querySelector('#market').click();
};
const key = (selector, value, shiftKey = false) => {
  const node = doc.querySelector(selector);
  node.focus();
  node.dispatchEvent(new win.KeyboardEvent('keydown', { key: value, shiftKey, bubbles: true, cancelable: true }));
};
const isOpen = () => doc.querySelector('#flea-modal-overlay').classList.contains('flea-overlay--open');

beforeEach(async () => {
  subscribers = [];
  dom = new JSDOM('<!doctype html><body><button id="market" data-ujn-modal="flea">Market</button><button id="donate" data-ujn-modal="donate">Donate</button></body>', {
    runScripts: 'outside-only', url: 'https://example.test/ujn-guide/',
  });
  win = dom.window;
  doc = win.document;
  win.document$ = { subscribe: callback => subscribers.push(callback) };
  Object.defineProperty(doc, 'currentScript', { value: { src: 'https://example.test/ujn-guide/javascripts/ujn-ui.js' } });
  const ready = new Promise(resolve => doc.addEventListener('DOMContentLoaded', resolve, { once: true }));
  win.eval(source);
  await ready;
});
afterEach(() => dom.window.close());

describe('responsive flea-market dialog', () => {
  it('opens an accessible dialog with only the default platform visible', () => {
    open();
    const dialog = doc.querySelector('[role="dialog"]');
    expect(isOpen()).toBe(true);
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(doc.getElementById(dialog.getAttribute('aria-labelledby')).textContent).toBe('校园跳蚤市场');
    expect(doc.querySelector('#flea-panel-wechat').hidden).toBe(false);
    expect(doc.querySelector('#flea-panel-qq').hidden).toBe(true);
    expect(doc.querySelector('#flea-tab-wechat').getAttribute('aria-selected')).toBe('true');
    expect(doc.activeElement).toBe(doc.querySelector('.flea-close'));
  });

  it('switches one panel at a time and preserves assets on project subpaths', () => {
    open();
    doc.querySelector('#flea-tab-qq').click();
    expect(doc.querySelector('#flea-panel-wechat').hidden).toBe(true);
    expect(doc.querySelector('#flea-panel-qq').hidden).toBe(false);
    expect(doc.querySelector('#flea-tab-wechat').tabIndex).toBe(-1);
    expect(doc.querySelector('#flea-tab-qq').tabIndex).toBe(0);
    for (const img of doc.querySelectorAll('.flea-qr-frame img')) {
      expect(decodeURI(img.src)).toMatch(/^https:\/\/example.test\/ujn-guide\/assets\/images\/跳蚤市场\//);
    }
    const link = doc.querySelector('.flea-join');
    expect(link.href).toBe('https://pd.qq.com/s/a41e8nsi6?b=5');
    expect(link.target).toBe('_blank');
    expect(link.rel).toContain('noopener');
  });

  it('supports arrow, Home and End keys with roving focus', () => {
    open();
    key('#flea-tab-wechat', 'ArrowRight');
    expect(doc.activeElement.id).toBe('flea-tab-qq');
    key('#flea-tab-qq', 'ArrowLeft');
    expect(doc.activeElement.id).toBe('flea-tab-wechat');
    key('#flea-tab-wechat', 'End');
    expect(doc.activeElement.id).toBe('flea-tab-qq');
    key('#flea-tab-qq', 'Home');
    expect(doc.activeElement.id).toBe('flea-tab-wechat');
  });

  it('restores the existing scroll state and opener focus on close', () => {
    doc.body.style.overflow = 'auto';
    open();
    expect(doc.body.style.overflow).toBe('hidden');
    doc.querySelector('.flea-close').click();
    expect(isOpen()).toBe(false);
    expect(doc.body.style.overflow).toBe('auto');
    expect(doc.activeElement.id).toBe('market');
  });

  it('closes with Escape', () => {
    open();
    key('#flea-tab-wechat', 'Escape');
    expect(isOpen()).toBe(false);
    expect(doc.body.style.overflow).toBe('');
    expect(doc.activeElement.id).toBe('market');
  });

  it('closes on the backdrop, but not on clicks inside the dialog', () => {
    open();
    doc.querySelector('.flea-caption').click();
    expect(isOpen()).toBe(true);
    doc.querySelector('#flea-modal-overlay').click();
    expect(isOpen()).toBe(false);
  });

  it('wraps keyboard focus without including hidden panels', () => {
    open();
    key('.flea-close', 'Tab', true);
    expect(doc.activeElement.id).toBe('flea-panel-wechat');
    key('#flea-panel-wechat', 'Tab');
    expect(doc.activeElement.className).toBe('flea-close');
    doc.querySelector('#flea-tab-qq').click();
    key('.flea-close', 'Tab', true);
    expect(doc.activeElement.className).toBe('flea-join');
    key('.flea-join', 'Tab');
    expect(doc.activeElement.className).toBe('flea-close');
  });

  it('resets the platform on reopening and does not overwrite the original overflow', () => {
    doc.body.style.overflow = 'scroll';
    open();
    doc.querySelector('#flea-tab-qq').click();
    doc.querySelector('#market').click();
    doc.querySelector('.flea-close').click();
    expect(doc.body.style.overflow).toBe('scroll');
    open();
    expect(doc.querySelector('#flea-panel-wechat').hidden).toBe(false);
    expect(doc.querySelector('#flea-panel-qq').hidden).toBe(true);
  });

  it('allows native QR long-press interactions', () => {
    open();
    const img = doc.querySelector('#flea-panel-wechat img');
    for (const type of ['pointerdown', 'touchstart', 'contextmenu']) {
      const event = new win.Event(type, { bubbles: true, cancelable: true });
      img.dispatchEvent(event);
      expect(event.defaultPrevented).toBe(false);
    }
    expect(img.draggable).toBe(false);
  });

  it('keeps the donation trigger independent and closes on instant navigation', () => {
    doc.querySelector('#donate').click();
    expect(doc.querySelector('#donate-modal-overlay').classList.contains('donate-overlay--open')).toBe(true);
    expect(isOpen()).toBe(false);
    open();
    // The final subscription cleans up the dialog on Material instant navigation.
    subscribers.at(-1)();
    expect(isOpen()).toBe(false);
    expect(doc.body.style.overflow).toBe('');
  });
});
