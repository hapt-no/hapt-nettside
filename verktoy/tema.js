// Språk for verktøyene: norsk (standard) eller engelsk. Samme valg og nøkkel som forsiden (hapt-lang).
// Fast tekst: data-en="…" på elementet (byttes som innerHTML), og data-en-placeholder / data-en-title /
// data-en-aria-label for attributter. Tekst som skriptene lager: HaptSprak.t('norsk', 'english').
// Ved bytte sendes hendelsen «hapt-sprak» på window, så sidene kan regne og tegne på nytt.
(function () {
  var sprak = 'no';
  try { if (localStorage.getItem('hapt-lang') === 'en') sprak = 'en'; } catch (e) {}
  var ATTR = ['placeholder', 'title', 'aria-label'];
  // Fanene og «verktøy» i topplinja er like på alle sidene, så de oversettes her
  var FANER = { 'led': 'LED wall', 'projektor': 'Projector', 'testbilde': 'Test pattern', 'pixelmap': 'Pixel map', 'syncfilm': 'Sync video', 'opptak': 'Recording', 'edid': 'EDID', 'vario': 'Vario', 'klokke': 'Clock' };
  function topplinje() {
    document.querySelectorAll('header.site nav a').forEach(function (a) {
      var del = ''; try { del = new URL(a.getAttribute('href') || '', location.href).pathname.replace(/\/(index\.html)?$/, '').split('/').pop() || ''; } catch (e) {}
      if (a.dataset.en == null && FANER[del]) a.dataset.en = FANER[del];
    });
    document.querySelectorAll('header.site .brand span').forEach(function (s) {
      if (s.dataset.en == null && s.textContent.trim() === 'verktøy') s.dataset.en = 'tools';
    });
  }
  function bruk(rot) {
    rot = rot || document;
    var liste = rot.querySelectorAll ? Array.prototype.slice.call(rot.querySelectorAll('[data-en]')) : [];
    if (rot.matches && rot.matches('[data-en]')) liste.push(rot);
    liste.forEach(function (n) {
      if (n.dataset.no == null) n.dataset.no = n.innerHTML;
      var ny = sprak === 'en' ? n.dataset.en : n.dataset.no;
      if (n.innerHTML !== ny) n.innerHTML = ny;
    });
    ATTR.forEach(function (a) {
      var sel = '[data-en-' + a + ']';
      var l2 = rot.querySelectorAll ? Array.prototype.slice.call(rot.querySelectorAll(sel)) : [];
      if (rot.matches && rot.matches(sel)) l2.push(rot);
      l2.forEach(function (n) {
        var noKey = 'data-no-' + a;
        if (!n.hasAttribute(noKey)) n.setAttribute(noKey, n.getAttribute(a) || '');
        n.setAttribute(a, sprak === 'en' ? n.getAttribute('data-en-' + a) : n.getAttribute(noKey));
      });
    });
  }
  function settKnapper() {
    document.querySelectorAll('.sprakvalg button').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.sprak === sprak ? 'true' : 'false'); });
  }
  window.HaptSprak = {
    en: function () { return sprak === 'en'; },
    kode: function () { return sprak; },
    t: function (no, en) { return sprak === 'en' && en != null ? en : no; },
    bruk: bruk,
    sett: function (l) {
      sprak = l === 'en' ? 'en' : 'no';
      try { localStorage.setItem('hapt-lang', sprak); } catch (e) {}
      document.documentElement.lang = sprak === 'en' ? 'en' : 'no';
      bruk(document); settKnapper();
      if (window.haptMidtstillFane) window.haptMidtstillFane();
      window.dispatchEvent(new CustomEvent('hapt-sprak', { detail: sprak }));
    }
  };
  document.documentElement.lang = sprak === 'en' ? 'en' : 'no';
  document.addEventListener('DOMContentLoaded', function () { topplinje(); bruk(document); });
})();

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
    var valg = document.createElement('div');
    valg.className = 'valg';
    // Språkvalg NO / EN
    var sv = document.createElement('div');
    sv.className = 'tema sprakvalg'; sv.setAttribute('role', 'group'); sv.setAttribute('aria-label', 'Språk / Language');
    [['no', 'NO'], ['en', 'EN']].forEach(function (l) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = l[1]; b.dataset.sprak = l[0];
      b.setAttribute('aria-pressed', HaptSprak.kode() === l[0] ? 'true' : 'false');
      b.onclick = function () { HaptSprak.sett(l[0]); };
      sv.appendChild(b);
    });
    valg.appendChild(sv);
    var boks = document.createElement('div');
    boks.className = 'tema'; boks.setAttribute('role', 'group'); boks.setAttribute('aria-label', 'Fargesett');
    boks.dataset.enAriaLabel = 'Colour scheme';
    [['mork', 'Mørk', 'Dark'], ['gra', 'Grå', 'Grey'], ['lys', 'Lys', 'Light']].forEach(function (t) {
      var b = document.createElement('button');
      b.type = 'button'; b.textContent = t[1]; b.dataset.tema = t[0]; b.dataset.en = t[2];
      b.setAttribute('aria-pressed', t[0] === valgt ? 'true' : 'false');
      b.onclick = function () {
        valgt = t[0];
        if (valgt === 'mork') delete rot.dataset.tema; else rot.dataset.tema = valgt;
        try { localStorage.setItem('hapt-tema', valgt); } catch (e) {}
        boks.querySelectorAll('button').forEach(function (x) { x.setAttribute('aria-pressed', x === b ? 'true' : 'false'); });
      };
      boks.appendChild(b);
    });
    valg.appendChild(boks);
    topp.appendChild(valg);
    HaptSprak.bruk(valg);
    midtstill();
  });
})();
