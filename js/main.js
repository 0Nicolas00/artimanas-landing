// Interacción del Hero: parallax suave siguiendo el mouse.

const hero = document.querySelector('.hero');

if (hero) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');
  const finePointer = window.matchMedia('(pointer: fine)');

  if (!reduceMotion.matches && finePointer.matches) {
    let targetX = 0;
    let targetY = 0;
    let currentX = 0;
    let currentY = 0;

    // Menor recorrido para evitar que el fondo necesite tanto zoom.
    const intensity = 50;
    const smoothing = 0.075;

    hero.addEventListener('pointermove', (event) => {
      const rect = hero.getBoundingClientRect();

      const normalizedX = (event.clientX - rect.left) / rect.width - 0.5;
      const normalizedY = (event.clientY - rect.top) / rect.height - 0.5;

      // El fondo se desplaza levemente en sentido contrario al cursor.
      targetX = normalizedX * intensity * -1;
      targetY = normalizedY * intensity * -1;
    });

    hero.addEventListener('pointerleave', () => {
      targetX = 0;
      targetY = 0;
    });

    const animateBackground = () => {
      currentX += (targetX - currentX) * smoothing;
      currentY += (targetY - currentY) * smoothing;

      hero.style.setProperty('--bg-x', `${currentX.toFixed(2)}px`);
      hero.style.setProperty('--bg-y', `${currentY.toFixed(2)}px`);

      requestAnimationFrame(animateBackground);
    };

    animateBackground();
  }
}
