// Arbeideren for «Lyd fra video». Leser bare lydbitene i fila, dekoder, omsampler ved behov, måler og sender
// ferdige WAV-deler (4 MB) til siden etter hvert, så minnebruken holder seg lav også for lange filer.
importScripts('lydkjerne.js', 'mp4.js');

var DEL = 4 * 1024 * 1024;      // bytes per del som sendes til siden
var TRINN = 32768;              // rammer per behandlingsrunde

self.onmessage = function (e) {
  var m = e.data;
  if (m.type !== 'trekk') return;
  trekk(m).catch(function (err) {
    var kode = err && err.kode;
    if (!kode && err && err.name === 'NotReadableError') kode = 'lesefeil';
    if (!kode && err && err.name === 'NotFoundError') kode = 'lesefeil';
    self.postMessage({ type: 'feil', id: m.id, kode: kode || 'ukjent', data: (err && err.data) || {}, melding: String((err && err.message) || err) });
  });
};

// Rør: inngang (flyttall per kanal) → omsampling → kvantisering/pakking → måling → deler til siden
function Ror(id, K, innRate, utRate, bits, kildeBits, maske) {
  this.id = id; this.K = K; this.innRate = innRate; this.utRate = utRate; this.bits = bits; this.maske = maske;
  this.oms = innRate !== utRate ? new HaptLyd.Omsampler(innRate, utRate, K) : null;
  this.pk = new HaptLyd.Pakker(K, bits, this.oms ? 'omsamplet' : 'kopi', kildeBits);
  this.ml = new HaptLyd.Maaler(utRate, K, maske);
  this.rammer = 0;
  this.st = []; for (var k = 0; k < K; k++) this.st.push(new Float64Array(TRINN));
  this.iSt = 0;
  this.del = new Uint8Array(DEL); this.iDel = 0; this.antallDeler = 0;
  this.tid = { pakk: 0, maal: 0, oms: 0 };
}
// Ledig plass i mellomlageret; dekoderen skriver rett inn i this.st fra this.iSt
Ror.prototype.plass = function () { return TRINN - this.iSt; };
Ror.prototype.fylt = function (n) { this.iSt += n; if (this.iSt === TRINN) this.kjor(); };
Ror.prototype.inn = function (kan, fra, n) {
  while (n > 0) {
    var d = Math.min(n, this.plass());
    for (var k = 0; k < this.K; k++) {
      var x = kan[k], s = this.st[k];
      if (x.subarray && x instanceof Float64Array) s.set(x.subarray(fra, fra + d), this.iSt);
      else for (var i = 0; i < d; i++) s[this.iSt + i] = x[fra + i];
    }
    fra += d; n -= d;
    this.fylt(d);
  }
};
Ror.prototype.kjor = function () {
  var n = this.iSt;
  if (!n) return;
  this.iSt = 0;
  if (this.oms) {
    var t = performance.now();
    this.oms.leggTil(this.st, 0, n);
    var o = this.oms.lag();
    this.tid.oms += performance.now() - t;
    this.skriv(o, o[0].length);
  } else this.skriv(this.st, n);
};
Ror.prototype.skriv = function (kan, n) {
  if (!n) return;
  var t = performance.now();
  var b = this.pk.pakk(kan, n);
  var t2 = performance.now();
  this.ml.legg(kan, n);
  var t3 = performance.now();
  this.tid.pakk += t2 - t; this.tid.maal += t3 - t2;
  this.rammer += n;
  var o = 0;
  while (o < b.length) {
    var d = Math.min(b.length - o, DEL - this.iDel);
    this.del.set(b.subarray(o, o + d), this.iDel);
    this.iDel += d; o += d;
    if (this.iDel === DEL) this.send();
  }
};
Ror.prototype.send = function () {
  if (!this.iDel) return;
  var buf = this.iDel === DEL ? this.del.buffer : this.del.slice(0, this.iDel).buffer;
  self.postMessage({ type: 'del', id: this.id, data: buf }, [buf]);
  this.antallDeler++;
  this.del = new Uint8Array(DEL); this.iDel = 0;
};
Ror.prototype.slutt = function () {
  this.kjor();
  if (this.oms) { var o = this.oms.tom(); this.skriv(o, o[0].length); }
  this.send();
  var r = this.ml.resultat();
  r.rammer = this.rammer; r.klippet = this.pk.klippet; r.rate = this.utRate; r.bits = this.bits; r.kanaler = this.K; r.maske = this.maske;
  r.omsamplet = !!this.oms; r.innRate = this.innRate; r.trinn = this.tid;
  return r;
};

function fremdriftsmaler(id, totalt) {
  var lest = 0, sist = 0;
  return function (n) {
    lest += n;
    var na = Date.now();
    if (na - sist > 120 || lest >= totalt) { sist = na; self.postMessage({ type: 'fremdrift', id: id, lest: lest, totalt: totalt }); }
  };
}

