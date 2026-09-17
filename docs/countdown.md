# Countdown

La sección `#countdown` abre `index.html`. **Ver más** lleva a `#inicio`.
Su CSS y JavaScript están separados en `css/countdown.css` y `js/countdown.js`.
Se integra el hero existente de `feature/hero` para que **Ver más** llegue al diseño ya trabajado. Sus estilos y comportamiento se conservan; el navbar está dentro del hero para no superponerse al countdown.

## Configuración y recursos

- **Fecha configurada:** 28 de noviembre de 2026 a las 19:00 de Argentina (`2026-11-28T19:00:00-03:00`). La fecha fue confirmada por el usuario; la hora sale de la cinta de la captura. Puede ajustarse en `data-countdown-date` en `index.html`. Una fecha inválida muestra guiones. Al vencer, el contador se detiene en cero.
- **Tipografía:** Bitcount Prop Single, confirmada por el usuario, aplicada a los números y las etiquetas. El archivo WOFF2 latino se sirve desde `assets/fonts` mediante `@font-face`, por lo que no requiere instalación en la computadora del visitante. Procede de [Google Fonts](https://fonts.google.com/specimen/Bitcount+Prop+Single); se incluye su licencia en `assets/fonts/Bitcount-Prop-Single-OFL.txt`.
- **Logo:** se utiliza el archivo vertical blanco subido por el usuario, `assets/images/logo-artimañas-vertical.png`, centrado arriba del contador y conservando su proporción original.

El fondo reutiliza el PNG original `fondo-hero.png`, sin modificarlo. El parallax tiene los mismos valores del hero (`intensity: 50`, `smoothing: 0.075`). La cinta recorre dos grupos iguales de texto para cerrar el bucle sin espacios vacíos. Respeta la preferencia de movimiento reducido y se pausa fuera de la sección. En móvil, las tarjetas se distribuyen en dos columnas y el parallax queda desactivado.
