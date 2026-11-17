# Artimañas 2026 — versión del 16 de noviembre de 2026

## Abrir y publicar

El sitio sigue siendo estático. React se monta únicamente en `#hero-shader`, detrás del HTML de la portada. El logo, la navegación, los textos, la cinta y el catálogo conservan su HTML y sus scripts.

Para desarrollar (Node.js 22 o superior):

```sh
npm ci --legacy-peer-deps
npm run build
npm run dev
```

Abrir `http://localhost:8080`. También se puede usar Live Server. Usar HTTP local en lugar de abrir `index.html` con `file://`, porque WebGL carga los mapas HDR por HTTP.

Para publicar manualmente en Netlify, subir **la carpeta `dist/` completa**, generada por `npm run build`. Contiene `index.html`, `css/`, `js/` y `assets/`, incluidos `hero-shader.bundle.js`, su archivo de licencias y `assets/shader-environments/*.hdr`. No hace falta subir `node_modules`, `src`, `scripts`, `Hero.jsx` ni las pruebas.

Para publicar desde un repositorio, `netlify.toml` configura el comando `npm run build`, la carpeta `dist` y la instalación con `--legacy-peer-deps`. El bundle compilado también queda en `js/hero-shader.bundle.js`, por lo que los archivos de producto en la raíz siguen siendo una versión estática completa.

## Fondo ShaderGradient de la portada

`Hero.jsx` contiene únicamente `ShaderGradientCanvas`, `ShaderGradient`, las cinco paletas exactas de la referencia en `PALETTES` y los parámetros originales en `SHADER_SETTINGS`. Después de cambiarlo, ejecutar `npm run build` para actualizar el bundle y `dist/`.

`src/hero-bootstrap.js` elige una sola paleta por carga antes del primer pintado. El build extrae `PALETTES` de `Hero.jsx` e inserta un script mínimo en el `<head>` de `index.html`, sin React ni otra descarga. Ese script comparte la elección entre el fondo estático CSS y el shader.

`src/hero-shader.jsx` monta el fondo y espera a que haya geometría, iluminación HDR y cuadros dibujados antes de mostrarlo con un fundido de 300 ms. La paleta no cambia al redimensionar, rotar ni recorrer el sitio. ShaderGradient es el único fondo animado. Durante la carga, si WebGL no está disponible, si falla el bundle o si se pierde el contexto, se muestra el degradado estático CSS de la paleta elegida. El seguimiento del cursor queda apagado con `data-pointer-follow="false"` en la sección `.hero` de `index.html`. El shader se pausa fuera de pantalla, con la pestaña oculta o al abrir un diálogo.

Prueba específica del primer fotograma, recarga normal, caché desactivada y fallos: `npm run test:hero-startup`. Se ejecuta contra la carpeta `dist/` generada por el build.

El seguimiento del mouse está en `ShaderPointerMotion`, dentro de `src/hero-shader.jsx`. Desplaza únicamente la geometría del shader en los ejes de pantalla: respuesta de 0,28 s, estela de 1,1 s y un arrastre de 3,5 % más una pequeña inercia. `POINTER_MOTION` permite ajustar esa intensidad sin tocar las paletas ni la cámara original. Al salir de la portada vuelve al centro; con entrada táctil queda centrado y conserva la animación automática. El logo y la cinta no se transforman. Prueba: `npm run test:hero-pointer`.

Hay un único fundido inferior, `.hero::before` en `css/base.css`, que termina en `--surface-0` (`#10080f`), el fondo del catálogo. El grano CSS de respaldo se oculta al activarse el shader, que ya tiene su propio grano. Una sombra discreta en las imágenes del logo y el texto de la portada sostiene el contraste sobre las zonas claras sin modificar los colores ni los parámetros del efecto.

Los mapas HDR se sirven desde `assets/shader-environments/`: son los archivos oficiales de ShaderGradient (`city.hdr`, `dawn.hdr`, `lobby.hdr`). La versión 2.4.20 precarga los tres aunque el efecto use `city`. No depende de una CDN en ejecución. Fuente: https://github.com/ruucm/shadergradient.

Pruebas del shader: `npm run test:hero-shader`. Las pruebas del respaldo Canvas 2D están en `npm run test:hero-palettes`. Si se usa un navegador Chromium ya instalado, definir `CHROMIUM_PATH` con la ruta a su ejecutable; en caso contrario, instalar el navegador de Playwright con `npx playwright install chromium`.

