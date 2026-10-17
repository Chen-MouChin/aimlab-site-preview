/**
 * AIMLab site — program detail page (program.html?id=<program-id>).
 *
 * Loads assets/data/programs/<id>.json after validating the id against the index
 * (assets/data/programs.json). Every section of the page is optional: a missing or empty
 * key in the JSON hides that section.
 *
 * Depends on js/lib.js and js/render.js (escaping, placeholders, renderProgramCard,
 * renderHighlights). Charts use Chart.js, loaded from the CDN only when a program has
 * results, and fall back to a table.
 * Program-specific visuals (window.AIM_RPPG_VISUALS) are mounted when data.visuals asks.
 */
'use strict';

const CHART_PALETTE = { s1: '#2a78d6', s2: '#eb6834', s3: '#6250d6', grid: 'rgba(15,23,42,.08)', text: '#334155' };
const CHART_JS = {
  src: 'https://cdnjs.cloudflare.com/ajax/libs/Chart.js/4.4.1/chart.umd.min.js',
  integrity: 'sha384-bs/nf9FbdNouRbMiFcrcZfLXYPKiPaGVGplVbv7dLGECccEXDW+S3zjqSKR5ZEaD'
};

document.addEventListener('DOMContentLoaded', loadProgramPage);

async function loadProgramPage() {
  const root = document.getElementById('program-root');
  if (!root) return;
  try {
    const rawId = new URLSearchParams(window.location.search).get('id') || '';
    const id = PROGRAM_ID_RE.test(rawId) ? rawId : '';
    const index = await loadJson('programs');
    const entry = Array.isArray(index) ? index.find(p => p.id === id && isPublicProgram(p)) : null;
    if (!entry) { renderNotFound(root); return; }

    const data = await loadJson(`programs/${id}`);
    setPageMeta(`${entry.title} | AIMLab`, `${entry.title_zh || entry.title} | 人工智慧醫學實驗室`, (data.hero && isFilled(data.hero.tagline)) ? data.hero.tagline : entry.tagline);

    renderHero(data.hero, byId('rl-hero'));
    loadJsonOr('highlights', []).then(items => renderHighlights(items, byId('rl-highlights'), { program: id }));
    renderOverview(data.overview, byId('rl-overview'));
    mountVisuals(data.visuals);
    renderDemos(data.demos, byId('rl-demos'));
    renderPipeline(data.pipeline, byId('rl-pipeline'));
    renderMethod(data.method, byId('rl-method'));
    renderResults(data.results, byId('rl-results'));
    await renderProgramPublications(data.publications, byId('rl-pubs'));
    await renderTeam(data.team, byId('rl-team'));
    renderRelated(data.related, index, byId('rl-related'));
  } catch (error) {
    console.error('[AIMLab] program page', error);
    renderLoadError(root);
  }
}

const byId = id => document.getElementById(id);

/** Title, description, canonical and Open Graph tags for the program being shown (the HTML carries generic ones). */
function setPageMeta(title, titleZh, description) {
  const el = document.querySelector('title');
  if (el) { el.dataset.en = title; el.dataset.zh = titleZh; }
  AIM_LANG.apply();
  const set = (selector, value) => { const el = document.querySelector(selector); if (el && value) el.setAttribute(selector.startsWith('link') ? 'href' : 'content', value); };
  set('meta[name="description"]', description);
  set('meta[property="og:title"]', title);
  set('meta[property="og:description"]', description);
  set('meta[property="og:url"]', window.location.href.split('#')[0]);
  set('link[rel="canonical"]', window.location.href.split('#')[0]);
}

/** Show or hide a section (by id) depending on whether it has content. */
function toggleSection(sectionId, hasContent) {
  const section = byId(sectionId);
  if (section) section.hidden = !hasContent;
}

function renderNotFound(root) {
  root.innerHTML = `
    <div class="container not-found">
      <h2 class="section-title">${t('Program not found', '找不到這個計畫')}</h2>
      <p>${t('Choose a program from the list.', '請從計畫列表中選擇。')}</p>
      <a class="pill pill--plain" href="programs.html">${t('All Programs →', '所有計畫 →')}</a>
    </div>`;
}

/* ================================================================ demo links */

