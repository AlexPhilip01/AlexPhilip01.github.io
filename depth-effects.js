/* SHIELD depth compositor — subtle atmospheric parallax, independent of card and 3D-shield controls. */
(() => {
  const root = document.documentElement;
  const atmosphere = document.getElementById('depth-atmosphere');
  const hero = document.getElementById('hero');
  const grid = document.querySelector('.depth-grid-floor');
  const content = hero && hero.querySelector('.hero-inner');
  if (!atmosphere || !hero || !grid) return;

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  if (reducedMotion) return;

  let pointerX = 0;
  let pointerY = 0;
  let scrollY = window.scrollY || 0;
  let frame = 0;
  const clamp = (value, min, max) => Math.min(max, Math.max(min, value));
  const queue = () => { if (!frame) frame = window.requestAnimationFrame(render); };

  function render() {
    frame = 0;
    root.style.setProperty('--depth-gold-x', (pointerX * -25).toFixed(1) + 'px');
    root.style.setProperty('--depth-gold-y', (pointerY * -19).toFixed(1) + 'px');
    root.style.setProperty('--depth-amber-x', (pointerX * 17).toFixed(1) + 'px');
    root.style.setProperty('--depth-amber-y', (pointerY * 13 + clamp(scrollY * .025, 0, 64)).toFixed(1) + 'px');
    root.style.setProperty('--depth-grid-x', (pointerX * 7).toFixed(1) + 'px');
    const heroHeight = Math.max(1, hero.offsetHeight);
    const heroProgress = clamp((scrollY - hero.offsetTop) / heroHeight, 0, 1);
    root.style.setProperty('--depth-grid-y', (pointerY * 5 + heroProgress * 28).toFixed(1) + 'px');
    if (content && finePointer && window.innerWidth > 900) {
      content.style.setProperty('--depth-content-x', (pointerX * -4).toFixed(1) + 'px');
      content.style.setProperty('--depth-content-y', (pointerY * -3).toFixed(1) + 'px');
    }
  }

  if (finePointer) {
    window.addEventListener('pointermove', (event) => {
      if (event.pointerType === 'touch') return;
      pointerX = clamp((event.clientX / Math.max(1, window.innerWidth) - .5) * 2, -1, 1);
      pointerY = clamp((event.clientY / Math.max(1, window.innerHeight) - .5) * 2, -1, 1);
      queue();
    }, { passive: true });
  }
  window.addEventListener('scroll', () => { scrollY = window.scrollY || 0; queue(); }, { passive: true });
  window.addEventListener('resize', queue, { passive: true });
  document.addEventListener('visibilitychange', () => { if (!document.hidden) queue(); });
  render();
})();