async function trekk(m) {
  var t0 = Date.now();
  var info = await HaptMp4.analyser(m.fil), tid = { analyse: Date.now() - t0, venting: 0 };
  var spor = info.lyd[m.spor];
  if (!spor) throw HaptMp4.feil('ingen-lyd');
  if (spor.stotte) throw HaptMp4.feil(spor.stotte.kode, spor.stotte);
  var utRate = m.rate === 'kilde' ? Math.round(spor.rate) : 48000, bits = m.bits;
  var liste = HaptMp4.biter(spor, 4 * 1024 * 1024), totalt = 0;
  for (var i = 0; i < liste.length; i++) totalt += liste[i].len;
  var fremdrift = fremdriftsmaler(m.id, totalt);
  var r, ror;

  // Forventet størrelse: WAV kan ikke være over 4 GB
  var forventet = Math.ceil((spor.varighet || 0) * utRate) * spor.kanaler * bits / 8;
  if (forventet > 4294967295 - 200) throw HaptMp4.feil('for-stor', { gb: forventet / 1e9 });

  if (spor.kodek.type === 'pcm') {
    var fmt = spor.kodek.fmt, innRate = Math.round(spor.rate);
    ror = new Ror(m.id, spor.kanaler, innRate, utRate, bits, spor.flyt ? 32 : spor.bits, spor.maske);
    var res = await HaptMp4.lesBiter(m.fil, liste, {
      tid: tid,
      vedBit: function (bit, u8, o) {
        var igjen = bit.rammer;
        while (igjen > 0) {
          var n = Math.min(igjen, ror.plass());
          HaptLyd.dekodPcm(fmt, u8, o, n, ror.st, ror.iSt);
          o += n * fmt.bpf; igjen -= n;
          ror.fylt(n);
        }
        fremdrift(bit.len);
      }
    });
    if (!res.ferdig) return;
    r = ror.slutt();
    r.blokker = res.blokker; r.biter = liste.length;
  } else {
    r = await dekodWc(m, spor, liste, utRate, bits, fremdrift);
  }
  var h = HaptLyd.wavHode(r.kanaler, r.rate, r.bits, r.rammer, r.maske);
  r.ms = Date.now() - t0; r.tid = tid;
  r.co64 = !!spor.tab.co64; r.moovPos = info.moovPos;
  self.postMessage({ type: 'ferdig', id: m.id, hode: h.hode, pad: h.pad, storrelse: h.storrelse, resultat: r }, [h.hode]);
}

// Komprimert lyd (AAC, MP3, Opus, FLAC) via WebCodecs. Som ffmpeg hoppes encoderforsinkelsen i starten over
// (edit-lista), og alt som kommer ut av dekoderen etter det tas med.
async function dekodWc(m, spor, liste, utRate, bits, fremdrift) {
  var kfg = spor.kodek.konfig, navn = spor.navn;
  if (typeof AudioDecoder === 'undefined') throw HaptMp4.feil('webcodecs', { navn: navn });
  var st = await AudioDecoder.isConfigSupported(kfg).catch(function () { return { supported: false }; });
  if (!st.supported) throw HaptMp4.feil('webcodecs', { navn: navn });
  var skala = spor.spor.skala || spor.rate, feilen = null, ror = null, pos = 0, hopp = 0;
  var dek = new AudioDecoder({
    output: function (ad) {
      try {
        var n = ad.numberOfFrames, K = ad.numberOfChannels;
        if (!ror) {
          var maske = K === spor.kanaler ? spor.maske : HaptLyd.standardMaske(K);
          ror = new Ror(m.id, K, ad.sampleRate, m.rate === 'kilde' ? ad.sampleRate : utRate, bits, 24, maske);
          pos = Math.round(ad.timestamp * ad.sampleRate / 1e6);
          hopp = Math.round(spor.hopp * ad.sampleRate);
        }
        if (K !== ror.K) throw HaptMp4.feil('dekoder', { melding: 'channels' });
        var kan = [];
        for (var k = 0; k < K; k++) { var f = new Float32Array(n); ad.copyTo(f, { planeIndex: k, format: 'f32-planar' }); kan.push(f); }
        ad.close();
        var fra = Math.max(0, Math.min(n, hopp - pos));
        pos += n;
        if (fra < n) ror.inn(kan, fra, n - fra);
      } catch (e) { feilen = feilen || e; try { ad.close(); } catch (e2) {} }
    },
    error: function (e) { feilen = feilen || HaptMp4.feil('dekoder', { melding: String(e && e.message || e) }); }
  });
  dek.configure(kfg);
  function vent() {
    return new Promise(function (ok) {
      var ferdig = false, f = function () { if (!ferdig) { ferdig = true; ok(); } };
      try { dek.addEventListener('dequeue', f, { once: true }); } catch (e) {}
      setTimeout(f, 20);
    });
  }
  var res = await HaptMp4.lesBiter(m.fil, liste, {
    vedBit: async function (bit, u8, o) {
      if (feilen) throw feilen;
      dek.decode(new EncodedAudioChunk({ type: 'key', timestamp: Math.round(bit.dts * 1e6 / skala), duration: Math.round(bit.dur * 1e6 / skala), data: u8.subarray(o, o + bit.len) }));
      fremdrift(bit.len);
      while (dek.decodeQueueSize > 16 && !feilen) await vent();
    }
  });
  if (!res.ferdig) return null;
  await dek.flush().catch(function (e) { feilen = feilen || HaptMp4.feil('dekoder', { melding: String(e && e.message || e) }); });
  try { dek.close(); } catch (e) {}
  if (feilen) throw feilen;
  if (!ror) throw HaptMp4.feil('dekoder', { melding: 'no output' });
  var r = ror.slutt();
  r.blokker = res.blokker; r.biter = liste.length;
  return r;
}
