/* SHIELD button polish: pointer-following gold specular light, with no animation loop. */
(() => {
  if (window.__shieldButtonPolish) return;
  window.__shieldButtonPolish = true;

  const selector = [
    'button', 'input[type="button"]', 'input[type="submit"]', 'input[type="reset"]',
    '.btn-primary', '.btn-ghost', '.btn', '.soc-primary-btn', '.soc-secondary-btn',
    '.ap-drive', 'a[role="button"]'
  ].join(',');

  if (!window.matchMedia('(hover: hover) and (pointer: fine)').matches) return;

  document.addEventListener('pointermove', event => {
    if (event.pointerType === 'touch') return;
    const element = event.target && event.target.closest ? event.target.closest(selector) : null;
    if (!element) return;
    const rect = element.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const x = Math.max(0, Math.min(100, ((event.clientX - rect.left) / rect.width) * 100));
    const y = Math.max(0, Math.min(100, ((event.clientY - rect.top) / rect.height) * 100));
    element.style.setProperty('--button-x', x.toFixed(1) + '%');
    element.style.setProperty('--button-y', y.toFixed(1) + '%');
  }, { passive: true });

  document.addEventListener('pointerout', event => {
    const element = event.target && event.target.closest ? event.target.closest(selector) : null;
    if (!element || (event.relatedTarget && element.contains(event.relatedTarget))) return;
    element.style.removeProperty('--button-x');
    element.style.removeProperty('--button-y');
  }, { passive: true });
})();
