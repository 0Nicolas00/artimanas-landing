# Artimañas Landing Page

Landing page de una sola página desarrollada de forma colaborativa por un equipo de 3 personas.

## Stack inicial

- HTML5
- CSS3
- JavaScript (ES6+)
- Git + GitHub

La estructura se mantiene deliberadamente simple para poder implementar el diseño aprobado sin agregar complejidad innecesaria.

## Estructura

```text
artimanas-landing/
├── assets/
│   ├── icons/
│   └── images/
├── css/
│   └── styles.css
├── js/
│   └── main.js
├── index.html
└── README.md
```

## Flujo de trabajo

`main` debe mantenerse estable. Cada integrante trabaja en una rama propia por tarea o sección.

Ejemplos:

```bash
git checkout main
git pull origin main
git checkout -b feature/hero
```

Al terminar una tarea:

```bash
git add .
git commit -m "Crear sección hero"
git push -u origin feature/hero
```

Después se crea un Pull Request hacia `main` para que otro integrante pueda revisar los cambios antes de integrarlos.

## Convenciones

- Nombres de ramas: `feature/nombre-seccion`, `fix/nombre-error`.
- Commits cortos y descriptivos: `Crear navbar`, `Agregar responsive del hero`, `Corregir menú mobile`.
- Evitar editar simultáneamente la misma sección sin coordinarlo.
- Antes de empezar una tarea, actualizar `main` con `git pull`.
- Los estilos globales y variables compartidas se modifican con cuidado porque afectan a toda la landing.

## Desarrollo local

Por ser una landing estática, puede abrirse `index.html` directamente o utilizarse Live Server desde VS Code.
