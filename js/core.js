
/* Lógica pura, compartida por la interfaz y las pruebas. Sin dependencias. */
(function (root) {
  'use strict';
  const categories = ['alienacion', 'entorno', 'identidad', 'sensorialidad', 'sinergia'];
  const eventAt = Date.parse('2026-11-28T19:00:00-03:00');
  const countdownAt = eventAt - 7 * 24 * 60 * 60 * 1000;
  function values(params, name) {
    return [...new Set((params.get(name) || '').split(',').filter(Boolean))];
  }
  function readFilters(params, people) {
    return {
      categories: values(params, 'categoria').filter(value => categories.includes(value)),
      students: values(params, 'alumno').filter(value => people.includes(value))
    };
  }
  function matches(work, filters, desktop) {
    return (!filters.categories.length || filters.categories.includes(work.category)) &&
      (desktop || !filters.students.length || filters.students.includes(work.student));
  }
  function countdown(now) {
    const total = Math.max(0, Math.ceil((eventAt - now) / 1000));
    return {
      active: now >= countdownAt && now < eventAt,
      ended: now >= eventAt,
      days: Math.floor(total / 86400),
      hours: Math.floor(total / 3600) % 24,
      minutes: Math.floor(total / 60) % 60,
      seconds: total % 60
    };
  }
  const api = {categories, eventAt, countdownAt, readFilters, matches, countdown};
  root.Artimanas = api;
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
})(typeof window !== 'undefined' ? window : globalThis);

