// Leser et pixelmap fra fil: kartfil (.json) eller bilde (PNG). I et bilde finnes flatene etter farge,
// og navn og mål leses med tekstgjenkjenning (Tesseract i ../ocr/, lastes først når det trengs).
// Brukes av testbilde og syncfilm. Krever pixelmap.js.
(function (root) {
  'use strict';
  // Tekstgjenkjenning (Tesseract, lagt i ../ocr/ så det virker uten eksterne tjenester). Lastes først når den trengs.
  var ocrLaster = null;
  function hentOcr() {
    if (ocrLaster) return ocrLaster;
    ocrLaster = new Promise(function (ok, feil) {
      var sc = document.createElement('script'); sc.src = '../ocr/tesseract.min.js';
      sc.onload = function () {
        var base = new URL('../ocr/', location.href).href;
        Tesseract.createWorker('nor', 1, { workerPath: base + 'worker.min.js', corePath: base, langPath: base, gzip: true })
          .then(function (w) { return w.setParameters({ tessedit_pageseg_mode: '11' }).then(function () { return w; }); })
          .then(ok, feil);
      };
      sc.onerror = feil;
      document.head.appendChild(sc);
    });
    return ocrLaster;
  }

  // Les navnet på hver flate: største tekstlinje med bokstaver i den flata
  function lesNavn(kilde, k, etiketter, cb) {
    var grunn = cb.grunn || '', status = { set textContent(t) { cb.status(t); } };
    status.textContent = grunn + ' Leser navn fra bildet …';
    hentOcr().then(function (w) {
      var i = 0;
      var neste = function () {
        if (!cb.aktiv(k)) return; // brukeren har lastet noe annet
        if (i >= k.flater.length) { cb.ferdig(k); status.textContent = grunn + ' Navnene er lest fra bildet; sjekk dem.'; return; }
        var f = k.flater[i];
        status.textContent = grunn + ' Leser navn ' + (i + 1) + ' av ' + k.flater.length + ' …';
        // Mange kart skriver «x, y // b x h» på flaten; da brukes de målene hvis de stemmer med det som ble funnet
        var brukMal = function (tekst) {
          var m = tekst.replace(/[oO]/g, '0').match(/(\d{1,5})\s*[,.]\s*(\d{1,5})\s*\S{1,3}\s*(\d{1,5})\s*[xX×]\s*(\d{1,5})/);
          if (!m) return;
          var n = { x: +m[1], y: +m[2], b: +m[3], h: +m[4] };
          if (n.b < 1 || n.h < 1 || n.x + n.b > k.bredde || n.y + n.h > k.hoyde) return;
          var ox = Math.min(n.x + n.b, f.x + f.b) - Math.max(n.x, f.x), oy = Math.min(n.y + n.h, f.y + f.h) - Math.max(n.y, f.y);
          if (ox > 0 && oy > 0 && ox * oy > 0.8 * f.b * f.h && ox * oy > 0.6 * n.b * n.h) { f.x = n.x; f.y = n.y; f.b = n.b; f.h = n.h; }
        };
        // Små hvite merkelapper på flaten forstørres og leses hver for seg
        var mine = etiketter.filter(function (e) {
          var mx = e.x + e.b / 2, my = e.y + e.h / 2;
          return mx > f.x && mx < f.x + f.b && my > f.y && my < f.y + f.h;
        });
        var lesEtiketter = function (j) {
          if (j >= mine.length) return Promise.resolve();
          var e = mine[j], pad = 3, skala = Math.min(12, Math.max(1, 96 / e.h));
          var c = document.createElement('canvas'); c.width = Math.round((e.b + pad * 2) * skala); c.height = Math.round((e.h + pad * 2) * skala);
          var cx = c.getContext('2d'); cx.fillStyle = '#fff'; cx.fillRect(0, 0, c.width, c.height); cx.imageSmoothingEnabled = true;
          cx.drawImage(kilde, e.x + 1, e.y + 1, e.b - 2, e.h - 2, pad * skala, pad * skala, (e.b - 2) * skala, (e.h - 2) * skala);
          // Svart tekst på hvitt: alt som ikke er mørkt gjøres hvitt, så kanter og farger rundt ikke forstyrrer
          var id = cx.getImageData(0, 0, c.width, c.height), d = id.data;
          for (var q = 0; q < d.length; q += 4) { var v = Math.max(d[q], d[q + 1], d[q + 2]) < 150 ? 0 : 255; d[q] = d[q + 1] = d[q + 2] = v; d[q + 3] = 255; }
          cx.putImageData(id, 0, 0);
          return w.setParameters({ tessedit_pageseg_mode: '7', tessedit_char_whitelist: '0123456789,/x ' }).then(function () { return w.recognize(c); }).then(function (r) { brukMal(r.data.text.replace(/\s+/g, ' ')); return lesEtiketter(j + 1); }, function () { return lesEtiketter(j + 1); });
        };
        // Navnet står som regel midt på flaten: les et utsnitt rundt midten først, så hele flaten om det ikke gir noe
        var forsok = function (helt) {
          var ub = helt ? f.b : Math.min(f.b, 1600), uh = helt ? f.h : Math.min(f.h, 600);
          var ux = f.x + Math.round((f.b - ub) / 2), uy = f.y + Math.round((f.h - uh) / 2);
          var skala = Math.min(helt ? 2 : 4, Math.max(1, 1600 / Math.max(ub, uh)));
          var c = document.createElement('canvas'); c.width = Math.round(ub * skala); c.height = Math.round(uh * skala);
          var cx = c.getContext('2d'); cx.imageSmoothingEnabled = true;
          cx.drawImage(kilde, ux, uy, ub, uh, 0, 0, c.width, c.height);
          return w.recognize(c);
        };
        var tolk = function (r) {
          var alle = (r.data.lines || []).map(function (l) {
            var t = l.text.replace(/[|_~^`´¨"“”]+/g, '').replace(/\s+/g, ' ').trim();
            return { t: t, h: l.bbox.y1 - l.bbox.y0, c: l.confidence };
          });
          alle.forEach(function (l) { brukMal(l.t); });
          var linjer = alle.filter(function (l) { return l.c >= 45 && (l.t.match(/[A-Za-zÆØÅæøå]/g) || []).length >= 2 && l.t.length <= 60; });
          linjer.sort(function (a, b) { return b.h - a.h; });
          return linjer[0] ? linjer[0].t : null;
        };
        lesEtiketter(0).then(function () { return w.setParameters({ tessedit_pageseg_mode: '11', tessedit_char_whitelist: '' }); }).then(function () { return forsok(false); }).then(function (r) {
          var t = tolk(r);
          if (t) return t;
          return forsok(true).then(tolk);
        }).then(function (t) {
          if (t) f.navn = t;
          i++; neste();
        }, function () { i++; neste(); });
      };
      neste();
    }, function () { status.textContent = grunn + ' Klarte ikke å starte tekstgjenkjenning, så navnene må skrives inn.'; });
  }


  // cb: { status(tekst), kart(kart) når flatene er funnet, aktiv(kart) om kartet fortsatt er i bruk, ferdig(kart) når navnene er lest }
  function fraFil(fil, cb) {
    if (/json$/i.test(fil.name) || fil.type === 'application/json') {
      fil.text().then(function (t) {
        try { var k = HaptPixelmap.les(JSON.parse(t)); cb.kart(k); cb.ferdig(k); } catch (e) { alert('Klarte ikke å lese kartfilen.'); }
      });
      return;
    }
    var img = new Image();
    img.onload = function () {
      var c2 = document.createElement('canvas'); c2.width = img.naturalWidth; c2.height = img.naturalHeight;
      var x2 = c2.getContext('2d'); x2.drawImage(img, 0, 0);
      cb.status('Leter etter flater …');
      setTimeout(function () {
        var flater = HaptPixelmap.finnFlater(x2.getImageData(0, 0, c2.width, c2.height));
        URL.revokeObjectURL(img.src);
        if (!flater.length) { alert('Fant ingen flater i bildet. Bakgrunnen må være svart.'); return; }
        var navn = fil.name.replace(/\.[^.]+$/, '');
        var k = { bredde: c2.width, hoyde: c2.height, navn: navn, flater: flater.map(function (f, i) { return { navn: 'Flate ' + (i + 1), x: f.x, y: f.y, b: f.b, h: f.h, pw: 0, ph: 0 }; }) };
        cb.kart(k);
        cb.grunn = navn + ': ' + k.bredde + ' × ' + k.hoyde + ' px, ' + k.flater.length + ' flater funnet.';
        lesNavn(c2, k, flater.etiketter || [], cb);
      }, 30);
    };
    img.onerror = function () { alert('Klarte ikke å åpne bildet.'); };
    img.src = URL.createObjectURL(fil);
  }

  root.HaptLesKart = { fraFil: fraFil };
})(this);
