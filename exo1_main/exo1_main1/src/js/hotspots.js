/**
 * Hotspot system.
 *
 * Each entry in HOTSPOTS names a real node inside the glTF scene graph. On load
 * the node is resolved to a world-space bounding sphere, which gives both the
 * anchor point for its screen marker and the distance the camera needs in order
 * to frame it. Nothing is hard-coded to a coordinate: rename a part in CAD and
 * the marker follows it.
 */

import { Vector2 } from 'three';

// Room a label needs to its right before it would spill out of the render
// window: an expanded chip carries the part name, a resting one just a numeral.
const LABEL_WIDTH = { open: 300, closed: 90 };

export function initHotspots({ viewer, items, markersEl, listEl, readoutEl, bayLabelEl, resetEl }) {
  const live = [];
  let current = null;
  let swapTimer = 0;

  // --- Build the list and the markers -------------------------------------

  for (const item of items) {
    const descriptor = viewer.resolve(item.node, item.view);
    if (!descriptor) {
      // A renamed or removed part should quietly drop out, not break the page.
      console.warn(`[hotspots] node "${item.node}" not found in model; skipping ${item.ref}`);
      continue;
    }

    const li = document.createElement('li');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'part';
    btn.setAttribute('role', 'tab');
    btn.setAttribute('aria-selected', 'false');
    btn.id = `part-${item.ref}`;
    btn.innerHTML =
      `<span class="part__ref">${item.ref}</span>` +
      `<span class="part__name">${item.name}</span>` +
      `<span class="part__layer">${item.layer}</span>`;
    li.appendChild(btn);
    listEl.appendChild(li);

    const marker = document.createElement('button');
    marker.type = 'button';
    marker.className = 'hs';
    marker.setAttribute('aria-label', `${item.ref} — ${item.name}`);
    marker.innerHTML =
      '<span class="hs__ring" aria-hidden="true"></span>' +
      '<span class="hs__core" aria-hidden="true"></span>' +
      `<span class="hs__label" aria-hidden="true"><b>${item.ref}</b><i>${item.name}</i></span>`;
    markersEl.appendChild(marker);

    const record = { item, descriptor, btn, marker, screen: new Vector2(), visible: false };
    live.push(record);

    btn.addEventListener('click', () => toggle(record));
    marker.addEventListener('click', () => toggle(record));
    btn.addEventListener('keydown', (e) => onListKey(e, record));
  }

  // --- Selection ----------------------------------------------------------

  function toggle(record) {
    if (current === record) deselect();
    else select(record);
  }

  function select(record) {
    current = record;
    viewer.focusOn(record.descriptor);

    for (const r of live) {
      const on = r === record;
      r.btn.setAttribute('aria-selected', on ? 'true' : 'false');
      r.marker.classList.toggle('is-active', on);
      r.marker.classList.toggle('is-dimmed', !on);
    }

    bayLabelEl.textContent = `${record.item.ref} · ${record.item.name}`;
    resetEl.hidden = false;
    writeReadout(record.item);
  }

  function deselect() {
    current = null;
    viewer.clearFocus();
    for (const r of live) {
      r.btn.setAttribute('aria-selected', 'false');
      r.marker.classList.remove('is-active', 'is-dimmed');
    }
    bayLabelEl.textContent = 'Full assembly';
    resetEl.hidden = true;
    writeReadout(null);
  }

  /** Roving arrow-key navigation across the parts list. */
  function onListKey(e, record) {
    const keys = { ArrowDown: 1, ArrowRight: 1, ArrowUp: -1, ArrowLeft: -1 };
    if (!(e.key in keys)) return;
    e.preventDefault();
    const i = live.indexOf(record);
    const next = live[(i + keys[e.key] + live.length) % live.length];
    next.btn.focus();
    select(next);
  }

  // --- Readout ------------------------------------------------------------

  const EMPTY = `
    <div class="readout__head">
      <p class="tag">No part selected</p>
    </div>
    <p class="readout__body">
      Six markers sit on the assembly. Select one in the list or on the model to
      focus the camera on that part and read what it does.
    </p>`;

  function writeReadout(item) {
    readoutEl.classList.add('is-swapping');
    clearTimeout(swapTimer);
    swapTimer = setTimeout(() => {
      if (!item) {
        readoutEl.innerHTML = EMPTY;
        readoutEl.removeAttribute('aria-labelledby');
      } else {
        readoutEl.setAttribute('aria-labelledby', `part-${item.ref}`);
        readoutEl.innerHTML = `
          <div class="readout__head">
            <div>
              <p class="tag tag--acc">${item.layer}</p>
              <p class="readout__name">${item.name}</p>
            </div>
            <p class="readout__ref num">${item.ref}</p>
          </div>
          <p class="readout__body">${item.lede}</p>
          <dl class="readout__specs">
            ${item.specs
              .map(([k, v]) => `<div class="readout__spec"><dt>${k}</dt><dd>${v}</dd></div>`)
              .join('')}
          </dl>`;
      }
      readoutEl.classList.remove('is-swapping');
    }, 180);
  }

  readoutEl.setAttribute('role', 'tabpanel');
  readoutEl.innerHTML = EMPTY;

  resetEl.addEventListener('click', deselect);
  viewer.onBackgroundClick = () => { if (current) deselect(); };

  // --- Per-frame projection ------------------------------------------------

  viewer.onFrame((frame) => {
    const bay = viewer.bayRect;
    for (const r of live) {
      const inFront = viewer.project(r.descriptor.center, r.screen);
      // A marker only means anything over the render window. The dot may sit a
      // little outside so its ring still reads at the frame edge, but a part
      // that has left the bay entirely loses its marker with it.
      const onScreen = inFront && Boolean(bay) &&
        r.screen.x > bay.left - 14 && r.screen.x < bay.left + bay.w + 14 &&
        r.screen.y > bay.top - 14 && r.screen.y < bay.top + bay.h + 14;

      if (onScreen !== r.visible) {
        r.visible = onScreen;
        r.marker.style.display = onScreen ? '' : 'none';
      }
      if (!onScreen) continue;

      r.marker.style.transform = `translate3d(${r.screen.x.toFixed(1)}px, ${r.screen.y.toFixed(1)}px, 0)`;
      const need = r === current ? LABEL_WIDTH.open : LABEL_WIDTH.closed;
      r.marker.classList.toggle('is-flipped', r.screen.x + need > bay.left + bay.w);


      // Raycasting every marker every frame is wasteful; a third of the rate is
      // well inside the eye's tolerance for a dot fading behind a housing.
      if (frame % 3 === 0) {
        r.marker.classList.toggle('is-occluded', viewer.isOccluded(r.descriptor.center));
      }
    }
  });

  return { select, deselect, get current() { return current; }, count: live.length };
}
