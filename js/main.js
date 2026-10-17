/**
 * AIMLab site — page bootstrap.
 *
 * Runs on every page after js/lib.js and js/render.js:
 *   1. site chrome: active nav link, mobile nav, image protection, parallax
 *   2. data sections: each container id below is filled from its JSON file when present
 *   3. home-page hero stats, computed from the data files
 *
 * To add a data-driven section: give the HTML an id, add one row to DATA_SECTIONS, and
 * write its render function in js/render.js.
 */
'use strict';

/** container id → data file (or its own loader) + render function. Only containers present on the page load. */
const DATA_SECTIONS = [
  { id: 'news-container',       data: 'news',         render: (d, el) => renderNews(d, el) },
  { id: 'highlights-container', data: 'highlights',   render: (d, el) => renderHighlights(d, el) },
  { id: 'people-pi',            data: 'people',       render: (d, el, ui) => renderPeople(d, ui) },
  { id: 'pubs-container',       data: 'publications', load: loadPublicPublications, render: (d, el) => renderPublications(d, el) },
  { id: 'programs-container',   data: 'programs',     render: (d, el, ui) => renderPrograms(d, ui) },
  { id: 'programs-all',         data: 'programs',     render: (d, el, ui) => renderPrograms(d, ui) }
];

document.addEventListener('DOMContentLoaded', () => {
  initActiveNav();
  renderFooterPrograms();
  initMobileNav();
  initHeaderBehavior();
  initImageProtection();
  initParallax();
  initScrollState();
  applySiteEffects();
  initHeroStats();
  mountDataSections();
});

/* ================================================================ data sections */

function mountDataSections() {
  const ui = {
    pi: document.getElementById('people-pi'),
    members: document.getElementById('people-members'),
    alumni: document.getElementById('alumni-list'),
    programs: document.getElementById('programs-container'),
    programsAll: document.getElementById('programs-all')
  };
  DATA_SECTIONS.forEach(({ id, data, load, render }) => {
    const el = document.getElementById(id);
    if (!el) return;
    (load ? load() : loadJson(data))
      .then(json => render(json, el, ui))
      .catch(error => { console.error(`[AIMLab] ${data}.json`, error); renderLoadError(el); });
  });
}

/* ================================================================ site chrome */

/** Highlight the nav link that matches the current page. */
/**
 * Highlight the nav link that matches the current page. A program detail page (program.html)
 * belongs to the Programs section: that link is highlighted too, marked as the current section.
 * Footer links get the same marking.
 */
function initActiveNav() {
  const current = window.location.pathname.split('/').pop() || 'index.html';
  const section = current === 'program.html' ? 'programs.html' : current;
  const id = new URLSearchParams(window.location.search).get('id');
  document.querySelectorAll('.nav-links a').forEach(link => {
    const href = (link.getAttribute('href') || '').replace(/^\//, '');
    if (href === section) {
      link.classList.add('active');
      link.setAttribute('aria-current', href === current ? 'page' : 'true');
    }
  });
  document.querySelectorAll('.footer-nav a').forEach(link => {
    const href = (link.getAttribute('href') || '').replace(/^\//, '');
    if (href === current || (current === 'program.html' && href === `program.html?id=${id}`)) link.setAttribute('aria-current', 'page');
  });
}

/** Footer Programs column follows programs.json, so a hidden or new program is reflected there. */
async function renderFooterPrograms() {
  const list = document.getElementById('footer-programs');
  if (!list) return;
  const programs = await loadJsonOr('programs', null);
  if (!Array.isArray(programs)) return;                  // keep the static fallback links
  const first = list.querySelector('a');                // keep whatever prefix the static links use ('', '/', or a sub-path)
  const root = first ? first.getAttribute('href').replace(/program\.html.*$/, '') : '';
  const id = new URLSearchParams(window.location.search).get('id');
  const onProgramPage = (window.location.pathname.split('/').pop() || '') === 'program.html';
  list.innerHTML = orderProgramsByTrack(programs.filter(isPublicProgram)).map(p => {
    const current = onProgramPage && p.id === id ? ' aria-current="page"' : '';
    return `<li><a href="${root}${programHref(p.id)}"${current}>${t(p.title || p.id, p.title_zh)}</a></li>`;
  }).join('');
}

/** Hamburger button for the mobile nav. */
function initMobileNav() {
  const toggle = document.getElementById('navToggle');
  const links = document.getElementById('navLinks');
  if (!toggle || !links) return;
  toggle.addEventListener('click', () => {
    const open = links.classList.toggle('open');
    toggle.setAttribute('aria-expanded', open ? 'true' : 'false');
  });
}

/**
 * Header on scroll. Its height is published as --header-h (anchors use it). On screens up to 860px
 * it hides while the reader scrolls down and returns on the first scroll up; it always shows near
 * the top of the page, while the menu is open, and when it holds keyboard focus.
 */
function initHeaderBehavior() {
  const header = document.querySelector('header');
  if (!header) return;
  const root = document.documentElement;
  const links = document.getElementById('navLinks');
  const small = window.matchMedia('(max-width: 860px)');
  const THRESHOLD = 8;                                   // px of travel before the header reacts
  const setHeight = () => root.style.setProperty('--header-h', `${header.offsetHeight}px`);
  setHeight();
  if ('ResizeObserver' in window) new ResizeObserver(setHeight).observe(header);

  let lastY = Math.max(0, window.scrollY);
  let ticking = false;
  const show = () => root.classList.remove('header-hidden');
  const update = () => {
    ticking = false;
    const y = Math.max(0, window.scrollY);              // iOS bounce can report negative values
    const delta = y - lastY;
    if (!small.matches || y <= header.offsetHeight || (links && links.classList.contains('open'))) {
      show();
      lastY = y;
      return;
    }
    if (Math.abs(delta) < THRESHOLD) return;            // small jitters are ignored, travel accumulates
    root.classList.toggle('header-hidden', delta > 0);
    lastY = y;
  };
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(update); }
  }, { passive: true });
  if (small.addEventListener) small.addEventListener('change', update);
  header.addEventListener('focusin', show);
  const toggle = document.getElementById('navToggle');
  if (toggle) toggle.addEventListener('click', show);   // opening the menu always brings the header back
}

