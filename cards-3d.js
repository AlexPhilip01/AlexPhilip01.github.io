/* SHIELD 3D card interactions — pointer-powered tilt and moving gold specular lighting. */
(() => {
  const selector = '.project-card, .cert-card, .stat-card, .progress-card, .featured-item, .case-study-card';
  const cards = Array.from(document.querySelectorAll(selector));
  if (!cards.length) return;

  const canTilt = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  cards.forEach((card) => {
    card.classList.add('card-3d-target');

    // Raise the visible content into the card's 3D plane, leaving click targets intact.
    Array.from(card.children).forEach((child, index) => {
      // These preview panels are absolutely positioned popovers; their transforms
      // control the existing reveal animation, so keep them out of the depth stack.
      if (
        child.classList.contains('card-3d-overlay') ||
        child.classList.contains('cert-preview') ||
        child.classList.contains('featured-preview')
      ) return;
      child.classList.add('card-3d-layer');
      child.style.setProperty('--layer-depth', Math.max(9, 27 - index * 5) + 'px');
    });

    if (!card.querySelector(':scope > .card-3d-overlay')) {
      const overlay = document.createElement('span');
      overlay.className = 'card-3d-overlay';
      overlay.setAttribute('aria-hidden', 'true');
      card.appendChild(overlay);
    }

    if (!canTilt || reducedMotion) return;

    let frame = 0;
    let pointerX = 50;
    let pointerY = 50;
    let targetX = 0;
    let targetY = 0;

    const render = () => {
      frame = 0;
      card.style.setProperty('--pointer-x', pointerX.toFixed(2) + '%');
      card.style.setProperty('--pointer-y', pointerY.toFixed(2) + '%');
      card.style.setProperty('--tilt-x', targetX.toFixed(2) + 'deg');
      card.style.setProperty('--tilt-y', targetY.toFixed(2) + 'deg');
      card.style.setProperty('--spotlight-opacity', '1');
    };

    card.addEventListener('pointermove', (event) => {
      if (event.pointerType !== 'mouse' && event.pointerType !== 'pen') return;
      const rect = card.getBoundingClientRect();
      if (!rect.width || !rect.height) return;
      pointerX = Math.min(100, Math.max(0, ((event.clientX - rect.left) / rect.width) * 100));
      pointerY = Math.min(100, Math.max(0, ((event.clientY - rect.top) / rect.height) * 100));
      const normalizedX = pointerX / 100 - 0.5;
      const normalizedY = pointerY / 100 - 0.5;
      targetX = normalizedX * 10;
      targetY = normalizedY * -9;
      if (!frame) frame = requestAnimationFrame(render);
    }, { passive: true });

    const reset = () => {
      if (frame) cancelAnimationFrame(frame);
      frame = 0;
      card.style.setProperty('--tilt-x', '0deg');
      card.style.setProperty('--tilt-y', '0deg');
      card.style.removeProperty('--card-lift');
      card.style.setProperty('--spotlight-opacity', '0');
      card.style.setProperty('--pointer-x', '50%');
      card.style.setProperty('--pointer-y', '50%');
    };
    card.addEventListener('pointerleave', reset);
    card.addEventListener('pointercancel', reset);
    card.addEventListener('blur', (event) => {
      if (!card.contains(event.relatedTarget)) reset();
    }, true);
  });
})();
