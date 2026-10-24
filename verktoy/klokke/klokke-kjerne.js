// hapt-o-clock i nettleseren: timerlogikken, oversatt fra appen (HOCCore: StageTimer, Show, Rundown,
// TimeText, RundownImport). Ren logikk uten skjerm, så den kan testes med node.
// En timer som går, lagrer når den startet (anker, ms på veggklokka) og hvor mye tid den hadde da.
// Gjenstående tid regnes ut når noen spør; ingen løkke teller ned, så ingenting hakker.
(function (root) {
  'use strict';

  function lagId() {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
    return 'id-' + Math.random().toString(36).slice(2) + Date.now().toString(36);
  }
  function kopi(o) { return JSON.parse(JSON.stringify(o)); }

  // Språk: norsk, eller engelsk når verktøyenes språkvalg (tema.js) står på EN. Uten HaptSprak (node) alltid norsk.
  function T(no, en) { return root.HaptSprak ? root.HaptSprak.t(no, en) : no; }
  // Tekst som blir stående på skjermen (feilmeldinger): bytter språk når den gjøres om til tekst på nytt
  function tekst(no, en) { return { no: no, en: en, toString: function () { return T(no, en); } }; }
  // Feil med begge språk: message på språket nå, tekst for å vise den på nytt etter et bytte
  function feil(no, en) { var e = new Error(T(no, en)); e.tekst = tekst(no, en); return e; }

  // ---------- Tid som tekst ----------

  // Hele sekunder som vises, rundet opp: en 5-minutters timer viser 5:00 hele første sekund,
  // 0:01 det siste, 0:00 første sekund i overtid og +0:01 etter det.
  function vistSek(igjen) { return Math.ceil(igjen - 1e-9) || 0; }

  // «4:59», «1:02:03», eller «+0:12» for negative sekunder (overtid)
  function formatSek(s) {
    var a = Math.abs(s), h = Math.floor(a / 3600), m = Math.floor(a / 60) % 60, sek = a % 60;
    var tekst = h > 0 ? h + ':' + to(m) + ':' + to(sek) : m + ':' + to(sek);
    return (s < 0 ? '+' : '') + tekst;
  }
  function format(igjen) { return formatSek(vistSek(igjen)); }
  function to(n) { return (n < 10 ? '0' : '') + n; }

  // «14:05:09»
  function klokke(dato) { return to(dato.getHours()) + ':' + to(dato.getMinutes()) + ':' + to(dato.getSeconds()); }

  // Leser «5:00», «1:30:00», «90» (sekunder) eller «2:30.5». Komma godtas som desimaltegn.
  function lesTid(tekst) {
    var deler = String(tekst || '').trim().replace(',', '.').split(':');
    if (deler.length < 1 || deler.length > 3 || deler.some(function (d) { return !/^\d+(\.\d+)?$/.test(d.trim()); })) return null;
    return deler.reduce(function (sum, d) { return sum * 60 + parseFloat(d); }, 0);
  }

  // Klokkeslett: {h, m, s}
  // Operatoren kan skrive 14.35; i filer (bareKolon) er 0.5 en del av et døgn, ikke et klokkeslett
  function lesKlokkeslett(tekst, bareKolon) {
    var t = String(tekst || '').trim();
    var d = (bareKolon ? t : t.replace(/\./g, ':')).split(':');
    if (d.length < 2 || d.length > 3 || d.some(function (x) { return !/^\d{1,2}$/.test(x); })) return null;
    var h = +d[0], m = +d[1], s = d.length === 3 ? +d[2] : 0;
    if (h > 23 || m > 59 || s > 59) return null;
    return { h: h, m: m, s: s };
  }
  function klokkeslettTekst(k) { return to(k.h) + ':' + to(k.m) + (k.s ? ':' + to(k.s) : ''); }
  // Sekunder fra nå til klokkeslettet neste gang det kommer: senere i dag, ellers i morgen
  function sekTil(k, naMs) {
    var na = new Date(naMs), mal = new Date(na.getFullYear(), na.getMonth(), na.getDate(), k.h, k.m, k.s || 0);
    if (mal.getTime() <= naMs) mal = new Date(na.getFullYear(), na.getMonth(), na.getDate() + 1, k.h, k.m, k.s || 0);
    return (mal.getTime() - naMs) / 1000;
  }
  // Klokkeslettet samme dag som tidspunktet
  function sammeDag(k, ms) { var d = new Date(ms); return new Date(d.getFullYear(), d.getMonth(), d.getDate(), k.h, k.m, k.s || 0).getTime(); }

  // ---------- Én timer ----------

  var STANDARDFARGER = { running: '#ffffff', paused: '#888888', warning: '#ffa500', danger: '#ff2828', overtime: '#ff2828', stopped: '#ffffff' };

  function nyTimer(id, navn, plassering) {
    return {
      id: id, name: navn, mode: 'countdown', duration: 300, phase: 'stopped', held: 300, anchor: null,
      warp: null, countTo: null, activePreset: null, next: null,
      endAction: 'overtime', endMessage: T('TIDEN ER UTE', 'TIME\'S UP'), warningAt: 60, dangerAt: 30, warpWarnPercent: 20,
      colors: kopi(STANDARDFARGER), placement: plassering
    };
  }

  function stopperPaNull(t) {
    if (t.endAction === 'stop' || t.endAction === 'message') return true;
    if (t.endAction === 'next') return !!t.next;
    return false;
  }

  // Tiden på klokka i sekunder: igjen for nedtelling (negativ i overtid), gått for opptelling
  function igjen(t, na) {
    if (t.phase === 'stopped' && t.countTo) return sekTil(t.countTo, na);
    if (t.phase !== 'running' || t.anchor == null) return t.held;
    var gatt = (na - t.anchor) / 1000 * (t.warp ? t.warp.factor : 1);
    if (t.mode === 'countup') return t.held + gatt;
    return stopperPaNull(t) ? Math.max(0, t.held - gatt) : t.held - gatt;
  }

  function start(t, na) {
    if (t.mode === 'clock' || t.phase === 'running') return;
    if (t.countTo) { t.duration = sekTil(t.countTo, na); t.held = t.duration; }
    else if (t.phase === 'stopped') t.held = t.mode === 'countup' ? 0 : t.duration;
    t.anchor = na; t.phase = 'running';
  }
  function pause(t, na) {
    if (t.phase !== 'running') return;
    t.held = igjen(t, na); t.anchor = null; t.phase = 'paused';
  }
  function stopp(t) {
    t.held = t.mode === 'countup' ? 0 : t.duration; t.anchor = null; t.phase = 'stopped';
  }
  function veksle(t, na) { if (t.phase === 'running') pause(t, na); else start(t, na); }

  // Legger til eller trekker fra tid. Skyver aldri fra tid igjen inn i overtid (stopper på 0:00),
  // men i overtid betyr -1m ett minutt mer overtid. På en stoppet timer endres satt tid.
  function juster(t, sek, na) {
    if (t.mode === 'clock' || (t.phase === 'stopped' && t.countTo)) return;
    if (t.mode === 'countup') {
      if (t.phase === 'stopped') return;
      t.held = Math.max(0, igjen(t, na) + sek);
      if (t.phase === 'running') t.anchor = na;
      return;
    }
    var na0 = igjen(t, na), ny = na0 + sek;
    if (na0 >= 0 && ny < 0) ny = 0;
    if (t.phase === 'stopped') { t.duration = Math.max(0, ny); t.held = t.duration; }
    else { t.held = ny; if (t.phase === 'running') t.anchor = na; }
  }

  function settTid(t, sek) {
    t.mode = 'countdown'; t.duration = Math.max(0, sek); t.countTo = null; t.activePreset = null; stopp(t);
  }
  function settModus(t, modus) {
    t.mode = modus; t.countTo = null; t.activePreset = null; t.warp = null; stopp(t);
  }
  function lastInn(t, p, indeks) {
    t.mode = p.mode; t.duration = p.duration; t.countTo = p.mode === 'countdown' ? (p.countTo || null) : null;
    t.activePreset = indeks; t.name = p.name; t.warp = null; stopp(t);
  }
  function go(t, na, indeks) {
    if (!t.next) return false;
    lastInn(t, t.next, indeks); t.next = null; start(t, na); return true;
  }
  function startTil(t, k, na) {
    t.mode = 'countdown'; t.countTo = k; t.activePreset = null; t.warp = null; t.phase = 'stopped'; start(t, na);
  }
  function erPaNull(t, na) { return t.mode === 'countdown' && t.phase === 'running' && igjen(t, na) <= 0; }
  function stoppPaNull(t) { t.held = 0; t.anchor = null; t.countTo = null; t.phase = 'stopped'; }

  // Warp: kjører fortere eller saktere så nedtellingen når 0:00 på klokkeslettet
  function warpPlan(t, k, na) {
    if (t.mode !== 'countdown') return { feil: tekst('Warp virker bare på nedtelling.', 'Warp only works on a countdown.') };
    var rest = t.phase === 'stopped' ? t.duration : igjen(t, na);
    if (rest <= 0) return { feil: tekst('Warp virker ikke i overtid.', 'Warp does not work in overtime.') };
    var til = sekTil(k, na);
    if (til <= 0) return { feil: tekst('Sluttiden er nå.', 'The end time is now.') };
    var f = rest / til;
    return { warp: { target: k, factor: f, over: Math.abs(f - 1) * 100 > t.warpWarnPercent, percent: Math.round((f - 1) * 100) } };
  }
  function nyBase(t, na) { if (t.phase === 'running') { t.held = igjen(t, na); t.anchor = na; } }
  function brukWarp(t, w, na) { nyBase(t, na); t.warp = w; }
  function fjernWarp(t, na) { nyBase(t, na); t.warp = null; }

  // Hvordan timeren ser ut akkurat nå: tekst, tone (farge), overtid og om den blinker
  function visning(t, na) {
    if (t.mode === 'clock') return { text: klokke(new Date(na)), seconds: 0, tone: 'clock', overtime: false, blinks: false };
    var v = igjen(t, na);
    if (t.mode === 'countup') {
      var gatt = Math.floor(v + 1e-9);
      return { text: formatSek(gatt), seconds: gatt, tone: t.phase === 'stopped' ? 'stopped' : t.phase === 'running' ? 'running' : 'paused', overtime: false, blinks: false };
    }
    var vist = vistSek(v), over = v < 0;
    var tone = t.phase === 'stopped' ? 'stopped' : over ? 'overtime' : vist <= t.dangerAt ? 'danger' : vist <= t.warningAt ? 'warning' : t.phase !== 'running' ? 'paused' : 'running';
    return { text: formatSek(vist), seconds: vist, tone: tone, overtime: over, blinks: over && t.phase !== 'stopped' && !stopperPaNull(t) };
  }
  function farge(t, tone) { return tone === 'clock' ? '#ffffff' : (t.colors[tone] || '#ffffff'); }

  // Overtid blinker som i appen: ned til 8 % og tilbake, hvert 0,9 s
  function blink(ms) {
    var fase = (ms / 1000 % 0.9) / 0.9, tri = fase < 0.5 ? fase * 2 : (1 - fase) * 2;
    return 1 - 0.92 * (1 - Math.cos(Math.PI * tri)) / 2;
  }

  // ---------- Presets ----------

  function nyPreset(navn, sek, modus, til) { return { id: lagId(), name: navn, duration: sek, mode: modus || 'countdown', countTo: til || null }; }
  // «5:00», «til 14:30», «▲» for opptelling, «⧗» for klokka
  function presetTekst(p) {
    if (p.mode === 'clock') return '⧗';
    if (p.mode === 'countup') return '▲';
    if (p.countTo) return T('til ', 'until ') + klokkeslettTekst(p.countTo);
    return formatSek(Math.round(p.duration));
  }

  // ---------- Showet ----------

  // Standardinnholdet (presets, banken, meldingen ved 0:00) lages på språket som er valgt når showet lages.
  // Etterpå er det showets eget innhold, som operatoren kan endre, og det byttes ikke ved språkbytte.
  function nyttShow() {
    return {
      versjon: 1,
      timers: [nyTimer(0, 'Timer 1', { x: 50, y: 100 / 3, size: 40, visible: true, background: '#000000' }),
               nyTimer(1, 'Timer 2', { x: 50, y: 200 / 3, size: 40, visible: true, background: '#000000' })],
      presets: [nyPreset(T('Innslag 5 min', 'Segment 5 min'), 300), nyPreset(T('Pause 15 min', 'Break 15 min'), 900), nyPreset('Keynote 30 min', 1800), nyPreset(T('Klokkeslett', 'Time of day'), 0, 'clock')],
      bank: [T('God morgen!', 'Good morning!'), T('Vennligst slå av mobiltelefon', 'Please switch off your mobile phone'), T('Vi starter om 5 minutter', 'We start in 5 minutes')],
      draft: '', message: '', messageVisible: false,
      output: 'clock', layout: 'stacked', dim: 1, messageLift: 0, messageScale: 100,
      logo: null, rundown: null
    };
  }

  // Et show fra fil eller lagring: det som mangler, fylles inn fra standard, så eldre filer åpnes
  function rens(s) {
    var std = nyttShow();
    if (!s || typeof s !== 'object' || !Array.isArray(s.timers) || s.timers.length !== 2) return std;
    Object.keys(std).forEach(function (k) { if (s[k] === undefined) s[k] = std[k]; });
    s.timers.forEach(function (t, i) {
      var st = std.timers[i];
      Object.keys(st).forEach(function (k) { if (t[k] === undefined) t[k] = kopi(st[k]); });
      Object.keys(STANDARDFARGER).forEach(function (k) { if (!t.colors[k]) t.colors[k] = STANDARDFARGER[k]; });
      Object.keys(st.placement).forEach(function (k) { if (t.placement[k] === undefined) t.placement[k] = st.placement[k]; });
      t.id = i;
    });
    if (!Array.isArray(s.presets)) s.presets = [];
    if (!Array.isArray(s.bank)) s.bank = [];
    return s;
  }

  function visMelding(s, tekst) {
    if (tekst != null) s.draft = tekst;
    s.message = s.draft; s.messageVisible = !!String(s.message).trim();
  }
  function skjulMelding(s) { s.messageVisible = false; }
  function veksleMelding(s) { if (s.messageVisible) skjulMelding(s); else visMelding(s); }
  function meldingPaScenen(s) { return s.messageVisible ? s.message : null; }
  function leggIBank(s) {
    var t = String(s.draft || '').trim();
    if (t && s.bank.indexOf(t) < 0) s.bank.push(t);
  }

  function lastPreset(s, i, timer) {
    if (!s.presets[i] || !s.timers[timer]) return;
    lastInn(s.timers[timer], kopi(s.presets[i]), i);
  }
  function fjernPreset(s, i) {
    if (!s.presets[i]) return;
    s.presets.splice(i, 1);
    s.timers.forEach(function (t) { if (t.activePreset === i) t.activePreset = null; else if (t.activePreset > i) t.activePreset--; });
  }
  function settNeste(s, i, timer) {
    if (!s.presets[i] || !s.timers[timer]) return;
    s.timers[timer].next = kopi(s.presets[i]);
  }

  // GO: det som står under NESTE tar over og starter. Et kjøreplanpunkt gjør klar det neste.
  function goShow(s, timer, na) {
    var t = s.timers[timer];
    if (!t || !t.next) return false;
    var id = t.next.id, idx = s.presets.findIndex(function (p) { return p.id === id; });
    if (!go(t, na, idx >= 0 ? idx : null)) return false;
    kjoreplanStartet(s, timer, id, na);
    return true;
  }

  // Nedtellinger som har nådd null, gjør det «Ved 0:00» sier. Sann hvis noe endret seg.
  function avgjor(s, na) {
    var endret = false;
    s.timers.forEach(function (t, i) {
      if (!erPaNull(t, na)) return;
      if (t.endAction === 'overtime') return;
      if (t.endAction === 'stop') stoppPaNull(t);
      else if (t.endAction === 'message') { stoppPaNull(t); visMelding(s, t.endMessage); }
      else if (t.endAction === 'next') { if (!goShow(s, i, na)) return; }
      endret = true;
    });
    return endret;
  }

  // ---------- Kjøreplan ----------

  function punktKjores(r, p) { return p.duration > 0 && p.duration >= r.shortestRun; }
  function nesteMedTid(r, etter) {
    for (var i = etter == null ? 0 : etter + 1; i < r.items.length; i++) if (punktKjores(r, r.items[i])) return i;
    return null;
  }
  function punktIndeks(r, id) { return r.items.findIndex(function (p) { return p.id === id; }); }
  function somPreset(p) { return { id: p.id, name: p.title, duration: p.duration, mode: 'countdown', countTo: null }; }

  // Sekunder bak plan (negativt: foran), fra punktet som går nå: når det slutter (tidligst nå)
  // mot når det skulle slutte. Null uten plantid å sammenligne med.
  function avvik(r, na) {
    if (r.current == null || r.currentStarted == null) return null;
    var p = r.items[r.current];
    if (!p || !p.start) return null;
    var plan = sammeDag(p.start, r.currentStarted);
    var slutt = Math.max(na, r.currentStarted + p.duration * 1000);
    return (slutt - (plan + p.duration * 1000)) / 1000;
  }
  function ferdig(r, na) {
    var a = avvik(r, na);
    if (a == null) return null;
    for (var i = r.items.length - 1; i >= 0; i--) {
      var p = r.items[i];
      if (p.duration > 0 && p.start) return sammeDag(p.start, r.currentStarted) + (p.duration + a) * 1000;
    }
    return null;
  }
  function avvikTekst(a) {
    var s = Math.round(a);
    if (s === 0) return T('i rute', 'on schedule');
    return s > 0 ? '+' + formatSek(s) + T(' bak plan', ' behind') : '−' + formatSek(-s) + T(' foran plan', ' ahead');
  }

  function forberedNeste(s, etter) {
    var r = s.rundown;
    if (!r) return;
    var i = nesteMedTid(r, etter);
    s.timers[r.timer].next = i == null ? null : somPreset(r.items[i]);
  }
  function lastKjoreplan(s, r) {
    if (s.rundown) fjernKjoreplan(s);
    r.current = null; r.currentStarted = null;
    if (r.timer == null) r.timer = 0;
    if (r.shortestRun == null) r.shortestRun = 60;
    s.rundown = r;
    forberedNeste(s, null);
  }
  function fjernKjoreplan(s) {
    var r = s.rundown;
    if (r) { var n = s.timers[r.timer].next; if (n && punktIndeks(r, n.id) >= 0) s.timers[r.timer].next = null; }
    s.rundown = null;
  }
  function settKjoreplanTimer(s, timer) {
    var r = s.rundown;
    if (!r || r.timer === timer || !s.timers[timer]) return;
    var n = s.timers[r.timer].next, ni = n ? punktIndeks(r, n.id) : -1;
    if (ni >= 0) s.timers[r.timer].next = null;
    r.timer = timer; r.current = null; r.currentStarted = null;
    if (ni >= 0) settNestePunkt(s, ni); else forberedNeste(s, null);
  }
  function settKortest(s, sek) {
    var r = s.rundown;
    if (!r) return;
    r.shortestRun = Math.max(0, sek);
    var n = s.timers[r.timer].next, ni = n ? punktIndeks(r, n.id) : -1;
    if (ni < 0 || !punktKjores(r, r.items[ni])) forberedNeste(s, r.current);
  }
  function settNestePunkt(s, i) {
    var r = s.rundown;
    if (!r || !r.items[i] || !punktKjores(r, r.items[i])) return;
    s.timers[r.timer].next = somPreset(r.items[i]);
  }
  function kjoreplanStartet(s, timer, id, na) {
    var r = s.rundown;
    if (!r || r.timer !== timer) return;
    var i = punktIndeks(r, id);
    if (i < 0) return;
    r.current = i; r.currentStarted = na;
    forberedNeste(s, i);
  }

  // ---------- Innlesing av kjøreplan (Shoflo, Rundown Studio, Excel, CSV) ----------

  var NAVN = {
    nummer: ['item#', 'item #', '#', 'nr', 'nr.', 'no', 'no.', 'cue', 'cue #', 'id'],
    start: ['start time', 'start', 'starttid', 'tid', 'time', 'klokkeslett', 'kl', 'kl.', 'planned start', 'planlagt start'],
    slutt: ['end time', 'end', 'slutt', 'sluttid', 'slutt-tid', 'stop', 'stopp'],
    varighet: ['duration', 'varighet', 'lengde', 'length', 'dur', 'minutter', 'min', 'minutes', 'varighet (min)', 'duration (min)', 'tid (min)'],
    tittel: ['item', 'title', 'tittel', 'innslag', 'segment', 'name', 'navn', 'program', 'punkt', 'post', 'description', 'beskrivelse']
  };

  function finnOverskrift(rader) {
    for (var r = 0; r < Math.min(15, rader.length); r++) {
      var kart = { annet: [] }, navn = rader[r].map(function (c) { return String(c).trim(); });
      navn.forEach(function (raw, i) {
        var n = raw.toLowerCase();
        if (!n) return;
        if (kart.nummer == null && NAVN.nummer.indexOf(n) >= 0) kart.nummer = i;
        else if (kart.start == null && NAVN.start.indexOf(n) >= 0) kart.start = i;
        else if (kart.varighet == null && (NAVN.varighet.indexOf(n) >= 0 || n.indexOf('varighet') === 0 || n.indexOf('duration') === 0)) { kart.varighet = i; kart.iMinutter = n.indexOf('min') >= 0; }
        else if (kart.tittel == null && NAVN.tittel.indexOf(n) >= 0) kart.tittel = i;
        else if (NAVN.slutt.indexOf(n) >= 0) return;
        else kart.annet.push({ navn: raw, i: i });
      });
      if (kart.tittel != null && kart.varighet != null) {
        var sm = navn.map(function (x) { return x.toLowerCase(); });
        kart.shoflo = ['item#', 'start time', 'duration', 'item'].every(function (x) { return sm.indexOf(x) >= 0; });
        return { rad: r, kart: kart };
      }
    }
    return null;
  }

  // «30m», «6m36s», «1h», «1h 30m» (Shoflo); «5:00», «1:02:03»; minutter; eller Excels del av et døgn
  function lesVarighet(tekst, iMinutter) {
    var s = String(tekst || '').toLowerCase().replace(/\s/g, '');
    if (!s) return null;
    var m = s.match(/^(?:(\d+(?:\.\d+)?)h)?(?:(\d+(?:\.\d+)?)m(?:in)?)?(?:(\d+(?:\.\d+)?)s(?:ek|ec)?)?$/);
    if (m && (m[1] || m[2] || m[3])) return (+(m[1] || 0)) * 3600 + (+(m[2] || 0)) * 60 + (+(m[3] || 0));
    if (s.indexOf(':') >= 0) return lesTid(s);
    var tall = parseFloat(s.replace(',', '.'));
    if (!/^\d+([.,]\d+)?(e-?\d+)?$/.test(s) || !(tall >= 0)) return null;
    if (iMinutter || tall >= 1) return tall * 60;
    return Math.round(tall * 86400);
  }
  // «13:06:36», «13:06», eller Excels del av et døgn
  function lesStart(tekst) {
    var s = String(tekst || '').trim();
    if (!s) return null;
    var k = lesKlokkeslett(s.slice(0, 8), true);
    if (k) return k;
    var f = parseFloat(s.replace(',', '.'));
    if (/^\d*[.,]?\d+(e-?\d+)?$/.test(s) && f >= 0 && f < 1) { var sek = Math.round(f * 86400); return { h: Math.floor(sek / 3600) % 24, m: Math.floor(sek / 60) % 60, s: sek % 60 }; }
    return null;
  }

  // Ark: [{navn, rader: [[celle]]}]
  function lagKjoreplan(ark, tittel, kilde) {
    var punkter = [], kolonner = [], shoflo = false, rs = false, navngitt = null, sisteOverskrift = [];
    ark.forEach(function (a) {
      var o = finnOverskrift(a.rader);
      if (!o) { sisteOverskrift = a.rader[0] || []; return; }
      var kart = o.kart;
      shoflo = shoflo || kart.shoflo;
      var over = {};
      a.rader.slice(0, o.rad).forEach(function (rad) { if (rad.length >= 2 && /:$/.test(String(rad[0]))) { var k = String(rad[0]).slice(0, -1).trim().toLowerCase(); if (!(k in over)) over[k] = String(rad[1]).trim(); } });
      var n = over.name || over.navn;
      if (n && !navngitt) navngitt = n;
      rs = rs || (over['export date'] != null && over.timezone != null);
      if (ark.length > 1) punkter.push({ id: lagId(), number: '', title: a.navn, subtitle: null, duration: 0, start: null, notes: {} });
      kart.annet.forEach(function (k) { if (kolonner.indexOf(k.navn) < 0) kolonner.push(k.navn); });
      a.rader.slice(o.rad + 1).forEach(function (rad) {
        function celle(i) { return i == null || rad[i] == null ? '' : String(rad[i]).trim(); }
        var linjer = celle(kart.tittel).split(/\r?\n|\r/).map(function (l) { return l.trim(); }).filter(Boolean);
        if (!linjer.length) return;
        var varighet = lesVarighet(celle(kart.varighet), kart.iMinutter) || 0;
        var st = lesStart(celle(kart.start));
        if (varighet === 0 && st && st.h === 0 && st.m === 0 && st.s === 0) st = null;   // Shoflo gir overskrifter 00:00:00
        var notater = {};
        kart.annet.forEach(function (k) {
          var t = celle(k.i).replace(/!\[[^\]]*\]\([^)]*\)/g, '').trim();
          if (t) notater[k.navn] = t;
        });
        punkter.push({ id: lagId(), number: celle(kart.nummer), title: linjer[0], subtitle: linjer.length > 1 ? linjer.slice(1).join(' · ') : null, duration: varighet, start: st, notes: notater });
      });
    });
    if (!punkter.length) {
      var sett = sisteOverskrift.filter(Boolean).join(', ');
      throw feil('Fant ikke kolonnene for tittel og varighet' + (sett ? '. Overskriftene var: ' + sett + '.' : '.'),
        'Could not find the title and duration columns' + (sett ? '. The headers were: ' + sett + '.' : '.'));
    }
    var arkNavn = ark.length === 1 && ark[0].navn && !/^(Sheet|Ark)/.test(ark[0].navn) ? ark[0].navn : null;
    var detalj = kolonner.filter(function (k) { return ['subject', 'emne', 'beskrivelse', 'description', 'notes', 'notater', 'innhold'].indexOf(k.toLowerCase()) >= 0; })[0] || null;
    return { title: navngitt || arkNavn || tittel, source: shoflo ? 'Shoflo' : rs ? 'Rundown Studio' : kilde, columns: kolonner, items: punkter, timer: 0, detailColumn: detalj, shortestRun: 60, current: null, currentStarted: null };
  }

  // CSV: komma, semikolon (norsk Excel) eller tab, det første linje har mest av
  function lesCsv(tekst, navn) {
    if (tekst.charCodeAt(0) === 0xfeff) tekst = tekst.slice(1);
    var forste = tekst.split(/\r?\n|\r/)[0] || '';
    var skille = [';', ',', '\t'].reduce(function (a, b) { return forste.split(b).length > forste.split(a).length ? b : a; }, ',');
    var rader = [], rad = [], celle = '', sitat = false;
    tekst += '\n';
    for (var i = 0; i < tekst.length; i++) {
      var c = tekst[i];
      if (sitat) {
        if (c === '"') { if (tekst[i + 1] === '"') { celle += '"'; i++; } else sitat = false; }
        else celle += c;
      } else if (c === '"' && celle === '') sitat = true;
      else if (c === skille) { rad.push(celle); celle = ''; }
      else if (c === '\n' || c === '\r') {
        if (c === '\r' && tekst[i + 1] === '\n') i++;
        rad.push(celle);
        if (rad.some(function (x) { return x !== ''; })) rader.push(rad);
        rad = []; celle = '';
      } else celle += c;
    }
    return { navn: navn, rader: rader };
  }

  // .xlsx er en zip med XML. inflate(bytes) må gi en Promise med bytene pakket ut (raw deflate).
  function u16(b, o) { return b[o] | (b[o + 1] << 8); }
  function u32(b, o) { return (u16(b, o) | (u16(b, o + 2) << 16)) >>> 0; }
  function lesZip(b) {
    var slutt = -1;
    for (var o = b.length - 22; o >= Math.max(0, b.length - 65557); o--) if (u32(b, o) === 0x06054b50) { slutt = o; break; }
    if (slutt < 0) throw feil('Ikke en Excel-fil (.xlsx): fant ikke innholdslista', 'Not an Excel file (.xlsx): could not find the file directory');
    var n = u16(b, slutt + 10), p = u32(b, slutt + 16), filer = {};
    for (var i = 0; i < n; i++) {
      if (u32(b, p) !== 0x02014b50) throw feil('Ødelagt Excel-fil', 'Corrupt Excel file');
      var nl = u16(b, p + 28), el = u16(b, p + 30), kl = u16(b, p + 32);
      var navn = new TextDecoder().decode(b.subarray(p + 46, p + 46 + nl));
      filer[navn] = { metode: u16(b, p + 10), str: u32(b, p + 20), hode: u32(b, p + 42) };
      p += 46 + nl + el + kl;
    }
    return filer;
  }
  async function zipFil(b, filer, navn, inflate) {
    var f = filer[navn];
    if (!f) return null;
    var h = f.hode, start = h + 30 + u16(b, h + 26) + u16(b, h + 28), data = b.subarray(start, start + f.str);
    var ut = f.metode === 0 ? data : f.metode === 8 ? await inflate(data) : null;
    if (!ut) throw feil('Ukjent komprimering i Excel-filen', 'Unknown compression in the Excel file');
    return new TextDecoder().decode(ut);
  }
  function xmlTekst(s) {
    return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&apos;/g, "'")
      .replace(/&#x([0-9a-f]+);/gi, function (_, h) { return String.fromCodePoint(parseInt(h, 16)); })
      .replace(/&#(\d+);/g, function (_, d) { return String.fromCodePoint(+d); }).replace(/&amp;/g, '&');
  }
  function attr(tag, navn) { var m = tag.match(new RegExp('\\s' + navn + '="([^"]*)"')); return m ? xmlTekst(m[1]) : null; }
  function kolonneNr(ref) { var n = 0; for (var i = 0; i < ref.length; i++) { var c = ref.charCodeAt(i); if (c < 65 || c > 90) break; n = n * 26 + c - 64; } return Math.max(0, n - 1); }
  async function lesXlsx(bytes, inflate) {
    var b = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes), filer = lesZip(b);
    var bok = await zipFil(b, filer, 'xl/workbook.xml', inflate);
    if (!bok) throw feil('Ikke en Excel-fil (.xlsx): mangler xl/workbook.xml', 'Not an Excel file (.xlsx): xl/workbook.xml is missing');
    var delt = [], ss = await zipFil(b, filer, 'xl/sharedStrings.xml', inflate);
    if (ss) (ss.match(/<si[\s>][\s\S]*?<\/si>|<si\/>/g) || []).forEach(function (si) {
      si = si.replace(/<rPh[\s\S]*?<\/rPh>/g, '');
      delt.push((si.match(/<t(?:\s[^>]*)?>[\s\S]*?<\/t>/g) || []).map(function (t) { return xmlTekst(t.replace(/^<t[^>]*>|<\/t>$/g, '')); }).join(''));
    });
    var rels = {}, rx = await zipFil(b, filer, 'xl/_rels/workbook.xml.rels', inflate);
    if (rx) (rx.match(/<Relationship\s[^>]*>/g) || []).forEach(function (r) { rels[attr(r, 'Id')] = attr(r, 'Target'); });
    var ark = [];
    var arkTagger = bok.match(/<sheet\s[^>]*>/g) || [];
    for (var i = 0; i < arkTagger.length; i++) {
      var tag = arkTagger[i], mal = rels[attr(tag, 'r:id')];
      if (!mal) continue;
      var sti = mal.charAt(0) === '/' ? mal.slice(1) : 'xl/' + mal, xml = await zipFil(b, filer, sti, inflate);
      if (!xml) continue;
      var rader = {}, maksRad = 0, maksKol = -1, radNr = 0;
      (xml.match(/<row[\s>][\s\S]*?<\/row>|<row\s[^>]*\/>/g) || []).forEach(function (rad) {
        var rt = rad.match(/^<row[^>]*>/)[0], r = +attr(rt, 'r') || radNr + 1, kol = 0;
        radNr = r;
        (rad.match(/<c[\s>][\s\S]*?<\/c>|<c\s[^>]*\/>/g) || []).forEach(function (c) {
          var ct = c.match(/^<c[^>]*>/)[0], ref = attr(ct, 'r'), type = attr(ct, 't');
          if (ref) kol = kolonneNr(ref);
          var v = c.match(/<v>([\s\S]*?)<\/v>/), t = c.match(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g);
          var tekst = v ? xmlTekst(v[1]) : t ? t.map(function (x) { return xmlTekst(x.replace(/^<t[^>]*>|<\/t>$/g, '')); }).join('') : '';
          if (type === 's' && delt[+tekst] != null) tekst = delt[+tekst];
          if (type === 'b') tekst = tekst === '1' ? 'TRUE' : 'FALSE';
          if (tekst !== '') { (rader[r] = rader[r] || {})[kol] = tekst; maksRad = Math.max(maksRad, r); maksKol = Math.max(maksKol, kol); }
          kol++;
        });
      });
      var ut = [];
      for (var rr = 1; rr <= maksRad; rr++) { var linje = []; for (var kk = 0; kk <= maksKol; kk++) linje.push(rader[rr] && rader[rr][kk] != null ? rader[rr][kk] : ''); ut.push(linje); }
      ark.push({ navn: attr(tag, 'name') || '', rader: ut });
    }
    if (!ark.length) throw feil('Fant ingen ark i Excel-filen', 'No sheets found in the Excel file');
    return ark;
  }

  var api = {
    lagId: lagId, kopi: kopi, T: T, tekst: tekst, feil: feil, vistSek: vistSek, formatSek: formatSek, format: format, klokke: klokke, lesTid: lesTid,
    lesKlokkeslett: lesKlokkeslett, klokkeslettTekst: klokkeslettTekst, sekTil: sekTil,
    nyTimer: nyTimer, igjen: igjen, start: start, pause: pause, stopp: stopp, veksle: veksle, juster: juster, settTid: settTid,
    settModus: settModus, lastInn: lastInn, startTil: startTil, stopperPaNull: stopperPaNull, erPaNull: erPaNull,
    warpPlan: warpPlan, brukWarp: brukWarp, fjernWarp: fjernWarp, visning: visning, farge: farge, blink: blink,
    nyPreset: nyPreset, presetTekst: presetTekst, nyttShow: nyttShow, rens: rens, STANDARDFARGER: STANDARDFARGER,
    visMelding: visMelding, skjulMelding: skjulMelding, veksleMelding: veksleMelding, meldingPaScenen: meldingPaScenen, leggIBank: leggIBank,
    lastPreset: lastPreset, fjernPreset: fjernPreset, settNeste: settNeste, goShow: goShow, avgjor: avgjor,
    punktKjores: punktKjores, nesteMedTid: nesteMedTid, punktIndeks: punktIndeks, avvik: avvik, ferdig: ferdig, avvikTekst: avvikTekst,
    lastKjoreplan: lastKjoreplan, fjernKjoreplan: fjernKjoreplan, settKjoreplanTimer: settKjoreplanTimer, settKortest: settKortest,
    settNestePunkt: settNestePunkt, lagKjoreplan: lagKjoreplan, lesCsv: lesCsv, lesXlsx: lesXlsx, lesVarighet: lesVarighet, lesStart: lesStart
  };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.HaptKlokke = api;
})(this);
