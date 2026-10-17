/**
 * AIMLab site — language switch (English / 繁體中文).
 *
 * Loaded before every other script. The choice lives in localStorage ("aim_lang") and is
 * mirrored on <html data-lang="en|zh">. Text is always rendered in both languages as a pair
 * of spans, <span class="t-en">…</span><span class="t-zh">…</span>, and the stylesheet shows
 * the one that matches data-lang, so switching never re-renders anything.
 *
 *   t(en, zh)   -> HTML for a bilingual pair (both escaped). Missing zh falls back to en.
 *   tx(en, zh)  -> the plain string for the current language (titles, alt text, aria labels).
 *   AIM_LANG.set('zh') / AIM_LANG.get()
 *
 * The <title> of a page carries its Chinese version in data-zh; it follows the switch too.
 */
'use strict';

const AIM_LANG = (() => {
  const KEY = 'aim_lang';
  const read = () => { try { return localStorage.getItem(KEY); } catch (error) { return null; } };
  const write = value => { try { localStorage.setItem(KEY, value); } catch (error) { /* private mode: the choice lasts for this page only */ } };
  let current = read() === 'zh' ? 'zh' : 'en';

  function apply() {
    const html = document.documentElement;
    html.dataset.lang = current;
    html.lang = current === 'zh' ? 'zh-Hant' : 'en';
    const title = document.querySelector('title');
    if (title) {
      if (!title.dataset.en) title.dataset.en = title.textContent;
      const zh = title.dataset.zh;
      title.textContent = (current === 'zh' && zh) ? zh : title.dataset.en;
    }
    document.querySelectorAll('.lang-toggle button').forEach(button => {
      const active = button.dataset.lang === current;
      button.classList.toggle('active', active);
      button.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
  }

  return {
    get: () => current,
    set(value) {
      current = value === 'zh' ? 'zh' : 'en';
      write(current);
      apply();
      document.dispatchEvent(new CustomEvent('aim:lang', { detail: current }));
    },
    apply
  };
})();

AIM_LANG.apply();   // before first paint, so the page never flashes the other language

/** Escape for HTML text (same rules as lib.js, which loads after this file). */
function i18nEscape(value) {
  return String(value == null ? '' : value)
    .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#039;');
}

/** Bilingual pair. `zh` may be empty: English is then shown in both languages. */
function t(en, zh) {
  const e = i18nEscape(en);
  const z = (zh == null || String(zh).trim() === '') ? e : i18nEscape(zh);
  return `<span class="t-en">${e}</span><span class="t-zh">${z}</span>`;
}

/** Bilingual pair whose parts are already HTML (callers escape themselves). */
function tHtml(enHtml, zhHtml) {
  return `<span class="t-en">${enHtml}</span><span class="t-zh">${zhHtml || enHtml}</span>`;
}

/** The current-language string, unescaped (for attributes and document.title). */
function tx(en, zh) {
  return (AIM_LANG.get() === 'zh' && zh != null && String(zh).trim() !== '') ? String(zh) : String(en == null ? '' : en);
}

/** Member roles and degrees as the site writes them, in Chinese. Unknown values stay English. */
const ROLE_ZH = {
  'postdoc': '博士後研究員', 'postdoctoral researcher': '博士後研究員',
  'phd student': '博士生', 'research assistant': '研究助理',
  'master student': '碩士生', 'undergraduate': '大學部專題生',
  'program lead': '計畫負責人', 'associate professor': '副教授', 'professor': '教授', 'assistant professor': '助理教授',
  'principal investigator': '指導教授', 'phd': '博士', 'master': '碩士'
};
function roleZh(role) {
  return String(role || '').split('·').map(part => {
    const key = part.trim().toLowerCase();
    return ROLE_ZH[key] || part.trim();
  }).join(' · ');
}

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.lang-toggle').forEach(box => {
    box.addEventListener('click', event => {
      const button = event.target.closest('button[data-lang]');
      if (button) AIM_LANG.set(button.dataset.lang);
    });
  });
  AIM_LANG.apply();
});
