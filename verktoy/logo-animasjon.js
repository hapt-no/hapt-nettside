// Logoanimasjonen fra hapt.no tegnet på canvas, til syncfilmen. Ikke en ny logo: bitene (path-ene) er
// hentet ordrett fra ordmerke-SVG-en i toppen av hapt.no (index.html), og tidene og kurvene er de samme
// CSS-overgangene som siden bruker. Samme forløp som videoene i den grafiske pakken (2-animasjon):
//   intro: symbolet står 0,48 s, blir til HAPT på 0,78 s, HAPT står til 4,0 s.
//   runde: HAPT 2 s, blir til blått symbol (0,58 s), symbolet står, tilbake til HAPT (0,78 s). 4,4 s, går i sløyfe.
// Bruk: HaptLogo.tilstand(t) gir tilstanden ved tiden t (sekunder fra start, intro først, så runder),
//       HaptLogo.tegn(g, x, y, h, tilstand, farge) tegner logoen h piksler høy med øvre venstre hjørne i x, y.
//       farge overstyrer fargen (f.eks. svart på hvite blinkbilder).
(function (root) {
  var VB = [763.5, 275.5];
  var PLAY = { tx: 82.76, ty: -12.31, rot: 90, s: 1.7215 };
  var BITER = {
    hl: { d: 'M67.5,13.8L67.4,12.4L67.2,11.1L66.9,9.8L66.5,8.5L65.9,7.3L65.2,6.1L64.4,5L63.5,4L62.5,3.1L61.4,2.3L60.2,1.6L59,1L57.7,0.6L56.4,0.3L55.1,0.1L53.8,0L13.8,0L12.4,0.1L11.1,0.3L9.8,0.6L8.5,1L7.3,1.6L6.1,2.3L5,3.1L4,4L3.1,5L2.3,6.1L1.6,7.3L1,8.5L0.6,9.8L0.3,11.1L0.1,12.4L0,13.8L0,261.8L0.1,263.1L0.3,264.4L0.6,265.7L1,267L1.6,268.2L2.3,269.4L3.1,270.5L4,271.5L5,272.4L6.1,273.2L7.3,273.9L8.5,274.5L9.8,274.9L11.1,275.2L12.4,275.4L13.8,275.5L53.8,275.5L55.1,275.4L56.4,275.2L57.7,274.9L59,274.5L60.2,273.9L61.4,273.2L62.5,272.4L63.5,271.5L64.4,270.5L65.2,269.4L65.9,268.2L66.5,267L66.9,265.7L67.2,264.4L67.4,263.1L67.5,261.8Z' },
    hr: { d: 'M190.2,13.8L190.2,12.4L190,11.1L189.7,9.8L189.2,8.5L188.6,7.3L187.9,6.1L187.1,5L186.2,4L185.2,3.1L184.1,2.3L183,1.6L181.8,1L180.5,0.6L179.2,0.3L177.8,0.1L176.5,0L137.8,0L136.4,0.1L135.1,0.3L133.8,0.6L132.5,1L131.3,1.6L130.1,2.3L129,3.1L128,4L127.1,5L126.3,6.1L125.6,7.3L125,8.5L124.6,9.8L124.3,11.1L124.1,12.4L124,13.8L124,261.8L124.1,263.1L124.3,264.4L124.6,265.7L125,267L125.6,268.2L126.3,269.4L127.1,270.5L128,271.5L129,272.4L130.1,273.2L131.3,273.9L132.5,274.5L133.8,274.9L135.1,275.2L136.4,275.4L137.8,275.5L176.5,275.5L177.8,275.4L179.2,275.2L180.5,274.9L181.8,274.5L183,273.9L184.1,273.2L185.2,272.4L186.2,271.5L187.1,270.5L187.9,269.4L188.6,268.2L189.2,267L189.7,265.7L190,264.4L190.2,263.1L190.2,261.8Z' },
    hx: { d: 'M139,105.8L139,163.8L52.5,163.8L52.5,105.8Z' },
    a: { d: 'M271.8,0.1L270.4,0.3L269,0.6L267.7,1.1L266.4,1.8L265.2,2.5L264.1,3.4L263.1,4.3L262.2,5.4L261.4,6.6L260.8,7.8L144.5,250L144,251.3L143.6,252.5L143.3,253.8L143.1,255.1L143.1,256.5L143.2,257.8L143.5,259.1L143.8,260.3L144.3,261.6L144.9,262.8L145.6,263.9L146.4,264.9L147.3,265.9L148.3,266.8L149.4,267.5L150.5,268.2L151.7,268.7L153,269.2L154.2,269.5L155.6,269.7L156.9,269.8L450.6,269.8L451.9,269.7L453.3,269.5L454.5,269.2L455.8,268.7L457,268.2L458.1,267.5L459.2,266.8L460.2,265.9L461.1,264.9L461.9,263.9L462.6,262.8L463.2,261.6L463.7,260.3L464,259.1L464.3,257.8L464.4,256.5L464.4,255.1L464.2,253.8L463.9,252.5L463.5,251.3L463,250L346.7,7.8L346.1,6.6L345.3,5.4L344.4,4.3L343.4,3.4L342.3,2.5L341.1,1.8L339.8,1.1L338.5,0.6L337.1,0.3L335.7,0.1L334.3,0L273.2,0ZM381.5,198.8L382.3,200.8L383,202.9L383.5,205L383.7,207.2L383.8,209.4L383.6,211.5L383.2,213.7L382.7,215.7L381.9,217.8L380.9,219.7L379.8,221.6L378.5,223.3L377,224.9L375.3,226.3L373.6,227.6L371.7,228.7L369.7,229.6L367.7,230.3L365.6,230.8L363.4,231.1L361.3,231.2L246.2,231.2L244.1,231.1L241.9,230.8L239.8,230.3L237.8,229.6L235.8,228.7L233.9,227.6L232.2,226.3L230.5,224.9L229,223.3L227.7,221.6L226.6,219.7L225.6,217.8L224.8,215.7L224.3,213.7L223.9,211.5L223.7,209.4L223.8,207.2L224,205L224.5,202.9L225.2,200.8L226,198.8L283.5,81.4L284.6,79.5L285.8,77.7L287.2,76.1L288.8,74.5L290.5,73.2L292.3,72L294.2,71L296.3,70.1L298.3,69.5L300.5,69.1L302.7,68.9L304.8,68.9L307,69.1L309.2,69.5L311.2,70.1L313.3,71L315.2,72L317,73.2L318.7,74.5L320.3,76.1L321.7,77.7L322.9,79.5L324,81.4Z', evenodd: true },
    pt: { d: 'M483.8,166.5L510.9,166.5L511.6,166.5L518.7,166.1L520.1,166L526.8,165L528.1,164.7L534.8,163.1L536.1,162.7L542.5,160.4L543.7,159.9L549.9,157L551.1,156.3L556.9,152.8L558,152.1L563.5,148L564.6,147.1L569.6,142.6L570.6,141.6L575.1,136.6L576,135.5L580.1,130L580.8,128.9L584.3,123.1L585,121.9L587.9,115.7L588.4,114.5L590.7,108.1L591.1,106.8L592.7,100.1L593,98.8L594,92.1L594.1,90.7L594.5,83.9L594.5,82.6L594.1,75.8L594,74.4L593,67.7L592.7,66.4L591.1,59.7L590.7,58.4L590.1,56.8L590,56.5L590.3,56.5L632.4,56.5L632.7,56.5L632.8,56.8L632.8,261.8L632.8,263.1L633,264.4L633.3,265.7L633.8,267L634.4,268.2L635.1,269.4L635.9,270.5L636.8,271.5L637.8,272.4L638.9,273.2L640,273.9L641.2,274.5L642.5,274.9L643.8,275.2L645.2,275.4L646.5,275.5L685.8,275.5L687.1,275.4L688.4,275.2L689.7,274.9L691,274.5L692.2,273.9L693.4,273.2L694.5,272.4L695.5,271.5L696.4,270.5L697.2,269.4L697.9,268.2L698.5,267L698.9,265.7L699.2,264.4L699.4,263.1L699.5,261.8L699.5,56.8L699.5,56.5L699.8,56.5L749.8,56.5L751.1,56.4L752.4,56.2L753.7,55.9L755,55.5L756.2,54.9L757.4,54.2L758.5,53.4L759.5,52.5L760.4,51.5L761.2,50.4L761.9,49.2L762.5,48L762.9,46.7L763.2,45.4L763.4,44.1L763.5,42.8L763.5,13.8L763.4,12.4L763.2,11.1L762.9,9.8L762.5,8.5L761.9,7.3L761.2,6.1L760.4,5L759.5,4L758.5,3.1L757.4,2.3L756.2,1.6L755,1L753.7,0.6L752.4,0.3L751.1,0.1L749.8,0L430.8,0L429.4,0.1L428.1,0.3L426.8,0.6L425.5,1L424.3,1.6L423.1,2.3L422,3.1L421,4L420.1,5L419.3,6.1L418.6,7.3L418,8.5L417.6,9.8L417.3,11.1L417.1,12.4L417,13.8L417,261.8L417.1,263.1L417.3,264.4L417.6,265.7L418,267L418.6,268.2L419.3,269.4L420.1,270.5L421,271.5L422,272.4L423.1,273.2L424.3,273.9L425.5,274.5L426.8,274.9L428.1,275.2L429.4,275.4L430.8,275.5L469.8,275.5L471.1,275.4L472.4,275.2L473.7,274.9L475,274.5L476.2,273.9L477.4,273.2L478.5,272.4L479.5,271.5L480.4,270.5L481.2,269.4L481.9,268.2L482.5,267L482.9,265.7L483.2,264.4L483.4,263.1L483.5,261.8L483.5,166.8L483.5,166.5ZM511.2,58L513.7,58.1L516.2,58.5L518.6,59.1L520.9,59.9L523.2,61L525.3,62.3L527.3,63.7L529.1,65.4L530.8,67.2L532.2,69.2L533.5,71.3L534.6,73.6L535.4,75.9L536,78.3L536.4,80.8L536.5,83.2L536.4,85.7L536,88.2L535.4,90.6L534.6,92.9L533.5,95.2L532.2,97.3L530.8,99.3L529.1,101.1L527.3,102.8L525.3,104.2L523.2,105.5L520.9,106.6L518.6,107.4L516.2,108L513.7,108.4L511.2,108.5L483.5,108.5L483.5,58Z', evenodd: true },
    ai: { d: 'M243.9,202.7L243.6,203.4L243.4,204.1L243.2,204.8L243.2,205.5L243.1,206.2L243.2,206.9L243.3,207.6L243.5,208.3L243.8,209L244.1,209.7L244.5,210.3L244.9,210.8L245.4,211.4L245.9,211.9L246.5,212.3L247.2,212.6L247.8,212.9L248.5,213.2L249.2,213.4L249.9,213.5L250.6,213.5L356.9,213.5L357.6,213.5L358.3,213.4L359,213.2L359.7,212.9L360.3,212.6L361,212.3L361.6,211.9L362.1,211.4L362.6,210.8L363,210.3L363.4,209.7L363.7,209L364,208.3L364.2,207.6L364.3,206.9L364.4,206.2L364.3,205.5L364.3,204.8L364.1,204.1L363.9,203.4L363.6,202.7L310.5,94.3L310.1,93.7L309.7,93.1L309.3,92.5L308.7,92L308.2,91.5L307.6,91.1L306.9,90.8L306.2,90.5L305.6,90.3L304.8,90.2L304.1,90.1L303.4,90.1L302.7,90.2L301.9,90.3L301.3,90.5L300.6,90.8L299.9,91.1L299.3,91.5L298.8,92L298.2,92.5L297.8,93.1L297.4,93.7L297,94.3Z' },
    ar: { d: 'M322.9,79.5L321.7,77.7L320.3,76.1L318.7,74.5L317,73.2L315.2,72L313.3,71L311.2,70.1L309.2,69.5L307,69.1L304.8,68.9L302.7,68.9L300.5,69.1L298.3,69.5L296.3,70.1L294.2,71L292.3,72L290.5,73.2L288.8,74.5L287.2,76.1L285.8,77.7L284.6,79.5L283.5,81.4L226,198.8L225.2,200.8L224.5,202.9L224,205L223.8,207.2L223.7,209.4L223.9,211.5L224.3,213.7L224.8,215.7L225.6,217.8L226.6,219.7L227.7,221.6L229,223.3L230.5,224.9L232.2,226.3L233.9,227.6L235.8,228.7L237.8,229.6L239.8,230.3L241.9,230.8L244.1,231.1L246.2,231.2L361.3,231.2L363.4,231.1L365.6,230.8L367.7,230.3L369.7,229.6L371.7,228.7L373.6,227.6L375.3,226.3L377,224.9L378.5,223.3L379.8,221.6L380.9,219.7L381.9,217.8L382.7,215.7L383.2,213.7L383.6,211.5L383.8,209.4L383.7,207.2L383.5,205L383,202.9L382.3,200.8L381.5,198.8L324,81.4ZM300.8,111.5L301,111.2L301.2,111L301.4,110.7L301.6,110.5L301.8,110.3L302.1,110.1L302.4,110L302.7,109.9L303,109.8L303.3,109.7L303.6,109.7L303.9,109.7L304.2,109.7L304.5,109.8L304.8,109.9L305.1,110L305.4,110.1L305.7,110.3L305.9,110.5L306.1,110.7L306.3,111L306.5,111.2L306.7,111.5L349,197.8L349.1,198.1L349.2,198.4L349.2,198.7L349.3,199L349.3,199.3L349.3,199.6L349.2,200L349.1,200.3L349,200.6L348.9,200.8L348.7,201.1L348.5,201.3L348.3,201.6L348.1,201.8L347.8,202L347.6,202.1L347.3,202.3L347,202.4L346.7,202.4L346.4,202.5L346,202.5L261.5,202.5L261.1,202.5L260.8,202.4L260.5,202.4L260.2,202.3L259.9,202.1L259.7,202L259.4,201.8L259.2,201.6L259,201.3L258.8,201.1L258.6,200.8L258.5,200.6L258.4,200.3L258.3,200L258.2,199.6L258.2,199.3L258.2,199L258.3,198.7L258.3,198.4L258.4,198.1L258.5,197.8Z', evenodd: true }
  };
  // Rammen rundt hver bit (transform-box: fill-box, transform-origin: center): midten av bitens egen boks
  var BOKS = {};
  function boks(navn) {
    var tall = BITER[navn].d.match(/-?[\d.]+/g).map(Number), x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (var i = 0; i < tall.length; i += 2) { x0 = Math.min(x0, tall[i]); x1 = Math.max(x1, tall[i]); y0 = Math.min(y0, tall[i + 1]); y1 = Math.max(y1, tall[i + 1]); }
    return [x0, y0, x1, y1];
  }
  for (var n in BITER) BOKS[n] = boks(n);
  BOKS.play = [Math.min(BOKS.ai[0], BOKS.ar[0]), Math.min(BOKS.ai[1], BOKS.ar[1]), Math.max(BOKS.ai[2], BOKS.ar[2]), Math.max(BOKS.ai[3], BOKS.ar[3])];
  var STI = {};
  function sti(navn) { if (!STI[navn] && typeof Path2D !== 'undefined') STI[navn] = new Path2D(BITER[navn].d); return STI[navn]; }

  // CSS-kurver
  function bezier(x1, y1, x2, y2) {
    var cx = 3 * x1, bx = 3 * (x2 - x1) - cx, ax = 1 - cx - bx, cy = 3 * y1, by = 3 * (y2 - y1) - cy, ay = 1 - cy - by;
    var fx = function (t) { return ((ax * t + bx) * t + cx) * t; }, fy = function (t) { return ((ay * t + by) * t + cy) * t; };
    return function (x) {
      if (x <= 0) return 0; if (x >= 1) return 1;
      var t = x, i, d;
      for (i = 0; i < 8; i++) { d = (3 * ax * t + 2 * bx) * t + cx; if (Math.abs(d) < 1e-6) break; var e = fx(t) - x; if (Math.abs(e) < 1e-6) return fy(t); t -= e / d; }
      var lo = 0, hi = 1; t = x;
      while (lo < hi) { var v = fx(t); if (Math.abs(v - x) < 1e-6) break; if (x > v) lo = t; else hi = t; t = (lo + hi) / 2; }
      return fy(t);
    };
  }
  var K = { ease: bezier(0.25, 0.1, 0.25, 1), easeIn: bezier(0.42, 0, 1, 1), linear: function (x) { return x < 0 ? 0 : x > 1 ? 1 : x; },
    ut: bezier(0.2, 0.8, 0.2, 1), sprett: bezier(0.3, 1.35, 0.5, 1), spill: bezier(0.65, 0, 0.25, 1) };

  var HVIT = [255, 255, 255], BLA = [26, 143, 209];
  // De to faste tilstandene: ordmerket (HAPT) og symbolet (pause/play)
  var ORD = { hx: 1, aO: 1, aS: 1, ptO: 1, ptX: 0, playTx: 0, playTy: 0, playRot: 0, playS: 1, ai: 1, ar: 0, farge: HVIT };
  var SYM = { hx: 0, aO: 0, aS: 0.85, ptO: 0, ptX: 48, playTx: PLAY.tx, playTy: PLAY.ty, playRot: PLAY.rot, playS: PLAY.s, ai: 0, ar: 1, farge: HVIT };
  // Overgangene, som i CSS-en: [egenskap, varighet, kurve, forsinkelse]. Transform-funksjonene i play går hver for seg.
  var TIL_ORD = [['hx', 0.26, K.ut, 0.34], ['aO', 0.22, K.ease, 0.3], ['aS', 0.3, K.ut, 0.3], ['ptO', 0.26, K.ease, 0.36], ['ptX', 0.42, K.sprett, 0.36],
    ['play', 0.52, K.spill, 0], ['ai', 0.12, K.linear, 0.2], ['ar', 0.12, K.linear, 0.2], ['farge', 0.15, K.ease, 0]];
  var TIL_SYM = [['hx', 0.18, K.easeIn, 0], ['aO', 0.18, K.ease, 0], ['aS', 0.2, K.easeIn, 0], ['ptO', 0.2, K.ease, 0], ['ptX', 0.26, K.easeIn, 0],
    ['play', 0.5, K.spill, 0.08], ['ai', 0.12, K.linear, 0.24], ['ar', 0.12, K.linear, 0.24], ['farge', 0.15, K.ease, 0]];
  function bland(a, b, p) { return a + (b - a) * p; }
  function overgang(fra, til, liste, t) {
    var ut = {};
    liste.forEach(function (o) {
      var p = o[2]((t - o[3]) / o[1]);
      if (o[0] === 'play') ['playTx', 'playTy', 'playRot', 'playS'].forEach(function (k) { ut[k] = bland(fra[k], til[k], p); });
      else if (o[0] === 'farge') ut.farge = [0, 1, 2].map(function (i) { return Math.round(bland(fra.farge[i], til.farge[i], p)); });
      else ut[o[0]] = bland(fra[o[0]], til[o[0]], p);
    });
    return ut;
  }
  var ORD_BLA = {}; for (var k in ORD) ORD_BLA[k] = ORD[k]; ORD_BLA.farge = BLA;
  var SYM_BLA = {}; for (k in SYM) SYM_BLA[k] = SYM[k]; SYM_BLA.farge = BLA;
  var INTRO = 4.0, RUNDE = 4.4, INTRO_START = 0.48, INN_START = 1.98, UT_START = 3.58;

  // Tilstanden ved tiden t sekunder: intro (4 s) først, så runder på 4,4 s. t < 0 gir symbolet.
  function tilstand(t) {
    if (t < INTRO) return t < INTRO_START ? SYM : overgang(SYM, ORD, TIL_ORD, t - INTRO_START);
    var r = (t - INTRO) % RUNDE;
    if (r < INN_START) return ORD;
    if (r < UT_START) return overgang(ORD, SYM_BLA, TIL_SYM, r - INN_START);
    return overgang(SYM_BLA, ORD, TIL_ORD, r - UT_START);
  }
  // Runden alene (uten intro), t sekunder inn i runden
  function runde(t) { return tilstand(INTRO + ((t % RUNDE) + RUNDE) % RUNDE); }

  function bit(g, navn, tilst, alfa, forvandling) {
    if (alfa <= 0) return;
    var b = BOKS[navn], ox = (b[0] + b[2]) / 2, oy = (b[1] + b[3]) / 2;
    g.save(); g.globalAlpha *= alfa;
    g.translate(ox, oy); if (forvandling) forvandling(g); g.translate(-ox, -oy);
    g.fill(sti(navn), BITER[navn].evenodd ? 'evenodd' : 'nonzero');
    g.restore();
  }
  // Tegner logoen med høyde h og øvre venstre hjørne i (x, y). Bredden blir h × 763,5 / 275,5.
  function tegn(g, x, y, h, tilst, farge) {
    tilst = tilst || ORD;
    var f = farge || 'rgb(' + tilst.farge.join(',') + ')', s = h / VB[1];
    g.save(); g.translate(x, y); g.scale(s, s); g.fillStyle = f;
    bit(g, 'hl', tilst, 1); bit(g, 'hr', tilst, 1);
    bit(g, 'hx', tilst, 1, function (c) { c.scale(Math.max(tilst.hx, 1e-4), 1); });
    bit(g, 'a', tilst, tilst.aO, function (c) { c.scale(tilst.aS, tilst.aS); });
    bit(g, 'pt', tilst, tilst.ptO, function (c) { c.translate(tilst.ptX, 0); });
    // play-gruppa: translate, rotate, scale om gruppas midtpunkt, og så bitene inni
    var pb = BOKS.play, px = (pb[0] + pb[2]) / 2, py = (pb[1] + pb[3]) / 2;
    g.save(); g.translate(px, py); g.translate(tilst.playTx, tilst.playTy); g.rotate(tilst.playRot * Math.PI / 180); g.scale(tilst.playS, tilst.playS); g.translate(-px, -py);
    bit(g, 'ai', tilst, tilst.ai); bit(g, 'ar', tilst, tilst.ar);
    g.restore();
    g.restore();
  }
  root.HaptLogo = { tilstand: tilstand, runde: runde, tegn: tegn, ORD: ORD, SYM: SYM, forhold: VB[0] / VB[1], INTRO: INTRO, RUNDE: RUNDE };
})(typeof window !== 'undefined' ? window : this);
