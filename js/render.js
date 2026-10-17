/**
 * AIMLab site — render functions for the shared data sections.
 *
 * Each function takes already-loaded JSON data and a container element and writes HTML.
 * They do not fetch anything; main.js and program.js decide what to load.
 * Depends on js/lib.js (escaping, placeholders, sorting, small templates).
 *
 * Sections: news · highlights · people (PI, members, alumni) · publications · programs.
 */
'use strict';

/* ================================================================ News */

/**
 * News feed. Items: { date: "YYYY-MM-DD" | "YYYY-MM", text, links?: { paper, code, project, program } }.
 * The home container (data-limit="5") shows the newest five; news.html shows everything grouped by year.
 * The day in "date" only orders items; the page shows month and year.
 */
const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
/** Every item shows month and year ("Jul 2026" / "2026 年 7 月"), whether or not the day is known. */
function newsDate(date) {
  const [y, m] = String(date || '').split('-');
  if (!y) return '';
  return m ? t(`${MONTHS[+m - 1]} ${y}`, `${y} 年 ${+m} 月`) : t(y, `${y} 年`);
}
function newsItem(item) {
  const links = item.links || {};
  const pills = [
    links.paper ? pillLink(safeUrl(links.paper), 'Paper', { zh: '論文' }) : '',
    links.code ? pillLink(safeUrl(links.code), 'Code', { zh: '程式碼' }) : '',
    links.project ? pillLink(safeUrl(links.project), 'Project', { zh: '專案' }) : '',
    links.site ? pillLink(safeUrl(links.site), 'Official site', { zh: '官方網站' }) : '',
    PROGRAM_ID_RE.test(links.program || '') ? pillLink(programHref(links.program), 'Program', { external: false, zh: '計畫' }) : ''
  ].filter(Boolean).join('');
  return `
    <div class="news-item">
      <span class="news-date">${newsDate(item.date)}</span>
      <span class="news-text">${t(item.text || '', item.text_zh)}${pills ? `<span class="news-links">${pills}</span>` : ''}</span>
    </div>`;
}
function renderNews(items, el) {
  if (!el) return;
  const sorted = (Array.isArray(items) ? items : []).slice().sort((a, b) => String(b.date || '').localeCompare(String(a.date || '')));
  const limit = parseInt(el.dataset.limit || '0', 10);
  if (limit) {
    el.innerHTML = sorted.slice(0, limit).map(newsItem).join('');
    return;
  }
  const years = [...new Set(sorted.map(n => String(n.date || '').slice(0, 4) || 'Other'))];
  el.innerHTML = years.map(year => `
    <section class="news-year">
      <h3 class="pub-year-title">${escapeHtml(year)}<span class="pub-year-count">${sorted.filter(n => String(n.date || '').startsWith(year)).length}</span></h3>
      ${sorted.filter(n => String(n.date || '').startsWith(year)).map(newsItem).join('')}
    </section>`).join('');
}

/* ================================================================ Highlights */

const HIGHLIGHT_ICONS = {
  award: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 2h8l1 6-5 3-5-3 1-6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><circle cx="12" cy="16" r="5" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M12 13.2l.9 1.9 2.1.3-1.5 1.5.4 2.1-1.9-1-1.9 1 .4-2.1-1.5-1.5 2.1-.3z" fill="currentColor"/></svg>',
  paper: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 3h8l4 4v14H6z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/><path d="M14 3v4h4M9 11h6M9 14.5h6M9 18h4" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
  talk:  '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"/></svg>'
};

/**
 * Spotlight cards (awards, accepted papers). On the home page every item is shown and
 * links to its program; on a program page pass { program: id } to filter. A card with its own
 * "link" (a results page, a paper) opens that in a new tab instead.
 * The surrounding <section> is hidden when there is nothing to show.
 */
