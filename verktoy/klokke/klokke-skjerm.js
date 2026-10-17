// Tegner scenen (presenteren) på et lerret, som PresenterView i appen: synlige timere jevnt fordelt
// eller på egen X/Y, meldingen i Barlow i en stripe nederst, og en svak klokke i hjørnet.
// Svart viser ingenting; Logo viser logoen på svart. Alt dempet med presenterens lysstyrke.
// Brukes både av skjerm.html og av forhåndsvisningen i operatorvinduet.
(function (root) {
  'use strict';
  var K = root.HaptKlokke;
  var SIFFER = '800 {px}px -apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';
  var bilder = {};

  function sifferFont(px) { return SIFFER.replace('{px}', px.toFixed(2)); }

  // Tall i fast bredde: hvert siffer i en celle like bred som det bredeste sifferet, så teksten ikke
  // hopper når tallene skifter (lerretet kan ikke slå på tabulære tall selv).
  function mal(g, tekst, px) {
    g.font = sifferFont(px);
    var celle = 0;
    for (var d = 0; d <= 9; d++) celle = Math.max(celle, g.measureText(String(d)).width);
    var b = 0;
    for (var i = 0; i < tekst.length; i++) b += /\d/.test(tekst[i]) ? celle : g.measureText(tekst[i]).width;
    var m = g.measureText('0');
    return { bredde: b, celle: celle, hoyde: m.actualBoundingBoxAscent || px * 0.72 };
  }
  function skriv(g, tekst, x, grunnlinje, celle) {
    g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    for (var i = 0; i < tekst.length; i++) {
      var w = /\d/.test(tekst[i]) ? celle : g.measureText(tekst[i]).width;
      g.fillText(tekst[i], x + w / 2, grunnlinje);
      x += w;
    }
  }

  function bryt(g, tekst, maks) {
    var ut = [];
    String(tekst).split(/\n/).forEach(function (avsnitt) {
      var ord = avsnitt.split(/\s+/).filter(Boolean), linje = '';
      ord.forEach(function (o) {
        var forsok = linje ? linje + ' ' + o : o;
        if (g.measureText(forsok).width > maks && linje) { ut.push(linje); linje = o; } else linje = forsok;
      });
      if (linje) ut.push(linje);
    });
    return ut;
  }

  function logoBilde(src, tegnIgjen) {
    if (!src) return null;
    var b = bilder[src];
    if (!b) { b = bilder[src] = new Image(); b.onload = tegnIgjen || null; b.src = src; }
    return b.complete && b.naturalWidth ? b : null;
  }

  // g: 2d-kontekst, W×H i lerretets enheter, s: showet, na: ms
  function tegn(g, W, H, s, na, tegnIgjen) {
    g.save();
    g.fillStyle = '#000'; g.fillRect(0, 0, W, H);
    g.globalAlpha = Math.max(0.1, Math.min(1, s.dim == null ? 1 : s.dim));
    if (s.output === 'logo') {
      var b = logoBilde(s.logo, tegnIgjen);
      if (b) {
        var f = Math.min(W * 0.6 / b.naturalWidth, H * 0.5 / b.naturalHeight);
        g.drawImage(b, (W - b.naturalWidth * f) / 2, (H - b.naturalHeight * f) / 2, b.naturalWidth * f, b.naturalHeight * f);
      } else if (root.HaptLogo) {
        // HAPT-logoen med samme animasjon som på hapt.no: symbolet blir til HAPT, så står den
        var L = root.HaptLogo, t = (na - (s.outputSince || 0)) / 1000;
        var lh = Math.min(H * 0.28, W * 0.5 / L.forhold);
        L.tegn(g, (W - lh * L.forhold) / 2, (H - lh) / 2, lh, t < L.INTRO ? L.tilstand(Math.max(0, t)) : L.ORD, null);
      }
    } else if (s.output !== 'black') {
      scene(g, W, H, s, na);
    }
    g.restore();
  }

  function scene(g, W, H, s, na) {
    // Den siste synlige timeren med annen bakgrunn enn svart bestemmer bakgrunnen, som i appen
    var bg = '#000000';
    s.timers.forEach(function (t) { if (t.placement.visible && String(t.placement.background).toLowerCase() !== '#000000') bg = t.placement.background; });
    g.fillStyle = bg; g.fillRect(0, 0, W, H);

    var viste = s.timers.filter(function (t) { return t.placement.visible && t.placement.size > 0; }).map(function (t) {
      var d = K.visning(t, na), p = t.placement;
      var px = Math.min(p.size / 100 * 0.42 * W, p.size / 100 * 0.75 * H);
      var m = mal(g, d.text, px);
      if (m.bredde > W) { px *= W / m.bredde; m = mal(g, d.text, px); }
      return { t: t, d: d, px: px, m: m };
    });
    // Plassering etter sifrenes egen høyde, så luften mellom er den man ser
    if (s.layout === 'free') {
      viste.forEach(function (v) {
        var p = v.t.placement;
        v.x = Math.max(0, Math.min(W - v.m.bredde, p.x / 100 * W - v.m.bredde / 2));
        v.y = Math.max(0, Math.min(H - v.m.hoyde, p.y / 100 * H - v.m.hoyde / 2));
      });
    } else {
      var sum = viste.reduce(function (a, v) { return a + v.m.hoyde; }, 0), luft = Math.max(0, (H - sum) / (viste.length + 1)), y = luft;
      viste.forEach(function (v) { v.x = Math.max(0, (W - v.m.bredde) / 2); v.y = y; y += v.m.hoyde + luft; });
    }
    viste.forEach(function (v) {
      g.save();
      g.globalAlpha *= v.d.blinks ? K.blink(na) : 1;
      g.font = sifferFont(v.px);
      g.fillStyle = K.farge(v.t, v.d.tone);
      skriv(g, v.d.text, v.x, v.y + v.m.hoyde, v.m.celle);
      g.restore();
    });

    var melding = K.meldingPaScenen(s);
    if (melding) {
      var px = Math.min(Math.max(22, W * 0.04), 64) * (s.messageScale || 100) / 100;
      g.font = '500 ' + px.toFixed(1) + 'px Barlow, "Helvetica Neue", Arial, sans-serif';
      var linjer = bryt(g, melding, W - 96), lh = px * 1.2 + 4;
      var hoyde = 22 + linjer.length * lh - 4 + 30, bunn = H - H * (s.messageLift || 0) / 100, topp = bunn - hoyde;
      var gr = g.createLinearGradient(0, topp, 0, bunn);
      gr.addColorStop(0, 'rgba(0,0,0,0)'); gr.addColorStop(0.3, 'rgba(0,0,0,0.65)'); gr.addColorStop(1, 'rgba(0,0,0,0.92)');
      g.fillStyle = gr; g.fillRect(0, topp, W, hoyde);
      g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'middle';
      linjer.forEach(function (l, i) { g.fillText(l, W / 2, topp + 22 + i * lh + px * 0.6); });
    }

    // Svak klokke nederst til høyre
    g.font = '12px -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif';
    if ('letterSpacing' in g) g.letterSpacing = '3px';
    g.fillStyle = 'rgba(255,255,255,0.12)'; g.textAlign = 'right'; g.textBaseline = 'alphabetic';
    g.fillText(K.klokke(new Date(na)), W - 18, H - 14);
    if ('letterSpacing' in g) g.letterSpacing = '0px';
  }

  root.HaptKlokkeSkjerm = { tegn: tegn };
})(this);
