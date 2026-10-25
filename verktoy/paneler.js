// Panelbibliotek for LED-kalkulatoren.
// Mål i mm, oppløsning i piksler per panel, vekt i kg per panel, effekt i watt per panel.
// Kilder: produsentenes datablad og produktsider (unilumin.com, absen.com, infiled.com, roevisual.com) og
// ledwallcentral.com. Utleiepanelene (Absen, INFiLED, ROE, Unilumin URM III) ble valgt i oktober 2026 etter hva
// utleiefirmaer i Norge og Europa har på lager. Der en modell finnes i flere versjoner med ulike tall, er det
// tyngste og mest strømkrevende tallet brukt, så rigg og kurser havner på den sikre siden. Sjekk mot eget datablad.
// merk / merkEn: kort merknad som vises under resultatet når panelet er valgt.
// Egne paneler lagres i nettleseren (localStorage) under nøkkelen «hapt-paneler».
(function () {
  var innebygd = [
    { id: 'uni-xs26', navn: 'Unilumin XS 2.6', b: 500, h: 500, px: 192, py: 192, kg: 7.7, maks: 150, snitt: 45, pitch: 2.6 },
    { id: 'uni-xs39', navn: 'Unilumin XS 3.9', b: 500, h: 500, px: 128, py: 128, kg: 7.7, maks: 150, snitt: 45, pitch: 3.9 },
    { id: 'uni-upad4-26', navn: 'Unilumin Upad IV 2.6', b: 500, h: 500, px: 192, py: 192, kg: 7.2, maks: 160, snitt: 55, pitch: 2.6 },
    // Unilumin URM III (inne). 2.6: V3R2-databladet 2023/5 (8 kg, 140/45 W), litt over nyere XC-utgave (7,9 kg, 130/45 W).
    // 3.9: V3R2-databladet 2023/5 V2.8.
    { id: 'uni-urm3-26', navn: 'Unilumin URM III 2.6 inne', b: 500, h: 500, px: 192, py: 192, kg: 8, maks: 140, snitt: 45, pitch: 2.604 },
    { id: 'uni-urm3-39-2h', navn: 'Unilumin URM III 3.9 inne', fam: 'urm3-39-inne', b: 500, h: 1000, px: 128, py: 256, kg: 14, maks: 248, snitt: 72, pitch: 3.906 },
    { id: 'uni-urm3-39', navn: 'Unilumin URM III 3.9 inne', fam: 'urm3-39-inne', b: 500, h: 500, px: 128, py: 128, kg: 8, maks: 124, snitt: 36, pitch: 3.906 },
    // Glux BAtn 6: oppløsning bekreftet av Martin; vekt fra BAtn-serien, effekt anslått fra BAtn 10-databladet (270/135 W per panel)
    { id: 'glux-batn6', navn: 'Glux BAtn 6', b: 500, h: 1000, px: 72, py: 144, kg: 4.8, maks: 270, snitt: 135, pitch: 6.94 },
    // Uniview UR Pro (ledwallcentral.com). 50 × 100 er «2H»-panelene. Pixel Logic oppgir 12,5 kg for 50 × 100, så sjekk vekten mot databladet.
    // fam: paneler med samme fam har samme bredde og pitch og kan blandes i samme vegg (store + små).
    { id: 'univ-urpro26-2h', navn: 'Uniview UR Pro 2.6 inne', fam: 'urpro26-inne', b: 500, h: 1000, px: 192, py: 384, kg: 11.4, maks: 300, snitt: 100, pitch: 2.604 },
    { id: 'univ-urpro26', navn: 'Uniview UR Pro 2.6 inne', fam: 'urpro26-inne', b: 500, h: 500, px: 192, py: 192, kg: 6.8, maks: 150, snitt: 50, pitch: 2.604 },
    { id: 'univ-urpro29-2h', navn: 'Uniview UR Pro 2.9 inne', fam: 'urpro29-inne', b: 500, h: 1000, px: 168, py: 336, kg: 11.4, maks: 300, snitt: 100, pitch: 2.976 },
    { id: 'univ-urpro29', navn: 'Uniview UR Pro 2.9 inne', fam: 'urpro29-inne', b: 500, h: 500, px: 168, py: 168, kg: 6.8, maks: 150, snitt: 50, pitch: 2.976 },
    { id: 'univ-urpro39-2h', navn: 'Uniview UR Pro 3.9 inne', fam: 'urpro39-inne', b: 500, h: 1000, px: 128, py: 256, kg: 11.4, maks: 300, snitt: 100, pitch: 3.906 },
    { id: 'univ-urpro39', navn: 'Uniview UR Pro 3.9 inne', fam: 'urpro39-inne', b: 500, h: 500, px: 128, py: 128, kg: 6.8, maks: 150, snitt: 50, pitch: 3.906 },
    { id: 'univ-urpro29-2h-ute', navn: 'Uniview UR Pro 2.9 ute', fam: 'urpro29-ute', b: 500, h: 1000, px: 168, py: 336, kg: 12, maks: 340, snitt: 110, pitch: 2.976 },
    { id: 'univ-urpro29-ute', navn: 'Uniview UR Pro 2.9 ute', fam: 'urpro29-ute', b: 500, h: 500, px: 168, py: 168, kg: 9, maks: 170, snitt: 55, pitch: 2.976 },
    { id: 'univ-urpro39-2h-ute', navn: 'Uniview UR Pro 3.9 ute', fam: 'urpro39-ute', b: 500, h: 1000, px: 128, py: 256, kg: 12, maks: 340, snitt: 110, pitch: 3.906 },
    { id: 'univ-urpro39-ute', navn: 'Uniview UR Pro 3.9 ute', fam: 'urpro39-ute', b: 500, h: 500, px: 128, py: 128, kg: 9, maks: 170, snitt: 55, pitch: 3.906 },

    // Absen Polaris (absen.com / usabsen.com). PL2.5 Pro V10: 8,8 kg i siste datablad (V20221215), eldre 8,6 kg.
    { id: 'absen-pl25pro-v2', navn: 'Absen PL2.5 Pro V2', b: 500, h: 500, px: 200, py: 200, kg: 7.8, maks: 170, snitt: 57.5, pitch: 2.5 },
    { id: 'absen-pl25pro-v10', navn: 'Absen PL2.5 Pro V10', b: 500, h: 500, px: 200, py: 200, kg: 8.8, maks: 170, snitt: 57.5, pitch: 2.5 },
    { id: 'absen-pl29-v10', navn: 'Absen PL2.9 V10', b: 500, h: 500, px: 168, py: 168, kg: 8, maks: 135, snitt: 45, pitch: 2.976 },
    { id: 'absen-pl29pro-v2', navn: 'Absen PL2.9 Pro V2', b: 500, h: 500, px: 168, py: 168, kg: 8, maks: 152.5, snitt: 51, pitch: 2.976 },
    // PL3.9 Pro: inne og ute. V3 kom i desember 2025; databladet sier 11,5 kg for 50 × 100, produktsiden 12 kg (brukt her).
    { id: 'absen-pl39pro-v2-2h', navn: 'Absen PL3.9 Pro V2', fam: 'pl39pro-v2', b: 500, h: 1000, px: 128, py: 256, kg: 13, maks: 400, snitt: 133.5, pitch: 3.906 },
    { id: 'absen-pl39pro-v2', navn: 'Absen PL3.9 Pro V2', fam: 'pl39pro-v2', b: 500, h: 500, px: 128, py: 128, kg: 8, maks: 200, snitt: 66.75, pitch: 3.906 },
    { id: 'absen-pl39pro-v3-2h', navn: 'Absen PL3.9 Pro V3', fam: 'pl39pro-v3', b: 500, h: 1000, px: 128, py: 256, kg: 12, maks: 360, snitt: 120, pitch: 3.906 },
    { id: 'absen-pl39pro-v3', navn: 'Absen PL3.9 Pro V3', fam: 'pl39pro-v3', b: 500, h: 500, px: 128, py: 128, kg: 7, maks: 180, snitt: 60, pitch: 3.906 },

    // INFiLED (infiled.com). AR3.9: tallene for ARmk2 (12,5 kg, 360/120 W), som er over første versjon (12,46 kg, 270/90 W).
    { id: 'infiled-ar39-2h', navn: 'INFiLED AR3.9', fam: 'ar39', b: 500, h: 1000, px: 128, py: 256, kg: 12.5, maks: 360, snitt: 120, pitch: 3.906 },
    { id: 'infiled-ar39', navn: 'INFiLED AR3.9', fam: 'ar39', b: 500, h: 500, px: 128, py: 128, kg: 8, maks: 180, snitt: 60, pitch: 3.906 },
    // DB2.6 Pro: 150/50 W i begge versjoner. Vekt fra første versjon (8,8 kg); INFiLED oppgir 8 kg for DBmk2, men kg og lb spriker der.
    { id: 'infiled-db26pro', navn: 'INFiLED DB2.6 Pro', b: 500, h: 500, px: 192, py: 192, kg: 8.8, maks: 150, snitt: 50, pitch: 2.604 },

    // ROE Visual (roevisual.com). Black Quartz: ROE oppgir 22 kg med støtteramme for 50 × 100 (17,8 kg uten).
    { id: 'roe-bq39', navn: 'ROE Black Quartz BQ3.9', fam: 'bq39', b: 500, h: 1000, px: 128, py: 256, kg: 22, maks: 360, snitt: 180, pitch: 3.906,
      merk: 'ROE Black Quartz: vekten for 50 × 100 er med støtteramme, slik ROE oppgir den (17,8 kg uten).', merkEn: 'ROE Black Quartz: the 50 × 100 weight includes the support frame, as ROE lists it (17.8 kg without).' },
    { id: 'roe-bq39-half', navn: 'ROE Black Quartz BQ3.9', fam: 'bq39', b: 500, h: 500, px: 128, py: 128, kg: 9.8, maks: 190, snitt: 85, pitch: 3.906 },
    { id: 'roe-bq46', navn: 'ROE Black Quartz BQ4.6', fam: 'bq46', b: 500, h: 1000, px: 108, py: 216, kg: 22, maks: 370, snitt: 185, pitch: 4.63,
      merk: 'ROE Black Quartz: vekten for 50 × 100 er med støtteramme, slik ROE oppgir den (17,8 kg uten).', merkEn: 'ROE Black Quartz: the 50 × 100 weight includes the support frame, as ROE lists it (17.8 kg without).' },
    { id: 'roe-bq46-half', navn: 'ROE Black Quartz BQ4.6', fam: 'bq46', b: 500, h: 500, px: 108, py: 108, kg: 9.8, maks: 190, snitt: 85, pitch: 4.63 },
    // Carbon CB5 (første versjon): hvit utgave 500/250 W, Black HB 650/330 W. Den høyeste er brukt.
    { id: 'roe-cb5', navn: 'ROE Carbon CB5', fam: 'cb5', b: 600, h: 1200, px: 104, py: 208, kg: 13.85, maks: 650, snitt: 330, pitch: 5.77,
      merk: 'ROE Carbon CB5 (første versjon): strømmen er regnet med Black HB-utgaven, 650 W per panel. Den vanlige hvite trekker 500 W.', merkEn: 'ROE Carbon CB5 (first version): power is based on the Black HB version, 650 W per panel. The standard white one draws 500 W.' },
    { id: 'roe-cb5-half', navn: 'ROE Carbon CB5', fam: 'cb5', b: 600, h: 600, px: 104, py: 104, kg: 7.95, maks: 250, snitt: 130, pitch: 5.77 },
    { id: 'roe-cb5mk2', navn: 'ROE Carbon CB5 MKII', fam: 'cb5mk2', b: 600, h: 1200, px: 104, py: 208, kg: 13.6, maks: 480, snitt: 240, pitch: 5.77 },
    { id: 'roe-cb5mk2-half', navn: 'ROE Carbon CB5 MKII', fam: 'cb5mk2', b: 600, h: 600, px: 104, py: 104, kg: 7.2, maks: 250, snitt: 125, pitch: 5.77 },
    { id: 'roe-dm26', navn: 'ROE Diamond DM2.6', b: 500, h: 500, px: 192, py: 192, kg: 5.76, maks: 180, snitt: 90, pitch: 2.604 },
    { id: 'roe-rb23', navn: 'ROE Ruby RB2.3', b: 500, h: 500, px: 216, py: 216, kg: 8.16, maks: 180, snitt: 90, pitch: 2.315 },
    { id: 'roe-rb26', navn: 'ROE Ruby RB2.6', b: 500, h: 500, px: 192, py: 192, kg: 8.5, maks: 160, snitt: 80, pitch: 2.604 },
    // Topaz: nåværende datablad (februar 2026). Tidlige ark oppga mer (TP2.6 8,4 kg 190/95 W, TP1.9 160/80 W).
    { id: 'roe-tp19', navn: 'ROE Topaz TP1.9', b: 500, h: 500, px: 256, py: 256, kg: 8.3, maks: 140, snitt: 70, pitch: 1.953 },
    { id: 'roe-tp26', navn: 'ROE Topaz TP2.6', b: 500, h: 500, px: 192, py: 192, kg: 8, maks: 140, snitt: 70, pitch: 2.604 },
    // Vanish: gjennomsiktige. V8T er turnéutgaven (100 × 100 og 100 × 50).
    { id: 'roe-v8', navn: 'ROE Vanish V8', b: 1000, h: 500, px: 112, py: 56, kg: 6.5, maks: 320, snitt: 160, pitch: 8.93 },
    { id: 'roe-v8t', navn: 'ROE Vanish V8T', fam: 'v8t', b: 1000, h: 1000, px: 112, py: 112, kg: 18.2, maks: 480, snitt: 240, pitch: 8.93 },
    { id: 'roe-v8t-h', navn: 'ROE Vanish V8T', fam: 'v8t', b: 1000, h: 500, px: 112, py: 56, kg: 11.22, maks: 260, snitt: 130, pitch: 8.93 },
    // Vanish ST V4ST: ROE oppgir vekten med stige (34,5 kg; 27,5 kg uten for 100 × 100). Maks 5 hele per strømkjede (220 V / 16 A).
    { id: 'roe-v4st', navn: 'ROE Vanish ST V4ST', fam: 'v4st', b: 1000, h: 1000, px: 216, py: 216, kg: 34.5, maks: 700, snitt: 350, pitch: 4.63,
      merk: 'ROE Vanish ST: vekten er med stige, slik ROE oppgir den (27,5 kg uten for 100 × 100). ROE tillater maks 5 hele paneler per strømkjede.', merkEn: 'ROE Vanish ST: the weight includes the ladder, as ROE lists it (27.5 kg without for 100 × 100). ROE allows at most 5 full panels per power link.' },
    { id: 'roe-v4st-h', navn: 'ROE Vanish ST V4ST', fam: 'v4st', b: 1000, h: 500, px: 216, py: 108, kg: 21.5, maks: 350, snitt: 175, pitch: 4.63 }
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
    finn: function (id) { return this.alle().filter(function (p) { return p.id === id; })[0]; },
    // Et lite panel (halv høyde) i samme familie som p, hvis det finnes
    lite: function (p) {
      if (!p || !p.fam) return null;
      return innebygd.filter(function (x) { return x.fam === p.fam && x.b === p.b && x.px === p.px && x.h * 2 === p.h && x.py * 2 === p.py; })[0] || null;
    }
  };
})();
