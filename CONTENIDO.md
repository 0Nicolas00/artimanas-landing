# Catálogo importado — revisión 26

Fuente: `Artimanas-Netlify (1) (2)(1).zip`, recibido el 16 de noviembre de 2026.
Base de diseño e interacciones: revisión 25 del ZIP anterior.

Se importaron las 32 obras del archivo recibido, sus títulos, autores, categorías y textos; 28 tienen descripción completa y cuatro conservan el aviso pendiente de la fuente. Se retiraron Federico Joselevich y Elías Bareiro, ausentes del catálogo recibido. No se cambiaron las 14 fotos de Galería: son idénticas en ambas versiones.

Las nueve fotos nuevas de seis autores se exportaron como WebP (calidad 88, lado máximo 2400 px), sin recortar y respetando la orientación EXIF. Las otras 26 obras conservan las imágenes de referencia que ya traía la fuente; todavía necesitan sus fotografías definitivas. Los originales permanecen en el ZIP recibido.

La fuente no incluye enlaces de videos ni de investigaciones. No se agregaron enlaces ficticios.

## Catálogo y materiales pendientes

| Obra | Alumno | Categoría | Descripción | Fotos |
| --- | --- | --- | --- | --- |
| Frecuencia Interna | Adam, Florencia Araceli | Alienación | Importada | Referencia anterior |
| Háptrikas | Andrés, Guadalupe | Sensorialidad | Importada | 2 nueva(s) |
| Media-TEX | Aroza, Matias | Alienación | Importada | Referencia anterior |
| Mimetikami | Besnati Saldise, Victoria | Entorno | Importada | 1 nueva(s) |
| Pladi | Bigot, Juan Martín | Entorno | Importada | Referencia anterior |
| Historias que se visten | Di Bella, Martina | Identidad | Importada | Referencia anterior |
| Detras de la Interfaz | Errecarte, Juan Ignacio | Alienación | Pendiente | Referencia anterior |
| Prometeo contemporáneo | Ferrer, Evelyn | Alienación | Importada | Referencia anterior |
| Vértices del aparecer | Galdeano, Sofia | Sinergia | Importada | Referencia anterior |
| Eól | Galindez, Catalina | Entorno | Importada | Referencia anterior |
| Sugerido | Gamón, Martina | Identidad | Importada | Referencia anterior |
| Maleable | Giambruni, Adelina | Identidad | Importada | 2 nueva(s) |
| Almaxia | Gimenez, Julia | Sinergia | Importada | Referencia anterior |
| Triedro material: Sonoro | Grassi, Maria | Sensorialidad | Importada | 2 nueva(s) |
| Sinestesia | Griguoli, Nicolás | Identidad | Pendiente | Referencia anterior |
| Fragmentos | Ignoffo, Lara Belén | Identidad | Pendiente | 1 nueva(s) |
| Rosty Zone | Iriarte, Jeremías Daniel | Entorno | Importada | Referencia anterior |
| Experimental Cognitive Override Technology (E.C.O.T.) | Isasmendi, Rodrigo | Alienación | Importada | Referencia anterior |
| Collapso | La Pioggia, Franco | Sinergia | Importada | Referencia anterior |
| La mirada que me define | Lajoinie, María Delfina | Identidad | Importada | Referencia anterior |
| Tocando Fondo | Magallanes Diaz, Lara Jazmín | Entorno | Pendiente | Referencia anterior |
| Sincronia | Mansilla Torres, Nicolas | Entorno | Importada | Referencia anterior |
| Melod.ia | Migone, Maria Candela | Identidad | Importada | Referencia anterior |
| Hasta agotar stock | Orbaiceta, Catalina | Identidad | Importada | Referencia anterior |
| AIRE | Panelli, Dolores | Alienación | Importada | Referencia anterior |
| Twinema Paradincaa | Riol Fernández, Juan Cruz | Identidad | Importada | Referencia anterior |
| tesis.wav | Rojas Rabassio, Juliana | Sensorialidad | Importada | Referencia anterior |
| Super Slime Factory | Rossetti, Matías | Sinergia | Importada | Referencia anterior |
| Galaxia | Sago, Suyay | Sensorialidad | Importada | Referencia anterior |
| engrai²S | Segundo, Tatiana | Sensorialidad | Importada | Referencia anterior |
| Seraph.exe | Triolo, Valentina | Alienación | Importada | Referencia anterior |
| Nimbo | Ubaldi, Guadalupe | Sensorialidad | Importada | 1 nueva(s) |

## Editar contenido

Las fichas están en `index.html`, dentro de cada `<article class="work-card">`. El título, autor y descripción se leen de su HTML; `data-category`, `data-youtube`, `data-research` y `data-images` completan los datos. Las fotos viven en `assets/`. Cuando una obra tiene varias fotos, `data-images` usa rutas relativas separadas por comas.

El `<img>` de la ficha define su portada. Si falta una foto de portada, el catálogo toma la primera de `data-images`. El detalle conserva el orden de esa lista e incluye la portada. `data-youtube` acepta el identificador o la URL del video y agrega su miniatura al inicio del carrusel.

Se conservaron los identificadores `data-slug` y `data-alumno` de las obras existentes para no romper sus enlaces. Por eso algunos identificadores internos mantienen títulos antiguos; el texto visible es el actualizado.

Si se agrega o elimina una obra, actualizar también `#student-list` y las opciones de `#panel-alumnos`. Los contadores por categoría y la lista del detalle se calculan automáticamente desde las fichas.