## Datos de las obras — revisión 26

Se incorporó el catálogo del ZIP recibido sobre la revisión 25: 32 obras, 28 descripciones completas, categorías y nombres actualizados, y nueve fotos nuevas para seis autores. El listado y los filtros corresponden a ese mismo catálogo. Las dos entradas ausentes en el archivo recibido se retiraron.

Se mantuvieron todos los módulos JavaScript y las animaciones de la revisión 25. El único ajuste de CSS permite mostrar los saltos de párrafo de las descripciones recibidas. Las fotografías nuevas se optimizaron a WebP, sin recorte y respetando su orientación; pasan de 22,9 MB a 2,32 MB en conjunto.

Archivos de producto modificados: `index.html`, `css/overlays.css` y nueve imágenes nuevas en `assets/`. `CONTENIDO.md` detalla el catálogo y los materiales pendientes. No se agregaron dependencias ni se trasladó código de la versión anterior.

Para probar: buscar a Guadalupe Andrés y recorrer sus dos fotos; abrir Maleable para comprobar su foto vertical; filtrar por categoría y alumno; abrir E.C.O.T. para revisar el título largo. Verificar también la entrada desde la portada, el scroll previo al detalle, el cursor y el cierre, tanto en escritorio como en teléfono.

Verificación de esta actualización: comparación exacta de los 32 registros contra el archivo recibido, correspondencia entre fichas, nombres y filtros, integridad de las imágenes y comprobación de que el JavaScript permanece idéntico. La ejecución de las pruebas de navegador quedó bloqueada por las restricciones de este entorno; las pruebas incluidas se pueden repetir localmente con los comandos indicados abajo.

## Entrada al catálogo y continuidad de imagen — revisión 25

- El primer scroll hacia abajo completa un único desplazamiento suave hasta centrar la primera obra visible. Funciona con rueda, teclado y, al soltar el dedo, con un gesto táctil. El scroll posterior continúa libre. Un gesto hacia arriba o una interrupción cancela el recorrido.
- Hay más aire entre la portada y la primera imagen. El adelanto no permite abrir obras ni nombres antes de empezar el recorrido.
- “Obras por alumno” conserva nitidez y contraste; el blur de portada solo afecta los nombres.
- El mensaje “Bajá para ver más” se retira al iniciar el recorrido, sin esperar a abandonar toda la portada.
- El texto del cursor se desvanece en 65 ms al salir o cambiar de mensaje. La forma recorta su contenido para evitar texto por fuera mientras se contrae.
- El área de imagen del detalle tiene dimensiones estables, y el destino animado usa la proporción real de la foto ya cargada en el catálogo. La imagen animada y la definitiva terminan en el mismo rectángulo, sin un segundo cambio de tamaño.

Archivos: `js/app.js`, `js/catalog-preview.js`, `js/cursor.js`, `js/work-transition.js`, `css/base.css`, `css/overlays.css`, `index.html` y pruebas. Se reutilizó el desplazamiento existente; no se agregaron dependencias.

Para probar: desde arriba hacer un scroll corto, comprobar el centrado y abrir la primera obra. Mirar el último instante de la expansión. Volver arriba y comprobar que el adelanto no abre obras, que el título se lee y que el texto del cursor desaparece al comenzar a bajar.

## Portada, clic y desenfoque — revisión 24

- “Muestra de arte interactivo” queda agrupado inmediatamente por encima del logo, como en la referencia.
- El adelanto del listado tiene un desenfoque leve que desaparece al entrar en el catálogo; el primer nombre no recibe el pulso protagonista mientras estamos en portada.
- Sobre el adelanto aparece el cursor blanco con pop, “Bajá para ver más” y un pequeño indicador animado de scroll. Se activa con el puntero, sin clic.
- El foco dejado por un clic ya no mantiene encendido el hover entre portada y catálogo. La navegación por teclado conserva su respuesta propia.
- La selección activa ya no desplaza la columna de nombres. Un clic sobre un nombre parcialmente visible conserva el scroll al recibir foco y sigue con el recorrido hacia la obra.
- El desenfoque del detalle tiene una etapa explícita de 900 ms con valores intermedios. En escritorio se aplica después de la composición y también al cambiar de obra.
- En mobile no se crean ni se mueven imágenes vecinas: el catálogo permanece en su lugar, mientras la foto elegida y la ficha se animan por encima. El fondo se oscurece y desenfoca gradualmente.

