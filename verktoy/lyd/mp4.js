// QuickTime/MP4-leser for «Lyd fra video». Leser bare boksstrukturen og lyddelen av fila med File.slice(),
// aldri hele fila: moov kan ligge først eller sist, og bokser kan ha 64-bits størrelse. Brukes både på siden
// (analyse) og i arbeideren (uttrekk). Feil kastes med .kode og .data, så siden kan vise dem på begge språk.
(function (g) {
  'use strict';

  var MAKS_MOOV = 512 * 1024 * 1024;

  function feil(kode, data) { var e = new Error(kode); e.kode = kode; e.data = data || {}; return e; }
  function les(fil, fra, til) { return fil.slice(fra, til).arrayBuffer().then(function (b) { return new Uint8Array(b); }); }
  function str4(u8, o) { return String.fromCharCode(u8[o], u8[o + 1], u8[o + 2], u8[o + 3]); }
  function u16(u8, o) { return (u8[o] << 8) | u8[o + 1]; }
  function i16(u8, o) { return (u8[o] << 24 >> 16) | u8[o + 1]; }
  function u32(u8, o) { return ((u8[o] << 24) >>> 0) + (u8[o + 1] << 16) + (u8[o + 2] << 8) + u8[o + 3]; }
  function i32(u8, o) { return (u8[o] << 24) | (u8[o + 1] << 16) | (u8[o + 2] << 8) | u8[o + 3]; }
  function u64(u8, o) { return u32(u8, o) * 4294967296 + u32(u8, o + 4); }
  function i64(u8, o) { return i32(u8, o) * 4294967296 + u32(u8, o + 4); }
  function f64(u8, o) { return new DataView(u8.buffer, u8.byteOffset + o, 8).getFloat64(0, false); }
  function lesbar(t) { return /^[\x20-\x7e\xa9]{4}$/.test(t); }

  // Barnebokser i [fra, til): [{ type, fra (innhold), til, hode }]
  function barn(u8, fra, til) {
    var ut = [], o = fra;
    while (o + 8 <= til) {
      var sz = u32(u8, o), t = str4(u8, o + 4), h = 8;
      if (sz === 1) { if (o + 16 > til) break; sz = u64(u8, o + 8); h = 16; }
      else if (sz === 0) sz = til - o;
      if (sz < h || o + sz > til) break; // QuickTime-terminator eller ødelagt: stopp her
      ut.push({ type: t, fra: o + h, til: o + sz, start: o });
      o += sz;
    }
    return ut;
  }
  function finn(liste, type) { for (var i = 0; i < liste.length; i++) if (liste[i].type === type) return liste[i]; return null; }
  function finnDyp(u8, fra, til, type, dybde) {
    var l = barn(u8, fra, til);
    for (var i = 0; i < l.length; i++) {
      if (l[i].type === type) return l[i];
      if ((dybde || 0) < 3 && /^(wave|mp4a|enca|sinf|schi)$/.test(l[i].type)) {
        var inn = l[i].type === 'mp4a' ? l[i].fra + 28 : l[i].fra; // mp4a inne i wave er en lydbeskrivelse
        var r = finnDyp(u8, inn, l[i].til, type, (dybde || 0) + 1) || (l[i].type === 'mp4a' ? finnDyp(u8, l[i].fra, l[i].til, type, (dybde || 0) + 1) : null);
        if (r) return r;
      }
    }
    return null;
  }

  // ---------- Toppnivå: finn ftyp og moov ----------
  function kjennIgjen(h) {
    if (h.length >= 4 && h[0] === 0x06 && h[1] === 0x0e && h[2] === 0x2b && h[3] === 0x34) return 'MXF';
    if (h.length >= 4 && h[0] === 0x1a && h[1] === 0x45 && h[2] === 0xdf && h[3] === 0xa3) return 'Matroska/WebM';
    if (h.length >= 12 && str4(h, 0) === 'RIFF') return str4(h, 8) === 'WAVE' ? 'WAV' : str4(h, 8) === 'AVI ' ? 'AVI' : 'RIFF';
    if (h.length >= 4 && (str4(h, 0) === 'FORM')) return 'AIFF';
    if (h.length >= 3 && h[0] === 0x49 && h[1] === 0x44 && h[2] === 0x33) return 'MP3';
    if (h.length >= 1 && h[0] === 0x47) return 'MPEG-TS';
    return null;
  }

  function finnMoov(fil) {
    var n = fil.size, pos = 0, ftyp = null, sett = [], forste = true, mdat = false;
    function steg() {
      if (pos + 8 > n) return Promise.reject(feil(mdat ? 'ingen-moov' : 'ikke-mov', { sett: sett }));
      return les(fil, pos, Math.min(n, pos + 16)).then(function (h) {
        var sz = u32(h, 0), t = str4(h, 4), hd = 8;
        if (!lesbar(t)) {
          var annet = forste ? kjennIgjen(h) : null;
          return Promise.reject(feil(forste ? 'ikke-mov' : 'odelagt', { format: annet, pos: pos }));
        }
        if (sz === 1) { sz = u64(h, 8); hd = 16; } else if (sz === 0) sz = n - pos;
        if (sz < hd) return Promise.reject(feil('odelagt', { pos: pos }));
        forste = false; sett.push(t);
        if (t === 'mdat') mdat = true;
        if (t === 'ftyp') {
          return les(fil, pos + hd, Math.min(pos + sz, pos + hd + 256)).then(function (b) {
            ftyp = { merke: str4(b, 0), kompatible: [] };
            for (var o = 8; o + 4 <= b.length; o += 4) ftyp.kompatible.push(str4(b, o));
            pos += sz; return steg();
          });
        }
        if (t === 'moov') {
          if (sz > MAKS_MOOV) return Promise.reject(feil('stor-moov', { storrelse: sz }));
          if (pos + sz > n) return Promise.reject(feil('avkortet'));
          return les(fil, pos, pos + sz).then(function (b) { return { moov: b, hode: hd, ftyp: ftyp, pos: pos }; });
        }
        if (pos + sz > n && t !== 'mdat') return Promise.reject(feil('avkortet'));
        pos += sz;
        return steg();
      });
    }
    return steg();
  }

  // ---------- Lydbeskrivelse (stsd) ----------
  var PCM_NAVN = { sowt: 'PCM', twos: 'PCM', lpcm: 'PCM', in24: 'PCM', in32: 'PCM', fl32: 'PCM float', fl64: 'PCM float', 'raw ': 'PCM', NONE: 'PCM', ipcm: 'PCM', fpcm: 'PCM float', ulaw: 'μ-law', alaw: 'A-law' };

  function lesEsds(u8, b) {
    // ES_Descriptor (3) → DecoderConfigDescriptor (4) → DecoderSpecificInfo (5)
    var o = b.fra + 4, slutt = b.til, oti = null, asc = null;
    function len() { var l = 0, i = 0, x; do { x = u8[o++]; l = (l << 7) | (x & 0x7f); i++; } while ((x & 0x80) && i < 4); return l; }
    while (o < slutt) {
      var tag = u8[o++], l = len(), s = o;
      if (tag === 3) { var fl = u8[o + 2]; o += 3; if (fl & 0x80) o += 2; if (fl & 0x40) o += 1 + u8[o]; if (fl & 0x20) o += 2; continue; }
      if (tag === 4) { oti = u8[o]; o += 13; continue; }
      if (tag === 5) { asc = u8.slice(o, o + l); break; }
      o = s + l;
    }
    return { oti: oti, asc: asc };
  }
  function lesAsc(asc) {
    // AudioSpecificConfig: objekttype, samplerateindeks, kanaloppsett
    var bit = 0;
    function b(n) { var v = 0; for (var i = 0; i < n; i++) { v = (v << 1) | ((asc[bit >> 3] >> (7 - (bit & 7))) & 1); bit++; } return v; }
    var RATER = [96000, 88200, 64000, 48000, 44100, 32000, 24000, 22050, 16000, 12000, 11025, 8000, 7350];
    var aot = b(5); if (aot === 31) aot = 32 + b(6);
    var fi = b(4), rate = fi === 15 ? b(24) : RATER[fi];
    var kan = b(4), sbr = false, utRate = rate;
    if (aot === 5 || aot === 29) { sbr = true; var fi2 = b(4); utRate = fi2 === 15 ? b(24) : RATER[fi2]; }
    return { aot: aot, rate: rate, utRate: utRate, kanaler: kan, sbr: sbr };
  }

  // Kanalmaske fra QuickTime 'chan' (AudioChannelLayout), som ffmpeg 6.1 (mov_chan.c): hele taggen (oppsett << 16 |
  // antall kanaler) slås opp i tabellen under. Ukjente tagger gir 0, og da brukes standardoppsettet for kanaltallet.
  // ffmpeg gir bare masken og stokker ikke om kanalene, så det gjør ikke vi heller.
  var KANALTAGG = {
    6553601: 0x4, 6619138: 0x3, 6684674: 0x3, 6750210: 0x60000000, 6815746: 0x3, 6881282: 0x3, 6946818: 0x3, 7077892: 0x33,
    7143429: 0x37, 7208966: 0x137, 7274504: 0x737, 7340040: 0x2d033, 7405571: 0x7, 7471107: 0x7, 7536644: 0x107, 7602180: 0x107,
    7667717: 0x607, 7733253: 0x607, 7798789: 0x607, 7864325: 0x607, 7929862: 0x60f, 7995398: 0x60f, 8060934: 0x60f, 8126470: 0x60f,
    8192007: 0x70f, 8257544: 0x6cf, 8323080: 0x6cf, 8388616: 0x63f, 8454152: 0x6cf, 8519688: 0x6000060f, 8585219: 0x103, 8650756: 0x603,
    8716291: 0xb, 8781828: 0x10b, 8847365: 0x60b, 8912900: 0xf, 8978437: 0x10f, 9043973: 0x60b, 9109510: 0x707, 9175047: 0x637,
    9240582: 0x707, 9306119: 0x70f, 9371655: 0x637, 9437192: 0x737, 9699335: 0x6c7, 9764866: 0xc, 9830403: 0x7, 9895940: 0x107,
    9961476: 0xf, 10027012: 0x10b, 10092549: 0x10f, 10158086: 0x707, 10223623: 0x637, 10289159: 0x70f, 10354695: 0xe0f, 10420231: 0x260f,
    10485768: 0x63f, 10551304: 0x6cf, 10616840: 25769805327, 10682376: 6442452495, 10747912: 0x560f, 10813448: 0xf0f, 10878984: 0x270f, 10944520: 0x2e0f,
    11010052: 0xf, 11075589: 0x10f, 11141126: 0x6c3, 11206662: 0x837, 11272198: 0x137, 11337735: 0x6cb, 11403271: 0x83f, 11468807: 0x13f,
    11534343: 0x6c7, 11599880: 0x6cf, 11665416: 0x6f3, 11730952: 0x7c7, 11796489: 0x6fb, 11862025: 0x7cf, 11927559: 0x70f
  };
  function lesChan(u8, b) {
    if (!b || b.til - b.fra < 16) return 0;
    var o = b.fra + 4, tagg = u32(u8, o), bitmap = u32(u8, o + 4), n = u32(u8, o + 8);
    if (tagg === 0x10000) return bitmap < 0x40000 ? bitmap : 0;
    if (tagg === 0) {
      // Etiketter: 1–18 er de samme bitene som i WAV-masken, 35–39 er brede, LFE2 og stereo-nedmiks
      if (b.til - o < 12 + n * 20) return 0;
      var m = 0, EKSTRA = { 35: 2147483648, 36: 4294967296, 37: 34359738368, 38: 0x20000000, 39: 0x40000000 };
      for (var i = 0; i < n; i++) {
        var et = u32(u8, o + 12 + i * 20), bit = et >= 1 && et <= 18 ? Math.pow(2, et - 1) : EKSTRA[et] || 0;
        if (!bit) return 0;
        if (Math.floor(m / bit) % 2 === 0) m += bit;
      }
      return m;
    }
    return KANALTAGG[tagg] || 0;
  }

  function lydBeskrivelse(u8, e, qt, stsdVersjon) {
    // e: sample entry-boks. Felles: 6 reservert + 2 dataref. Så versjon/revisjon/leverandør (QuickTime) eller reservert (ISO).
    var o = e.fra, ver = u16(u8, o + 8);
    var r = { fourcc: e.type, versjon: ver, kanaler: u16(u8, o + 16), bits: u16(u8, o + 18), rate: u32(u8, o + 24) / 65536 };
    var ekstra = o + 28;
    var qtFelt = qt || (stsdVersjon === 0 && ver > 0);
    if (qtFelt && ver === 1) {
      r.samplesPerPacket = u32(u8, o + 28); r.bytesPerPacket = u32(u8, o + 32); r.bytesPerFrame = u32(u8, o + 36); r.bytesPerSample = u32(u8, o + 40);
      ekstra = o + 44;
    } else if (qtFelt && ver === 2) {
      r.rate = f64(u8, o + 32); r.kanaler = u32(u8, o + 40); r.bits = u32(u8, o + 48);
      r.flagg = u32(u8, o + 52); r.bytesPerFrame = u32(u8, o + 56); r.samplesPerPacket = u32(u8, o + 60);
      ekstra = o + 64;
    }
    var bokser = barn(u8, ekstra, e.til);
    r.boks = function (t) { return finn(bokser, t) || finnDyp(u8, ekstra, e.til, t); };
    var enda = r.boks('enda');
    r.le = enda ? u16(u8, enda.fra) !== 0 : null;
    r.chan = lesChan(u8, r.boks('chan'));
    var srat = r.boks('srat');
    if (srat && srat.til - srat.fra >= 8 && u32(u8, srat.fra + 4) > 0) r.rate = u32(u8, srat.fra + 4);
    return r;
  }

  // Avgjør hvordan sporet skal dekodes: { type: 'pcm', fmt } | { type: 'wc', konfig } | { type: 'nei', kode }
  function kodek(u8, d) {
    var f = d.fourcc, ch = d.kanaler, bits = d.bits, rate = d.rate;
    var pcm = null;
    if (f === 'sowt' || f === 'twos' || f === 'NONE' || f === 'raw ') {
      var le = f === 'sowt';
      if (f === 'raw ') pcm = bits === 16 ? { enc: 's', bytes: 2, le: false } : { enc: 'u', bytes: 1 };
      else if (bits === 8) pcm = { enc: 's', bytes: 1 };
      else if (bits === 24) pcm = { enc: 's', bytes: 3, le: le };
      else if (bits === 32) pcm = { enc: 's', bytes: 4, le: le };
      else pcm = { enc: 's', bytes: 2, le: le };
    } else if (f === 'in24' || f === 'in32' || f === 'fl32' || f === 'fl64') {
      var lE = d.le === true;
      pcm = f === 'in24' ? { enc: 's', bytes: 3, le: lE } : f === 'in32' ? { enc: 's', bytes: 4, le: lE } : f === 'fl32' ? { enc: 'f', bytes: 4, le: lE } : { enc: 'f', bytes: 8, le: lE };
    } else if (f === 'lpcm') {
      var fl = d.flagg || 0;
      if (fl & 32) return { type: 'nei', kode: 'ikke-flettet' };
      var sb = ch && d.bytesPerFrame ? d.bytesPerFrame / ch : Math.ceil(bits / 8);
      if (fl & 1) pcm = { enc: 'f', bytes: sb };
      else pcm = { enc: (fl & 4) || bits > 8 ? 's' : 'u', bytes: sb, hoy: !!(fl & 16) };
      pcm.le = !(fl & 2);
    } else if (f === 'ipcm' || f === 'fpcm') {
      var pc = d.boks('pcmC');
      if (!pc) return { type: 'nei', kode: 'kodek', fourcc: f };
      var flg = u8[pc.fra + 4], ss = u8[pc.fra + 5];
      bits = ss;
      pcm = { enc: f === 'fpcm' ? 'f' : 's', bytes: ss / 8, le: !!(flg & 1) };
    } else if (f === 'ulaw' || f === 'alaw') {
      pcm = { enc: f, bytes: 1 }; bits = 8;
    }
    if (pcm) {
      if (!ch) return { type: 'nei', kode: 'odelagt' };
      pcm.kanaler = ch;
      pcm.bits = pcm.enc === 'f' ? pcm.bytes * 8 : (f === 'lpcm' || f === 'ipcm') ? bits : pcm.bytes * 8;
      if (pcm.enc === 'ulaw' || pcm.enc === 'alaw') pcm.bits = 16;
      pcm.bpf = pcm.bytes * ch;
      if ([1, 2, 3, 4, 8].indexOf(pcm.bytes) < 0 || (pcm.enc === 'f' && pcm.bytes !== 4 && pcm.bytes !== 8) || (pcm.enc === 's' && pcm.bytes === 8)) return { type: 'nei', kode: 'kodek', fourcc: f };
      return { type: 'pcm', fmt: pcm, navn: PCM_NAVN[f] || 'PCM', bits: pcm.enc === 'f' ? pcm.bytes * 8 : pcm.enc === 'ulaw' || pcm.enc === 'alaw' ? 8 : pcm.bits, flyt: pcm.enc === 'f' };
    }
    // Komprimert: dekodes med WebCodecs (AudioDecoder) der nettleseren kan
    if (f === 'mp4a') {
      var es = d.boks('esds');
      if (!es) return { type: 'nei', kode: 'kodek', fourcc: f };
      var e = lesEsds(u8, es);
      if (e.oti === 0x69 || e.oti === 0x6B) return { type: 'wc', navn: 'MP3', konfig: { codec: 'mp3', sampleRate: rate, numberOfChannels: ch } };
      if ([0x40, 0x66, 0x67, 0x68].indexOf(e.oti) < 0 || !e.asc) return { type: 'nei', kode: 'kodek', fourcc: 'mp4a/' + (e.oti == null ? '?' : '0x' + e.oti.toString(16)) };
      var a = lesAsc(e.asc);
      var aotNavn = { 1: 'AAC Main', 2: 'AAC-LC', 5: 'HE-AAC', 29: 'HE-AAC v2', 23: 'AAC-LD', 39: 'AAC-ELD' }[a.aot] || 'AAC';
      return {
        type: 'wc', navn: aotNavn, aac: true,
        konfig: { codec: 'mp4a.40.' + a.aot, sampleRate: a.sbr ? a.utRate : (a.rate || rate), numberOfChannels: a.kanaler || ch, description: e.asc }
      };
    }
    if (f === '.mp3' || f === 'ms\u0000U') return { type: 'wc', navn: 'MP3', konfig: { codec: 'mp3', sampleRate: rate, numberOfChannels: ch } };
    if (f === 'Opus') {
      var dops = d.boks('dOps');
      if (!dops) return { type: 'nei', kode: 'kodek', fourcc: f };
      var p = dops.fra, nch = u8[p + 1], fam = u8[p + 10];
      // OpusHead med pre-skip 0: Chrome hopper ellers over pre-skip selv, og vi hopper som ffmpeg (edit-lista)
      var hode = [0x4f, 0x70, 0x75, 0x73, 0x48, 0x65, 0x61, 0x64, 1, nch, 0, 0, u8[p + 7], u8[p + 6], u8[p + 5], u8[p + 4], u8[p + 9], u8[p + 8], fam];
      if (fam !== 0) for (var i = 11; i < 13 + nch && p + i < dops.til; i++) hode.push(u8[p + i]);
      return { type: 'wc', navn: 'Opus', preskip: u16(u8, p + 2), konfig: { codec: 'opus', sampleRate: 48000, numberOfChannels: nch, description: new Uint8Array(hode) } };
    }
    if (f === 'fLaC') {
      var dfla = d.boks('dfLa');
      if (!dfla) return { type: 'nei', kode: 'kodek', fourcc: f };
      var bes = new Uint8Array(4 + dfla.til - dfla.fra - 4);
      bes.set([0x66, 0x4c, 0x61, 0x43]); bes.set(u8.subarray(dfla.fra + 4, dfla.til), 4);
      return { type: 'wc', navn: 'FLAC', konfig: { codec: 'flac', sampleRate: rate, numberOfChannels: ch, description: bes } };
    }
    return { type: 'nei', kode: 'kodek', fourcc: f };
  }

  // ---------- Sporene ----------
  function lesSpor(u8, trak, qt, filmSkala) {
    var l = barn(u8, trak.fra, trak.til), t = { id: 0, aktiv: true, edits: null };
    var tkhd = finn(l, 'tkhd');
    if (tkhd) { var tv = u8[tkhd.fra]; t.aktiv = (u8[tkhd.fra + 3] & 1) === 1; t.id = u32(u8, tkhd.fra + (tv === 1 ? 20 : 12)); }
    var edts = finn(l, 'edts'), elst = edts && finn(barn(u8, edts.fra, edts.til), 'elst');
    if (elst) {
      var ev = u8[elst.fra], en = u32(u8, elst.fra + 4), o = elst.fra + 8;
      t.edits = [];
      for (var i = 0; i < en && o + (ev === 1 ? 20 : 12) <= elst.til; i++) {
        if (ev === 1) { t.edits.push({ varighet: u64(u8, o), mediaTid: i64(u8, o + 8) }); o += 20; }
        else { t.edits.push({ varighet: u32(u8, o), mediaTid: i32(u8, o + 4) }); o += 12; }
      }
    }
    var mdia = finn(l, 'mdia');
    if (!mdia) return null;
    var ml = barn(u8, mdia.fra, mdia.til), mdhd = finn(ml, 'mdhd'), hdlr = finn(ml, 'hdlr'), minf = finn(ml, 'minf');
    t.handler = hdlr ? str4(u8, hdlr.fra + 8) : '';
    if (mdhd) {
      var mv = u8[mdhd.fra];
      if (mv === 1) { t.skala = u32(u8, mdhd.fra + 20); t.mediaVarighet = u64(u8, mdhd.fra + 24); }
      else { t.skala = u32(u8, mdhd.fra + 12); t.mediaVarighet = u32(u8, mdhd.fra + 16); }
    }
    var stbl = minf && finn(barn(u8, minf.fra, minf.til), 'stbl');
    if (!stbl) return t;
    var sl = barn(u8, stbl.fra, stbl.til);
    t.tab = { stsd: finn(sl, 'stsd'), stts: finn(sl, 'stts'), stsc: finn(sl, 'stsc'), stsz: finn(sl, 'stsz'), stz2: finn(sl, 'stz2'), stco: finn(sl, 'stco'), co64: finn(sl, 'co64') };
    t.filmSkala = filmSkala;
    return t;
  }

  // Tabellene som funksjoner, uten å pakke dem ut i store lister
  function tabeller(u8, t) {
    var T = t.tab, r = {};
    // stsc: [førsteChunk (1-basert), samplerPerChunk, beskrivelse]
    r.stsc = [];
    if (T.stsc) for (var i = 0, n = u32(u8, T.stsc.fra + 4), o = T.stsc.fra + 8; i < n && o + 12 <= T.stsc.til; i++, o += 12) r.stsc.push([u32(u8, o), u32(u8, o + 4), u32(u8, o + 8)]);
    if (T.co64) { r.antallChunk = u32(u8, T.co64.fra + 4); var c64 = T.co64.fra + 8; r.chunk = function (c) { return u64(u8, c64 + 8 * c); }; r.co64 = true; }
    else if (T.stco) { r.antallChunk = u32(u8, T.stco.fra + 4); var c32 = T.stco.fra + 8; r.chunk = function (c) { return u32(u8, c32 + 4 * c); }; }
    else { r.antallChunk = 0; r.chunk = function () { return 0; }; }
    if (T.stsz) {
      var fast = u32(u8, T.stsz.fra + 4), zs = T.stsz.fra + 12;
      r.antallSampler = u32(u8, T.stsz.fra + 8); r.fastStorrelse = fast;
      r.storrelse = fast ? function () { return fast; } : function (s) { return u32(u8, zs + 4 * s); };
    } else if (T.stz2) {
      var fb = u8[T.stz2.fra + 7], z2 = T.stz2.fra + 12;
      r.antallSampler = u32(u8, T.stz2.fra + 8); r.fastStorrelse = 0;
      r.storrelse = fb === 4 ? function (s) { var x = u8[z2 + (s >> 1)]; return s & 1 ? x & 15 : x >> 4; } : fb === 8 ? function (s) { return u8[z2 + s]; } : function (s) { return u16(u8, z2 + 2 * s); };
    } else { r.antallSampler = 0; r.fastStorrelse = 0; r.storrelse = function () { return 0; }; }
    r.stts = [];
    if (T.stts) for (var j = 0, m = u32(u8, T.stts.fra + 4), p = T.stts.fra + 8; j < m && p + 8 <= T.stts.til; j++, p += 8) r.stts.push([u32(u8, p), u32(u8, p + 4)]);
    return r;
  }

  // ---------- Pakker og edit-lister, som ffmpeg 6.1 ----------
  // ffmpeg deler et PCM-spor i pakker. «Gammel» modus (stts har én oppføring med varighet 1): hver chunk deles i
  // pakker på opptil 1024 rammer, og tiden T teller rammer. Ellers er hver sample en pakke med tid fra stts.
  // Pakkene samles i løp: { off, size (byte per pakke), rammer (per pakke), ts, dur (T per pakke), antall }.
  function pcmLop(spor) {
    var tb = spor.tab, bpf = spor.kodek.fmt.bpf, st = tb.stsc, lop = [], s = 0, e = 0, T = 0, c, n, off;
    function chunk(c) { while (e + 1 < st.length && st[e + 1][0] - 1 <= c) e++; return Math.min(st.length ? st[e][1] : 0, tb.antallSampler - s); }
    if (spor.gammelPcm) {
      for (c = 0; c < tb.antallChunk && s < tb.antallSampler; c++) {
        n = chunk(c); off = tb.chunk(c); s += n;
        var hele = Math.floor(n / 1024), rest = n - hele * 1024;
        if (hele) { lop.push({ off: off, size: 1024 * bpf, rammer: 1024, ts: T, dur: 1024, antall: hele }); T += hele * 1024; off += hele * 1024 * bpf; }
        if (rest) { lop.push({ off: off, size: rest * bpf, rammer: rest, ts: T, dur: rest, antall: 1 }); T += rest; }
      }
      return { lop: lop, slutt: T };
    }
    // Én pakke per sample. Fast størrelse fra stsz som er mindre enn en ramme eller ikke går opp i rammer, er
    // gammel QuickTime-stil (ofte 1): da er hver sample én ramme. For stor fast størrelse rettes også, som i ffmpeg.
    var fast = tb.fastStorrelse, si = 0, sl = tb.stts.length ? tb.stts[0][0] : 0;
    if (fast > 0 && (fast < bpf || fast % bpf)) fast = bpf;
    function sttsNeste() { while (sl === 0 && si + 1 < tb.stts.length) { si++; sl = tb.stts[si][0]; } return tb.stts.length ? tb.stts[si][1] : 0; }
    for (c = 0; c < tb.antallChunk && s < tb.antallSampler; c++) {
      n = chunk(c); off = tb.chunk(c);
      if (fast > bpf && c + 1 < tb.antallChunk) { var neste = tb.chunk(c + 1); if (neste > off && n * fast > neste - off) fast = bpf; }
      var cur = null, j = 0;
      while (j < n) {
        var dur = sttsNeste(), size, k;
        if (fast > 0) { size = fast; k = Math.max(1, Math.min(n - j, sl > 0 ? sl : n - j)); }
        else { size = tb.storrelse(s); k = 1; }
        if (cur && cur.size === size && cur.dur === dur) cur.antall += k;
        else { cur = { off: off, size: size, rammer: Math.floor(size / bpf), ts: T, dur: dur, antall: k }; lop.push(cur); }
        off += size * k; T += dur * k; s += k; j += k; sl -= k;
      }
    }
    return { lop: lop, slutt: T };
  }

  // Minste pakkegrense som er ≥ X (pakkestartene og slutten)
  function grenseLop(lop, X, slutt) {
    if (X <= 0) return 0;
    for (var i = 0; i < lop.length; i++) {
      var l = lop[i], end = l.ts + l.antall * l.dur;
      if (X <= l.ts) return l.ts;
      if (X <= end) return l.dur > 0 ? Math.min(end, l.ts + Math.ceil((X - l.ts) / l.dur) * l.dur) : end;
    }
    return slutt;
  }
  function grenseStts(stts, X) {
    if (X <= 0) return 0;
    var T = 0;
    for (var i = 0; i < stts.length; i++) {
      var end = T + stts[i][0] * stts[i][1];
      if (X <= T) return T;
      if (X <= end) return stts[i][1] > 0 ? Math.min(end, T + Math.ceil((X - T) / stts[i][1]) * stts[i][1]) : end;
      T = end;
    }
    return T;
  }

  // Lengden av tomme edits (mediatid −1) helt først i edit-lista, i filmens tidsskala
  function tomStart(ed) {
    var s = 0;
    for (var i = 0; ed && i < ed.length && ed[i].mediaTid < 0; i++) s += ed[i].varighet;
    return s;
  }

  // Hvilke tidsrom [S, E) av mediet som spilles, i pakketid T, og { stille: sekunder } for tomme edits.
  // Som ffmpeg: første edit med innhold starter nøyaktig på mediatiden, senere edits starter på første hele pakke,
  // og alle slutter på første pakkegrense ved eller etter slutten av editen. Tomme edits først hoppes over.
  // Unntak, så WAV-fila følger tidslinja til videoen: en tom edit etter lyd blir stillhet like lang som editen,
  // og tomme edits først blir stillhet når videosporet starter med det samme hullet. Da kuttes all lyden nøyaktig
  // på edit-grensene, så hver del havner på riktig sted. Uten edit-liste: hele mediet.
  function utvalg(t, grense, slutt, tilT, videoHull) {
    var ed = t.edits;
    if (!ed || !ed.length || !t.filmSkala || !t.skala) return [[0, slutt]];
    var forste = 0, i;
    while (forste < ed.length && ed[forste].mediaTid < 0) forste++;
    var hull = tomStart(ed), startStille = hull > 0 && hull === videoHull, tidslinje = startStille;
    for (i = forste + 1; i < ed.length; i++) if (ed[i].mediaTid < 0 && ed[i].varighet > 0) tidslinje = true;
    var ut = [], forsteLyd = true;
    for (i = startStille ? 0 : forste; i < ed.length; i++) {
      var e = ed[i];
      if (e.mediaTid < 0) { if (tidslinje && e.varighet > 0) ut.push({ stille: e.varighet / t.filmSkala }); continue; }
      var mt = tilT(e.mediaTid), d = tilT(Math.round(e.varighet * t.skala / t.filmSkala));
      var S = tidslinje || forsteLyd ? mt : grense(mt), E = tidslinje ? mt + d : grense(mt + d);
      forsteLyd = false;
      S = Math.min(S, slutt); E = Math.min(E, slutt);
      if (E > S) ut.push([S, E]);
    }
    return ut;
  }

  // Går gjennom PCM-rammene i utvalget i rekkefølge: cb(off i fila, antall rammer). Stillhet gir cb(null, antall).
  function pcmGjennom(spor, cb) {
    var lop = spor.lop, bpf = spor.kodek.fmt.bpf;
    spor.utvalg.forEach(function (u) {
      if (u.stille != null) { if (u.stille > 0) cb(null, u.stille); return; }
      var S = u[0], E = u[1];
      for (var i = 0; i < lop.length; i++) {
        var l = lop[i], end = l.ts + l.antall * l.dur;
        if (end <= S || l.dur <= 0 && (l.ts < S || l.ts >= E)) continue;
        if (l.ts >= E) break;
        var a = Math.max(S, l.ts), b = Math.min(E, end);
        if (l.dur === l.rammer && l.size === l.rammer * bpf) {
          // Sammenhengende rammer: rett fram
          if (b > a) cb(l.off + (a - l.ts) * bpf, b - a);
          continue;
        }
        var j0 = l.dur > 0 ? Math.floor((a - l.ts) / l.dur) : 0, j1 = l.dur > 0 ? Math.ceil((b - l.ts) / l.dur) : l.antall;
        for (var j = j0; j < j1; j++) {
          var pts = l.ts + j * l.dur, fa = 0, fb = l.rammer;
          if (l.dur > 0) {
            if (pts < a) fa = Math.round((a - pts) * l.rammer / l.dur);
            if (pts + l.dur > b) fb = Math.round((b - pts) * l.rammer / l.dur);
          }
          if (fb > fa) cb(l.off + j * l.size + fa * bpf, fb - fa);
        }
      }
    });
  }

  var VIDEO = {
    apch: 'ProRes 422 HQ', apcn: 'ProRes 422', apcs: 'ProRes 422 LT', apco: 'ProRes 422 Proxy', ap4h: 'ProRes 4444', ap4x: 'ProRes 4444 XQ',
    nclc: 'NotchLC', Hap1: 'HAP', Hap5: 'HAP Alpha', HapY: 'HAP Q', HapM: 'HAP Q Alpha', HapA: 'HAP Alpha-Only', Hap7: 'HAP R',
    avc1: 'H.264', avc3: 'H.264', hvc1: 'H.265', hev1: 'H.265', AVdn: 'DNxHD', AVdh: 'DNxHR', mp4v: 'MPEG-4', jpeg: 'Motion JPEG', mjpa: 'Motion JPEG',
    av01: 'AV1', vp09: 'VP9', png: 'PNG', 'png ': 'PNG', rle: 'Animation', 'rle ': 'Animation', DXDI: 'DXV', DXD3: 'DXV', 'v210': 'Uncompressed 10-bit', '2vuy': 'Uncompressed 8-bit'
  };

  // ---------- Analyse av hele fila ----------
  function analyser(fil) {
    return finnMoov(fil).then(function (m) {
      var u8 = m.moov, rot = barn(u8, m.hode, u8.length);
      var qt = !m.ftyp || m.ftyp.merke === 'qt  ' || m.ftyp.kompatible.indexOf('qt  ') >= 0;
      var mvhd = finn(rot, 'mvhd'), filmSkala = 0, filmVarighet = 0;
      if (mvhd) {
        if (u8[mvhd.fra] === 1) { filmSkala = u32(u8, mvhd.fra + 20); filmVarighet = u64(u8, mvhd.fra + 24); }
        else { filmSkala = u32(u8, mvhd.fra + 12); filmVarighet = u32(u8, mvhd.fra + 16); }
      }
      var fragmentert = !!finn(rot, 'mvex');
      var res = { qt: qt, merke: m.ftyp ? m.ftyp.merke : 'qt  ', moovForst: null, varighet: filmSkala ? filmVarighet / filmSkala : 0, lyd: [], video: null, fragmentert: fragmentert, _u8: u8 };
      res.moovPos = m.pos;
      // Hullet først i videosporet (tomme edits), så lyden kan få samme hull
      var videoHull = 0;
      rot.filter(function (b) { return b.type === 'trak'; }).some(function (trak) {
        var t = lesSpor(u8, trak, qt, filmSkala);
        if (t && t.tab && t.tab.stsd && t.handler === 'vide') { videoHull = tomStart(t.edits); return true; }
      });
      rot.filter(function (b) { return b.type === 'trak'; }).forEach(function (trak) {
        var t = lesSpor(u8, trak, qt, filmSkala);
        if (!t || !t.tab || !t.tab.stsd) return;
        var stsd = t.tab.stsd, stsdVer = u8[stsd.fra], antallBesk = u32(u8, stsd.fra + 4);
        var besk = barn(u8, stsd.fra + 8, stsd.til);
        if (t.handler === 'vide' && !res.video) {
          var tb = tabeller(u8, t), e0 = besk[0];
          var frames = tb.antallSampler, dur = t.skala ? t.mediaVarighet / t.skala : 0;
          // Lengde på tidslinja etter edit-lista (også tomme edits), ellers mediets lengde
          var ed = t.edits || [], medInnhold = ed.filter(function (x) { return x.mediaTid >= 0; });
          var vis = medInnhold.length && filmSkala && medInnhold.every(function (x) { return x.varighet > 0; }) ? ed.reduce(function (s, x) { return s + x.varighet; }, 0) / filmSkala : dur;
          res.video = {
            fourcc: e0 ? e0.type : '', navn: e0 ? (VIDEO[e0.type] || e0.type) : '',
            bredde: e0 ? u16(u8, e0.fra + 24) : 0, hoyde: e0 ? u16(u8, e0.fra + 26) : 0,
            varighet: vis, bilder: frames, bildeVarighet: frames ? dur / frames : 0, fps: dur ? frames / dur : 0
          };
          return;
        }
        if (t.handler !== 'soun') return;
        var spor = { indeks: res.lyd.length, id: t.id, aktiv: t.aktiv, spor: t };
        if (!besk.length) { spor.stotte = { kode: 'odelagt' }; res.lyd.push(spor); return; }
        var d = lydBeskrivelse(u8, besk[0], qt, stsdVer);
        // Samplerate 0 (f.eks. over 65535 Hz i en 16.16-verdi): bruk tidsskalaen til mediet, som ffmpeg.
        // Er tidsskalaen det samme tallet med de høye bitene kuttet bort, er det også tidsskalaen som gjelder.
        if ((!d.rate || (t.skala > 65535 && t.skala % 65536 === Math.round(d.rate))) && t.skala > 1) d.rate = t.skala;
        spor.fourcc = d.fourcc; spor.rate = d.rate; spor.kanaler = d.kanaler;
        var k = kodek(u8, d);
        spor.kodek = k;
        spor.navn = k.navn || d.fourcc;
        // Flere ulike beskrivelser i samme spor støttes ikke
        if (antallBesk > 1) {
          for (var bi = 1; bi < besk.length; bi++) {
            var d2 = lydBeskrivelse(u8, besk[bi], qt, stsdVer);
            if (d2.fourcc !== d.fourcc || d2.kanaler !== d.kanaler || d2.rate !== d.rate || d2.bits !== d.bits) { spor.stotte = { kode: 'flere-formater' }; break; }
          }
        }
        if (k.type === 'pcm') {
          spor.bits = k.bits; spor.flyt = k.flyt;
          spor.maske = d.chan && HaptLyd.antallBiter(d.chan) === d.kanaler ? d.chan : HaptLyd.standardMaske(d.kanaler);
        } else if (k.type === 'wc') {
          spor.kanaler = k.konfig.numberOfChannels || d.kanaler;
          spor.rate = k.konfig.sampleRate || d.rate;
          spor.maske = d.chan && HaptLyd.antallBiter(d.chan) === spor.kanaler ? d.chan : HaptLyd.standardMaske(spor.kanaler);
        } else if (!spor.stotte) spor.stotte = { kode: k.kode, fourcc: k.fourcc || d.fourcc };
        var tb2 = tabeller(u8, t);
        spor.tab = tb2;
        if (!tb2.antallSampler || !tb2.antallChunk) {
          if (!spor.stotte) spor.stotte = { kode: fragmentert ? 'fragmentert' : 'tomt-spor' };
        }
        if (!spor.stotte && !(spor.rate > 0)) spor.stotte = { kode: 'ingen-rate' };
        // ffmpeg 6.1 skriver 24-bits PCM i MP4 med pcmC = 32 bit, men stsz = 3 byte per kanal. stsz stemmer med dataene.
        if (k.type === 'pcm' && (d.fourcc === 'ipcm' || d.fourcc === 'fpcm') && tb2.fastStorrelse > 0 && tb2.fastStorrelse !== k.fmt.bpf && tb2.fastStorrelse % d.kanaler === 0) {
          var nb = tb2.fastStorrelse / d.kanaler;
          if (k.fmt.enc === 's' ? nb >= 1 && nb <= 4 : nb === 4 || nb === 8) { k.fmt.bytes = nb; k.fmt.bits = nb * 8; k.fmt.bpf = tb2.fastStorrelse; k.bits = nb * 8; spor.bits = k.bits; }
        }
        // Lengde i rammer etter edit-lista
        if (k.type === 'pcm' && !spor.stotte) {
          spor.gammelPcm = tb2.stts.length === 1 && tb2.stts[0][1] === 1;
          var pl = pcmLop(spor), rate = d.rate;
          spor.lop = pl.lop;
          // I gammel modus teller T rammer; edit-tidene står i mediets tidsskala
          var omr = spor.gammelPcm && t.skala && t.skala !== rate ? rate / t.skala : 1;
          spor.utvalg = utvalg(t, function (X) { return grenseLop(pl.lop, X, pl.slutt); }, pl.slutt, function (x) { return Math.round(x * omr); }, videoHull)
            .map(function (u) { return u.stille != null ? { stille: Math.round(u.stille * rate) } : u; });
          var tot = 0;
          pcmGjennom(spor, function (o, n) { tot += n; });
          spor.rammer = tot;
          spor.varighet = tot / rate;
        } else if (k.type === 'wc' && !spor.stotte) {
          // Komprimert: tidsrommene regnes i sekunder og velges ut av det dekodede signalet
          var sum = 0;
          for (var x = 0; x < tb2.stts.length; x++) sum += tb2.stts[x][0] * tb2.stts[x][1];
          var ms = t.skala || spor.rate, sek = [];
          var ut2 = utvalg(t, function (X) { return grenseStts(tb2.stts, X); }, sum, function (v) { return v; }, videoHull);
          if (!t.edits || !t.edits.length) ut2 = [[k.preskip ? Math.round(k.preskip * ms / 48000) : 0, sum]]; // Opus uten edit-liste: hopp over pre-skip
          // Med stillhet følger lyden tidslinja, så slutten kuttes nøyaktig også her
          var forrige = -1, varighet = 0, harStille = ut2.some(function (x) { return x.stille != null; });
          for (var u = 0; u < ut2.length; u++) {
            if (ut2[u].stille != null) { sek.push(ut2[u]); varighet += ut2[u].stille; continue; }
            if (ut2[u][0] < forrige) { spor.stotte = { kode: 'edits' }; break; }
            forrige = ut2[u][1];
            varighet += (ut2[u][1] - ut2[u][0]) / ms;
            // Det dekoderen gir etter siste pakke tas med, som i ffmpeg (ikke når lyden følger tidslinja)
            sek.push([ut2[u][0] / ms, ut2[u][1] >= sum && !harStille ? Infinity : ut2[u][1] / ms]);
          }
          spor.utvalg = sek;
          spor.varighet = varighet;
        }
        res.lyd.push(spor);
      });
      return res;
    });
  }

  // ---------- Lesing av lyddata ----------
  // Lager en liste over biter som skal leses: { off, len, rammer (PCM) | pakker (komprimert) }
  function biter(spor, maksBit) {
    var tb = spor.tab, ut = [], s = 0, e = 0, st = tb.stsc;
    if (spor.kodek.type === 'pcm') {
      var bpf = spor.kodek.fmt.bpf, maksR = Math.max(1, Math.floor(maksBit / bpf));
      pcmGjennom(spor, function (off, n) {
        if (off === null) { ut.push({ stille: true, off: -1, len: 0, rammer: n }); return; }
        for (var r = 0; r < n; r += maksR) {
          var k = Math.min(maksR, n - r);
          ut.push({ off: off + r * bpf, len: k * bpf, rammer: k });
        }
      });
    } else {
      // Komprimert: én bit per pakke, med tidsstempel i mediets tidsskala
      var dts = 0, ti = 0, tl = tb.stts.length ? tb.stts[0][0] : 0;
      for (var c2 = 0; c2 < tb.antallChunk && s < tb.antallSampler; c2++) {
        while (e + 1 < st.length && st[e + 1][0] - 1 <= c2) e++;
        var n2 = st.length ? st[e][1] : 0, o2 = tb.chunk(c2);
        for (var j = 0; j < n2 && s < tb.antallSampler; j++, s++) {
          var sz = tb.storrelse(s);
          while (tl === 0 && ti + 1 < tb.stts.length) { ti++; tl = tb.stts[ti][0]; }
          var dur = tb.stts.length ? tb.stts[ti][1] : 0;
          ut.push({ off: o2, len: sz, dts: dts, dur: dur });
          o2 += sz; dts += dur; tl--;
        }
      }
    }
    return ut;
  }

  // Leser bitene i rekkefølge, slått sammen til blokker på opptil maksBlokk når de ligger tett,
  // med noen få lesinger i gang samtidig. Kaller vedBit(bit, u8, fra) for hver bit; vedBit kan returnere et løfte.
  function lesBiter(fil, liste, valg) {
    valg = valg || {};
    var maksBlokk = valg.maksBlokk || 8 * 1024 * 1024, glipe = valg.glipe || 262144, samtidig = valg.samtidig || 12;
    var blokker = [], cur = null;
    for (var i = 0; i < liste.length; i++) {
      var b = liste[i];
      // Stillhet leses ikke fra fila
      if (b.stille) { blokker.push({ stille: true, biter: [b] }); cur = null; continue; }
      if (cur && b.off >= cur.slutt && b.off - cur.slutt <= glipe && b.off + b.len - cur.start <= maksBlokk) { cur.biter.push(b); cur.slutt = b.off + b.len; }
      else { cur = { start: b.off, slutt: b.off + b.len, biter: [b] }; blokker.push(cur); }
    }
    var neste = 0, igang = [];
    function fyll() { while (igang.length < samtidig && neste < blokker.length) { var bl = blokker[neste++]; igang.push({ bl: bl, p: bl.stille ? Promise.resolve(null) : les(fil, bl.start, bl.slutt) }); } }
    return (async function () {
      fyll();
      while (igang.length) {
        if (valg.stopp && valg.stopp()) return { ferdig: false, blokker: blokker.length };
        var x = igang.shift(), tv = Date.now(), u8 = await x.p;
        if (valg.tid) valg.tid.venting += Date.now() - tv;
        fyll();
        if (!x.bl.stille && u8.length < x.bl.slutt - x.bl.start) throw feil('avkortet');
        for (var j = 0; j < x.bl.biter.length; j++) {
          var bit = x.bl.biter[j], r = valg.vedBit(bit, u8, x.bl.stille ? 0 : bit.off - x.bl.start);
          if (r && r.then) await r;
        }
      }
      return { ferdig: true, blokker: blokker.length };
    })();
  }

  g.HaptMp4 = { analyser: analyser, biter: biter, lesBiter: lesBiter, feil: feil, VIDEO: VIDEO };
})(typeof self !== 'undefined' ? self : this);