/** Same-origin demo pages live under demo/. Anything else must pass safeUrl(). */
function isLocalDemo(value) {
  return typeof value === 'string' && /^demo\/[a-z0-9-]+\.html$/.test(value.trim());
}
function demoHref(value) {
  return isLocalDemo(value) ? escapeAttr(value.trim()) : safeUrl(value);
}
function youtubeId(url) {
  if (typeof url !== 'string') return null;
  const match = url.match(/(?:youtube\.com\/(?:watch\?v=|embed\/)|youtu\.be\/)([A-Za-z0-9_-]{6,})/);
  return match ? match[1] : null;
}

/* ================================================================ hero */

function renderHero(hero, el) {
  if (!el || !hero) return;
  const links = hero.links || {};
  const badges = Array.isArray(hero.badges) ? hero.badges : [];
  const todoPill = label => `<span class="pill rl-pill-ph">${label} (TODO)</span>`;
  const heroLinks = [
    isFilled(links.github) ? pillLink(safeUrl(links.github), 'GitHub') : ('github' in links ? todoPill('GitHub') : ''),
    isFilled(links.paper) ? pillLink(safeUrl(links.paper), 'Paper', { zh: '論文' }) : ('paper' in links ? todoPill('Paper') : ''),
    isFilled(links.demo) ? pillLink(demoHref(links.demo), 'Interactive Demo', { zh: '互動展示' }) : '',
    `<a class="pill" href="#rl-demos-section" data-needs-demos>${t('Watch demo ↓', '觀看展示 ↓')}</a>`
  ].join('');
  const crumb = `
      <nav class="breadcrumb" aria-label="${escapeAttr(tx('Breadcrumb', '目前位置'))}">
        <a href="programs.html">${t('Programs', '研究計畫')}</a><span class="sep" aria-hidden="true">›</span>
        <span aria-current="page">${t(hero.title || '', hero.title_zh)}</span>
      </nav>`;
  el.innerHTML = `
    <div class="rl-hero-inner fade-up">
      ${crumb}
      ${hero.label ? `<div class="hero-label"><span class="hero-label-dot"></span>${t(hero.label, hero.label_zh)}</div>` : ''}
      <h1 class="rl-hero-title">${t(hero.title || '', hero.title_zh)}</h1>
      ${hero.subtitle ? `<p class="rl-hero-sub">${t(hero.subtitle, hero.subtitle_zh)}</p>` : ''}
      <p class="rl-hero-tagline">${tHtml(ph(hero.tagline), isFilled(hero.tagline_zh) ? escapeHtml(hero.tagline_zh) : '')}</p>
      ${badges.length ? `<div class="rl-badges">${badges.map(b => badge(b)).join('')}</div>` : ''}
      <div class="rl-hero-links">${heroLinks}</div>
    </div>`;
}

/* ================================================================ overview */

function renderOverview(overview, el) {
  if (!el || !overview) return;
  const focus = Array.isArray(overview.focus) ? overview.focus : [];
  const focusZh = Array.isArray(overview.focus_zh) ? overview.focus_zh : [];
  const members = Array.isArray(overview.members) ? overview.members : [];
  const zh = v => (isFilled(v) ? escapeHtml(v) : '');
  el.innerHTML = `
    <div class="rl-overview-main">
      <p class="rl-overview-summary">${tHtml(ph(overview.summary), zh(overview.summary_zh))}</p>
      ${focus.length ? `<h3 class="rl-overview-h">${t('Focus', '研究重點')}</h3><ul class="rl-focus">${focus.map((f, i) => `<li>${tHtml(ph(f), zh(focusZh[i]))}</li>`).join('')}</ul>` : ''}
    </div>
    <aside class="rl-overview-side card">
      <div class="card-content">
        <div class="rl-group-meta">
          ${isFilled(overview.lead) ? `<div><span class="k">${t('Lead', '負責人')}</span> ${escapeHtml(overview.lead)}</div>` : ''}
          ${members.length ? `<div><span class="k">${t('Members', '成員')}</span> ${members.map(ph).join(', ')}</div>` : ''}
        </div>
      </div>
    </aside>`;
}

/* ================================================================ demos */

