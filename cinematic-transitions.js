/* SHIELD cinematic transitions — gold page wipe plus restrained in-view reveals. */
(() => {
  if (window.__shieldCinematicTransitions) return;
  window.__shieldCinematicTransitions = true;

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const style = document.createElement('style');
  style.id = 'shield-cinematic-transition-styles';
  style.textContent = [
    '#cinematic-wipe{position:fixed;inset:0;z-index:2147483000;pointer-events:none;visibility:hidden;opacity:0;clip-path:inset(0 0 0 100%);background:radial-gradient(ellipse at 78% 18%,rgba(212,168,58,.18),transparent 42%),linear-gradient(135deg,#0b0b0d 0%,#11100e 62%,#050506 100%);transition:clip-path .48s cubic-bezier(.77,0,.18,1),opacity .18s ease,visibility 0s linear .5s;isolation:isolate;overflow:hidden}',
    '#cinematic-wipe::before{content:"";position:absolute;top:0;bottom:0;right:0;width:2px;background:linear-gradient(180deg,transparent,#e9cf7a 14%,#d4a83a 50%,#e9cf7a 86%,transparent);box-shadow:0 0 26px rgba(212,168,58,.48),0 0 68px rgba(212,168,58,.18)}',
    '#cinematic-wipe::after{content:"";position:absolute;inset:0;background:linear-gradient(110deg,transparent 20%,rgba(233,207,122,.045) 46%,transparent 72%);opacity:.85}',
    '#cinematic-wipe.is-active{visibility:visible;opacity:1;clip-path:inset(0);transition:clip-path .48s cubic-bezier(.77,0,.18,1),opacity .18s ease,visibility 0s}',
    '#cinematic-wipe.is-revealing{clip-path:inset(0 0 0 100%);transition:clip-path .68s cubic-bezier(.77,0,.18,1),opacity .2s ease}',
    '.cinematic-wipe-label{position:absolute;left:clamp(24px,6vw,84px);bottom:clamp(28px,7vh,72px);display:flex;align-items:center;gap:12px;color:#e9cf7a;font:600 10px/1.5 "DM Mono","JetBrains Mono",monospace;letter-spacing:.18em;text-transform:uppercase}',
    '.cinematic-wipe-label::before{content:"";width:22px;height:1px;background:#d4a83a;box-shadow:0 0 14px rgba(212,168,58,.7)}',
    '.cinematic-reveal{opacity:0;transform:translate3d(0,22px,0) scale(.994);filter:blur(4px);transition:opacity .7s cubic-bezier(.2,.8,.2,1),transform .75s cubic-bezier(.2,.8,.2,1),filter .6s ease;will-change:opacity,transform,filter}',
    '.cinematic-reveal.is-visible{opacity:1;transform:none;filter:none;will-change:auto}',
    '@media(prefers-reduced-motion:reduce){#cinematic-wipe{display:none!important}.cinematic-reveal,.cinematic-reveal.is-visible{opacity:1!important;transform:none!important;filter:none!important;transition:none!important;will-change:auto!important}}'
  ].join('\n');
  document.head.appendChild(style);

  const wipe = document.createElement('div');
  wipe.id = 'cinematic-wipe';
  wipe.setAttribute('aria-hidden','true');
  wipe.innerHTML = '<span class="cinematic-wipe-label">SHIELD / Secure route</span>';
  document.body.appendChild(wipe);

  function revealPage() {
    if (reduceMotion || !wipe.isConnected) return;
    wipe.classList.add('is-active');
    void wipe.offsetWidth;
    requestAnimationFrame(() => wipe.classList.add('is-revealing'));
    window.setTimeout(() => wipe.classList.remove('is-active','is-revealing'), 820);
  }

  if (!reduceMotion) {
    if (document.getElementById('scene')) {
      let done = false;
      const fallback = window.setTimeout(() => { if (!done) { done = true; revealPage(); } }, 2300);
      document.addEventListener('shield-drive-ready', () => {
        if (done) return;
        done = true;
        window.clearTimeout(fallback);
        window.setTimeout(revealPage, 80);
      }, { once: true });
    } else {
      window.addEventListener('load', () => window.setTimeout(revealPage, 45), { once: true });
    }
  }

  if (!reduceMotion && 'IntersectionObserver' in window) {
    const targets = [
      '#about .about-grid', '#experience .edu-timeline', '#education .edu-timeline',
      '#skills .skills-grid', '#featured .featured-row', '#soc-lab .soc-console',
      '#case-studies .case-studies-grid', '#projects .projects-grid',
      '#certs .certs-grid', '#progress .progress-cards', '#contact .connect-inner'
    ];
    const elements = targets.flatMap(selector => Array.from(document.querySelectorAll(selector)));
    elements.forEach(el => {
      el.classList.add('cinematic-reveal');
    });
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        entry.target.classList.add('is-visible');
        observer.unobserve(entry.target);
      });
    }, { rootMargin:'0px 0px -9% 0px', threshold:0.04 });
    elements.forEach(el => observer.observe(el));
  }

  let navigating = false;
  document.addEventListener('click', event => {
    const link = event.target && event.target.closest ? event.target.closest('a[href]') : null;
    if (!link || navigating || event.defaultPrevented || event.button !== 0) return;
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
    if (link.hasAttribute('download') || (link.target && link.target.toLowerCase() !== '_self')) return;
    const raw = link.getAttribute('href');
    if (!raw || raw.startsWith('#') || /^(mailto:|tel:|javascript:|data:)/i.test(raw)) return;

    let dest;
    try { dest = new URL(raw, window.location.href); } catch (error) { return; }
    if (!/^https?:$/.test(dest.protocol) || dest.origin !== window.location.origin) return;
    if (dest.pathname === window.location.pathname && dest.search === window.location.search) {
      if (dest.hash) return;
      if (dest.href === window.location.href) return;
    }

    event.preventDefault();
    navigating = true;
    if (reduceMotion) {
      window.location.assign(dest.href);
      return;
    }
    wipe.classList.remove('is-revealing');
    wipe.classList.add('is-active');
    window.setTimeout(() => window.location.assign(dest.href), 490);
  });
})();