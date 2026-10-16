// Felles pixelmap-kode for pixelmap-generatoren og testbildet.
// Kartformat (kartfil .json): { bredde, hoyde, navn, flater: [{ navn, x, y, b, h, pw, ph }] }
(function (root) {
  'use strict';

  var farger = ['#1a8fd1', '#e0a43a', '#4cc38a', '#d9576b', '#a678e0', '#3fc1c9', '#e07a3a', '#c9c94c', '#7d9be0', '#e078b8', '#8ad14c', '#c98a5a'];
  function farge(i) { return farger[i % farger.length]; }

  function hent() {
    try { var k = JSON.parse(localStorage.getItem('hapt-pixelmap') || 'null'); return k ? les(k) : null; } catch (e) { return null; }
  }
  function lagre(kart) { try { localStorage.setItem('hapt-pixelmap', JSON.stringify(kart)); } catch (e) {} }

  // Gjør en innlest kartfil trygg å bruke
  function les(k) {
    var tall = function (v, min, maks) { v = Math.round(+v || 0); return Math.max(min, Math.min(maks, v)); };
    if (!k || !Array.isArray(k.flater)) throw new Error('Ikke en kartfil');
    return {
      bredde: tall(k.bredde, 16, 16384), hoyde: tall(k.hoyde, 16, 16384), navn: String(k.navn || ''),
      flater: k.flater.slice(0, 200).map(function (f, i) {
        return { navn: String(f.navn || 'Flate ' + (i + 1)).slice(0, 60), x: tall(f.x, 0, 16384), y: tall(f.y, 0, 16384), b: tall(f.b, 1, 16384), h: tall(f.h, 1, 16384), pw: tall(f.pw, 0, 4096), ph: tall(f.ph, 0, 4096) };
      })
    };
  }

  function overlapp(kart) {
    var ut = [];
    for (var i = 0; i < kart.flater.length; i++) for (var j = i + 1; j < kart.flater.length; j++) {
      var a = kart.flater[i], b = kart.flater[j];
      if (a.x < b.x + b.b && b.x < a.x + a.b && a.y < b.y + b.h && b.y < a.y + a.h) ut.push(a.navn + ' og ' + b.navn);
    }
    return ut;
  }

  // Hyllepakking: legg flatene fra venstre mot høyre, ny rad når det ikke er plass. bareSiste = plasser bare den siste.
  function pakk(kart, bareSiste) {
    var liste = bareSiste ? kart.flater.slice(-1) : kart.flater;
    if (!bareSiste) {
      var x = 0, y = 0, radH = 0;
      kart.flater.forEach(function (f) {
        if (x + f.b > kart.bredde && x > 0) { x = 0; y += radH; radH = 0; }
        f.x = x; f.y = y; x += f.b; radH = Math.max(radH, f.h);
      });
      return;
    }
    var f = liste[0], andre = kart.flater.slice(0, -1);
    var kandidater = [[0, 0]];
    andre.forEach(function (a) { kandidater.push([a.x + a.b, a.y], [a.x, a.y + a.h], [0, a.y + a.h]); });
    kandidater.sort(function (p, q) { return p[1] - q[1] || p[0] - q[0]; });
    for (var i = 0; i < kandidater.length; i++) {
      var p = kandidater[i];
      var ledig = p[0] + f.b <= kart.bredde && p[1] + f.h <= kart.hoyde && andre.every(function (a) {
        return !(p[0] < a.x + a.b && a.x < p[0] + f.b && p[1] < a.y + a.h && a.y < p[1] + f.h);
      });
      if (ledig) { f.x = p[0]; f.y = p[1]; return; }
    }
    f.x = 0; f.y = 0;
  }

  // Fest en flate som flyttes til kantene av andre flater og utgangen
  function fest(kart, f, nx, ny, avstand) {
    var xs = [0, kart.bredde - f.b], ys = [0, kart.hoyde - f.h];
    kart.flater.forEach(function (a) {
      if (a === f) return;
      xs.push(a.x + a.b, a.x - f.b, a.x, a.x + a.b - f.b);
      ys.push(a.y + a.h, a.y - f.h, a.y, a.y + a.h - f.h);
    });
    var naer = function (v, liste) { var best = v, d = avstand; liste.forEach(function (c) { if (Math.abs(c - v) < d) { d = Math.abs(c - v); best = c; } }); return best; };
    return [naer(nx, xs), naer(ny, ys)];
  }

  function tegnFlate(ctx, f, i) {
    var c = farge(i);
    var m = Math.min(f.b, f.h);
    ctx.save();
    ctx.beginPath(); ctx.rect(f.x, f.y, f.b, f.h); ctx.clip();
    ctx.fillStyle = c; ctx.globalAlpha = 0.28; ctx.fillRect(f.x, f.y, f.b, f.h); ctx.globalAlpha = 1;
    if (f.pw > 0 && f.ph > 0) {
      var kol = Math.ceil(f.b / f.pw), rad = Math.ceil(f.h / f.ph);
      ctx.fillStyle = c; ctx.globalAlpha = 0.14;
      for (var yy = 0; yy < rad; yy++) for (var xx = 0; xx < kol; xx++) if ((xx + yy) % 2) ctx.fillRect(f.x + xx * f.pw, f.y + yy * f.ph, f.pw, f.ph);
      ctx.globalAlpha = 0.6; ctx.strokeStyle = c; ctx.lineWidth = 1; ctx.beginPath();
      for (xx = 1; xx < kol; xx++) { ctx.moveTo(f.x + xx * f.pw + 0.5, f.y); ctx.lineTo(f.x + xx * f.pw + 0.5, f.y + f.h); }
      for (yy = 1; yy < rad; yy++) { ctx.moveTo(f.x, f.y + yy * f.ph + 0.5); ctx.lineTo(f.x + f.b, f.y + yy * f.ph + 0.5); }
      ctx.stroke(); ctx.globalAlpha = 1;
      var pfs = Math.max(8, Math.min(f.pw, f.ph) * 0.14);
      if (pfs >= 9) {
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '400 ' + Math.round(pfs) + 'px Barlow, Arial, sans-serif'; ctx.textAlign = 'left'; ctx.textBaseline = 'top';
        for (yy = 0; yy < rad; yy++) for (xx = 0; xx < kol; xx++) ctx.fillText((xx + 1) + '.' + (yy + 1), f.x + xx * f.pw + pfs * 0.35, f.y + yy * f.ph + pfs * 0.3);
      }
    }
    ctx.strokeStyle = c; ctx.lineWidth = Math.max(2, Math.round(m / 200)); ctx.strokeRect(f.x + ctx.lineWidth / 2, f.y + ctx.lineWidth / 2, f.b - ctx.lineWidth, f.h - ctx.lineWidth);
    // Navn og mål midt i flata
    var fs = Math.max(10, Math.min(m * 0.12, f.b / Math.max(6, f.navn.length) * 1.4));
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.font = '500 ' + Math.round(fs) + 'px Barlow, Arial, sans-serif';
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    var tw = Math.max(ctx.measureText(f.navn).width, fs * 5) + fs;
    ctx.fillRect(f.x + f.b / 2 - tw / 2, f.y + f.h / 2 - fs * 1.1, tw, fs * 2.6);
    ctx.fillStyle = '#fff'; ctx.fillText(f.navn, f.x + f.b / 2, f.y + f.h / 2 - fs * 0.3);
    ctx.font = '400 ' + Math.round(fs * 0.5) + 'px Barlow, Arial, sans-serif'; ctx.fillStyle = '#d6d8db';
    ctx.fillText(f.b + ' × ' + f.h + '  @  ' + f.x + ', ' + f.y, f.x + f.b / 2, f.y + f.h / 2 + fs * 0.75);
    ctx.restore();
  }

  function tegn(cv, kart) {
    cv.width = kart.bredde; cv.height = kart.hoyde;
    var ctx = cv.getContext('2d');
    ctx.fillStyle = '#000'; ctx.fillRect(0, 0, cv.width, cv.height);
    // Diskret rutenett hver 120 px så tom plass synes
    ctx.strokeStyle = 'rgba(255,255,255,0.06)'; ctx.lineWidth = 1; ctx.beginPath();
    for (var x = 120; x < cv.width; x += 120) { ctx.moveTo(x + 0.5, 0); ctx.lineTo(x + 0.5, cv.height); }
    for (var y = 120; y < cv.height; y += 120) { ctx.moveTo(0, y + 0.5); ctx.lineTo(cv.width, y + 0.5); }
    ctx.stroke();
    kart.flater.forEach(function (f, i) { tegnFlate(ctx, f, i); });
    if (kart.navn) {
      var fs = Math.max(12, Math.round(Math.min(cv.width, cv.height) * 0.018));
      ctx.font = '400 ' + fs + 'px Barlow, Arial, sans-serif'; ctx.textAlign = 'right'; ctx.textBaseline = 'bottom'; ctx.fillStyle = 'rgba(255,255,255,0.6)';
      ctx.fillText(kart.navn + '  ·  ' + kart.bredde + ' × ' + kart.hoyde, cv.width - fs * 0.6, cv.height - fs * 0.5);
    }
  }

  // Finn flater i et pixelmap-bilde. Naboer med lik farge (innenfor en toleranse) hører til samme område;
  // nesten svart regnes som bakgrunn. Små områder inne i et større (tekst, panelstreker) slås sammen med det store.
  // data = ImageData. Returnerer [{x, y, b, h}] sortert fra venstre-topp.
  function finnFlater(data) {
    var W = data.width, H = data.height, px = data.data, N = W * H;
    // Hver piksel får en klasse: 0 = bakgrunn (svart/gjennomsiktig), 1 = fargeløs (hvit/grå tekst og linjer), 2 = farget.
    // Fargede piksler grupperes etter fargetone, så sjakkruter i lys og mørk utgave av samme farge blir én flate.
    var klasse = new Uint8Array(N), tone = new Float32Array(N);
    for (var i = 0; i < N; i++) {
      var o = i * 4, r = px[o], g = px[o + 1], bl = px[o + 2];
      if (px[o + 3] <= 128 || r + g + bl <= 45) continue;
      var mx = Math.max(r, g, bl), mn = Math.min(r, g, bl);
      if (mx < 40 || (mx - mn) / mx < 0.25) { klasse[i] = 1; continue; }
      var d = mx - mn, t = mx === r ? ((g - bl) / d + 6) % 6 : mx === g ? (bl - r) / d + 2 : (r - g) / d + 4;
      klasse[i] = 2; tone[i] = t * 60;
    }
    var naer = function (a, b) { var d = Math.abs(a - b); return Math.min(d, 360 - d) < 25; };
    // Tynne hvite streker (diagonaler, sirkel, rutenett) deler ellers flaten i biter: en fargeløs piksel med
    // samme farge på begge sider innen 3 piksler regnes som en del av flaten rundt.
    var tynn = function (i, steg, maks) {
      for (var a = 1; a <= 3; a++) {
        var p = i - a * steg; if (p < 0 || !maks(a, -1)) return -1;
        if (klasse[p] === 2) { for (var b = 1; b <= 3; b++) { var q = i + b * steg; if (q >= N || !maks(b, 1)) return -1;
          if (klasse[q] === 2) return naer(tone[p], tone[q]) ? p : -1; if (klasse[q] !== 1) return -1; } return -1; }
        if (klasse[p] !== 1) return -1;
      }
      return -1;
    };
    var fiks = [];
    for (var i2 = 0; i2 < N; i2++) {
      if (klasse[i2] !== 1) continue;
      var x2 = i2 % W;
      var p2 = tynn(i2, 1, function (a, r) { var x = x2 + a * r; return x >= 0 && x < W; });
      if (p2 < 0) p2 = tynn(i2, W, function () { return true; });
      if (p2 >= 0) fiks.push(i2, p2);
    }
    for (var f = 0; f < fiks.length; f += 2) { klasse[fiks[f]] = 2; tone[fiks[f]] = tone[fiks[f + 1]]; }
    var merke = new Int32Array(N), ko = new Int32Array(N), bokser = [];
    for (var s = 0; s < N; s++) {
      if (merke[s] || !klasse[s]) continue;
      var id = bokser.length + 1, hode = 0, hale = 0, k = klasse[s], t0 = tone[s];
      var bo = { x0: W, y0: H, x1: 0, y1: 0, n: 0, farget: k === 2 };
      var ok = function (j) { return !merke[j] && klasse[j] === k && (k === 1 || naer(tone[j], t0)); };
      ko[hale++] = s; merke[s] = id;
      while (hode < hale) {
        var c = ko[hode++], cx = c % W, cy = (c / W) | 0; bo.n++;
        if (cx < bo.x0) bo.x0 = cx; if (cx > bo.x1) bo.x1 = cx; if (cy < bo.y0) bo.y0 = cy; if (cy > bo.y1) bo.y1 = cy;
        if (cx > 0 && ok(c - 1)) { merke[c - 1] = id; ko[hale++] = c - 1; }
        if (cx < W - 1 && ok(c + 1)) { merke[c + 1] = id; ko[hale++] = c + 1; }
        if (cy > 0 && ok(c - W)) { merke[c - W] = id; ko[hale++] = c - W; }
        if (cy < H - 1 && ok(c + W)) { merke[c + W] = id; ko[hale++] = c + W; }
      }
      bokser.push(bo);
    }
    // Finnes det fargede flater, er hvit tekst, rammer og hjørnemerker bare pynt og tas ikke med
    // Hvite, fylte rektangler er ofte merkelapper med navn eller mål; de tas vare på så teksten kan leses
    var etiketter = bokser.filter(function (b) {
      var bb = b.x1 - b.x0 + 1, hh = b.y1 - b.y0 + 1;
      return !b.farget && hh >= 5 && bb >= 2 * hh && hh <= 300 && b.n > 0.6 * bb * hh;
    }).map(function (b) { return { x: b.x0, y: b.y0, b: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 }; });
    if (bokser.some(function (b) { return b.farget; })) bokser = bokser.filter(function (b) { return b.farget; });
    var areal = function (b) { return (b.x1 - b.x0 + 1) * (b.y1 - b.y0 + 1); };
    bokser = bokser.filter(function (b) { return areal(b) >= 400; }); // bokstaver og støy
    bokser.sort(function (a, b) { return areal(b) - areal(a); });
    // Slå sammen bokser som ligger inni en annen, eller overlapper mer enn halvparten av den minste
    var endret = true;
    while (endret) {
      endret = false;
      for (var i = 0; i < bokser.length && !endret; i++) for (var j = i + 1; j < bokser.length; j++) {
        var A = bokser[i], B = bokser[j];
        var ox = Math.min(A.x1, B.x1) - Math.max(A.x0, B.x0) + 1, oy = Math.min(A.y1, B.y1) - Math.max(A.y0, B.y0) + 1;
        if (ox > 0 && oy > 0 && ox * oy > 0.5 * Math.min(areal(A), areal(B))) {
          A.x0 = Math.min(A.x0, B.x0); A.y0 = Math.min(A.y0, B.y0); A.x1 = Math.max(A.x1, B.x1); A.y1 = Math.max(A.y1, B.y1);
          bokser.splice(j, 1); endret = true; break;
        }
      }
    }
    // Ta med en tynn kantlinje rundt flaten (ofte hvit) så målene blir hele
    var fylt = function (x0, y0, x1, y1) {
      if (x0 < 0 || y0 < 0 || x1 >= W || y1 >= H) return false;
      var n = 0, t = 0; for (var y = y0; y <= y1; y++) for (var x = x0; x <= x1; x++) { t++; if (klasse[y * W + x] === 1) n++; }
      return n > 0.4 * t;
    };
    bokser.forEach(function (b) {
      for (var g = 0; g < 3 && fylt(b.x0 - 1, b.y0, b.x0 - 1, b.y1); g++) b.x0--;
      for (g = 0; g < 3 && fylt(b.x1 + 1, b.y0, b.x1 + 1, b.y1); g++) b.x1++;
      for (g = 0; g < 3 && fylt(b.x0, b.y0 - 1, b.x1, b.y0 - 1); g++) b.y0--;
      for (g = 0; g < 3 && fylt(b.x0, b.y1 + 1, b.x1, b.y1 + 1); g++) b.y1++;
    });
    var minAreal = N * 0.001;
    var ut = bokser.filter(function (b) { return areal(b) >= minAreal; }).map(function (b) {
      return { x: b.x0, y: b.y0, b: b.x1 - b.x0 + 1, h: b.y1 - b.y0 + 1 };
    }).sort(function (p, q) { return p.y - q.y || p.x - q.x; });
    ut.etiketter = etiketter;
    return ut;
  }

  var api = { farge: farge, hent: hent, lagre: lagre, les: les, overlapp: overlapp, pakk: pakk, fest: fest, tegn: tegn, finnFlater: finnFlater };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaptPixelmap = api;
})(this);
