// Panelbibliotek for LED-kalkulatoren og testbildet.
// Mål i mm, oppløsning i piksler per panel, vekt i kg per panel, effekt i watt per panel.
// Kilder: Unilumin XS-datablad (unilumin.com) og ledwallcentral.com (Uniview). Sjekk mot eget datablad før bruk.
// Egne paneler lagres i nettleseren (localStorage) under nøkkelen «hapt-paneler».
(function () {
  var innebygd = [
    { id: 'uni-xs26', navn: 'Unilumin XS 2.6', b: 500, h: 500, px: 192, py: 192, kg: 7.7, maks: 150, snitt: 45, pitch: 2.6 },
    { id: 'uni-xs39', navn: 'Unilumin XS 3.9', b: 500, h: 500, px: 128, py: 128, kg: 7.7, maks: 150, snitt: 45, pitch: 3.9 },
    { id: 'uni-upad4-26', navn: 'Unilumin Upad IV 2.6', b: 500, h: 500, px: 192, py: 192, kg: 7.2, maks: 160, snitt: 55, pitch: 2.6 },
    // Glux BAtn 6: oppløsning bekreftet av Martin; vekt fra BAtn-serien, effekt anslått fra BAtn 10-databladet (270/135 W per panel)
    { id: 'glux-batn6', navn: 'Glux BAtn 6', b: 500, h: 1000, px: 72, py: 144, kg: 4.8, maks: 270, snitt: 135, pitch: 6.94 },
    // Uniview UR Pro 2H (500 × 1000 mm): ledwallcentral.com. Pixel Logic oppgir 12,5 kg for de samme panelene, så sjekk vekten mot databladet.
    { id: 'univ-urpro26-2h', navn: 'Uniview UR Pro 2.6 inne', b: 500, h: 1000, px: 192, py: 384, kg: 11.4, maks: 300, snitt: 100, pitch: 2.604 },
    { id: 'univ-urpro29-2h', navn: 'Uniview UR Pro 2.9 inne', b: 500, h: 1000, px: 168, py: 336, kg: 11.4, maks: 300, snitt: 100, pitch: 2.976 },
    { id: 'univ-urpro39-2h', navn: 'Uniview UR Pro 3.9 inne', b: 500, h: 1000, px: 128, py: 256, kg: 11.4, maks: 300, snitt: 100, pitch: 3.906 },
    { id: 'univ-urpro29-2h-ute', navn: 'Uniview UR Pro 2.9 ute', b: 500, h: 1000, px: 168, py: 336, kg: 12, maks: 340, snitt: 110, pitch: 2.976 },
    { id: 'univ-urpro39-2h-ute', navn: 'Uniview UR Pro 3.9 ute', b: 500, h: 1000, px: 128, py: 256, kg: 12, maks: 340, snitt: 110, pitch: 3.906 }
  ];

  function hentEgne() {
    try { return JSON.parse(localStorage.getItem('hapt-paneler') || '[]'); } catch (e) { return []; }
  }
  function lagreEgne(liste) {
    try { localStorage.setItem('hapt-paneler', JSON.stringify(liste)); } catch (e) {}
  }

  window.HaptPaneler = {
    innebygd: innebygd,
    alle: function () { return innebygd.concat(hentEgne()); },
    egne: hentEgne,
    lagreEgne: lagreEgne,
    finn: function (id) { return this.alle().filter(function (p) { return p.id === id; })[0]; }
  };
})();