/** Disable right-click save and drag on images (light deterrent, not DRM). */
function initImageProtection() {
  const block = event => { if (event.target.tagName === 'IMG') event.preventDefault(); };
  document.addEventListener('contextmenu', block);
  document.addEventListener('dragstart', block);
}

/** Slow vertical drift of the home hero background on scroll. */
function initParallax() {
  const heroBg = document.querySelector('.hero-bg');
  if (!heroBg) return;
  let ticking = false;
  window.addEventListener('scroll', () => {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(() => {
      heroBg.style.transform = `translateY(${window.scrollY * 0.28}px)`;
      ticking = false;
    });
  }, { passive: true });
}

/**
 * html.is-scrolling while the page moves. Cards lift on hover, so without this every card that slides
 * under a resting mouse pointer jumps up and back down mid-scroll, which reads as stutter.
 */
function initScrollState() {
  const root = document.documentElement;
  let idle = 0;
  window.addEventListener('scroll', () => {
    if (!root.classList.contains('is-scrolling')) root.classList.add('is-scrolling');
    clearTimeout(idle);
    idle = setTimeout(() => root.classList.remove('is-scrolling'), 160);
  }, { passive: true });
}

/* ================================================================ site effects */

/** Effects that are behaviour rather than styling: the flag starts this function instead of only adding CSS. */
const SITE_BEHAVIORS = {
  smooth_wheel: initSmoothWheel
};

/**
 * Site effects are opt-in flags in site.json ("effects"), edited from the admin panel (網站設定).
 * Each true flag becomes a class fx-<name> on <html> (underscores become dashes) for the CSS scoped
 * under it, and starts its entry in SITE_BEHAVIORS if it has one. An effect that is off never runs.
 */
async function applySiteEffects() {
  const site = await loadJsonOr('site', {});
  const effects = site.effects || {};
  Object.keys(effects).forEach(key => {
    if (effects[key] !== true) return;
    document.documentElement.classList.add('fx-' + key.replace(/_/g, '-'));
    if (SITE_BEHAVIORS[key]) SITE_BEHAVIORS[key]();
  });
}

/**
 * Damped mouse-wheel scrolling (site.json effects.smooth_wheel). Each notch moves a target and the page
 * eases toward it, so scrolling glides to a stop instead of jumping 100px at a time.
 * Only for a mouse wheel on a desktop pointer: trackpads and touch screens already have native momentum.
 * Zoom (Ctrl), horizontal scroll, inner scroll areas, reduced motion and keyboard/scrollbar input stay native.
 */
