// EDID-motor: lager og leser EDID (VESA E-EDID 1.3 med valgfri CTA-861-blokk).
// Brukes av edid/index.html, og kan testes med node (module.exports nederst).
(function (root) {
  'use strict';

  // CVT med redusert blanking (VESA CVT 1.2). versjon 1 eller 2.
  function cvtRB(hAktiv, vAktiv, hz, versjon, eksakt) {
    var vSync;
    var r = hAktiv / vAktiv;
    var nær = function (a) { return Math.abs(r - a) < 0.01; };
    if (versjon === 2) vSync = 8;
    else if (nær(4 / 3)) vSync = 4;
    else if (nær(16 / 9)) vSync = 5;
    else if (nær(16 / 10)) vSync = 6;
    else if (nær(5 / 4) || nær(15 / 9)) vSync = 7;
    else vSync = 10;

    var minVBlank = 460; // mikrosekunder
    var hPeriodeEst = ((1e6 / hz) - minVBlank) / vAktiv;
    var vbiLinjer = Math.floor(minVBlank / hPeriodeEst) + 1;
    var hBlank, hSync, hFp, vFp, vBp, klokke;
    if (versjon === 2) {
      hBlank = 80; hSync = 32; hFp = 8; vBp = 6;
      var minVbi = 1 + vSync + vBp;
      vbiLinjer = Math.max(vbiLinjer, minVbi);
      vFp = vbiLinjer - vSync - vBp;
      var totV2 = vAktiv + vbiLinjer, totH2 = hAktiv + hBlank;
      klokke = Math.floor(hz * totV2 * totH2 / 1e3) / 1e3; // MHz, 1 kHz steg
    } else {
      hBlank = 160; hSync = 32; hFp = 48; vFp = 3;
      var minVbi1 = vFp + vSync + 6;
      vbiLinjer = Math.max(vbiLinjer, minVbi1);
      vBp = vbiLinjer - vFp - vSync;
      var totV = vAktiv + vbiLinjer, totH = hAktiv + hBlank;
      klokke = 0.25 * Math.floor((hz * totV * totH / 1e6) / 0.25); // MHz, 0,25 MHz steg
    }
    var totalH = hAktiv + hBlank, totalV = vAktiv + vbiLinjer;
    // DTD lagrer klokka i 10 kHz-steg
    klokke = Math.floor(klokke * 100 + 1e-9) / 100;
    if (eksakt) {
      // Juster horisontal blanking litt så frekvensen treffer så nær ønsket Hz som mulig (viktig ved genlock og 50 Hz-kamera)
      var best = null;
      for (var ekstra = 0; ekstra <= 600; ekstra += 2) {
        var th = hAktiv + hBlank + ekstra;
        var k10 = Math.round(hz * th * totalV / 1e4); // i 10 kHz
        var avvik = Math.abs(k10 * 1e4 / (th * totalV) - hz);
        if (!best || avvik < best.avvik - 1e-9) best = { ekstra: ekstra, k: k10 / 100, avvik: avvik };
        if (avvik < 0.0003) break; // godt nok: viser riktig med tre desimaler
      }
      hFp += best.ekstra; hBlank += best.ekstra; totalH += best.ekstra; klokke = best.k;
    }
    return {
      hAktiv: hAktiv, vAktiv: vAktiv, hBlank: hBlank, vBlank: vbiLinjer,
      hFp: hFp, hSync: hSync, vFp: vFp, vSync: vSync,
      klokke: klokke, hPos: true, vPos: versjon === 2,
      totalH: totalH, totalV: totalV,
      hz: klokke * 1e6 / (totalH * totalV), hKhz: klokke * 1e3 / totalH
    };
  }

  // Standard CEA/CTA-timing for 1080p (VIC 16/31) og 2160p brukes ikke her; vi bruker CVT-RB for alt egendefinert.

  function sjekkTiming(t) {
    var feil = [];
    if (t.hAktiv > 4095 || t.vAktiv > 4095) feil.push('EDID kan bare beskrive opptil 4095 piksler i hver retning i en DTD.');
    if (t.klokke > 655.35) feil.push('Pikselklokka (' + t.klokke.toFixed(2) + ' MHz) er over 655,35 MHz, som er det høyeste en DTD kan beskrive. Prøv CVT-RB v2 eller lavere frekvens.');
    if (t.vFp > 63 || t.vSync > 63) feil.push('Vertikal front porch eller sync er for stor for DTD.');
    return feil;
  }

  function dtd(t, mmB, mmH) {
    var b = new Array(18).fill(0);
    var k = Math.round(t.klokke * 100);
    b[0] = k & 255; b[1] = (k >> 8) & 255;
    b[2] = t.hAktiv & 255; b[3] = t.hBlank & 255; b[4] = ((t.hAktiv >> 8) << 4) | ((t.hBlank >> 8) & 15);
    b[5] = t.vAktiv & 255; b[6] = t.vBlank & 255; b[7] = ((t.vAktiv >> 8) << 4) | ((t.vBlank >> 8) & 15);
    b[8] = t.hFp & 255; b[9] = t.hSync & 255;
    b[10] = ((t.vFp & 15) << 4) | (t.vSync & 15);
    b[11] = (((t.hFp >> 8) & 3) << 6) | (((t.hSync >> 8) & 3) << 4) | (((t.vFp >> 4) & 3) << 2) | ((t.vSync >> 4) & 3);
    mmB = Math.min(4095, Math.round(mmB || 0)); mmH = Math.min(4095, Math.round(mmH || 0));
    b[12] = mmB & 255; b[13] = mmH & 255; b[14] = ((mmB >> 8) << 4) | (mmH >> 8);
    b[17] = 0x18 | (t.vPos ? 4 : 0) | (t.hPos ? 2 : 0); // digital separat sync
    return b;
  }

  function tekstDescriptor(type, tekst) {
    var b = [0, 0, 0, type, 0];
    var s = (tekst || '').replace(/[^\x20-\x7e]/g, '').slice(0, 13);
    for (var i = 0; i < 13; i++) {
      if (i < s.length) b.push(s.charCodeAt(i));
      else if (i === s.length) b.push(0x0a);
      else b.push(0x20);
    }
    return b;
  }

  function sjekksum(blokk) {
    var sum = 0;
    for (var i = 0; i < 127; i++) sum += blokk[i];
    blokk[127] = (256 - (sum % 256)) % 256;
    return blokk;
  }

  // valg: { navn, produsent (3 bokstaver), produkt, serie, timinger: [t1, t2?], mmB, mmH, kunEgen, hdmi, lyd }
  function lag(valg) {
    var e = new Array(128).fill(0);
    [0, 255, 255, 255, 255, 255, 255, 0].forEach(function (v, i) { e[i] = v; });
    var p = (valg.produsent || 'HPT').toUpperCase().replace(/[^A-Z]/g, 'A').padEnd(3, 'A').slice(0, 3);
    var id = ((p.charCodeAt(0) - 64) << 10) | ((p.charCodeAt(1) - 64) << 5) | (p.charCodeAt(2) - 64);
    e[8] = id >> 8; e[9] = id & 255;
    var prod = valg.produkt || 1; e[10] = prod & 255; e[11] = (prod >> 8) & 255;
    var serie = valg.serie || 1; e[12] = serie & 255; e[13] = (serie >> 8) & 255; e[14] = (serie >> 16) & 255; e[15] = (serie >>> 24) & 255;
    var nå = valg.dato || new Date();
    var uke = Math.min(53, Math.max(1, Math.ceil(((nå - new Date(nå.getFullYear(), 0, 1)) / 864e5 + 1) / 7)));
    e[16] = uke; e[17] = nå.getFullYear() - 1990;
    e[18] = 1; e[19] = 3;
    e[20] = 0x80; // digital inngang
    e[21] = Math.min(255, Math.round((valg.mmB || 0) / 10)); e[22] = Math.min(255, Math.round((valg.mmH || 0) / 10));
    e[23] = 120; // gamma 2,2
    e[24] = 0x0a; // RGB-farge, foretrukket timing i første DTD
    [0xee, 0x91, 0xa3, 0x54, 0x4c, 0x99, 0x26, 0x0f, 0x50, 0x54].forEach(function (v, i) { e[25 + i] = v; }); // sRGB-ish
    if (!valg.kunEgen) { e[35] = 0x21; e[36] = 0x08; e[37] = 0x00; } // 640×480, 800×600, 1024×768 @ 60
    for (var i = 38; i < 54; i++) e[i] = 1; // ingen standardtiminger

    var t = valg.timinger;
    var d1 = dtd(t[0], valg.mmB, valg.mmH);
    for (i = 0; i < 18; i++) e[54 + i] = d1[i];

    // Grenser (range limits) som dekker alle timingene
    var hzer = t.map(function (x) { return x.hz; }), khz = t.map(function (x) { return x.hKhz; }), mhz = t.map(function (x) { return x.klokke; });
    var minV = Math.max(1, Math.floor(Math.min.apply(null, hzer)) - 1), maxV = Math.min(255, Math.ceil(Math.max.apply(null, hzer)) + 1);
    var minH = Math.max(1, Math.floor(Math.min.apply(null, khz)) - 1), maxH = Math.min(255, Math.ceil(Math.max.apply(null, khz)) + 1);
    var maxK = Math.min(255, Math.ceil(Math.max.apply(null, mhz) / 10) + 1);
    if (!valg.kunEgen) { minV = Math.min(minV, 56); maxV = Math.max(maxV, 61); minH = Math.min(minH, 30); maxH = Math.max(maxH, 49); maxK = Math.max(maxK, 7); }
    var grense = [0, 0, 0, 0xfd, 0, minV, maxV, minH, maxH, maxK, 0, 0x0a, 0x20, 0x20, 0x20, 0x20, 0x20, 0x20];
    for (i = 0; i < 18; i++) e[72 + i] = grense[i];

    var navn = tekstDescriptor(0xfc, valg.navn || 'HAPT');
    for (i = 0; i < 18; i++) e[90 + i] = navn[i];

    var siste = t[1] ? dtd(t[1], valg.mmB, valg.mmH) : tekstDescriptor(0xff, String(serie));
    for (i = 0; i < 18; i++) e[108 + i] = siste[i];

    e[126] = valg.hdmi ? 1 : 0;
    sjekksum(e);
    if (!valg.hdmi) return e;

    // CTA-861-blokk slik at kilder ser skjermen som HDMI
    var c = new Array(128).fill(0);
    var blokker = [];
    if (valg.lyd) {
      blokker = blokker.concat([0x23, 0x09, 0x07, 0x07]); // lyd: LPCM 2 kanaler, 32/44,1/48 kHz, 16/20/24 bit
      blokker = blokker.concat([0x83, 0x01, 0x00, 0x00]); // høyttaleroppsett: FL/FR
    }
    var maxTmds = Math.max.apply(null, mhz);
    var vsdb = [0x03, 0x0c, 0x00, 0x10, 0x00, 0x00, Math.min(255, Math.ceil(Math.min(340, maxTmds) / 5))];
    blokker = blokker.concat([0x60 | vsdb.length]).concat(vsdb);
    c[0] = 0x02; c[1] = 0x03; c[2] = 4 + blokker.length;
    c[3] = (valg.lyd ? 0x40 : 0) | 0x00;
    for (i = 0; i < blokker.length; i++) c[4 + i] = blokker[i];
    // Gjenta foretrukket timing i CTA-blokka (noen kilder leser bare denne)
    var pos = 4 + blokker.length;
    for (i = 0; i < 18; i++) c[pos + i] = d1[i];
    c[3] |= 1;
    sjekksum(c);
    return e.concat(c);
  }

  // ---------- Leser ----------
  var vicNavn = { 1: '640×480p60', 2: '720×480p60', 3: '720×480p60', 4: '1280×720p60', 5: '1920×1080i60', 16: '1920×1080p60', 17: '720×576p50', 18: '720×576p50', 19: '1280×720p50', 20: '1920×1080i50', 31: '1920×1080p50', 32: '1920×1080p24', 33: '1920×1080p25', 34: '1920×1080p30', 60: '1280×720p24', 61: '1280×720p25', 62: '1280×720p30', 63: '1920×1080p120', 64: '1920×1080p100', 93: '3840×2160p24', 94: '3840×2160p25', 95: '3840×2160p30', 96: '3840×2160p50', 97: '3840×2160p60', 98: '4096×2160p24', 99: '4096×2160p25', 100: '4096×2160p30', 101: '4096×2160p50', 102: '4096×2160p60' };

  function lesDtd(b, o) {
    var k = (b[o] | (b[o + 1] << 8)) / 100;
    if (!k) return null;
    var hA = b[o + 2] | ((b[o + 4] >> 4) << 8), hB = b[o + 3] | ((b[o + 4] & 15) << 8);
    var vA = b[o + 5] | ((b[o + 7] >> 4) << 8), vB = b[o + 6] | ((b[o + 7] & 15) << 8);
    var il = !!(b[o + 17] & 0x80);
    var hz = k * 1e6 / ((hA + hB) * (vA + vB));
    return { hAktiv: hA, vAktiv: il ? vA * 2 : vA, klokke: k, hz: il ? hz * 2 : hz, interlace: il, hBlank: hB, vBlank: vB, mmB: b[o + 12] | ((b[o + 14] >> 4) << 8), mmH: b[o + 13] | ((b[o + 14] & 15) << 8) };
  }

  function les(bytes) {
    var r = { feil: [], timinger: [], vic: [], blokker: Math.floor(bytes.length / 128) };
    if (bytes.length < 128) { r.feil.push('For kort: en EDID er minst 128 byte, denne er ' + bytes.length + '.'); return r; }
    var hode = [0, 255, 255, 255, 255, 255, 255, 0];
    if (hode.some(function (v, i) { return bytes[i] !== v; })) r.feil.push('Starten (header) er ikke en gyldig EDID.');
    r.sjekksum = [];
    for (var bl = 0; bl < r.blokker; bl++) {
      var s = 0; for (var i = 0; i < 128; i++) s += bytes[bl * 128 + i];
      r.sjekksum.push(s % 256 === 0);
    }
    var id = (bytes[8] << 8) | bytes[9];
    r.produsent = String.fromCharCode(((id >> 10) & 31) + 64, ((id >> 5) & 31) + 64, (id & 31) + 64);
    r.produkt = bytes[10] | (bytes[11] << 8);
    r.serie = (bytes[12] | (bytes[13] << 8) | (bytes[14] << 16) | (bytes[15] << 24)) >>> 0;
    r.uke = bytes[16]; r.år = bytes[17] + 1990;
    r.versjon = bytes[18] + '.' + bytes[19];
    r.digital = !!(bytes[20] & 0x80);
    r.cm = [bytes[21], bytes[22]];
    var est = [];
    var estNavn = [['720×400@70', '720×400@88', '640×480@60', '640×480@67', '640×480@72', '640×480@75', '800×600@56', '800×600@60'], ['800×600@72', '800×600@75', '832×624@75', '1024×768i@87', '1024×768@60', '1024×768@70', '1024×768@75', '1280×1024@75'], ['1152×870@75']];
    for (var by = 0; by < 3; by++) for (var bit = 0; bit < 8; bit++) if (bytes[35 + by] & (0x80 >> bit) && estNavn[by][bit]) est.push(estNavn[by][bit]);
    r.etablerte = est;
    r.standard = [];
    for (i = 38; i < 54; i += 2) {
      if (bytes[i] === 1 && bytes[i + 1] === 1) continue;
      if (bytes[i] === 0) continue;
      var w = (bytes[i] + 31) * 8, f = bytes[i + 1] >> 6, hzS = (bytes[i + 1] & 63) + 60;
      var h = f === 0 ? (r.versjon >= '1.3' ? w * 10 / 16 : w) : f === 1 ? w * 3 / 4 : f === 2 ? w * 4 / 5 : w * 9 / 16;
      r.standard.push(w + '×' + Math.round(h) + '@' + hzS);
    }
    for (var o = 54; o < 126; o += 18) {
      if (bytes[o] || bytes[o + 1]) { var t = lesDtd(bytes, o); if (t) { t.kilde = 'EDID'; r.timinger.push(t); } continue; }
      var type = bytes[o + 3];
      var txt = String.fromCharCode.apply(null, bytes.slice(o + 5, o + 18)).split('\n')[0].trim();
      if (type === 0xfc) r.navn = txt;
      if (type === 0xff) r.serieTekst = txt;
      if (type === 0xfe) r.tekst = txt;
      if (type === 0xfd) r.grenser = { minV: bytes[o + 5], maxV: bytes[o + 6], minH: bytes[o + 7], maxH: bytes[o + 8], maxMhz: bytes[o + 9] * 10 };
    }
    for (bl = 1; bl < r.blokker; bl++) {
      var b0 = bl * 128;
      if (bytes[b0] !== 2) continue;
      r.cta = { versjon: bytes[b0 + 1], hdmi: false, lyd: !!(bytes[b0 + 3] & 0x40) };
      var slutt = bytes[b0 + 2], p = b0 + 4;
      while (p < b0 + slutt && slutt >= 4) {
        var tag = bytes[p] >> 5, len = bytes[p] & 31;
        if (tag === 2) for (var j = 1; j <= len; j++) { var v = bytes[p + j]; var vic = (v >= 129 && v <= 192) ? v & 127 : v; r.vic.push({ vic: vic, navn: vicNavn[vic] || ('VIC ' + vic), naturlig: v >= 129 && v <= 192 }); }
        if (tag === 3 && bytes[p + 1] === 0x03 && bytes[p + 2] === 0x0c && bytes[p + 3] === 0) r.cta.hdmi = true;
        if (tag === 3 && bytes[p + 1] === 0xd8 && bytes[p + 2] === 0x5d && bytes[p + 3] === 0xc4) r.cta.hdmi2 = true;
        if (tag === 1) r.cta.lyd = true;
        p += len + 1;
      }
      if (slutt >= 4) for (o = b0 + slutt; o + 18 <= b0 + 127; o += 18) {
        var td = lesDtd(bytes, o); if (!td) break; td.kilde = 'CTA'; r.timinger.push(td);
      }
    }
    return r;
  }

  // Les .bin eller tekst med hex (f.eks. fra et EDID-verktøy)
  function fraTekst(s) {
    var hex = s.replace(/0x/gi, '').replace(/[^0-9a-f]/gi, '');
    var ut = [];
    for (var i = 0; i + 1 < hex.length; i += 2) ut.push(parseInt(hex.substr(i, 2), 16));
    return ut;
  }

  var api = { cvtRB: cvtRB, sjekkTiming: sjekkTiming, lag: lag, les: les, fraTekst: fraTekst };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaptEdid = api;
})(this);
