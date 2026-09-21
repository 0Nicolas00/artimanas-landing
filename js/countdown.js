// Countdown independiente del hero: fecha real, parallax y cinta.
(() => {
  const section = document.querySelector('.countdown');
  if (!section) return;

  const timer = section.querySelector('[role="timer"]');
  const status = section.querySelector('[data-countdown-status]');
  const fields = Object.fromEntries(
    [...section.querySelectorAll('[data-countdown-unit]')].map((field) => [field.dataset.countdownUnit, field])
  );
  const date = section.dataset.countdownDate?.trim() || '';
  // Exigir una zona horaria evita que cada visitante cuente hacia una hora diferente.
  const hasTimeZone = /T\d{2}:\d{2}(?::\d{2})?(?:Z|[+-]\d{2}:\d{2})$/.test(date);
  const deadline = hasTimeZone ? Date.parse(date) : NaN;
  let clockTimeout;

  function renderValue(unit, value) {
    const text = typeof value === 'number' ? String(value).padStart(2, '0') : value;
    const field = fields[unit];
    if (!field) return;
    if (field.textContent !== text) field.textContent = text;
    field.style.setProperty('--countdown-digits', Math.max(2, text.length));
  }

  function updateClock() {
    window.clearTimeout(clockTimeout);
    if (!Number.isFinite(deadline)) return;

    const remaining = Math.max(0, deadline - Date.now());
    const seconds = Math.ceil(remaining / 1000);
    renderValue('days', Math.floor(seconds / 86400));
    renderValue('hours', Math.floor(seconds / 3600) % 24);
    renderValue('minutes', Math.floor(seconds / 60) % 60);
    renderValue('seconds', seconds % 60);

    if (remaining === 0) {
      section.dataset.countdownState = 'complete';
      timer.setAttribute('aria-label', 'La muestra Artimañas 2026 ya comenzó');
      status.textContent = 'La muestra Artimañas 2026 ya comenzó.';
      return;
    }

    section.dataset.countdownState = 'running';
    if (!document.hidden) clockTimeout = window.setTimeout(updateClock, Math.min(1000, remaining));
  }

  if (!Number.isFinite(deadline)) {
    section.dataset.countdownState = date ? 'invalid' : 'pending';
    Object.keys(fields).forEach((unit) => renderValue(unit, '--'));
    timer.setAttribute('aria-label', 'Fecha de la muestra pendiente de confirmación');
    status.textContent = 'Fecha de la muestra pendiente de confirmación.';
    if (date) console.warn('Countdown: usar una fecha ISO con hora y zona horaria en data-countdown-date.');
  } else {
    timer.setAttribute('aria-label', 'Tiempo restante hasta la muestra Artimañas 2026');
    status.textContent = '';
    updateClock();
  }

  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const desktopPointer = window.matchMedia('(pointer: fine) and (min-width: 701px)');
  let inView = true;
  let frame;
  let targetX = 0;
  let targetY = 0;
  let currentX = 0;
  let currentY = 0;
  // Mismos recorrido y suavizado del hero: máximo 25px por eje.
  const intensity = 50;
  const smoothing = 0.075;

  function canMove() {
    return inView && !document.hidden && !reducedMotion.matches && desktopPointer.matches;
  }

  function resetBackground() {
    window.cancelAnimationFrame(frame);
    frame = undefined;
    targetX = currentX = 0;
    targetY = currentY = 0;
    section.style.setProperty('--countdown-bg-x', '0px');
    section.style.setProperty('--countdown-bg-y', '0px');
  }

  function animateBackground() {
    frame = undefined;
    if (!canMove()) return;

    currentX += (targetX - currentX) * smoothing;
    currentY += (targetY - currentY) * smoothing;
    const moving = Math.abs(targetX - currentX) > 0.01 || Math.abs(targetY - currentY) > 0.01;
    if (!moving) { currentX = targetX; currentY = targetY; }
    section.style.setProperty('--countdown-bg-x', `${currentX.toFixed(2)}px`);
    section.style.setProperty('--countdown-bg-y', `${currentY.toFixed(2)}px`);
    if (moving) frame = window.requestAnimationFrame(animateBackground);
  }

  function requestMovement() {
    if (canMove() && frame === undefined) frame = window.requestAnimationFrame(animateBackground);
  }

  section.addEventListener('pointermove', (event) => {
    if (!canMove() || event.pointerType === 'touch') return;
    const rect = section.getBoundingClientRect();
    targetX = -((event.clientX - rect.left) / rect.width - 0.5) * intensity;
    targetY = -((event.clientY - rect.top) / rect.height - 0.5) * intensity;
    requestMovement();
  });

  section.addEventListener('pointerleave', () => {
    targetX = targetY = 0;
    requestMovement();
  });

  function syncMotion() {
    section.dataset.countdownVisible = String(inView && !document.hidden);
    if (!canMove()) resetBackground();
  }

  if ('IntersectionObserver' in window) {
    const observer = new IntersectionObserver(([entry]) => {
      inView = entry.isIntersecting;
      syncMotion();
    });
    observer.observe(section);
  }

  reducedMotion.addEventListener('change', syncMotion);
  desktopPointer.addEventListener('change', syncMotion);
  document.addEventListener('visibilitychange', () => {
    syncMotion();
    window.clearTimeout(clockTimeout);
    if (!document.hidden) updateClock();
  });
  window.addEventListener('pagehide', () => {
    window.clearTimeout(clockTimeout);
    resetBackground();
  });
  window.addEventListener('pageshow', () => { syncMotion(); updateClock(); });
  syncMotion();
})();