function renderHighlights(items, el, { program = '' } = {}) {
  if (!el) return;
  let list = Array.isArray(items) ? items : [];
  if (program) list = list.filter(h => h.program === program);
  list = sortHighlights(list);

  const section = el.closest('section');
  if (section) section.hidden = !list.length;

  el.innerHTML = list.map(h => {
    const kind = HIGHLIGHT_ICONS[h.kind] ? h.kind : 'paper';
    const tone = h.tone === 'silver' ? ' hl-card--silver' : '';        // 2nd place and the like: silver, never gold
    const body = `
      <div class="hl-icon hl-icon--${kind}">${HIGHLIGHT_ICONS[kind]}</div>
      <div class="hl-body">
        <div class="hl-kicker">${t(h.kicker || '', h.kicker_zh)}</div>
        <h3 class="hl-title">${t(h.title || '', h.title_zh)}</h3>
        ${h.detail ? `<p class="hl-detail">${t(h.detail, h.detail_zh)}</p>` : ''}
        ${h.who ? `<div class="hl-who">${escapeHtml(h.who)}</div>` : ''}
      </div>`;
    if (isFilled(h.link)) {
      return `<a class="hl-card hl-card--${kind}${tone}" href="${safeUrl(h.link)}" target="_blank" rel="noopener noreferrer">${body}</a>`;
    }
    const linkToProgram = !program && PROGRAM_ID_RE.test(h.program || '');
    return linkToProgram
      ? `<a class="hl-card hl-card--${kind}${tone}" href="${programHref(h.program)}">${body}</a>`
      : `<div class="hl-card hl-card--${kind}${tone}">${body}</div>`;
  }).join('');
}

/* ================================================================ People */

/** The whole People page: PI card, member grid with filters, alumni table. */
function renderPeople(data, ui) {
  if (!data) return;
  if (ui.pi && data.pi) renderPrincipalInvestigator(data.pi, ui.pi);
  if (ui.members && Array.isArray(data.members)) {
    const members = sortMembers(data.members);
    renderMembers(members, ui.members);
    initMemberFilters(members, ui.members, document.getElementById('member-filter'));
  }
  if (ui.alumni && Array.isArray(data.alumni)) renderAlumni(data.alumni, ui.alumni);
}

function renderPrincipalInvestigator(pi, el) {
  const links = pi.links || {};
  const email = (pi.email || '').replace('[at]', '@').replace(' ', '');
  const expertise = Array.isArray(pi.expertise) ? pi.expertise : [];
  const profileLinks = [
    ['nycu_scholar', 'NYCU Scholar'],
    ['ibe_profile', 'IBE Profile'],
    ['department_profile', 'Department'],
    ['orcid', 'ORCID']
  ].filter(([key]) => links[key]).map(([key, label]) => pillLink(safeUrl(links[key]), label, { zh: { nycu_scholar: '陽明交大學術網', ibe_profile: '所網頁', department_profile: '系網頁', orcid: 'ORCID' }[key] }));
  const expertiseZh = Array.isArray(pi.expertise_zh) ? pi.expertise_zh : [];
  const awards = (Array.isArray(pi.awards) ? pi.awards : []).filter(a => a && isFilled(a.title));

  el.innerHTML = `
    <div class="pi-profile-centered">
      <img src="${escapeAttr(pi.photo || 'assets/img/avatar.svg')}" alt="${escapeAttr(pi.name || 'PI')}" draggable="false">
      <div class="pi-name">${escapeHtml(pi.name || '')} <span class="pi-name-zh">${escapeHtml(pi.name_zh || '')}</span></div>
      <div class="pi-title">${t(pi.title || '', pi.title_zh || roleZh(pi.title))}</div>
      <div class="pi-affil">${t(pi.group || '', pi.group_zh)}<br>${t(pi.affiliation || '', pi.affiliation_zh)}</div>
      <div class="pi-contact">
        ${pi.office ? `<div class="contact-chip"><span class="k">${t('Office', '辦公室')}</span> ${t(pi.office, pi.office_zh)}</div>` : ''}
        ${pi.phone ? `<div class="contact-chip"><span class="k">${t('Phone', '電話')}</span> ${escapeHtml(pi.phone)}</div>` : ''}
        ${pi.email ? `<div class="contact-chip"><span class="k">Email</span> <a class="contact-link" href="mailto:${escapeAttr(email)}">${escapeHtml(pi.email)}</a></div>` : ''}
      </div>
      <div class="pi-links">${profileLinks.join('')}</div>
      ${expertise.length ? `
        <div class="pi-expertise">
          <h4>${t('Research Expertise', '研究專長')}</h4>
          <ul>${expertise.map((x, i) => `<li>${t(x, expertiseZh[i])}</li>`).join('')}</ul>
        </div>` : ''}
      ${awards.length ? `
        <div class="pi-expertise pi-awards">
          <h4>${t('Awards', '獲獎')}</h4>
          <ul class="pi-award-list">${awards.map(piAward).join('')}</ul>
        </div>` : ''}
    </div>`;
}

