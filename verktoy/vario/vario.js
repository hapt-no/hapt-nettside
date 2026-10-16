// Byggeoppskrift for AV Stumpfl Vario-lerret. Kan testes med node (module.exports nederst).
// Kilder: avstumpfl.com (Vario specs, manual, frame/surface-sidene), forhandlerlister (BVS-X-deler), Theatrixx/Audio General produktguide.
// Antakelse: hvert hjørne har 50 cm ben, så en side = 50 + elementer + 50. Det stemmer med alle Stumpfls standardstørrelser
// (f.eks. 210 = 50 + 110 + 50, 240 = 50 + 110 + 30 + 50). Sjekk etikettene på delene.
(function (root) {
  'use strict';

  var HJORNE = 50;
  var system = {
    32: {
      navn: 'Vario 32', profil: '32 × 32 mm', kant: 5,
      deler: [110, 100, 90, 85, 80, 70, 65, 60, 45, 30],
      sikker: true,
      maks: [450, 335],
      midtstotte: 500, midtbein: 600,
      vekt: function (o) { return 17 + (o - 740) * 0.0125; },
      bein: 'T32'
    },
    64: {
      navn: 'Vario 64', profil: '64 × 32 mm', kant: 10,
      deler: [110, 100, 90, 85, 80, 70, 65, 60, 45, 30],
      sikker: false,
      maks: [1200, 600],
      midtstotte: 700, midtbein: 700,
      vekt: function (o) { return 39 + (o - 1400) * 0.03; },
      bein: 'AT32/64'
    }
  };

  var standard = {
    32: [[210, 160, 17], [240, 180, 19], [280, 210, 20], [320, 245, 21], [360, 270, 23], [400, 300, 25], [280, 160, 19], [310, 180, 20], [365, 210, 22], [420, 240, 23], [460, 270, 26], [250, 160, 18], [282, 180, 19], [330, 210, 21], [378, 240, 23], [426, 270, 26], [410, 210, 22], [500, 250, 29], [600, 300, 34], [610, 210, 32]],
    64: [[400, 300, 39], [500, 380, 46], [600, 450, 53], [700, 520, 75], [800, 600, 81], [365, 210, 36], [420, 240, 38], [460, 270, 41], [540, 310, 46], [650, 370, 53], [372, 240, 38], [420, 270, 40], [484, 310, 44], [580, 370, 52], [708, 450, 78], [800, 400, 77], [1200, 400, 93]]
  };

  var duker = [
    { id: 'white-ci', navn: 'Flex White CI', type: 'Front', gain: '1,02', vinkel: '±50°', bredde: 210, note: '100 % lystett' },
    { id: 'rear-ci', navn: 'Flex Rear CI', type: 'Bak', gain: '1,18', vinkel: '±45°', bredde: 210, note: 'SeamlessOptic som tillegg over 210 cm' },
    { id: 'rear-mo', navn: 'Flex Rear MO', type: 'Bak', gain: '2,25', vinkel: '±45°', bredde: 305, note: 'Høy gain, smalere betraktningsvinkel' },
    { id: 'dual-mo', navn: 'Flex Dual MO', type: 'Front og bak', gain: '0,62 / 0,78', vinkel: '', bredde: 305, note: 'Bilde synlig fra begge sider' }
  ];

  var bein = [
    { navn: 'T32', hoyde: 220, min: 6, maks: 82, profil: [32] },
    { navn: 'AT32', hoyde: 320, min: 6, maks: 113, profil: [32] },
    { navn: 'AT32/64', hoyde: 430, min: 9, maks: 146, profil: [32, 64] },
    { navn: 'AT48', hoyde: 415, min: 9, maks: 161, profil: [64] },
    { navn: 'AT64', hoyde: 550, min: 9, maks: 176, profil: [64] }
  ];

  // Finn færrest mulig elementer som fyller lengden nøyaktig (i cm). Ved likt antall: flest 110-elementer.
  function fyll(lengde, deler) {
    if (lengde === 0) return [];
    if (lengde < 0) return null;
    var best = [null];
    for (var l = 1; l <= lengde; l++) {
      best[l] = null;
      for (var i = 0; i < deler.length; i++) {
        var d = deler[i];
        if (d > l || (l - d > 0 && !best[l - d] && l - d !== 0)) continue;
        var forrige = l - d === 0 ? [] : best[l - d];
        if (!forrige) continue;
        var kand = forrige.concat([d]);
        if (!best[l] || kand.length < best[l].length || (kand.length === best[l].length && antall110(kand) > antall110(best[l]))) best[l] = kand;
      }
    }
    return best[lengde];
  }
  function antall110(l) { return l.filter(function (x) { return x === 110; }).length; }

  // Rekkefølge langs siden: tilpasningsdeler ytterst, 110-elementer i midten (som i manualen: «6, 5, (6)»)
  function rekkefolge(deler) {
    var std = deler.filter(function (d) { return d === 110; });
    var til = deler.filter(function (d) { return d !== 110; }).sort(function (a, b) { return b - a; });
    if (!til.length) return std;
    var ut = [til[0]].concat(std);
    if (til[1]) ut.push(til[1]);
    return ut.concat(til.slice(2));
  }

  // Nærmeste side som lar seg bygge (5 cm steg)
  function nermesteSide(L, deler) {
    L = Math.round(L / 5) * 5;
    for (var d = 0; d < 200; d += 5) {
      if (L - d >= 100 && fyll(L - d - 100, deler)) return L - d === L ? L : (fyll(L + d - 100, deler) ? L + d : L - d);
      if (fyll(L + d - 100, deler)) return L + d;
    }
    return null;
  }

  // valg: { profil: 32|64|'auto', modus: 'bilde'|'ramme', b, h (cm), underkant (cm), duk }
  function regn(valg) {
    var res = { advarsler: [] };
    var p = valg.profil;
    var kantGuess = function (pp) { return system[pp].kant * 2; };
    var ob, oh;
    var tilRamme = function (pp) {
      return valg.modus === 'bilde' ? [valg.b + kantGuess(pp), valg.h + kantGuess(pp)] : [valg.b, valg.h];
    };
    if (p === 'auto') {
      var r32 = tilRamme(32);
      p = (r32[0] <= system[32].maks[0] && r32[1] <= system[32].maks[1]) || (r32[1] <= 310 && r32[0] <= 910) ? 32 : 64;
    }
    var s = system[p];
    var r = tilRamme(p);
    ob = nermesteSide(r[0], s.deler); oh = nermesteSide(r[1], s.deler);
    if (!ob || !oh) { res.feil = 'Klarer ikke å bygge den størrelsen.'; return res; }
    if (ob !== Math.round(r[0]) || oh !== Math.round(r[1])) res.advarsler.push('Justert til nærmeste størrelse som kan bygges: ' + ob + ' × ' + oh + ' cm ramme.');
    if (p === 32 && ((ob > 460 && oh > 310) || ob > 910 || oh > 345)) res.advarsler.push('Større enn Stumpfl lager Vario 32 som standard. Vurder Vario 64.');

    var bunn = rekkefolge(fyll(ob - 2 * HJORNE, s.deler));
    var side = rekkefolge(fyll(oh - 2 * HJORNE, s.deler));
    res.profil = p; res.system = s;
    res.ramme = [ob, oh];
    res.bilde = [ob - 2 * s.kant, oh - 2 * s.kant];
    res.topp = bunn.slice(); res.bunn = bunn.slice(); res.venstre = side.slice(); res.hoyre = side.slice();
    // Midtstøtter: én per påbegynt terskel-bredde (Vario 32: fra 500 cm, Vario 64: fra 700 cm). Midtbein fra 600 / 700 cm.
    res.midtstotter = Math.floor(ob / s.midtstotte);
    res.midtbein = ob >= s.midtbein ? res.midtstotter : 0;
    res.midtstotte = res.midtstotter > 0;
    if (res.midtstotte) {
      // Midtstøtta består av topp- og bunnstykke og elementer som på sidene
      res.midt = side.slice();
    }
    var teller = {};
    var legg = function (liste, gang) { liste.forEach(function (d) { teller[d] = (teller[d] || 0) + gang; }); };
    legg(bunn, 2); legg(side, 2); if (res.midt) legg(res.midt, res.midtstotter);
    res.deler = Object.keys(teller).map(Number).sort(function (a, b) { return b - a; }).map(function (d) { return { lengde: d, antall: teller[d] }; });
    res.antallElementer = res.deler.reduce(function (a, d) { return a + d.antall; }, 0);
    
    var omkrets = 2 * (ob + oh);
    var std = standard[p].filter(function (x) { return x[0] === ob && x[1] === oh; })[0];
    res.standard = !!std;
    res.vekt = std ? std[2] : Math.max(10, Math.round(s.vekt(omkrets)));

    // Duk
    var duk = duker.filter(function (d) { return d.id === valg.duk; })[0] || duker[0];
    res.duk = duk;
    res.skjoter = Math.max(0, Math.ceil(res.bilde[1] / duk.bredde) - 1);
    if (res.bilde[1] > duk.bredde && res.bilde[0] <= duk.bredde) res.skjoter = 0; // kan legges på tvers
    if (p === 64 && (ob >= 800 || (ob >= 708 && oh >= 450)) && duk.type !== 'Front') res.advarsler.push('Stumpfl leverer ikke bakprojeksjonsduk i denne størrelsen på Vario 64 som standard.');

    // Bein
    var uk = valg.underkant || 0;
    var passer = bein.filter(function (b) { return b.profil.indexOf(p) >= 0 && uk >= b.min && uk <= b.maks; });
    res.bein = passer[0] || null;
    res.beinAntall = 2 + res.midtbein;
    if (!res.bein) res.advarsler.push('Ingen standardbein gir ' + uk + ' cm til underkant. Høyeste er ' + (p === 32 ? 'AT32/64 (146 cm)' : 'AT64 (176 cm)') + '. Heng lerretet eller bygg det opp.');
    res.overkant = uk + oh;
    return res;
  }

  var api = { regn: regn, fyll: fyll, nermesteSide: nermesteSide, system: system, duker: duker, bein: bein, standard: standard, HJORNE: HJORNE };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaptVario = api;
})(this);