Archivos: `js/app.js`, `js/work-transition.js`, `js/catalog-preview.js`, `js/cursor.js`, `css/base.css`, `css/overlays.css`, `css/hero-layout.css` e `index.html`. No se agregaron dependencias.

Para probar: entrar y salir del adelanto con el mouse sin hacer clic; elegir un nombre parcialmente visible; observar la llegada a la obra y el blur gradual; repetir en teléfono y comprobar que las demás fotos no se desplazan.

## Nombres y recorrido — revisión 23

La lista de nombres conserva su posición, ancho, espaciado, tipografía y scroll al abrir el detalle. Solo la ficha y las imágenes se reorganizan. Se ajustaron `js/work-transition.js` y `css/overlays.css` para mantener el mismo rectángulo de la lista original, incluido al cerrar.

Al hacer clic en un nombre del catálogo, la página se desplaza con aceleración y frenado suave hasta centrar la obra. Solo al completar ese recorrido se inicia la expansión del detalle. Se reutiliza la animación de scroll existente; no se agrega una librería ni una demora fija. Si se interrumpe con rueda, toque, teclado o navegación, también se cancela la apertura pendiente. Un segundo nombre reemplaza el primero.

Cambios localizados en `js/app.js`, versión de recursos en `index.html` y pruebas en `tests/`. Para probar: elegir un nombre cuya obra esté lejos, observar el recorrido y la apertura; repetir e interrumpir con la rueda. Los clics sobre imágenes y los cambios de alumno dentro del detalle mantienen su comportamiento.

## Corrección de movimiento — revisión 22

- La composición dura aproximadamente 960 ms: la ficha y las imágenes se desplazan; la lista conserva su posición, con aceleración y frenado gradual. El desenfoque se inicia al terminar ese movimiento.
- El cursor crece con sobrepaso y asentamiento en 560 ms, y se contrae en 440 ms. Conserva el tamaño actual al cambiar de dirección y el texto se desvanece al salir. El scroll ya no reinicia el efecto.
- Estas dos transiciones explícitas se mantienen activas también con la preferencia de movimiento reducido, por decisión del diseño solicitado. Las otras preferencias no se modificaron.
- Los archivos CSS y JS tienen una versión en sus URLs para evitar cargar una copia anterior después de publicar.
- Se verifican tamaños y posiciones intermedios, apertura/cierre, historial, cambios rápidos y disposición móvil.

## Qué cambió

- Hero de 90dvh en escritorio y mobile, con el logo centrado entre el texto y la cinta.
- Cinta con dos grupos idénticos, sin huecos al repetir; se adapta a pantallas anchas.
- Cursor blanco: punto de 12 px, círculo de 90 px con “Ver obra” o “Ampliar”. La transición entre punto y círculo tiene un pop con un leve sobrepaso y asentamiento, sin reiniciarse con cada movimiento. Solo con puntero fino; los diálogos conservan el cursor nativo.
- Inicio y Muestra alineados a los márgenes del catálogo. Galería con más ancho útil para las imágenes. El catálogo recupera tarjetas cuadradas, con crecimiento y superposición suave de la obra activa.
- Click en un nombre o imagen abre el detalle lateral. En escritorio: 20% nombres, 20% ficha, 60% área de imagen, con la lista de nombres en la misma posición, ancho y espaciado que en el catálogo. Desde un nombre, primero se centra la obra con scroll animado. Luego la imagen elegida y sus vecinas se desplazan a la nueva composición; la ficha entra desde la izquierda y después se desenfocan las vecinas. El catálogo completo se retira del fondo. El cierre restaura su posición de scroll. La imagen es la primera diapositiva; no se agrega un video vacío.
- En teléfono, la ficha se apila debajo de la imagen para mantener el contenido legible. Las imágenes restantes permanecen estáticas en su posición original.
- Filtros blancos, ocultos en portada, con aparición suave. Al entrar al footer el mismo botón pasa a “Ir arriba”, con desplazamiento animado.
- Filtros mobile como panel inferior: pestañas redondeadas, selección a la derecha, lista desplazable y acciones siempre visibles. Las combinaciones sin resultados se deshabilitan, pero las selecciones activas siempre pueden quitarse.
- Halo continuo entre catálogo y footer, también en mobile. Su expansión queda dentro del ancho disponible y no ensancha la página al abrir un panel.
- Logos institucionales sin el rectángulo violeta: un filtro SVG transforma la luminosidad en alpha al renderizar, conservando los archivos originales y sus contornos.
- “Cómo llegar” apunta únicamente a Sede Fonseca, Diagonal 78 y 62. Se corrigió también el domicilio escrito en el ticket.
- Se quitó “Mover con el celular”. El sensor se inicia automáticamente cuando el navegador lo permite. Si requiere permiso, se solicita al tocar la portada; si se rechaza o no hay sensor, sigue la animación ambiental.
- Imágenes extraídas y deduplicadas; HTML, CSS y JavaScript separados por función.

