/**
 * AIMLab site — shared helpers.
 *
 * Loaded first on every page (classic script, no bundler). Everything here is a plain
 * global function so that render.js, main.js and program.js can use it directly.
 * Rules of the house:
 *   - Every string that comes from a JSON file goes through escapeHtml()/escapeAttr()
 *     before it is put into HTML, and every href goes through safeUrl().
 *   - Placeholders look like "{{SOMETHING}}". They are never shown as real content.
 *   - Data files live in assets/data/ and are loaded with loadJson(name).
 */
'use strict';

/* ---------------------------------------------------------------- constants */

/** Folder that holds every JSON data file, relative to the page. */
const DATA_DIR = './assets/data/';

/** A program id is a short slug; it is used in URLs, so it is validated everywhere. */
const PROGRAM_ID_RE = /^[a-z0-9-]{1,32}$/;

/** Human labels for the two program tracks. */
const TRACK_LABEL = { frontier: 'Frontier AI', clinical: 'Clinical AI' };

/** Member roles, most senior first. Matching is case-insensitive and by substring. */
const ROLE_ORDER = ['postdoc', 'phd student', 'research assistant', 'master student', 'undergraduate'];

/* ---------------------------------------------------------------- escaping */

/** Escape text for use inside HTML content. */
function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

/** Escape text for use inside an HTML attribute value. */
function escapeAttr(value) {
  return escapeHtml(value);
}

/**
 * Only http(s) and mailto links are allowed in hrefs that come from data.
 * Anything else (javascript:, data:, relative paths) becomes "#".
 */
