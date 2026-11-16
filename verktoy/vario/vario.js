// Byggeoppskrift for AV Stumpfl Vario-lerret. Kan testes med node (module.exports nederst).
// Kilder: avstumpfl.com (Vario specs, manual, frame/surface-sidene), forhandlerlister (BVS-X-deler), Theatrixx/Audio General produktguide.
// Hjørnene (Stumpfls manual: «Basic frame (4 corners)»): 4 hjørner er en grunnramme på 210 × 210 cm, altså 105 cm ben.
// En side = 105 + elementer + 105 (f.eks. 320 = 105 + 110 + 105, 280 × 160 = hjørnesett 210 × 160 + 70 på topp og bunn).
// Vario 32 har også hjørnesett 210 × 180 og 210 × 160 (kortere loddrette ben) og 78 × 78; Vario 64 bare 210 × 210.
// Utleiesett (Graeske) går opp med denne modellen. Det hjørnesettet som gir færrest elementer velges, ved likt antall 210 × 210.
// 16:10-breddene 282, 378, 426 (Vario 32) og 372, 484, 708 (Vario 64) er ikke hele 5 cm, så de trenger tilpasningselementer
// som ikke står i elementlista. For dem brukes Stumpfls mål og vekt, tilpasningselementet regnes ut av rammemålet og merkes som ikke bekreftet.
(function (root) {
  'use strict';

  // Tekst følger språkvalget på siden (HaptSprak fra tema.js). Uten den (f.eks. i node) blir det norsk.
  function t(no, en) { return root && root.HaptSprak ? root.HaptSprak.t(no, en) : no; }

  // Lengden på hvert hjørneben (cm). b = vannrett ben, h = loddrett ben. liten: brukes bare for rammer under 210 × 160 cm.
  var HJORNE = 105;
  var HJORNESETT = {
    32: [{ navn: '210 × 210', b: 105, h: 105 }, { navn: '210 × 180', b: 105, h: 90 }, { navn: '210 × 160', b: 105, h: 80 }, { navn: '78 × 78', b: 39, h: 39, liten: true }],
    64: [{ navn: '210 × 210', b: 105, h: 105 }]
  };
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
    // Gain og vinkel fra Stumpfls nåværende datablad (sjekket 16.11.2026); eldre tall står i merknaden
    { id: 'white-ci', navn: 'Flex White CI', type: 'Front', typeEn: 'Front', gain: '0,96', vinkel: '±55°', bredde: 210, note: '100 % lystett. Eldre datablad oppgir gain 1,02', noteEn: '100% opaque. Older datasheets give gain 1.02' },
    { id: 'rear-ci', navn: 'Flex Rear CI', type: 'Bak', typeEn: 'Rear', gain: '0,89', vinkel: '±45°', bredde: 214, note: 'SeamlessOptic som standard på nyeste duk (rullbredde 220 cm). Eldre duk: gain 1,18, rullbredde 214 cm', noteEn: 'SeamlessOptic as standard on the newest surface (roll width 220 cm). Older surface: gain 1.18, roll width 214 cm' },
    { id: 'rear-mo', navn: 'Flex Rear MO', type: 'Bak', typeEn: 'Rear', gain: '2,05', vinkel: '±35°', bredde: 305, note: 'Høy gain, smalere betraktningsvinkel. Eldre utgave av duken: gain 2,25, ±45°', noteEn: 'High gain, narrower viewing angle. Older version of the surface: gain 2.25, ±45°' },
    { id: 'dual-mo', navn: 'Flex Dual MO', type: 'Front og bak', typeEn: 'Front and rear', gain: '0,49 / 0,94', vinkel: '±40° / ±45°', bredde: 305, note: 'Bilde synlig fra begge sider (gain og vinkel: front / bak). Eldre Stumpfl-datablad: gain 0,62 / 0,78', noteEn: 'Image visible from both sides (gain and angle: front / rear). Older Stumpfl datasheet: gain 0.62 / 0.78' }
  ];

  var bein = [
    { navn: 'T32', hoyde: 220, min: 6, maks: 82, profil: [32] },
    { navn: 'AT32', hoyde: 320, min: 6, maks: 113, profil: [32] },
    { navn: 'AT32/64', hoyde: 430, min: 9, maks: 146, profil: [32, 64] },
    { navn: 'AT48', hoyde: 415, min: 9, maks: 161, profil: [64] },
    { navn: 'AT64', hoyde: 550, min: 9, maks: 176, profil: [64] }
  ];

  // Finn færrest mulig elementer som fyller lengden nøyaktig (i cm). Ved likt antall: flest 110-elementer.
  // Tabellen (antall, antall 110, siste element per lengde) huskes per elementliste, så store mål ikke låser siden.
  var fyllTabell = {};
  function fyll(lengde, deler) {
    if (lengde === 0) return [];
    if (!(lengde > 0) || lengde % 1) return null;
    var key = deler.join(','), T = fyllTabell[key] || (fyllTabell[key] = { n: [0], n110: [0], sist: [0] });
    for (var l = T.n.length; l <= lengde; l++) {
      T.n[l] = Infinity; T.n110[l] = 0; T.sist[l] = 0;
      for (var i = 0; i < deler.length; i++) {
        var d = deler[i];
        if (d > l || T.n[l - d] === Infinity) continue;
        var kn = T.n[l - d] + 1, k110 = T.n110[l - d] + (d === 110 ? 1 : 0);
        if (kn < T.n[l] || (kn === T.n[l] && k110 > T.n110[l])) { T.n[l] = kn; T.n110[l] = k110; T.sist[l] = d; }
      }
    }
    if (T.n[lengde] === Infinity) return null;
    var ut = [];
    for (var x = lengde; x > 0; x -= T.sist[x]) ut.unshift(T.sist[x]);
    return ut;
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

  // Kan siden bygges nøyaktig av elementlista, med hjørneben ben (cm) i hver ende?
  function byggbar(L, deler, ben) {
    if (ben == null) ben = HJORNE;
    return L >= 2 * ben && (L - 2 * ben) % 5 === 0 && !!fyll(L - 2 * ben, deler);
  }

  // Nærmeste side som lar seg bygge. Ved lik avstand: den lengste.
  function nermesteSide(L, deler, ben) {
    L = Math.round(L);
    for (var d = 0; d < 200; d++) {
      if (byggbar(L - d, deler, ben)) return d === 0 ? L : (byggbar(L + d, deler, ben) ? L + d : L - d);
      if (byggbar(L + d, deler, ben)) return L + d;
    }
    return null;
  }

  // Hjørnesettene som kan brukes for denne rammen (78 × 78 bare for små rammer)
  function hjorneKandidater(r, p) {
    return HJORNESETT[p].filter(function (c) { return !c.liten || r[0] < 210 || r[1] < 160; });
  }
  // Går rammen opp nøyaktig med kjente elementer og et av hjørnesettene?
  function byggbarRamme(b, h, p) {
    var deler = system[p].deler;
    return HJORNESETT[p].some(function (c) { return byggbar(b, deler, c.b) && byggbar(h, deler, c.h); });
  }

  // Stumpfls 16:10-størrelser kan ikke lages med 5 cm-avrundingen. Ligger ønsket ramme innen 3 cm fra en av dem
  // (og går ikke opp nøyaktig selv), brukes standardstørrelsen. Andre størrelser regnes som før.
  function nermesteStandard(r, p) {
    var best = null, bestAvst = Infinity;
    standard[p].forEach(function (x) {
      var db = Math.abs(x[0] - r[0]), dh = Math.abs(x[1] - r[1]);
      if (db > 3 || dh > 3 || db + dh >= bestAvst) return;
      if (byggbarRamme(x[0], x[1], p)) return; // de lager 5 cm-avrundingen allerede
      best = x; bestAvst = db + dh;
    });
    if (best && byggbarRamme(Math.round(r[0]), Math.round(r[1]), p)) return null;
    return best;
  }

  // Elementer for en side. Går den ikke opp med elementlista, blir resten ett tilpasningselement
  // med utregnet lengde (ikke bekreftet). Færrest elementer, ved likt antall flest 110-elementer.
  function sideDeler(L, deler, ben) {
    var inne = L - 2 * ben, f = fyll(inne, deler);
    if (f) return f;
    var minst = Math.min.apply(null, deler), storst = Math.max.apply(null, deler), best = null;
    for (var k = 0; k <= inne - minst; k += 5) {
      var rest = inne - k, kjent = rest <= storst ? fyll(k, deler) : null;
      if (!kjent) continue;
      var kand = kjent.concat([rest]);
      if (!best || kand.length < best.length || (kand.length === best.length && antall110(kand) > antall110(best))) best = kand;
    }
    return best;
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
    var naerStd = nermesteStandard(r, p);
    // Nærmeste ramme av kjente elementer, for hvert hjørnesett. Nærmest vinner; ved lik avstand færrest elementer, så 210 × 210.
    var kand = hjorneKandidater(r, p), nb = null, nh = null, bestAvst = Infinity, bestAnt = Infinity;
    kand.forEach(function (c) {
      var b = nermesteSide(r[0], s.deler, c.b), h = nermesteSide(r[1], s.deler, c.h);
      if (!b || !h) return;
      var avst = Math.abs(b - r[0]) + Math.abs(h - r[1]), ant = fyll(b - 2 * c.b, s.deler).length + fyll(h - 2 * c.h, s.deler).length;
      if (avst < bestAvst - 1e-9 || (Math.abs(avst - bestAvst) < 1e-9 && ant < bestAnt)) { nb = b; nh = h; bestAvst = avst; bestAnt = ant; }
    });
    // Standardstørrelsen brukes bare når den ligger minst like nær som nærmeste størrelse av kjente elementer
    if (naerStd && nb && nh && Math.abs(naerStd[0] - r[0]) + Math.abs(naerStd[1] - r[1]) > bestAvst) naerStd = null;
    if (naerStd) { ob = naerStd[0]; oh = naerStd[1]; }
    else { ob = nb; oh = nh; }
    if (!ob || !oh) { res.feil = t('Klarer ikke å bygge den størrelsen.', 'Cannot build that size.'); return res; }
    // Hjørnesett for rammen: helst uten utregnede tilpasningselementer, så færrest elementer, så 210 × 210
    var hj = null, bunn = null, side = null, hjPoeng = null;
    kand.forEach(function (c) {
      var bd = sideDeler(ob, s.deler, c.b), sd = sideDeler(oh, s.deler, c.h);
      if (!bd || !sd) return;
      var ukj = (fyll(ob - 2 * c.b, s.deler) ? 0 : 1) + (fyll(oh - 2 * c.h, s.deler) ? 0 : 1), poeng = ukj * 1000 + bd.length + sd.length;
      if (hjPoeng === null || poeng < hjPoeng) { hj = c; bunn = bd; side = sd; hjPoeng = poeng; }
    });
    if (ob !== Math.round(r[0]) || oh !== Math.round(r[1])) res.advarsler.push(naerStd
      ? t('Justert til Stumpfls standardstørrelse ' + ob + ' × ' + oh + ' cm ramme.', 'Adjusted to the Stumpfl standard size ' + ob + ' × ' + oh + ' cm frame.')
      : t('Justert til nærmeste størrelse som kan bygges: ' + ob + ' × ' + oh + ' cm ramme.', 'Adjusted to the nearest size that can be built: ' + ob + ' × ' + oh + ' cm frame.'));

    if (!bunn || !side) { res.feil = t('Klarer ikke å bygge den størrelsen.', 'Cannot build that size.'); return res; }
    // Tilpasningselementer som ikke står i elementlista (16:10-standardene): lengden er regnet ut, ikke bekreftet
    res.ubekreftet = bunn.concat(side).filter(function (d, i, a) { return s.deler.indexOf(d) < 0 && a.indexOf(d) === i; });
    if (res.ubekreftet.length) {
      var flere = res.ubekreftet.length > 1;
      res.advarsler.push(t('Denne størrelsen går ikke opp i hele 5 cm med de kjente elementlengdene. ' + (flere ? 'Tilpasningselementene på ' : 'Tilpasningselementet på ') + res.ubekreftet.join(' og ') + ' cm (merket ? på tegningen) er regnet ut av rammemålet, ikke bekreftet. Sjekk etikettene på delene.',
        'This size is not a whole multiple of 5 cm with the known element lengths. ' + (flere ? 'The filler elements of ' : 'The filler element of ') + res.ubekreftet.join(' and ') + ' cm (marked ? in the drawing) ' + (flere ? 'are' : 'is') + ' calculated from the frame size, not confirmed. Check the labels on the parts.'));
    }
    if (p === 32 && ((ob > 460 && oh > 310) || ob > 910 || oh > 345)) res.advarsler.push(t('Større enn Stumpfl lager Vario 32 som standard. Vurder Vario 64.', 'Larger than any standard Stumpfl Vario 32. Consider Vario 64.'));

    bunn = rekkefolge(bunn); side = rekkefolge(side);
    res.profil = p; res.system = s; res.hjorne = hj;
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
    if (p === 64 && (ob >= 800 || (ob >= 708 && oh >= 450)) && duk.type !== 'Front') res.advarsler.push(t('Stumpfl leverer ikke bakprojeksjonsduk i denne størrelsen på Vario 64 som standard.', 'Stumpfl does not supply a rear projection surface in this size for Vario 64 as standard.'));

    // Bein
    var uk = valg.underkant || 0;
    var passer = bein.filter(function (b) { return b.profil.indexOf(p) >= 0 && uk >= b.min && uk <= b.maks; });
    res.bein = passer[0] || null;
    res.beinAntall = 2 + res.midtbein;
    if (!res.bein) res.advarsler.push(t('Ingen standardbein gir ' + uk + ' cm til underkant. Høyeste er ' + (p === 32 ? 'AT32/64 (146 cm)' : 'AT64 (176 cm)') + '. Heng lerretet eller bygg det opp.', 'No standard leg gives ' + uk + ' cm to the bottom edge. The tallest is ' + (p === 32 ? 'AT32/64 (146 cm)' : 'AT64 (176 cm)') + '. Fly the screen or raise it on a riser.'));
    res.overkant = uk + oh;
    return res;
  }

  var api = { regn: regn, fyll: fyll, nermesteSide: nermesteSide, system: system, duker: duker, bein: bein, standard: standard, HJORNE: HJORNE, HJORNESETT: HJORNESETT };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaptVario = api;
})(this);