/**
 * One PI award row: year | award name + category, project and what she did | role.
 * people.json pi.awards: [{ year, title, title_zh, category, category_zh, project, project_zh, role, note, note_zh, link }]
 */
function piAward(a) {
  const detail = [isFilled(a.project) ? t(a.project, a.project_zh) : '', isFilled(a.note) ? t(a.note, a.note_zh) : ''].filter(Boolean).join(' · ');
  return `
    <li class="pi-award">
      <span class="pi-award-year">${escapeHtml(String(a.year || ''))}</span>
      <div class="pi-award-body">
        <div class="pi-award-title">${isFilled(a.link) ? `<a href="${safeUrl(a.link)}" target="_blank" rel="noopener noreferrer">${t(a.title, a.title_zh)}</a>` : t(a.title, a.title_zh)}${isFilled(a.category) ? ` <span class="pi-award-cat">${t(a.category, a.category_zh)}</span>` : ''}</div>
        ${detail ? `<div class="pi-award-detail">${detail}</div>` : ''}
      </div>
      ${isFilled(a.role) ? `<span class="pi-award-role">${escapeHtml(a.role)}</span>` : ''}
    </li>`;
}

/**
 * A paper's award labels. A challenge ranking is the challenge name (neutral) then one gold label per
 * result: [RFMiD Challenge] [總成績世界第四] [任務四世界第三]. A named award is one gold label.
 * award_link (optional) makes the challenge name, or the named award, link to its page.
 */
function publicationAward(pub) {
  const href = isFilled(pub.award_link) ? safeUrl(pub.award_link) : '';
  const label = (cls, inner) => href
    ? `<a class="${cls}" href="${href}" target="_blank" rel="noopener noreferrer">${inner}</a>`
    : `<span class="${cls}">${inner}</span>`;
  const results = Array.isArray(pub.award_results) ? pub.award_results : [];
  if (isFilled(pub.award_challenge) && results.length) {
    const zh = Array.isArray(pub.award_results_zh) ? pub.award_results_zh : [];
    return `<span class="pub-awards">${label('pub-award pub-award--challenge', escapeHtml(pub.award_challenge))}${results.map((r, i) => `<span class="pub-award">${t(r, zh[i])}</span>`).join('')}</span>`;
  }
  return pub.award ? `<span class="pub-awards">${label('pub-award', t(pub.award, pub.award_zh))}</span>` : '';
}

/** Group badges ("rPPG", "MLLM"); the groups a member leads are green with "· Lead". */
function memberBadges(member) {
  const groups = Array.isArray(member.groups) ? member.groups : [];
  const leads = Array.isArray(member.lead_of) ? member.lead_of : [];
  const interests = Array.isArray(member.interests) ? member.interests.filter(isFilled) : [];
  // color by group (Frontier AI stays light blue), plus badge--lead for the light ring on any lead badge
  const style = g => [g === 'Frontier AI' ? 'frontier' : (leads.includes(g) ? 'green' : ''), leads.includes(g) ? 'badge--lead' : ''].filter(Boolean).join(' ');
  return [
    ...groups.map(g => badge(leads.includes(g) ? `${g} · Lead` : g, style(g), leads.includes(g) ? `${g} · 負責人` : '')),
    ...interests.map(i => badge(i))
  ].join('');
}

