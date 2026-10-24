// Lydkjernen for «Lyd fra video»: filnavn, PCM-dekoding, omsampling, måling (topp, true peak, LUFS) og WAV-hode.
// Brukes både på siden og i arbeideren (arbeider.js). Alt regnes i flyttall med dobbel presisjon.
(function (g) {
  'use strict';

  // ---------- Filnavn ----------
  // Samme regel som Python-verktøyet: NFC, små bokstaver, «–» blir «-», «_vN» rett før endelsen fjernes,
  // alt som ikke er a–z eller 0–9 blir «-». Bare ASCII, fordi disguise lager tomme filer av andre tegn.
  function wavNavn(navn, fraBruker) {
    var n = String(navn || '').replace(/\\/g, '/');
    n = n.slice(n.lastIndexOf('/') + 1);
    try { n = n.normalize('NFC'); } catch (e) {}
    n = n.toLowerCase().replace(/–/g, '-');
    // Bokstaver som æ, ø, å og ü blir nærmeste a–z, så «Øvelse» blir «ovelse» og ikke «velse»
    n = n.replace(/æ/g, 'ae').replace(/ø/g, 'o').replace(/ß/g, 'ss');
    try { n = n.normalize('NFD').replace(/[\u0300-\u036f]/g, ''); } catch (e) {}
    if (fraBruker) n = n.replace(/\.wav$/, '');
    else n = n.replace(/\.[a-z0-9]{1,5}$/, '').replace(/_v\d+$/, '');
    n = n.replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
    return (n || 'lyd') + '.wav';
  }

  // ---------- Kanalmasker ----------
  // Det ffmpeg skriver i WAV-hodet når kilden ikke sier noe om kanalene (ffmpeg 6, av_channel_layout_default)
  var STANDARD_MASKE = { 1: 0x4, 2: 0x3, 3: 0xB, 4: 0x107, 5: 0x37, 6: 0x3F, 7: 0x70F, 8: 0x63F, 10: 0x2D03F, 12: 0x2D63F };
  function standardMaske(kanaler) { return STANDARD_MASKE[kanaler] || 0; }
  function antallBiter(m) { var n = 0; while (m) { n += m & 1; m >>>= 1; } return n; }

  // ---------- PCM ----------
  // fmt: { enc: 's' | 'u' | 'f' | 'ulaw' | 'alaw', bytes (per sample i fila), bits (gyldige), le, hoy (24 i 32, venstrejustert), kanaler, bpf }
  // Skriver hver kanal til ut[k][utFra + i] som flyttall der fullt utslag er ±1 (heltall / 2^(bits-1)).
  var ULAW = null, ALAW = null;
  function g711() {
    if (ULAW) return;
    ULAW = new Float64Array(256); ALAW = new Float64Array(256);
    for (var i = 0; i < 256; i++) {
      var u = ~i & 0xff, t = ((u & 0x0f) << 3) + 0x84;
      t <<= (u & 0x70) >> 4;
      ULAW[i] = ((u & 0x80) ? (0x84 - t) : (t - 0x84)) / 32768;
      var a = i ^ 0x55, s = (a & 0x70) >> 4, v = a & 0x0f;
      v = s ? (v + v + 1 + 32) << (s + 2) : (v + v + 1) << 3;
      ALAW[i] = ((a & 0x80) ? v : -v) / 32768;
    }
  }

  function dekodPcm(fmt, b, fra, antall, ut, utFra) {
    var K = fmt.kanaler, bpf = fmt.bpf, sb = fmt.bytes, k, i, p, v, o;
    for (k = 0; k < K; k++) {
      var d = ut[k];
      p = fra + k * sb; o = utFra;
      if (fmt.enc === 's' && sb === 2) {
        if (fmt.le) for (i = 0; i < antall; i++, p += bpf) d[o++] = ((b[p] | (b[p + 1] << 8)) << 16 >> 16) / 32768;
        else for (i = 0; i < antall; i++, p += bpf) d[o++] = (((b[p] << 8) | b[p + 1]) << 16 >> 16) / 32768;
      } else if (fmt.enc === 's' && sb === 3) {
        if (fmt.le) for (i = 0; i < antall; i++, p += bpf) d[o++] = ((b[p] | (b[p + 1] << 8) | (b[p + 2] << 16)) << 8 >> 8) / 8388608;
        else for (i = 0; i < antall; i++, p += bpf) d[o++] = (((b[p] << 16) | (b[p + 1] << 8) | b[p + 2]) << 8 >> 8) / 8388608;
      } else if (fmt.enc === 's' && sb === 4) {
        // 32-bitsbeholder: ekte 32 bit, eller 24 bit venstrejustert (hoy) eller høyrejustert
        var skal = fmt.bits === 32 || fmt.hoy ? 2147483648 : Math.pow(2, fmt.bits - 1);
        var hoyre = fmt.bits < 32 && !fmt.hoy ? 32 - fmt.bits : 0;
        for (i = 0; i < antall; i++, p += bpf) {
          v = fmt.le ? (b[p] | (b[p + 1] << 8) | (b[p + 2] << 16) | (b[p + 3] << 24)) : ((b[p] << 24) | (b[p + 1] << 16) | (b[p + 2] << 8) | b[p + 3]);
          if (hoyre) v = v << hoyre >> hoyre;
          d[o++] = v / skal;
        }
      } else if (fmt.enc === 's' && sb === 1) {
        for (i = 0; i < antall; i++, p += bpf) d[o++] = (b[p] << 24 >> 24) / 128;
      } else if (fmt.enc === 'u' && sb === 1) {
        for (i = 0; i < antall; i++, p += bpf) d[o++] = (b[p] - 128) / 128;
      } else if (fmt.enc === 'f') {
        var dv = new DataView(b.buffer, b.byteOffset, b.byteLength);
        if (sb === 4) for (i = 0; i < antall; i++, p += bpf) d[o++] = dv.getFloat32(p, fmt.le);
        else for (i = 0; i < antall; i++, p += bpf) d[o++] = dv.getFloat64(p, fmt.le);
      } else if (fmt.enc === 'ulaw' || fmt.enc === 'alaw') {
        g711();
        var tab = fmt.enc === 'ulaw' ? ULAW : ALAW;
        for (i = 0; i < antall; i++, p += bpf) d[o++] = tab[b[p]];
      } else {
        throw new Error('pcm-format');
      }
    }
  }

  // ---------- Kaiser-vindu ----------
  function besselI0(x) {
    var s = 1, t = 1, k = 1, y = x * x / 4;
    while (t > 1e-14 * s) { t *= y / (k * k); s += t; k++; }
    return s;
  }
  function sinc(x) { if (x === 0) return 1; var a = Math.PI * x; return Math.sin(a) / a; }
  function gcd(a, b) { while (b) { var t = a % b; a = b; b = t; } return a; }

  // ---------- Omsampler ----------
  // Polyfase vindusinc (Kaiser, β 9,5, ca. 95 dB demping), strømmende. Utsample n ligger på inngangstid n·inn/ut,
  // og lengden blir ceil(N·ut/inn), som ffmpeg. Knekkpunkt 0,95 av laveste Nyquist og 36 nullpunkt hver vei:
  // ved 44,1 → 48 kHz er det 76 punkt per utsample, flatt til ca. 19,3 kHz og −6 dB ved 20,9 kHz.
  // Kanalene ligger flettet i ett buffer, så hver koeffisient hentes én gang for alle kanalene.
  function Omsampler(innRate, utRate, kanaler, valg) {
    valg = valg || {};
    var d = gcd(innRate, utRate);
    this.L = utRate / d; this.M = innRate / d; this.K = kanaler;
    var rho = valg.knekk || 0.95, Z = valg.nullpunkt || 36, beta = valg.beta || 9.5;
    var fc = Math.min(1, this.L / this.M) * rho;
    var H = Math.ceil(Z / fc);
    this.H = H; this.T = 2 * H;
    // Faser: nøyaktig L faser når det går, ellers 4096 med lineær interpolasjon mellom nabofasene
    this.P = this.L <= 4096 ? this.L : 4096;
    this.interp = this.L > 4096;
    var T = this.T, P = this.P, c = new Float64Array((P + 1) * T), i0b = besselI0(beta);
    for (var p = 0; p <= P; p++) {
      var frac = p / P, sum = 0;
      for (var j = 0; j < T; j++) {
        var x = H - 1 - j + frac, r = x / H;
        var w = Math.abs(r) >= 1 ? 0 : besselI0(beta * Math.sqrt(1 - r * r)) / i0b;
        var v = fc * sinc(fc * x) * w;
        c[p * T + j] = v; sum += v;
      }
      for (j = 0; j < T; j++) c[p * T + j] /= sum;
    }
    this.c = c;
    // Flettet inngangsbuffer. Globalt indeks for første ramme er start; vi begynner med H-1 nuller foran.
    this.kap = 1 << 16;
    this.buf = new Float64Array(this.kap * kanaler);
    this.start = -(H - 1); this.slutt = 0; // slutt = globalt indeks etter siste ramme i bufferet
    this.n = 0; this.q = 0; this.r = 0;      // neste utsample n: q = floor(n·M/L), r = n·M mod L
    this.inn = 0;                            // antall ekte inngangsrammer
  }
  Omsampler.prototype.leggTil = function (kan, fra, antall, nuller) {
    var K = this.K, bruk = this.slutt - this.start;
    if (bruk + antall > this.kap) {
      // Kast det som ikke trengs lenger, og gjør plass
      var kutt = Math.max(0, this.q - this.H + 1 - this.start);
      var ny = bruk - kutt + antall, kap = this.kap;
      while (ny > kap) kap *= 2;
      if (kap === this.kap) this.buf.copyWithin(0, kutt * K, bruk * K);
      else { var nb = new Float64Array(kap * K); nb.set(this.buf.subarray(kutt * K, bruk * K)); this.buf = nb; }
      this.kap = kap; this.start += kutt; bruk -= kutt;
    }
    var b = this.buf, o = bruk * K;
    if (nuller) b.fill(0, o, o + antall * K);
    else for (var k = 0; k < K; k++) { var x = kan[k], p = o + k; for (var i = fra, e = fra + antall; i < e; i++, p += K) b[p] = x[i]; }
    this.slutt += antall;
    if (!nuller) this.inn += antall;
  };
  function fir1(b, c, offs, fas, m, T, o0) {
    for (var i = 0; i < m; i++) {
      var a = offs[i], cb = fas[i] * T, s0 = 0, s1 = 0, j = 0;
      for (; j + 1 < T; j += 2) { s0 += b[a + j] * c[cb + j]; s1 += b[a + j + 1] * c[cb + j + 1]; }
      for (; j < T; j++) s0 += b[a + j] * c[cb + j];
      o0[i] = s0 + s1;
    }
  }
  function fir2(b, c, offs, fas, m, T, o0, o1) {
    for (var i = 0; i < m; i++) {
      var a = 2 * offs[i], cb = fas[i] * T, s0 = 0, s1 = 0, t0 = 0, t1 = 0, j = 0;
      for (; j + 1 < T; j += 2) {
        var c0 = c[cb + j], c1 = c[cb + j + 1];
        s0 += b[a] * c0; t0 += b[a + 1] * c0; s1 += b[a + 2] * c1; t1 += b[a + 3] * c1; a += 4;
      }
      for (; j < T; j++) { var c2 = c[cb + j]; s0 += b[a] * c2; t0 += b[a + 1] * c2; a += 2; }
      o0[i] = s0 + s1; o1[i] = t0 + t1;
    }
  }
  function firN(b, c, offs, fas, m, T, K, k, o0) {
    for (var i = 0; i < m; i++) {
      var a = K * offs[i] + k, cb = fas[i] * T, s = 0;
      for (var j = 0; j < T; j++, a += K) s += b[a] * c[cb + j];
      o0[i] = s;
    }
  }
  // Lag alle utsampler som har nok inngang (og høyst grense totalt). Returnerer [Float64Array per kanal].
  // Speil starten (x[−n] = x[n]) som ffmpeg, så en brå start ikke gir et ekstra hakk. Gjøres når nok inngang finnes.
  Omsampler.prototype.speilStart = function (alt) {
    if (this.speilet || (!alt && this.inn < this.H)) return;
    this.speilet = true;
    var K = this.K, H = this.H, b = this.buf, null0 = -this.start; // bufferindeks for globalt sample 0
    for (var n = 1; n < H; n++) {
      var i = null0 - n;
      if (i < 0) break;
      for (var k = 0; k < K; k++) b[i * K + k] = n < this.inn ? b[(null0 + n) * K + k] : 0;
    }
  };
  Omsampler.prototype.lag = function (grense) {
    this.speilStart(false);
    if (!this.speilet) return this._tom();
    var L = this.L, M = this.M, H = this.H, T = this.T, P = this.P, K = this.K;
    var m = 0, q = this.q, r = this.r, n = this.n;
    var maks = grense == null ? Infinity : grense - n;
    var trenger = Math.min(maks, Math.max(0, Math.ceil(((this.slutt - H - q) * L - r) / M) + 2));
    var offs = this._offs, fas = this._fas;
    if (!offs || offs.length < trenger) { offs = this._offs = new Int32Array(trenger + 1024); fas = this._fas = new Int32Array(trenger + 1024); }
    while (m < maks && q + H < this.slutt) {
      offs[m] = q - H + 1 - this.start;
      fas[m] = r;
      m++;
      r += M;
      if (r >= L) { q += Math.floor(r / L); r %= L; }
    }
    var ut = [], k;
    for (k = 0; k < K; k++) ut.push(new Float64Array(m));
    var b = this.buf, c = this.c;
    if (this.interp) {
      // Mange faser: interpoler lineært mellom to nabofaser
      for (k = 0; k < K; k++) {
        var o = ut[k];
        for (var i = 0; i < m; i++) {
          var x = fas[i] / L * P, pi = Math.floor(x), pf = x - pi, a = K * offs[i] + k, cb = pi * T, s = 0, s1 = 0;
          for (var j = 0; j < T; j++, a += K) { s += b[a] * c[cb + j]; s1 += b[a] * c[cb + T + j]; }
          o[i] = s + (s1 - s) * pf;
        }
      }
    } else if (K === 1) fir1(b, c, offs, fas, m, T, ut[0]);
    else if (K === 2) fir2(b, c, offs, fas, m, T, ut[0], ut[1]);
    else for (k = 0; k < K; k++) firN(b, c, offs, fas, m, T, K, k, ut[k]);
    this.q = q; this.r = r; this.n = n + m;
    return ut;
  };
  Omsampler.prototype._tom = function () { var u = []; for (var k = 0; k < this.K; k++) u.push(new Float64Array(0)); return u; };
  Omsampler.prototype.lengde = function (innAntall) { return Math.ceil(innAntall * this.L / this.M); };
  // Tøm: speil slutten (x[N+j] = x[N−1−j], som ffmpeg) og lag resten, så totalen blir ceil(N·ut/inn)
  Omsampler.prototype.tom = function () {
    var mal = this.lengde(this.inn), H = this.H, K = this.K, N = this.inn;
    this.speilStart(true);
    if (this.n >= mal) return this._tom();
    var qSiste = Math.floor((mal - 1) * this.M / this.L);
    var mangler = qSiste + H + 1 - this.slutt;
    if (mangler > 0) {
      this.leggTil(null, 0, mangler, true);
      var b = this.buf;
      for (var j = 0; j < mangler; j++) {
        var g = N + j, kilde = 2 * N - 1 - g, i = g - this.start, ik = kilde - this.start;
        if (kilde < 0 || ik < 0) continue;
        for (var k = 0; k < K; k++) b[i * K + k] = b[ik * K + k];
      }
    }
    return this.lag(mal);
  };

  // ---------- Måling: topp, true peak og LUFS (EBU R128 / ITU-R BS.1770) ----------
  function kVekt(rate) {
    // Samme utledning som libebur128 / ffmpeg, så filteret stemmer for alle rater
    var f0 = 1681.974450955533, G = 3.999843853973347, Q = 0.7071752369554196;
    var K = Math.tan(Math.PI * f0 / rate), Vh = Math.pow(10, G / 20), Vb = Math.pow(Vh, 0.4996667741545416);
    var a0 = 1 + K / Q + K * K;
    var pre = { b0: (Vh + Vb * K / Q + K * K) / a0, b1: 2 * (K * K - Vh) / a0, b2: (Vh - Vb * K / Q + K * K) / a0, a1: 2 * (K * K - 1) / a0, a2: (1 - K / Q + K * K) / a0 };
    f0 = 38.13547087602444; Q = 0.5003270373238773;
    K = Math.tan(Math.PI * f0 / rate);
    var rlb = { b0: 1, b1: -2, b2: 1, a1: 2 * (K * K - 1) / (1 + K / Q + K * K), a2: (1 - K / Q + K * K) / (1 + K / Q + K * K) };
    return [pre, rlb];
  }

  // True peak: 4 × oversampling med vindusinc (8 nullpunkt hver vei, 16 punkt per fase; BS.1770 bruker 12).
  // Regnes bare rundt sampler som er innenfor 4,4 dB av høyeste verdi så langt, så det koster lite.
  var TP_H = 8, TP_FAS = null;
  function tpFaser() {
    if (TP_FAS) return TP_FAS;
    TP_FAS = [];
    var beta = 7, i0b = besselI0(beta);
    for (var f = 1; f < 4; f++) {
      var c = new Float64Array(2 * TP_H), s = 0;
      for (var j = 0; j < 2 * TP_H; j++) {
        var x = TP_H - 1 - j + f / 4, r = x / TP_H;
        var w = Math.abs(r) >= 1 ? 0 : besselI0(beta * Math.sqrt(1 - r * r)) / i0b;
        c[j] = sinc(x) * w; s += c[j];
      }
      for (j = 0; j < 2 * TP_H; j++) c[j] /= s;
      TP_FAS.push(c);
    }
    return TP_FAS;
  }

  function Maaler(rate, kanaler, maske) {
    this.rate = rate; this.K = kanaler;
    var f = kVekt(rate);
    this.f = f;
    this.z = []; // filtertilstand per kanal: [x1, x2, y1, y2] for hvert av de to filtrene
    for (var k = 0; k < kanaler; k++) this.z.push(new Float64Array(8));
    // Kanalvekter etter BS.1770: LFE 0, surround 1,41, resten 1
    this.vekt = [];
    var biter = [];
    if (maske && antallBiter(maske) === kanaler) for (var b = 0; b < 32; b++) if (maske & (1 << b)) biter.push(1 << b);
    for (k = 0; k < kanaler; k++) {
      var bit = biter[k] || 0;
      this.vekt.push(bit === 0x8 ? 0 : (bit === 0x10 || bit === 0x20 || bit === 0x200 || bit === 0x400) ? 1.41 : 1);
    }
    this.blokk = Math.round(rate / 10); // 100 ms
    this.iBlokk = 0;
    this.sum = new Float64Array(kanaler);
    this.blokker = []; // vektet middelkvadrat per 100 ms
    this.topp = new Float64Array(kanaler);
    this.tp = new Float64Array(kanaler);
    this.hist = []; // siste 2·TP_H sampler per kanal for true peak
    for (k = 0; k < kanaler; k++) this.hist.push(new Float64Array(2 * TP_H));
    this.antall = 0;
  }
  Maaler.prototype.legg = function (kan, antall) {
    var K = this.K, pre = this.f[0], rlb = this.f[1], k, i;
    // Topp og true peak
    var faser = tpFaser(), N2 = 2 * TP_H;
    for (k = 0; k < K; k++) {
      var x = kan[k], tp = 0, sp = this.topp[k];
      for (i = 0; i < antall; i++) { var a = x[i] < 0 ? -x[i] : x[i]; if (a > sp) sp = a; }
      this.topp[k] = sp;
      var tpNå = Math.max(this.tp[k], sp);
      // Arbeidsbuffer: historikk + ny blokk; interpoler mellom i og i+1 der en av dem er høy nok
      var hb = this.hist[k], n = N2 + antall, w = this._w && this._w.length >= n ? this._w : (this._w = new Float64Array(n + 4096));
      w.set(hb, 0); w.set(x.subarray(0, antall), N2);
      var terskel = tpNå * 0.6, best = this.tp[k] > sp ? this.tp[k] : sp;
      // Posisjon i (i w) har sentrum mellom w[i] og w[i+1]; trenger w[i-TP_H+1 .. i+TP_H]
      for (i = TP_H - 1; i + TP_H < n; i++) {
        var a1 = w[i] < 0 ? -w[i] : w[i], a2 = w[i + 1] < 0 ? -w[i + 1] : w[i + 1];
        if (a1 < terskel && a2 < terskel) continue;
        var base = i - TP_H + 1;
        for (var f = 0; f < 3; f++) {
          var c = faser[f], s = 0;
          for (var j = 0; j < N2; j++) s += w[base + j] * c[j];
          if (s < 0) s = -s;
          if (s > best) best = s;
        }
      }
      this.tp[k] = best;
      // Ta vare på de siste 2·TP_H samplene til neste runde
      if (antall >= N2) hb.set(x.subarray(antall - N2, antall));
      else { hb.copyWithin(0, antall); hb.set(x.subarray(0, antall), N2 - antall); }
    }
    // K-vekting og 100 ms-blokker
    var B = this.blokk, pos = 0;
    while (pos < antall) {
      var del = Math.min(antall - pos, B - this.iBlokk);
      for (k = 0; k < K; k++) {
        var z = this.z[k], xs = kan[k], s2 = 0;
        var x1 = z[0], x2 = z[1], y1 = z[2], y2 = z[3], u1 = z[4], u2 = z[5], v1 = z[6], v2 = z[7];
        for (i = pos; i < pos + del; i++) {
          var x0 = xs[i];
          var y0 = pre.b0 * x0 + pre.b1 * x1 + pre.b2 * x2 - pre.a1 * y1 - pre.a2 * y2;
          x2 = x1; x1 = x0; y2 = y1; y1 = y0;
          var v0 = y0 - 2 * u1 + u2 - rlb.a1 * v1 - rlb.a2 * v2;
          u2 = u1; u1 = y0; v2 = v1; v1 = v0;
          s2 += v0 * v0;
        }
        z[0] = x1; z[1] = x2; z[2] = y1; z[3] = y2; z[4] = u1; z[5] = u2; z[6] = v1; z[7] = v2;
        this.sum[k] += s2;
      }
      this.iBlokk += del; pos += del;
      if (this.iBlokk === B) {
        var tot = 0;
        for (k = 0; k < K; k++) { tot += this.vekt[k] * this.sum[k] / B; this.sum[k] = 0; }
        this.blokker.push(tot);
        this.iBlokk = 0;
      }
    }
    this.antall += antall;
  };
  // Integrert loudness med porter (−70 LUFS absolutt, −10 LU relativt), 400 ms-blokker med 75 % overlapp
  Maaler.prototype.lufs = function () {
    var b = this.blokker, z = [];
    for (var j = 0; j + 4 <= b.length; j++) z.push((b[j] + b[j + 1] + b[j + 2] + b[j + 3]) / 4);
    var ld = function (v) { return -0.691 + 10 * Math.log10(v); };
    var a = z.filter(function (v) { return v > 0 && ld(v) > -70; });
    if (!a.length) return -Infinity;
    var snitt = a.reduce(function (s, v) { return s + v; }, 0) / a.length;
    var rel = ld(snitt) - 10;
    var gj = a.filter(function (v) { return ld(v) > rel; });
    if (!gj.length) return -Infinity;
    return ld(gj.reduce(function (s, v) { return s + v; }, 0) / gj.length);
  };
  Maaler.prototype.resultat = function () {
    var db = function (v) { return v > 0 ? 20 * Math.log10(v) : -Infinity; };
    var sp = 0, tp = 0;
    for (var k = 0; k < this.K; k++) { if (this.topp[k] > sp) sp = this.topp[k]; if (this.tp[k] > tp) tp = this.tp[k]; }
    return { topp: db(sp), truePeak: db(Math.max(tp, sp)), lufs: this.lufs(), kanalTopp: Array.prototype.map.call(this.topp, db) };
  };

  // ---------- Kvantisering og pakking til WAV-data ----------
  // modus 'kopi': samme rate som kilden. 24 bit: som ffmpeg (avrund til 32 bit, så de 24 øverste bitene), slik at
  // 16- og 24-bitskilder blir bit for bit like. 16 bit: kilder på 16 bit eller mindre kopieres, ellers TPDF-dither.
  // modus 'omsamplet': avrund til nærmeste (24 bit) eller TPDF-dither (16 bit).
  function Pakker(kanaler, bits, modus, kildeBits) {
    this.K = kanaler; this.bits = bits; this.modus = modus;
    this.kopi16 = bits === 16 && modus === 'kopi' && kildeBits && kildeBits <= 16;
    this.klippet = 0;
    this.seed = 0x12345678;
  }
  Pakker.prototype.pakk = function (kan, antall) {
    var K = this.K, B = this.bits / 8, ut = new Uint8Array(antall * K * B), k, i, p, v, x, r;
    for (k = 0; k < K; k++) {
      var d = kan[k];
      p = k * B;
      if (this.bits === 24) {
        if (this.modus === 'kopi') {
          for (i = 0; i < antall; i++, p += K * 3) {
            r = Math.round(d[i] * 2147483648);
            if (r > 2147483647) { r = 2147483647; this.klippet++; } else if (r < -2147483648) { r = -2147483648; this.klippet++; }
            v = Math.floor(r / 256);
            ut[p] = v & 255; ut[p + 1] = (v >> 8) & 255; ut[p + 2] = (v >> 16) & 255;
            d[i] = v / 8388608;
          }
        } else {
          for (i = 0; i < antall; i++, p += K * 3) {
            v = Math.round(d[i] * 8388608);
            if (v > 8388607) { v = 8388607; this.klippet++; } else if (v < -8388608) { v = -8388608; this.klippet++; }
            ut[p] = v & 255; ut[p + 1] = (v >> 8) & 255; ut[p + 2] = (v >> 16) & 255;
            d[i] = v / 8388608;
          }
        }
      } else {
        var s = this.seed;
        for (i = 0; i < antall; i++, p += K * 2) {
          x = d[i] * 32768;
          if (this.kopi16) v = Math.round(x);
          else {
            // TPDF: summen av to uavhengige ±0,5 LSB
            s ^= s << 13; s ^= s >>> 17; s ^= s << 5; var r1 = (s >>> 0) / 4294967296;
            s ^= s << 13; s ^= s >>> 17; s ^= s << 5; var r2 = (s >>> 0) / 4294967296;
            v = Math.round(x + r1 - r2);
          }
          if (v > 32767) { v = 32767; this.klippet++; } else if (v < -32768) { v = -32768; this.klippet++; }
          ut[p] = v & 255; ut[p + 1] = (v >> 8) & 255;
          d[i] = v / 32768;
        }
        this.seed = s;
      }
    }
    return ut;
  };

  // ---------- WAV-hode ----------
  // Samme oppbygging som ffmpeg sin pcm_s24le-WAV, som er prøvd på disguise VX4:
  // RIFF, fmt (40 byte WAVE_FORMAT_EXTENSIBLE med kanalmaske og PCM-undertype), LIST/INFO/ISFT, data.
  // 16 bit mono/stereo opp til 48 kHz får vanlig 16-byte PCM-fmt, også som ffmpeg.
  var PROGRAM = 'hapt.no tools'; // 13 tegn + NUL, samme lengde som ffmpeg sin
  function wavHode(kanaler, rate, bits, rammer, maske) {
    var B = bits / 8, blokk = kanaler * B, data = rammer * blokk;
    var ext = bits > 16 || rate > 48000 || (maske !== 0 && maske !== 0x4 && maske !== 0x3);
    var fmtLen = ext ? 40 : 16;
    var listData = PROGRAM.length + 1, listPad = listData & 1, listLen = 4 + 8 + listData + listPad;
    var hodeLen = 12 + 8 + fmtLen + 8 + listLen + 8;
    var pad = data & 1;
    var riff = hodeLen - 8 + data + pad;
    if (riff > 4294967295) throw new Error('for-stor');
    var b = new ArrayBuffer(hodeLen), v = new DataView(b), o = 0;
    function str(s) { for (var i = 0; i < s.length; i++) v.setUint8(o++, s.charCodeAt(i)); }
    str('RIFF'); v.setUint32(o, riff, true); o += 4; str('WAVE');
    str('fmt '); v.setUint32(o, fmtLen, true); o += 4;
    v.setUint16(o, ext ? 0xFFFE : 1, true); o += 2;
    v.setUint16(o, kanaler, true); o += 2;
    v.setUint32(o, rate, true); o += 4;
    v.setUint32(o, rate * blokk, true); o += 4;
    v.setUint16(o, blokk, true); o += 2;
    v.setUint16(o, bits, true); o += 2;
    if (ext) {
      v.setUint16(o, 22, true); o += 2;
      v.setUint16(o, bits, true); o += 2;
      v.setUint32(o, maske >>> 0, true); o += 4;
      // KSDATAFORMAT_SUBTYPE_PCM 00000001-0000-0010-8000-00aa00389b71
      [1, 0, 0, 0, 0, 0, 0x10, 0, 0x80, 0, 0, 0xaa, 0, 0x38, 0x9b, 0x71].forEach(function (x) { v.setUint8(o++, x); });
    }
    str('LIST'); v.setUint32(o, listLen, true); o += 4; str('INFO');
    str('ISFT'); v.setUint32(o, listData, true); o += 4; str(PROGRAM); v.setUint8(o++, 0); if (listPad) v.setUint8(o++, 0);
    str('data'); v.setUint32(o, data, true); o += 4;
    return { hode: b, pad: pad, storrelse: hodeLen + data + pad };
  }

  g.HaptLyd = {
    wavNavn: wavNavn, standardMaske: standardMaske, antallBiter: antallBiter,
    dekodPcm: dekodPcm, Omsampler: Omsampler, Maaler: Maaler, Pakker: Pakker, wavHode: wavHode, kVekt: kVekt
  };
})(typeof self !== 'undefined' ? self : this);