/** Demo cards: embedded demo page, YouTube, image/GIF or a video file. */
function renderDemos(demos, el) {
  if (!el) return;
  const list = Array.isArray(demos) ? demos : [];
  toggleSection('rl-demos-section', list.length > 0);
  if (!list.length) {
    document.querySelectorAll('[data-needs-demos]').forEach(a => a.remove());
    return;
  }
  el.innerHTML = list.map(demo => {
    const title = escapeAttr(demo.title || 'Demo');
    let media = '';
    let openLink = '';
    if (isPlaceholder(demo.src)) {
      media = `<div class="rl-media rl-media-ph"><span>▶</span><small>${ph(demo.src)}</small></div>`;
    } else if (demo.type === 'page' && isLocalDemo(demo.src)) {
      const src = escapeAttr(demo.src.trim());
      media = `<div class="rl-media rl-media-tall"><iframe src="${src}" title="${title}" loading="lazy"></iframe></div>`;
      openLink = `<a class="pill rl-media-open" href="${src}" target="_blank" rel="noopener noreferrer">${t('Open full page ↗', '開新分頁 ↗')}</a>`;
    } else if (youtubeId(demo.src)) {
      media = `<div class="rl-media"><iframe src="https://www.youtube-nocookie.com/embed/${youtubeId(demo.src)}" title="${title}" loading="lazy" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowfullscreen referrerpolicy="strict-origin-when-cross-origin"></iframe></div>`;
    } else if (demo.type === 'gif' || /\.(gif|png|jpe?g|webp)$/i.test(demo.src)) {
      media = `<div class="rl-media"><img src="${escapeAttr(demo.src)}" alt="${title}" loading="lazy" draggable="false"></div>`;
    } else {
      media = `<div class="rl-media"><video src="${escapeAttr(demo.src)}" controls muted loop playsinline preload="metadata"></video></div>`;
    }
    return `
      <figure class="card rl-demo">
        ${media}
        <figcaption class="card-content">
          <h3>${tHtml(ph(demo.title), isFilled(demo.title_zh) ? escapeHtml(demo.title_zh) : '')}</h3>
          <p>${tHtml(ph(demo.caption), isFilled(demo.caption_zh) ? escapeHtml(demo.caption_zh) : '')}</p>
          ${openLink}
        </figcaption>
      </figure>`;
  }).join('');
}

/* ================================================================ pipeline / method */

function renderPipeline(steps, el) {
  if (!el) return;
  const list = Array.isArray(steps) ? steps : [];
  el.hidden = !list.length;
  el.style.setProperty('--steps', list.length);
  el.innerHTML = list.map((step, i) => `
    <div class="rl-step">
      <div class="rl-step-num">${escapeHtml(step.step || String(i + 1).padStart(2, '0'))}</div>
      <div class="rl-step-name">${t(step.name || '', step.name_zh)}</div>
      <div class="rl-step-desc">${tHtml(ph(step.desc), isFilled(step.desc_zh) ? escapeHtml(step.desc_zh) : '')}</div>
    </div>`).join('');
}

/** Text section with an optional figure. `title` overrides the section heading. */
function renderMethod(method, el) {
  if (!el) return;
  const paragraphs = method && Array.isArray(method.paragraphs) ? method.paragraphs : [];
  const paragraphsZh = method && Array.isArray(method.paragraphs_zh) ? method.paragraphs_zh : [];
  const hasFigure = !!method && 'figure' in method;
  toggleSection('rl-method-section', !!method && (paragraphs.length > 0 || hasFigure));
  if (!method) return;

  const heading = document.querySelector('#rl-method-section .section-title');
  if (heading && method.title) heading.innerHTML = t(method.title, method.title_zh);

  const figure = !hasFigure ? '' : (isPlaceholder(method.figure)
    ? `<figure class="rl-figure"><div class="rl-media rl-media-ph rl-arch-ph"><span>⬚</span><small>${ph(method.figure)}</small></div><figcaption>${ph(method.caption)}</figcaption></figure>`
    : `<figure class="rl-figure"><img class="rl-arch" src="${escapeAttr(method.figure)}" alt="${escapeAttr(method.caption || 'Architecture')}" loading="lazy" draggable="false"><figcaption>${ph(method.caption)}</figcaption></figure>`);
  el.classList.toggle('rl-method--text', !hasFigure);
  el.innerHTML = `${figure}<div class="rl-method-text">${paragraphs.map((p, i) => `<p>${tHtml(ph(p), isFilled(paragraphsZh[i]) ? escapeHtml(paragraphsZh[i]) : '')}</p>`).join('')}</div>`;
}