/** Email / GitHub / Scholar links for a member or team card. */
function memberLinks(links = {}) {
  const items = [
    isFilled(links.email) ? `<a href="mailto:${escapeAttr(links.email)}" title="Email" rel="noopener noreferrer">✉</a>` : '',
    isFilled(links.github) ? `<a href="${safeUrl(links.github)}" title="GitHub" target="_blank" rel="noopener noreferrer">GitHub</a>` : '',
    isFilled(links.scholar) ? `<a href="${safeUrl(links.scholar)}" title="Scholar" target="_blank" rel="noopener noreferrer">Scholar</a>` : ''
  ].filter(Boolean);
  return items.length ? `<div class="member-links">${items.join('')}</div>` : '';
}

/**
 * One member card, the same everywhere a person appears (People page, program Team sections):
 * gold card for postdocs and PhD students, light ring for program leads, group badges, links.
 */
function memberCard(m) {
  const groups = Array.isArray(m.groups) ? m.groups : [];
  const badges = memberBadges(m);
  const tier = (roleRank(m.role) <= 1 ? ' member-card--senior' : '') +                      // postdoc / PhD: gold card
    ((Array.isArray(m.lead_of) && m.lead_of.length) ? ' member-card--lead' : '');              // program lead: blue-green ring
  return `
    <div class="member-card${tier}" data-role="${escapeAttr(m.role || '')}" data-groups="${escapeAttr(groups.join('|'))}">
      <img src="${escapeAttr(m.photo || 'assets/img/avatar.svg')}" alt="${escapeAttr(m.name || 'Member')}" draggable="false">
      <span class="person-name">${escapeHtml(m.name || '')}</span>
      <div class="person-role">${t(m.role || '', roleZh(m.role))}</div>
      ${badges ? `<div class="member-interests">${badges}</div>` : ''}
      ${memberLinks(m.links)}
    </div>`;
}

function renderMembers(members, el) {
  el.innerHTML = members.map(memberCard).join('');
}

/**
 * Two filter rows (Role, Group) above the member grid. Both filters apply at once.
 * The Role row only appears when there is more than one role; the Group row only when
 * at least one member has a group.
 */
function initMemberFilters(members, gridEl, filterEl) {
  if (!filterEl) return;
  const roleCounts = {};
  const groupCounts = {};
  members.forEach(m => {
    if (isFilled(m.role)) roleCounts[m.role] = (roleCounts[m.role] || 0) + 1;
    (Array.isArray(m.groups) ? m.groups : []).forEach(g => { groupCounts[g] = (groupCounts[g] || 0) + 1; });
  });
  const roles = Object.keys(roleCounts).sort((a, b) => roleRank(a) - roleRank(b));
  const GROUP_ORDER = ['Frontier AI', 'rPPG', 'MLLM', 'CAG'];   // track, then programs, then other groups A–Z
  const groupPos = g => (GROUP_ORDER.includes(g) ? GROUP_ORDER.indexOf(g) : GROUP_ORDER.length);
  const groups = Object.keys(groupCounts).sort((a, b) => groupPos(a) - groupPos(b) || a.localeCompare(b));

  const row = (key, label, keys, counts) => `
    <div class="filter-row" data-key="${key}">
      <span class="filter-label">${label}</span>
      <button class="filter-btn active" data-filter="all">${t('All', '全部')} <span class="filter-count">${members.length}</span></button>
      ${keys.map(k => `<button class="filter-btn" data-filter="${escapeAttr(k)}">${key === 'role' ? t(k, roleZh(k)) : escapeHtml(k)} <span class="filter-count">${counts[k]}</span></button>`).join('')}
    </div>`;
  filterEl.innerHTML =
    (roles.length > 1 ? row('role', t('Role', '身分'), roles, roleCounts) : '') +
    (groups.length ? row('group', t('Group', '群組'), groups, groupCounts) : '');

  const state = { role: 'all', group: 'all' };
  const applyFilters = () => {
    gridEl.querySelectorAll('.member-card').forEach(card => {
      const roleOk = state.role === 'all' || card.dataset.role === state.role;
      const groupOk = state.group === 'all' || (card.dataset.groups || '').split('|').includes(state.group);
      card.hidden = !(roleOk && groupOk);
    });
  };
  filterEl.addEventListener('click', event => {
    const button = event.target.closest('.filter-btn');
    if (!button) return;
    const rowEl = button.closest('.filter-row');
    rowEl.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    state[rowEl.dataset.key] = button.dataset.filter;
    applyFilters();
  });
}