## Archivos y trabajo en equipo

| Área | Archivos principales |
| --- | --- |
| Contenido y enlaces de obras | `index.html`, `assets/` |
| Estética, responsive y composición | `css/base.css`, `css/catalog.css`, `css/hero-layout.css`, `css/overlays.css`, `css/student-links.css` |
| Navegación, fichas y filtros | `js/app.js`, `js/core.js`, `js/work-transition.js` |
| Fondo, movimiento y cursor | `src/hero-shader.jsx`, `js/logo-intro.js`, `js/catalog-preview.js`, `js/marquee.js`, `js/cursor.js` |
| Pruebas | `tests/smoke.cjs`, `tests/interactions.cjs`, `tests/transitions.cjs`, `tests/preview.cjs`, `tests/entry.cjs` |

Una división práctica para tres personas: contenido y recursos; estilos y responsive; interacciones y pruebas. Hacer commits por cambio y coordinar las modificaciones a `index.html`.

Las imágenes compartidas existen una sola vez en `assets/`; sus nombres con hash identifican el contenido. Los logos y el objeto del footer tienen nombres descriptivos. Al agregar imágenes nuevas, usar nombres descriptivos y rutas relativas.

## Comprobaciones de la base de diseño (revisión 25)

Pruebas automatizadas y revisión de capturas en Chromium:

- Hero al 90%, centrado, sin desbordamiento horizontal en anchos de 360, 390, 768, 1100, 1101, 1440, 1920 y 3840 px.
- Apertura de ficha desde nombres, cambio de alumno, imagen inicial, cierre y retorno por historial. Se comprueba que el desenfoque comienza después de acomodar las imágenes, que la ficha entra desde la izquierda y que cerrar o volver atrás durante la animación no deja capas ni estados pendientes.
- Scroll principal desde el fondo de la columna; scroll de nombres independiente.
- Filtros por alumno, contador de resultados y aplicación. Panel inferior completo dentro del viewport móvil.
- Cambio del botón al llegar al footer y regreso animado al inicio.
- Cursor de 12/90 px, repetición de cinta, galería y ampliación de fotos.
- Permiso de orientación simulado: no se consulta en escritorio, se solicita al tocar en el caso que lo requiere y procesa eventos en mobile.
- Blur intermedio de escritorio/mobile, inmovilidad de las fotos no seleccionadas en mobile, hover repetido sin clic, cursor de scroll, foco anterior y nombres parcialmente visibles.
- Carga de los recursos locales sin errores HTTP ni errores JavaScript.

Para repetirlas: instalar Node.js, ejecutar `npm install`, luego `npx playwright install chromium` y finalmente `npm test`. Se puede indicar un Chromium ya instalado mediante la variable `CHROMIUM_PATH`. Las capturas de prueba se escriben en la carpeta temporal del sistema.

Falta validar el sensor con un celular físico, especialmente Safari/iOS. La emulación móvil comprueba disposición e interacciones, no reemplaza esa prueba de hardware.

El catálogo recibido todavía tiene cuatro descripciones pendientes, 26 obras con imágenes de referencia y ningún enlace de video o investigación. Se conservaron esos estados sin inventar materiales; el detalle está en `CONTENIDO.md`.

## Referencias técnicas

- Sede Fonseca: https://www2.fba.unlp.edu.ar/extension/cursos-y-talleres/sedes/
- Permiso de orientación: https://developer.mozilla.org/en-US/docs/Web/API/DeviceOrientationEvent/requestPermission_static
- Caché de recursos independientes: https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/Caching

- Animaciones y finalización: https://developer.mozilla.org/en-US/docs/Web/API/Animation/finished
