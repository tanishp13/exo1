/**
 * Entry point. Renders content, wires behaviour, then brings up the viewer.
 *
 * The page is fully readable before any of this runs and stays usable if WebGL
 * is unavailable — the 3D layer is an inspection tool for the assembly, not the
 * carrier of the argument.
 */

// Stylesheets are linked from index.html so they stay render-blocking and the
// page never flashes unstyled while the module graph loads.

import { HOTSPOTS } from './data.js';
import {
  bindTimelineScroll,
  renderAudience,
  renderLandscape,
  renderSafety,
  renderStats,
  renderSteps,
  renderTiming,
  renderTimeline,
} from './sections.js';
import { initNav } from './nav.js';
import { initReveal, revealOnce } from './reveal.js';
import { initForm } from './form.js';
import { createViewer } from './viewer.js';
import { initHotspots } from './hotspots.js';

const $ = (sel) => document.querySelector(sel);

/* ── Content ──────────────────────────────────────────────────────────────── */

renderStats($('#hero-stats'));
renderAudience($('#audience'));
renderTiming($('#timing-plot'));
renderSteps($('#steps'));
renderSafety($('#safety-list'));
renderLandscape($('#landscape-table'));

const milestones = renderTimeline($('#tl-items'));
bindTimelineScroll({ track: $('#tl-track'), fill: $('#tl-fill'), items: milestones });

/* ── Behaviour ────────────────────────────────────────────────────────────── */

initNav({ nav: $('#nav'), toggle: $('#nav-toggle'), links: $('#nav-links') });
initForm($('#join-form'));
initReveal();
revealOnce($('#timing'), 'is-in', 0.18);
for (const step of document.querySelectorAll('.step')) revealOnce(step, 'is-in', 0.4);

/* ── Viewer ───────────────────────────────────────────────────────────────── */

const stage = $('#stage');
const markers = $('#markers');
const statusEl = $('#gl-status');
const progressEl = $('#gl-progress');
const labelEl = $('#gl-label');

function disableStage(message) {
  stage.classList.remove('is-live');
  markers.classList.remove('is-live');
  if (message) {
    statusEl.hidden = false;
    labelEl.textContent = message;
    progressEl.style.width = '100%';
  }
}

const viewer = createViewer({
  canvas: $('#gl'),
  dragSurface: document.querySelector('.bay--live'),

  onProgress(ratio) {
    if (ratio == null) {
      labelEl.textContent = 'Loading assembly';
      return;
    }
    progressEl.style.width = `${Math.round(ratio * 100)}%`;
    labelEl.textContent = `Loading assembly · ${Math.round(ratio * 100)}%`;
  },

  onReady(api) {
    statusEl.hidden = true;

    initHotspots({
      viewer: api,
      items: HOTSPOTS,
      markersEl: markers,
      listEl: $('#parts-list'),
      readoutEl: $('#readout'),
      bayLabelEl: $('#bay-target'),
      resetEl: $('#bay-reset'),
    });

    // Only render while a bay is actually on screen. Below the explorer the loop
    // stops outright rather than burning frames behind opaque sections.
    const bays = [...document.querySelectorAll('[data-model-bay]')];
    const explorerBay = document.querySelector('[data-model-bay="explorer"]');
    const onScreen = new Set();

    const io = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) onScreen.add(entry.target);
          else onScreen.delete(entry.target);

          // Markers belong to the explorer alone, and only once enough of its
          // bay is showing to aim at. Any looser and the dots drift over the
          // opaque sections below, where there is no model behind them.
          if (entry.target === explorerBay) {
            markers.classList.toggle(
              'is-live',
              entry.isIntersecting && entry.intersectionRatio > 0.45,
            );
          }
        }

        const live = onScreen.size > 0;
        api.setVisible(live);
        stage.classList.toggle('is-live', live);
        if (!live) api.stop();
      },
      { rootMargin: '10% 0px 10% 0px', threshold: [0, 0.2, 0.45, 0.7, 1] },
    );

    for (const bay of bays) io.observe(bay);
    api.refreshBays();
  },

  onError(err) {
    console.error('[viewer]', err);
    disableStage('3D view unavailable the written specification below is unaffected.');
  },
});

if (!viewer) disableStage('WebGL unavailable the written specification below is unaffected.');

// Pausing on a hidden tab keeps the GPU quiet when nobody is looking.
document.addEventListener('visibilitychange', () => {
  if (!viewer) return;
  if (document.hidden) viewer.stop();
  else viewer.start();
});