/* ================================================================ results (Chart.js) */

function chartPalette() {
  return CHART_PALETTE;
}

function renderResults(results, el) {
  if (!el) return;
  const list = Array.isArray(results) ? results : [];
  toggleSection('rl-results-section', list.length > 0);
  if (!list.length) return;

  el.innerHTML = list.map(r => `
    <div class="card rl-result">
      <div class="card-content">
        <h3>${tHtml(ph(r.title), isFilled(r.title_zh) ? escapeHtml(r.title_zh) : '')}</h3>
        <div class="rl-chart-wrap"><canvas id="rl-chart-${escapeAttr(r.id || '')}" role="img" aria-label="${escapeAttr(r.title || 'Chart')}"></canvas></div>
        <details class="rl-table"><summary>${t('Show data table', '顯示數據表')}</summary>${resultTable(r)}</details>
        ${r.note ? `<p class="rl-note">${tHtml(ph(r.note), isFilled(r.note_zh) ? escapeHtml(r.note_zh) : '')}</p>` : ''}
      </div>
    </div>`).join('');

  loadChartJs().then(() => list.forEach(buildChart)).catch(() => {
    // No CDN: hide the canvases and open the tables so the numbers stay visible.
    el.querySelectorAll('.rl-chart-wrap').forEach(w => { w.hidden = true; });
    el.querySelectorAll('.rl-table').forEach(d => { d.open = true; });
  });
}

/** Load Chart.js on demand (most programs have no results section, so the page never pays for it). */
function loadChartJs() {
  if (typeof Chart !== 'undefined') return Promise.resolve();
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = CHART_JS.src;
    script.integrity = CHART_JS.integrity;
    script.crossOrigin = 'anonymous';
    script.onload = resolve;
    script.onerror = () => reject(new Error('Chart.js failed to load'));
    document.head.appendChild(script);
  });
}

function resultTable(r) {
  const labels = Array.isArray(r.labels) ? r.labels : [];
  const series = Array.isArray(r.series) ? r.series : [];
  const cell = v => `<td>${escapeHtml(String(v ?? ''))}</td>`;
  return `<table>
    <thead><tr><th>${escapeHtml(r.xLabel || '')}</th>${series.map(s => `<th>${escapeHtml(s.name || '')}</th>`).join('')}</tr></thead>
    <tbody>${labels.map((label, i) => `<tr>${cell(label)}${series.map(s => cell((s.data || [])[i])).join('')}</tr>`).join('')}</tbody>
  </table>`;
}