/** Alumni table, newest graduation year first; blank cells show a dash. */
function renderAlumni(alumni, el) {
  const dash = v => escapeHtml(v || '—');
  const sorted = alumni.slice().sort((a, b) => (Number(b.year) || 0) - (Number(a.year) || 0));
  el.innerHTML = sorted.map(a => `
    <tr>
      <td class="alumni-year">${dash(a.year)}</td>
      <td class="alumni-name">${dash(a.name)}</td>
      <td>${a.degree ? t(a.degree, roleZh(a.degree)) : '—'}</td>
      <td>${a.current ? t(a.current, a.current_zh) : '—'}</td>
    </tr>`).join('');
}

/* ================================================================ Publications */

/** One delegated handler: a Cite button copies its BibTeX and confirms inline. */
document.addEventListener('click', async event => {
  const button = event.target.closest('.pub-cite');
  if (!button) return;
  event.preventDefault();
  const text = button.dataset.bibtex || '';
  try {
    await navigator.clipboard.writeText(text);
    const label = button.innerHTML;
    button.innerHTML = t('Copied ✓', '已複製 ✓');
    button.classList.add('is-done');
    setTimeout(() => { button.innerHTML = label; button.classList.remove('is-done'); }, 1600);
  } catch (error) {
    window.prompt('Copy the BibTeX entry:', text);    // clipboard blocked: fall back to a selectable prompt
  }
});


/** One publication card. The title links to the DOI when there is one. */
function publicationItem(pub) {
  const links = pub.links || {};
  const title = escapeHtml(pub.title || '');
  const pills = [
    links.doi ? pillLink(safeUrl(links.doi), 'DOI') : '',
    pub.bibtex ? `<button type="button" class="pill pub-cite" data-bibtex="${escapeAttr(pub.bibtex)}" aria-label="Copy BibTeX">${t('Cite', '引用')}</button>` : '',
    links.pdf ? pillLink(safeUrl(links.pdf), 'PDF') : '',
    links.code ? pillLink(safeUrl(links.code), 'Code') : '',
    links.project ? pillLink(safeUrl(links.project), 'Project') : ''
  ].filter(Boolean).join('');
  return `
    <div class="pub-item" data-type="${escapeAttr(pub.type || '')}" data-award="${pub.award ? '1' : '0'}">
      <div class="pub-head">
        ${links.doi ? `<a class="pub-title" href="${safeUrl(links.doi)}" target="_blank" rel="noopener noreferrer">${title}</a>` : `<span class="pub-title">${title}</span>`}
        ${publicationAward(pub)}
      </div>
      <div class="pub-authors">${escapeHtml(pub.authors || '')}</div>
      <div class="pub-venue">
        ${pub.type ? `<span class="pub-type">${t(pub.type, { journal: '期刊', conference: '會議' }[pub.type])}</span> ` : ''}${escapeHtml(pub.venue || '')}${yearLabel(pub.year)}${pub.impact ? ` <span class="pub-impact">${escapeHtml(pub.impact)}</span>` : ''}
      </div>
      ${pills ? `<div class="pub-links">${pills}</div>` : ''}
    </div>`;
}

