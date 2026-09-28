(() => {
  const scene = document.querySelector('.ticket-scene');
  const ticket = document.querySelector('.ticket-landscape');
  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)');
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

  if (!scene || !ticket || !finePointer.matches || reducedMotion.matches) return;

  const target = { x: 0, y: 0, rx: 0, ry: 0 };
  const current = { x: 0, y: 0, rx: 0, ry: 0 };
  let frame = null;

  const animate = () => {
    let moving = false;
    for (const key of Object.keys(target)) {
      current[key] += (target[key] - current[key]) * 0.12;
      if (Math.abs(target[key] - current[key]) > 0.01) moving = true;
    }

    ticket.style.setProperty('--ticket-x', `${current.x.toFixed(2)}px`);
    ticket.style.setProperty('--ticket-y', `${current.y.toFixed(2)}px`);
    ticket.style.setProperty('--ticket-rotate-x', `${current.rx.toFixed(2)}deg`);
    ticket.style.setProperty('--ticket-rotate-y', `${current.ry.toFixed(2)}deg`);

    frame = moving ? window.requestAnimationFrame(animate) : null;
  };

  const schedule = () => {
    if (frame === null) frame = window.requestAnimationFrame(animate);
  };

  scene.addEventListener('pointermove', (event) => {
    const bounds = scene.getBoundingClientRect();
    const x = ((event.clientX - bounds.left) / bounds.width - 0.5) * 2;
    const y = ((event.clientY - bounds.top) / bounds.height - 0.5) * 2;

    target.x = x * 12;
    target.y = y * 9;
    target.rx = -y * 2.2;
    target.ry = x * 2.2;
    schedule();
  });

  scene.addEventListener('pointerleave', () => {
    target.x = target.y = target.rx = target.ry = 0;
    schedule();
  });

  reducedMotion.addEventListener('change', (event) => {
    if (event.matches) {
      if (frame !== null) window.cancelAnimationFrame(frame);
      frame = null;
      ticket.style.removeProperty('--ticket-x');
      ticket.style.removeProperty('--ticket-y');
      ticket.style.removeProperty('--ticket-rotate-x');
      ticket.style.removeProperty('--ticket-rotate-y');
    }
  });
})();
