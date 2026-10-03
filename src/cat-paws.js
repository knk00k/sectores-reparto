import { catPawRoutes, catPawSteps } from './cat-paw-paths.js';

const pawSVG = `<svg viewBox="0 0 32 36" fill="currentColor" aria-hidden="true">
  <ellipse cx="5.8" cy="13.1" rx="3.5" ry="4.8" transform="rotate(-24 5.8 13.1)"/>
  <ellipse cx="12.1" cy="6.5" rx="3.6" ry="5" transform="rotate(-8 12.1 6.5)"/>
  <ellipse cx="21" cy="6.9" rx="3.6" ry="5" transform="rotate(12 21 6.9)"/>
  <ellipse cx="27" cy="14" rx="3.4" ry="4.7" transform="rotate(27 27 14)"/>
  <path d="M7.3 25.6c0-3.1 3.1-5.1 4.8-8.2 1.7-3.2 6.2-3.2 8 0 1.8 3.1 4.8 5.1 4.8 8.2 0 4.1-3.6 6.5-6.6 5.2-1.6-.7-3-.7-4.6 0-3 1.3-6.4-1.1-6.4-5.2Z"/>
</svg>`;

export function setupCatPaws(trigger) {
  let trail = null;
  let cleanupTimer;
  const signature = trigger.textContent;
  const clear = () => {
    clearTimeout(cleanupTimer);
    trail?.remove();
    trail = null;
    trigger.textContent = signature;
    trigger.classList.remove('is-walking');
  };
  trigger.addEventListener('click', () => {
    clear();
    const signatureRect = trigger.getBoundingClientRect();
    trigger.textContent = 'ฅ( •̀ω•́ )ฅ';
    trigger.classList.add('is-walking');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const width = document.documentElement.clientWidth;
    const height = window.innerHeight;
    const rect = trigger.getBoundingClientRect();
    // Reservar espacio para ambos textos y para una huella girada con margen.
    const clearance = 32;
    const outsideSignature = ({ x, y }) =>
      x < Math.min(rect.left, signatureRect.left) - clearance ||
      x > Math.max(rect.right, signatureRect.right) + clearance ||
      y < Math.min(rect.top, signatureRect.top) - clearance ||
      y > Math.max(rect.bottom, signatureRect.bottom) + clearance;
    const startX = rect.left + rect.width / 2;
    const startY = rect.top + rect.height / 2;
    const routes = catPawRoutes(width, height, { x: startX, y: startY });
    let nextRouteDelay = 0;
    const steps = reducedMotion
      ? Array.from({ length: 3 }, (_, i) => ({ x: Math.max(18, Math.min(width - 18, startX + (i - 1) * 28)), y: rect.top - clearance - 4, angle: 0, delay: 0, route: 0 }))
      : routes.flatMap((route, routeIndex) => {
        const routeSteps = catPawSteps(route, Math.max(32, Math.min(44, Math.min(width, height) / 18)), width < 600 ? 7 : 10)
          .filter(outsideSignature)
          .map((step, i) => ({ ...step, delay: nextRouteDelay + i * 180, route: routeIndex + 1 }));
        // El siguiente recorrido empieza cuando se desvanece la última huella.
        nextRouteDelay = routeSteps.at(-1).delay + 2000;
        return routeSteps;
      });
    trail = document.createElement('div');
    trail.className = `cat-paw-trail${reducedMotion ? ' is-still' : ''}`;
    trail.setAttribute('aria-hidden', 'true');
    trail.dataset.route = '1-2-3';
    steps.forEach(({ x, y, angle, delay, route }) => {
      const paw = document.createElement('span');
      paw.className = 'cat-paw';
      paw.style.left = `${x}px`;
      paw.style.top = `${y}px`;
      paw.style.setProperty('--paw-angle', `${angle}deg`);
      paw.style.animationDelay = `${delay}ms`;
      paw.dataset.route = route;
      paw.innerHTML = pawSVG;
      trail.append(paw);
    });
    document.body.append(trail);
    cleanupTimer = setTimeout(clear, reducedMotion ? 1800 : nextRouteDelay);
  });
  document.addEventListener('keydown', (event) => { if (event.key === 'Escape') clear(); });
  document.addEventListener('visibilitychange', () => { if (document.hidden) clear(); });
  window.addEventListener('resize', clear);
  window.addEventListener('pagehide', clear);
}