function initSmoothWheel() {
  const desktop = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reduce = window.matchMedia('(prefers-reduced-motion: reduce)');
  const EASE = 0.14;                                  // share of the remaining distance covered per 60 Hz frame
  let target = window.scrollY, current = target, running = false, last = 0;

  const maxScroll = () => document.documentElement.scrollHeight - window.innerHeight;
  const isMouseWheel = e => e.deltaMode !== 0 || (e.wheelDeltaY && Math.abs(e.wheelDeltaY) % 120 === 0);
  const innerScroller = (e, dy) => {
    for (let el = e.target; el && el !== document.body && el !== document.documentElement; el = el.parentElement) {
      if (el.scrollHeight <= el.clientHeight) continue;
      const oy = getComputedStyle(el).overflowY;
      if (oy !== 'auto' && oy !== 'scroll') continue;
      if (dy < 0 ? el.scrollTop > 0 : el.scrollTop + el.clientHeight < el.scrollHeight - 1) return true;
    }
    return false;
  };

  const step = now => {
    const dt = last ? Math.min(64, now - last) : 16.7; last = now;
    const k = 1 - Math.pow(1 - EASE, dt / 16.7);
    current += (target - current) * k;
    if (Math.abs(target - current) < 0.5) current = target;
    window.scrollTo({ top: current, behavior: 'instant' });
    if (current !== target) requestAnimationFrame(step);
    else running = false;
  };

  window.addEventListener('wheel', e => {
    if (!desktop.matches || reduce.matches || e.ctrlKey || e.metaKey || e.shiftKey || e.defaultPrevented) return;
    if (Math.abs(e.deltaX) > Math.abs(e.deltaY) || !isMouseWheel(e) || innerScroller(e, e.deltaY)) return;
    e.preventDefault();
    if (!running) { target = current = window.scrollY; }
    const dy = e.deltaMode === 1 ? e.deltaY * 40 : e.deltaMode === 2 ? e.deltaY * window.innerHeight : e.deltaY;
    target = Math.max(0, Math.min(maxScroll(), target + dy));
    if (!running) { running = true; last = 0; requestAnimationFrame(step); }
  }, { passive: false });

  // Scrollbar drags, keys and anchor jumps move the page on their own: stop easing and follow them.
  ['keydown', 'mousedown', 'touchstart'].forEach(type => window.addEventListener(type, () => {
    if (running) { target = current = window.scrollY; }
  }, { passive: true }));
}

/* ================================================================ hero stats */

/**
 * Home-page numbers, computed from the data files so they never go stale:
 *   publications = public entries in publications.json (site.json year rule), members = people.json members,
 *   programs = public programs, years = current year − site.json "founded" (hidden while null).
 */
async function initHeroStats() {
  const box = document.querySelector('.hero-stats');
  if (!box) return;
  const [pubs, people, programs, site] = await Promise.all([
    loadJsonOr('publications', []), loadJsonOr('people', {}), loadJsonOr('programs', []), loadJsonOr('site', {})
  ]);
  const isRealName = v => isFilled(v) && !/^Member \d+$/.test(v.trim());
  const values = {
    publications: publicPublications(pubs, site).filter(p => isFilled(p.title)).length,
    members: (people.members || []).filter(m => isRealName(m.name)).length,
    programs: programs.filter(isPublicProgram).length,
    years: Number.isInteger(site.founded) ? Math.max(0, new Date().getFullYear() - site.founded) : null
  };

  box.querySelectorAll('.stat-item').forEach(item => {
    const value = values[item.dataset.stat];
    if (value === null || value === undefined) {
      const divider = item.previousElementSibling;
      if (divider && divider.classList.contains('stat-divider')) divider.remove();
      item.remove();
      return;
    }
    item.querySelector('.stat-num').dataset.target = String(value);
    const suffix = item.querySelector('.stat-suffix');
    if (suffix) suffix.textContent = (item.dataset.stat === 'years' && value > 0) ? '+' : '';
  });
  box.hidden = false;
  animateStatsWhenVisible(box);
}

/** Count each .stat-num up to its data-target the first time the stats card scrolls into view. */
function animateStatsWhenVisible(box) {
  const nums = box.querySelectorAll('.stat-num');
  if (!nums.length) return;
  const DURATION_MS = 1800;
  const countUp = (el, target) => {
    const start = performance.now();
    const tick = now => {
      const progress = Math.min((now - start) / DURATION_MS, 1);
      const eased = 1 - Math.pow(1 - progress, 4);          // ease-out quart
      el.textContent = Math.round(eased * target);
      if (progress < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  };
  const observer = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    nums.forEach(el => countUp(el, parseInt(el.dataset.target, 10) || 0));
    observer.disconnect();
  }, { threshold: 0.25 });
  observer.observe(box);
}
