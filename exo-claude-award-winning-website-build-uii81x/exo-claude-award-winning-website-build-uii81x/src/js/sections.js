/**
 * Renders the content sections from data.js.
 *
 * All of it could have been written by hand in index.html. It lives here so the
 * numbers on the page and the numbers in the source documents stay in one file
 * — if a spec changes, it changes once.
 */

import { AUDIENCE, CLAIMS, LANDSCAPE, MILESTONES, SAFETY, STEPS, TIMING } from './data.js';

const el = (tag, cls, html) => {
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (html != null) n.innerHTML = html;
  return n;
};

/* --- Hero stat strip ------------------------------------------------------ */

export function renderStats(root) {
  if (!root) return;
  for (const c of CLAIMS) {
    const wrap = el('div', 'hero__stat');
    wrap.appendChild(el('dt', 'num', `${c.figure}<span>${c.unit}</span>`));
    wrap.appendChild(el('dd', null, c.body));
    root.appendChild(wrap);
  }
}

/* --- Timing strip --------------------------------------------------------- */

export function renderTiming(root) {
  if (!root) return;
  const span = TIMING.window;
  const pct = (ms) => `${(ms / span) * 100}%`;

  const axis = el('div', 'tm-axis');
  for (let t = 0; t <= span; t += 50) {
    const tick = el('span', 'tm-axis__tick', `${t}<span aria-hidden="true"> ms</span>`);
    tick.style.left = pct(t);
    axis.appendChild(tick);
  }
  root.appendChild(axis);

  TIMING.rows.forEach((row, i) => {
    const wrap = el('div', `tm-row${row.active ? ' tm-row--active' : ''}`);
    wrap.appendChild(el('p', 'tm-row__label', row.label));

    const track = el('div', 'tm-row__track');
    const bar = el('span', 'tm-bar');
    bar.style.left = pct(row.start);
    bar.style.width = pct(row.end - row.start);
    bar.style.setProperty('--tm-delay', `${i * 130}ms`);
    bar.appendChild(el('span', 'tm-bar__value', `${row.start}–${row.end} ms`));
    track.appendChild(bar);
    wrap.appendChild(track);

    wrap.appendChild(el('p', 'tm-row__note', row.note));
    root.appendChild(wrap);
  });
}

/* --- Four steps ----------------------------------------------------------- */

export function renderSteps(root) {
  if (!root) return;
  for (const s of STEPS) {
    const li = el('li', 'step');
    li.dataset.reveal = '';
    li.appendChild(el('p', 'step__n num', s.n));
    li.appendChild(el('h3', 'step__title', s.title));
    li.appendChild(el('p', 'step__body', s.body));
    li.appendChild(el('p', 'step__meta', s.meta));
    root.appendChild(li);
  }
}

/* --- Safety layers -------------------------------------------------------- */

export function renderSafety(root) {
  if (!root) return;
  for (const [key, name, desc] of SAFETY) {
    const li = el('li', 'safety__item');
    li.appendChild(el('span', 'safety__key', `(${key})`));
    li.appendChild(el('span', 'safety__name', name));
    li.appendChild(el('span', 'safety__desc', desc));
    root.appendChild(li);
  }
}

/* --- Competitive landscape ------------------------------------------------ */

export function renderLandscape(table) {
  if (!table) return;
  const thead = el('thead');
  const hr = el('tr');
  hr.appendChild(el('th', null, 'Axis'));
  for (const c of LANDSCAPE.columns) {
    const th = el('th', null, c);
    th.scope = 'col';
    hr.appendChild(th);
  }
  thead.appendChild(hr);

  const tbody = el('tbody');
  for (const [axis, ...cells] of LANDSCAPE.rows) {
    const tr = el('tr');
    const th = el('th', null, axis);
    th.scope = 'row';
    tr.appendChild(th);
    for (const c of cells) tr.appendChild(el('td', null, c));
    tbody.appendChild(tr);
  }

  table.append(thead, tbody);
}

/* --- Timeline ------------------------------------------------------------- */

const STATE_TEXT = { done: 'Complete', active: 'In progress', next: 'Planned' };

export function renderTimeline(root) {
  if (!root) return [];
  const nodes = [];
  for (const m of MILESTONES) {
    const li = el('li', 'tl__item');
    li.dataset.state = m.state;
    li.appendChild(el('p', 'tl__tag', m.tag));
    li.appendChild(el('h3', 'tl__title', m.title));
    li.appendChild(el('p', 'tl__body', m.body));

    const facets = el('div', 'tl__facets');
    for (const f of m.facets) facets.appendChild(el('span', 'tl__facet', f));
    li.appendChild(facets);

    li.appendChild(el('p', 'tl__state', `<i aria-hidden="true"></i>${STATE_TEXT[m.state]}`));
    root.appendChild(li);
    nodes.push(li);
  }
  return nodes;
}

/**
 * Scroll-linked rail. The fill tracks how far the track has travelled through
 * the viewport; each node lights when the fill reaches it. Horizontal on wide
 * screens, vertical below 900px — the same maths drives both.
 */
export function bindTimelineScroll({ track, fill, items }) {
  if (!track || !fill || !items.length) return;
  const vertical = () => window.matchMedia('(max-width: 900px)').matches;
  let ticking = false;

  function update() {
    ticking = false;
    const r = track.getBoundingClientRect();
    const vh = window.innerHeight;
    const travel = r.height + vh * 0.55;
    const p = Math.max(0, Math.min(1, (vh * 0.82 - r.top) / travel));

    if (vertical()) fill.style.height = `${p * 100}%`;
    else fill.style.width = `${p * 100}%`;

    items.forEach((li, i) => {
      const at = items.length > 1 ? i / (items.length - 1) : 0;
      li.classList.toggle('is-reached', p >= at * 0.86);
    });
  }

  function onScroll() {
    if (ticking) return;
    ticking = true;
    requestAnimationFrame(update);
  }

  window.addEventListener('scroll', onScroll, { passive: true });
  window.addEventListener('resize', onScroll, { passive: true });
  update();
}

/* --- Audience band -------------------------------------------------------- */

export function renderAudience(root) {
  if (!root) return;
  AUDIENCE.forEach((line, i) => {
    const li = el('li');
    li.dataset.i = `Built for / ${String(i + 1).padStart(2, '0')}`;
    li.textContent = line;
    root.appendChild(li);
  });
}