/**
 * Publications list (publications.html): every entry, grouped by year, under a toolbar with a
 * type filter (All / Journal / Conference / Awarded) and year links that jump down the page.
 * Filtering hides items; a year with nothing left hides with its link.
 */
function renderPublications(pubs, el) {
  if (!el) return;
  const sorted = sortPublications(Array.isArray(pubs) ? pubs : []);
  const years = [...new Set(sorted.map(p => p.year || 'Other'))];
  const count = test => sorted.filter(test).length;
  const filters = [
    ['all', t('All', '全部'), () => true],
    ['journal', t('Journal', '期刊'), p => p.type === 'journal'],
    ['conference', t('Conference', '會議'), p => p.type === 'conference'],
    ['award', t('Awarded', '得獎'), p => !!p.award]
  ].filter(([key, , test]) => key === 'all' || count(test) > 0);

  el.innerHTML = `
    <div class="pub-toolbar">
      <div class="filter-row" data-key="type">
        <span class="filter-label">${t('Type', '類型')}</span>
        ${filters.map(([key, label, test]) => `<button type="button" class="filter-btn${key === 'all' ? ' active' : ''}" data-filter="${key}">${label} <span class="filter-count">${count(test)}</span></button>`).join('')}
      </div>
      <div class="filter-row" data-key="year">
        <span class="filter-label">${t('Year', '年份')}</span>
        ${years.map(year => `<a class="filter-btn" href="#pub-${escapeAttr(String(year))}" data-year="${escapeAttr(String(year))}">${escapeHtml(String(year))}</a>`).join('')}
      </div>
    </div>
    ${years.map(year => {
      const ofYear = sorted.filter(p => (p.year || 'Other') === year);
      return `
      <section class="pub-year" id="pub-${escapeAttr(String(year))}" data-year="${escapeAttr(String(year))}">
        <h3 class="pub-year-title">${escapeHtml(String(year))}<span class="pub-year-count">${ofYear.length}</span></h3>
        <div class="pub-list">${ofYear.map(publicationItem).join('')}</div>
      </section>`;
    }).join('')}`;

  const typeRow = el.querySelector('.filter-row[data-key="type"]');
  typeRow.addEventListener('click', event => {
    const button = event.target.closest('.filter-btn');
    if (!button) return;
    typeRow.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    button.classList.add('active');
    const key = button.dataset.filter;
    const keep = item => key === 'all' || (key === 'award' ? item.dataset.award === '1' : item.dataset.type === key);
    el.querySelectorAll('.pub-item').forEach(item => { item.hidden = !keep(item); });
    el.querySelectorAll('.pub-year').forEach(section => {
      const shown = [...section.querySelectorAll('.pub-item')].filter(item => !item.hidden).length;
      section.hidden = shown === 0;
      section.querySelector('.pub-year-count').textContent = String(shown);
      const link = el.querySelector(`.filter-row[data-key="year"] [data-year="${section.dataset.year}"]`);
      if (link) link.hidden = shown === 0;
    });
  });
}

/* ================================================================ Programs */

/** Cover kinds drawn live on a canvas instead of a still image (see mountLiveCovers). */
const LIVE_COVERS = ['rppg', 'mllm'];

