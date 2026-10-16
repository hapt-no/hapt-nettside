// Fargesett for verktøyene: mørk (standard), grå eller lys, som i hapt-o-clock. Huskes i nettleseren.
(function () {
  var rot = document.documentElement, valgt = 'mork';
  try { valgt = localStorage.getItem('hapt-tema') || 'mork'; } catch (e) {}
  if (valgt === 'gra' || valgt === 'lys') rot.dataset.tema = valgt;
  // På smal skjerm kan fanene sveipes: vis den valgte fanen midt i raden. Gjør ingenting mens
  // siden er skjult bak PIN-koden (las.js), som derfor kaller den igjen etter opplåsing.
  function midtstill() {
    var nav = document.querySelector('header.site nav'), aktiv = nav && nav.querySelector('[aria-current="page"]');
    if (aktiv && nav.scrollWidth > nav.clientWidth) nav.scrollLeft += aktiv.getBoundingClientRect().left - nav.getBoundingClientRect().left - (nav.clientWidth - aktiv.offsetWidth) / 2;
  }
  window.haptMidtstillFane = midtstill;
  document.addEventListener('DOMContentLoaded', function () {
    var topp = document.querySelector('header.site');
    if (!topp) return;
    var boks = document.createElement('div');
    boks.className = 'tema'; boks.setAttribute('role', 'group'); boks.setAttribute('aria-label', 'Fargesett');
    [['mork', 'Mørk'], ['gra', 'Grå'], ['lys', 'Lys']].forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = t[1]; b.dataset.tema = t[0];
      b.setAttribute('aria-pressed', t[0] === valgt ? 'true' : 'false');
      b.onclick = function () {
        valgt = t[0];
        if (valgt === 'mork') delete rot.dataset.tema; else rot.dataset.tema = valgt;
        try { localStorage.setItem('hapt-tema', valgt); } catch (e) {}
        boks.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      };
      boks.appendChild(b);
    });
    topp.appendChild(boks);
    midtstill();
  });
})();
