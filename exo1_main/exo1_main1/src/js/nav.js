/** Header behaviour: sticky treatment, mobile disclosure, current-section link. */

export function initNav({ nav, toggle, links }) {
  const anchors = [...links.querySelectorAll('a[data-navlink]')];

  // --- Sticky background --------------------------------------------------
  const sentinel = document.createElement('div');
  sentinel.style.cssText = 'position:absolute;top:0;height:1px;width:1px;';
  document.body.prepend(sentinel);

  new IntersectionObserver(
    ([entry]) => nav.classList.toggle('is-stuck', !entry.isIntersecting),
    { threshold: 0 },
  ).observe(sentinel);

  // --- Mobile disclosure --------------------------------------------------
  function setOpen(open) {
    toggle.setAttribute('aria-expanded', String(open));
    links.classList.toggle('is-open', open);
    document.body.classList.toggle('is-locked', open);
  }

  toggle.addEventListener('click', () => {
    setOpen(toggle.getAttribute('aria-expanded') !== 'true');
  });

  links.addEventListener('click', (e) => {
    if (e.target.closest('a')) setOpen(false);
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && toggle.getAttribute('aria-expanded') === 'true') {
      setOpen(false);
      toggle.focus();
    }
  });

  window.addEventListener('resize', () => {
    if (window.innerWidth > 900) setOpen(false);
  }, { passive: true });

  // --- Current section ----------------------------------------------------
  const targets = anchors
    .map((a) => ({ a, section: document.querySelector(a.getAttribute('href')) }))
    .filter((t) => t.section);

  const spy = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        const hit = targets.find((t) => t.section === entry.target);
        if (!hit) continue;
        for (const t of targets) t.a.classList.toggle('is-current', t === hit);
      }
    },
    { rootMargin: '-45% 0px -50% 0px' },
  );

  for (const t of targets) spy.observe(t.section);
}