/** One program card; shared by the home page, programs.html and Related Programs. */
function renderProgramCard(program) {
  const tags = Array.isArray(program.tags) ? program.tags : [];
  const lead = isFilled(program.lead) ? program.lead : '';
  const track = program.track === 'frontier' ? 'frontier' : 'clinical';
  return `
    <a class="card pg-card" href="${programHref(program.id)}" data-track="${track}">
      <div class="pg-card-cover">
        ${LIVE_COVERS.includes(program.live)
          ? `<canvas class="pg-card-live" data-live="${program.live}" aria-hidden="true"></canvas>`
          : `<img src="${escapeAttr(program.img || 'assets/img/placeholder_project.svg')}" alt="" loading="lazy" draggable="false" onerror="this.remove()">${
              program.pulse_layer ? `<img class="pg-card-pulse" src="${escapeAttr(program.pulse_layer)}" alt="" aria-hidden="true" draggable="false" onerror="this.remove()">` : ''}`}
      </div>
      <div class="card-content">
        <span class="pg-card-track">${TRACK_LABEL[track]}</span>
        <h3>${t(program.title || '', program.title_zh)}${program.title_zh ? ` <span class="pg-card-zh">${t(program.title_zh, program.title)}</span>` : ''}</h3>
        <p>${t(program.tagline || '', program.tagline_zh)}</p>
        ${tags.length ? `<div class="pg-card-tags">${tags.map(t => badge(t)).join('')}</div>` : ''}
        <div class="pg-card-foot">
          ${lead ? `<span class="pg-card-lead">${t(`Lead · ${lead}`, `負責人 · ${lead}`)}</span>` : '<span></span>'}
          <span class="pg-card-cta">${t('View program →', '查看計畫 →')}</span>
        </div>
      </div>
    </a>`;
}

/**
 * Program grids. ui.programs = home page (featured only); ui.programsAll = programs.html
 * (every public program, frontier first, with the intro sentence and legend kept in sync).
 */
function renderPrograms(programs, ui) {
  const visible = (Array.isArray(programs) ? programs : []).filter(isPublicProgram);
  const done = () => mountLiveCovers();

  if (ui.programs) {
    const featured = visible.filter(p => p.featured);
    ui.programs.innerHTML = (featured.length ? featured : visible).map(renderProgramCard).join('');
  }

  if (ui.programsAll) {
    const ordered = orderProgramsByTrack(visible);
    ui.programsAll.innerHTML = ordered.map(renderProgramCard).join('');
    syncProgramsIntro(ordered);
  }
  done();
}

/**
 * Program cards can carry a live illustration instead of a cover image ("live" in programs.json):
 *   "rppg" -> js/rppg-visuals.js (+ js/face-mesh-data.js): face mesh and sweeping pulse, dark.
 *   "mllm" -> js/mllm-visuals.js: inputs, network, emotion plane and typed reply, all drawn live.
 * The matching module must be loaded on the page; otherwise the canvas stays blank on its background.
 */
function mountLiveCovers(root = document) {
  const modules = { rppg: window.AIM_RPPG_VISUALS, mllm: window.AIM_MLLM_VISUALS };
  root.querySelectorAll('canvas.pg-card-live:not([data-mounted])').forEach(cv => {
    cv.dataset.mounted = '1';
    const module = modules[cv.dataset.live];
    if (module) module.mountCanvas(cv);
  });
}

/** programs.html: the count sentence and the track legend follow the visible programs. */
function syncProgramsIntro(programs) {
  const tracks = new Set(programs.map(p => (p.track === 'frontier' ? 'frontier' : 'clinical')));
  const words = ['', 'One program', 'Two programs', 'Three programs', 'Four programs', 'Five programs', 'Six programs'];
  const zhNum = ['', '一', '二', '三', '四', '五', '六'];
  const count = document.getElementById('pg-count');
  if (count) {
    const howMany = words[programs.length] || `${programs.length} programs`;
    const n = zhNum[programs.length] || String(programs.length);
    count.innerHTML = t(`${howMany} on ${tracks.size === 2 ? 'two tracks' : 'one track'}.`, `${n}個計畫，${tracks.size === 2 ? '分屬兩條軸線' : '同一條軸線'}。`);
  }
  document.querySelectorAll('[data-track-desc], .pg-legend-item').forEach(el => {
    const track = el.dataset.trackDesc || (el.classList.contains('pg-legend-item--clinical') ? 'clinical' : 'frontier');
    el.hidden = !tracks.has(track);
  });
}