function buildChart(r) {
  const canvas = byId(`rl-chart-${r.id}`);
  if (!canvas) return;
  const palette = chartPalette();
  const colors = [palette.s1, palette.s2, palette.s3];
  const series = Array.isArray(r.series) ? r.series.slice(0, 3) : [];
  const isLine = r.type === 'line';
  new Chart(canvas, {
    type: isLine ? 'line' : 'bar',
    data: {
      labels: r.labels || [],
      datasets: series.map((s, i) => ({
        label: s.name || `Series ${i + 1}`,
        data: s.data || [],
        borderColor: colors[i],
        backgroundColor: colors[i],
        borderWidth: isLine ? 2 : 0,
        pointRadius: isLine ? 3 : 0,
        pointHoverRadius: isLine ? 5 : 0,
        tension: isLine ? 0.25 : 0,
        borderRadius: isLine ? 0 : 4,
        borderSkipped: 'bottom',
        maxBarThickness: 36,
        fill: false
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      interaction: { mode: 'index', intersect: false },
      plugins: {
        legend: { display: series.length > 1, position: 'top', labels: { color: palette.text, boxWidth: 10, boxHeight: 10, usePointStyle: true } },
        tooltip: { backgroundColor: 'rgba(15,23,42,.92)', titleColor: '#f1f5f9', bodyColor: '#f1f5f9', padding: 10, cornerRadius: 8 }
      },
      scales: {
        x: { title: { display: !!r.xLabel, text: r.xLabel || '', color: palette.text }, grid: { display: false }, ticks: { color: palette.text } },
        y: { title: { display: !!r.yLabel, text: r.yLabel || '', color: palette.text }, grid: { color: palette.grid }, ticks: { color: palette.text }, beginAtZero: !isLine }
      }
    }
  });
}

/* ================================================================ publications / team / related */

/**
 * Related Publications. Entries are references into assets/data/publications.json so the
 * program page never duplicates bibliographic data:
 *   "doi:10.1016/j.compmedimag.2022.102049"   matched on the DOI
 *   "Vessel-BloomSeg"                           matched on the start of the title (case-insensitive)
 * A plain object is rendered as-is (for papers that are not in the site list yet).
 */
async function renderProgramPublications(refs, el) {
  if (!el) return;
  const list = Array.isArray(refs) ? refs : [];
  toggleSection('rl-pubs-section', list.length > 0);
  if (!list.length) return;
  const [all, site] = await Promise.all([loadJsonOr('publications', []), loadJsonOr('site', {})]);
  const shown = new Set(publicPublications(all, site));
  const byDoi = doi => all.find(p => (p.links || {}).doi && p.links.doi.toLowerCase().endsWith(doi.toLowerCase()));
  const byTitle = prefix => all.find(p => String(p.title || '').toLowerCase().startsWith(prefix.toLowerCase()));
  const resolved = list.map(ref => {
    if (typeof ref !== 'string') return ref;
    const hit = ref.startsWith('doi:') ? byDoi(ref.slice(4)) : byTitle(ref);
    if (!hit) console.warn('[AIMLab] related publication not found:', ref);
    return hit && shown.has(hit) ? hit : null;          // a paper outside the public years stays off this page too
  }).filter(Boolean);
  toggleSection('rl-pubs-section', resolved.length > 0);
  el.innerHTML = `<div class="pub-list">${sortPublications(resolved).map(publicationItem).join('')}</div>`;
}

/**
 * Team: the same card as the People page. Each entry is matched by name against people.json
 * (members and the PI), so a person's photo, role, badges, gold card and lead ring are identical
 * everywhere; the program file only decides who is listed and in what order. An entry that is
 * not in people.json falls back to its own fields.
 */
async function renderTeam(team, el) {
  if (!el) return;
  const list = Array.isArray(team) ? team : [];
  toggleSection('rl-team-section', list.length > 0);
  if (!list.length) return;
  const people = await loadJsonOr('people', {});
  const known = Array.isArray(people.members) ? people.members : [];
  const key = name => String(name || '').trim().toLowerCase();
  const resolve = entry => {
    const name = typeof entry === 'string' ? entry : entry.name;
    const hit = known.find(m => key(m.name) === key(name));
    if (hit) return hit;
    if (people.pi && key(people.pi.name) === key(name)) {
      return { name: people.pi.name, role: people.pi.title || 'Principal Investigator', photo: people.pi.photo, links: { email: people.pi.email } };   // roleZh() translates the title
    }
    return typeof entry === 'string' ? { name } : entry;
  };
  el.innerHTML = list.map(entry => memberCard(resolve(entry))).join('');
}

function renderRelated(ids, index, el) {
  if (!el) return;
  const list = Array.isArray(ids) ? ids : [];
  const programs = list.map(id => (index || []).find(p => p.id === id)).filter(isPublicProgram);
  toggleSection('rl-related-section', programs.length > 0);
  if (!programs.length) return;
  el.innerHTML = programs.map(renderProgramCard).join('');
  mountLiveCovers(el);
}

/* ================================================================ program-specific visuals */

/**
 * Mount static illustrations for a program (e.g. the rPPG face-mesh hero stage and the
 * "how a camera sees a heartbeat" section). The visuals module is loaded by program.html
 * and exposes window.AIM_RPPG_VISUALS = { heroStage, scienceSection, mount }.
 */
function mountVisuals(kind) {
  if (kind !== 'rppg' || !window.AIM_RPPG_VISUALS) return;
  const visuals = window.AIM_RPPG_VISUALS;
  const inner = document.querySelector('#rl-hero .rl-hero-inner');
  if (inner) {
    const text = document.createElement('div');          // wrap the hero text so the stage can sit beside it
    text.className = 'rl-hero-text';
    while (inner.firstChild) text.appendChild(inner.firstChild);
    inner.appendChild(text);
    inner.classList.add('rl-hero-inner--visual');
    inner.insertAdjacentHTML('beforeend', visuals.heroStage());
  }
  const demos = byId('rl-demos-section');
  if (demos) demos.insertAdjacentHTML('beforebegin', visuals.scienceSection());
  visuals.mount();
}
