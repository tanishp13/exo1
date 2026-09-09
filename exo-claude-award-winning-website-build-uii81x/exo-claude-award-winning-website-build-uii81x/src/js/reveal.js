/**
 * Reveal on scroll. Elements marked [data-reveal] fade up once, staggered by
 * their position among siblings. Anything that never intersects (JS disabled,
 * reduced motion) is already visible via CSS.
 */

export function initReveal() {
  const reduced = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const nodes = [...document.querySelectorAll('[data-reveal]')];

  if (reduced || !('IntersectionObserver' in window)) {
    for (const n of nodes) n.classList.add('is-in');
    return;
  }

  const io = new IntersectionObserver(
    (entries) => {
      for (const entry of entries) {
        if (!entry.isIntersecting) continue;
        entry.target.classList.add('is-in');
        io.unobserve(entry.target);
      }
    },
    { rootMargin: '0px 0px -12% 0px', threshold: 0.08 },
  );

  for (const n of nodes) {
    const siblings = [...(n.parentElement?.children ?? [])].filter((c) => c.hasAttribute('data-reveal'));
    n.style.setProperty('--reveal-delay', `${Math.min(siblings.indexOf(n), 5) * 90}ms`);
    io.observe(n);
  }
}

/** Adds .is-in to a single element the first time it enters the viewport. */
export function revealOnce(node, cls = 'is-in', threshold = 0.25) {
  if (!node) return;
  if (!('IntersectionObserver' in window)) return node.classList.add(cls);
  const io = new IntersectionObserver(
    ([entry]) => {
      if (!entry.isIntersecting) return;
      node.classList.add(cls);
      io.disconnect();
    },
    { threshold },
  );
  io.observe(node);
}