function safeUrl(url) {
  if (!url || typeof url !== 'string') return '#';
  const trimmed = url.trim();
  if (/^https?:\/\//i.test(trimmed) || /^mailto:/i.test(trimmed)) return escapeAttr(trimmed);
  return '#';
}

/* ---------------------------------------------------------------- placeholders */

/** True for empty strings, non-strings and "{{TEMPLATE}}" markers. */
function isPlaceholder(value) {
  return typeof value !== 'string' || value.trim() === '' || value.trim().startsWith('{{');
}

/** True for a real (non-placeholder) string value. */
function isFilled(value) {
  return !isPlaceholder(value);
}

/**
 * Escape a value, or render a visible placeholder chip when it is still a "{{...}}"
 * marker so editors can see what is missing.
 */
function ph(value) {
  if (!isPlaceholder(value)) return escapeHtml(value);
  const label = (typeof value === 'string' && value.trim()) ? value.trim().replace(/^\{\{|\}\}$/g, '') : 'TODO';
  return `<span class="rl-ph">${escapeHtml(label)}</span>`;
}

/* ---------------------------------------------------------------- data loading */

/** Fetch assets/data/<name>.json. Throws on HTTP errors. */
async function loadJson(name) {
  const response = await fetch(`${DATA_DIR}${name}.json`);
  if (!response.ok) throw new Error(`HTTP ${response.status} while loading ${name}.json`);
  return response.json();
}

/** Like loadJson() but resolves to `fallback` instead of throwing. */
async function loadJsonOr(name, fallback) {
  try { return await loadJson(name); } catch (error) { return fallback; }
}

/** Replace an element's content with the standard "could not load" message. */
function renderLoadError(el) {
  if (el) el.innerHTML = `<div class="load-error">${t('Could not load this section.', '資料載入失敗')}</div>`;
}

/* ---------------------------------------------------------------- publication years */

/**
 * site.json "publications" decides which years of papers are public (admin: 網站設定):
 *   { "mode": "all" }                      every paper
 *   { "mode": "since",  "since": 2020 }    papers from 2020 on
 *   { "mode": "recent", "recent": 5 }      the last 5 years, the current year included
 * Returns the first public year, or null when every year is public.
 */
function publicationYearFloor(site) {
  const rule = (site && site.publications) || {};
  if (rule.mode === 'since' && Number.isInteger(rule.since)) return rule.since;
  if (rule.mode === 'recent' && Number.isInteger(rule.recent)) return new Date().getFullYear() - rule.recent + 1;
  return null;
}

/**
 * The papers the site may show: the Publications page, program pages and the home-page count.
 * A paper unticked on the admin 論文 page ("hidden": true) is never shown.
 */
function publicPublications(pubs, site) {
  const list = (Array.isArray(pubs) ? pubs : []).filter(p => p && p.hidden !== true);
  const floor = publicationYearFloor(site);
  return floor === null ? list : list.filter(p => Number(p.year) >= floor);
}

async function loadPublicPublications() {
  const [pubs, site] = await Promise.all([loadJson('publications'), loadJsonOr('site', {})]);
  return publicPublications(pubs, site);
}

/* ---------------------------------------------------------------- programs */

/** A program is public unless its index entry sets "hidden": true. */
function isPublicProgram(program) {
  return !!program && program.hidden !== true;
}

/** Link to a program detail page; falls back to the list when the id is not a valid slug. */
function programHref(id) {
  return PROGRAM_ID_RE.test(id || '') ? `program.html?id=${id}` : 'programs.html';
}

/** Frontier programs first, then everything else, keeping the file order inside each group. */
function orderProgramsByTrack(programs) {
  const frontier = programs.filter(p => p.track === 'frontier');
  const rest = programs.filter(p => p.track !== 'frontier');
  return [...frontier, ...rest];
}

/* ---------------------------------------------------------------- sorting rules */

/** 0 for the most senior role, higher numbers for junior roles, 9 when unknown. */
function roleRank(role) {
  const text = String(role || '').toLowerCase();
  const index = ROLE_ORDER.findIndex(key => text.includes(key));
  return index === -1 ? 9 : index;
}

const isLead = member => Array.isArray(member.lead_of) && member.lead_of.length > 0;

/**
 * Members: degree first (PhD before Master), then program leads, then seniority (earlier
 * entry year, then earlier cohort), then name A-Z. entry_year is the ROC year the student joined.
 */
function sortMembers(members) {
  return members.slice().sort((a, b) =>
    roleRank(a.role) - roleRank(b.role) ||
    isLead(b) - isLead(a) ||
    (a.entry_year ?? 9999) - (b.entry_year ?? 9999) ||
    (a.cohort ?? 99) - (b.cohort ?? 99) ||
    String(a.name || '').localeCompare(String(b.name || '')));
}

/**
 * Publications: newest year first; inside a year by importance score (CORE A* 1.0, SJR Q1 1.2,
 * CORE A 1.3, Q2 2.0, CORE B 2.2, spreadsheet Q 2.5, nothing 3, domestic 4), award-winning
 * papers first, then title A–Z. score/tier are precomputed by tools/build_publications.py.
 */
function sortPublications(pubs) {
  const importance = p => (typeof p.score === 'number' ? p.score : (p.tier || 3));
  const awardFirst = p => (p.award ? 0 : 1);
  return pubs.slice().sort((a, b) =>
    (b.year || 0) - (a.year || 0) ||
    importance(a) - importance(b) ||
    awardFirst(a) - awardFirst(b) ||
    String(a.title || '').localeCompare(String(b.title || ''), 'en', { sensitivity: 'base' }));
}

/** Highlights: awards before papers, then newest first. */
function sortHighlights(items) {
  const awardFirst = h => (h.kind === 'award' ? 0 : 1);
  return items.slice().sort((a, b) =>
    awardFirst(a) - awardFirst(b) ||
    String(b.date || '').localeCompare(String(a.date || '')));
}

/* ---------------------------------------------------------------- tiny templates */

/** A pill link. External links open in a new tab. `zh` (optional) is the Chinese label. */
function pillLink(href, label, { external = true, className = '', zh = '' } = {}) {
  const target = external ? ' target="_blank" rel="noopener noreferrer"' : '';
  return `<a class="pill ${className}" href="${href}"${target}>${t(label, zh)}</a>`;
}

/** A badge chip. `zh` (optional) is the Chinese label. */
function badge(text, className = '', zh = '') {
  return `<span class="badge ${className}">${t(text, zh)}</span>`;
}

/** Year shown after a venue name, always in the same place and never inside the venue text. */
function yearLabel(year) {
  return year ? ` <span class="pub-year-label">· ${escapeHtml(String(year))}</span>` : '';
}
