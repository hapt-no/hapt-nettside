// Operatorvinduet: styrer showet, lagrer det i nettleseren og sender det til scenen (skjerm.html).
// Samme oppsett og ord som hapt-o-clock-appen. Uten Companion, OSC og nett-kjøreplan, som trenger appen.
(function () {
  'use strict';
  var K = HaptKlokke, $ = function (id) { return document.getElementById(id); };
  var NOKKEL = 'hapt-klokke-show';
  var show = hent();
  var kanal = 'BroadcastChannel' in window ? new BroadcastChannel('hapt-klokke') : null;
  var scene = null, sceneVindu = null;
  var rader = [], visPresets = [false, false], valgtPunkt = null, innstSide = 't0', ventendeWarp = [null, null];

  function hent() {
    try { var t = localStorage.getItem(NOKKEL); if (t) return K.rens(JSON.parse(t)); } catch (e) {}
    return K.nyttShow();
  }
  var lagreFeil = false;
  function lagre() {
    try { localStorage.setItem(NOKKEL, JSON.stringify(show)); lagreFeil = false; }
    catch (e) { lagreFeil = true; }
    if (kanal) kanal.postMessage({ show: show });
  }
  // Alle endringer går hit: endre showet, lagre, sende til scenen og tegne operatoren på nytt
  function endre(fn) { fn(show, Date.now()); lagre(); tegnAlt(); }
  function esc(t) { return String(t == null ? '' : t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; }); }
  function tidTekst(sek) { return K.formatSek(Math.round(sek)); }

  // ---------- Symboler som i appen ----------
  var PLAY = '<svg class="symbol" viewBox="0 0 12 12"><path d="M3 1.6c0-.7.8-1.1 1.4-.7l6.1 4.4c.5.4.5 1.1 0 1.4L4.4 11.1c-.6.4-1.4 0-1.4-.7z" fill="currentColor"/></svg>';
  var PAUSE = '<svg class="symbol" viewBox="0 0 12 12"><rect x="2" y="1" width="3" height="10" rx="1" fill="currentColor"/><rect x="7" y="1" width="3" height="10" rx="1" fill="currentColor"/></svg>';
  var STOPP = '<svg class="symbol" viewBox="0 0 12 12" style="width:12px;height:12px"><rect x="1" y="1" width="10" height="10" rx="2" fill="currentColor"/></svg>';

  // ---------- Timerradene ----------
  function byggTimere() {
    var boks = $('timere');
    boks.innerHTML = [0, 1].map(function (i) {
      return '<div class="trad" data-i="' + i + '">' +
        '<div class="kontroll">' +
          '<div class="thode"><span class="tnr" style="background:var(--t' + (i + 1) + ')">' + (i + 1) + '</span>' +
            '<input type="text" class="navn" aria-label="Navn på timer ' + (i + 1) + '" autocomplete="off"><span class="merke warpmerke" hidden></span></div>' +
          '<div class="tall-boks"><div class="tall">0:00</div></div>' +
          '<div class="status"><i></i><span></span></div>' +
          '<div class="knapperad"><button class="knapp stor startknapp" type="button" title="Start / pause (tastatur: ' + (i ? 'Enter' : 'mellomrom') + ')"></button>' +
            '<button class="knapp stor stoppknapp" type="button" title="Stopp og nullstill (tastatur: ' + (i ? 'T' : 'R') + ')" aria-label="Stopp">' + STOPP + '</button></div>' +
          '<div class="knapperad juster">' +
            '<button class="knapp" type="button" data-juster="60" title="Legg til 1 minutt">+1m</button><button class="knapp" type="button" data-juster="30" title="Legg til 30 sekunder">+30s</button>' +
            '<button class="knapp" type="button" data-juster="-30" title="Trekk fra 30 sekunder">-30s</button><button class="knapp" type="button" data-juster="-60" title="Trekk fra 1 minutt">-1m</button></div>' +
          '<div class="knapperad">' +
            '<input type="text" class="settInn" placeholder="mm:ss" inputmode="numeric" autocomplete="off" aria-label="Ny tid"><button class="knapp settTid" type="button">Sett tid</button><span class="luft"></span>' +
            '<input type="text" class="tilInn" placeholder="hh:mm" inputmode="numeric" autocomplete="off" aria-label="Klokkeslett" title="Klokkeslett timeren skal nå 0:00: Til (teller ned til det nå) eller Warp (fortsetter, i nytt tempo)">' +
            '<button class="knapp til" type="button" title="Tell ned til klokkeslettet, fra nå">Til</button>' +
            '<button class="knapp warp" type="button" title="Få nedtellingen til å ende på klokkeslettet">Warp</button>' +
            '<button class="knapp fjernWarp" type="button" title="Slå av warp: vanlig tempo fra der den står" hidden>✕</button></div>' +
          '<div class="tidsvar" hidden></div>' +
          '<div class="neste"></div>' +
        '</div>' +
        '<div class="liste"></div>' +
      '</div>';
    }).join('');
    rader = [0, 1].map(function (i) {
      var el = boks.querySelector('.trad[data-i="' + i + '"]'), q = function (s) { return el.querySelector(s); };
      var r = { el: el, navn: q('.navn'), tall: q('.tall'), status: q('.status'), statusTekst: q('.status span'), start: q('.startknapp'), stopp: q('.stoppknapp'),
        settInn: q('.settInn'), tilInn: q('.tilInn'), warpmerke: q('.warpmerke'), fjernWarp: q('.fjernWarp'), til: q('.til'), warp: q('.warp'),
        tidsvar: q('.tidsvar'), neste: q('.neste'), liste: q('.liste'), juster: el.querySelectorAll('[data-juster]') };
      r.navn.addEventListener('input', function () { show.timers[i].name = r.navn.value; lagre(); });
      r.navn.addEventListener('keydown', function (e) { if (e.key === 'Enter') r.navn.blur(); });
      r.start.onclick = function () { endre(function (s, na) { K.veksle(s.timers[i], na); }); };
      r.stopp.onclick = function () { endre(function (s) { K.stopp(s.timers[i]); }); };
      Array.prototype.forEach.call(r.juster, function (b) { b.onclick = function () { endre(function (s, na) { K.juster(s.timers[i], +b.dataset.juster, na); }); }; });
      function settTid() {
        var sek = K.lesTid(r.settInn.value);
        if (sek == null) { svar(i, 'Skriv tiden som mm:ss, for eksempel 5:00.'); return; }
        endre(function (s) { K.settTid(s.timers[i], sek); });
        r.settInn.value = ''; r.settInn.blur(); svar(i, null);
      }
      r.el.querySelector('.settTid').onclick = settTid;
      r.settInn.addEventListener('keydown', function (e) { if (e.key === 'Enter') settTid(); });
      r.til.onclick = function () {
        var k = K.lesKlokkeslett(r.tilInn.value);
        if (!k) { svar(i, 'Skriv klokkeslettet som HH:MM, for eksempel 14:35.'); return; }
        endre(function (s, na) { K.startTil(s.timers[i], k, na); });
        r.tilInn.value = ''; r.tilInn.blur(); svar(i, null);
      };
      function planleggWarp() {
        var k = K.lesKlokkeslett(r.tilInn.value);
        if (!k) { svar(i, 'Skriv sluttiden som HH:MM, for eksempel 14:35.'); return; }
        var plan = K.warpPlan(show.timers[i], k, Date.now());
        if (plan.feil) { svar(i, plan.feil); return; }
        r.tilInn.value = ''; r.tilInn.blur();
        if (plan.warp.over) {
          ventendeWarp[i] = plan.warp;
          svar(i, '⚠ Warp ' + Math.abs(plan.warp.percent) + ' % ' + (plan.warp.factor > 1 ? 'raskere' : 'saktere') + ' enn normalt. Det er mer enn terskelen på ' + show.timers[i].warpWarnPercent + ' %.', true);
        } else { endre(function (s, na) { K.brukWarp(s.timers[i], plan.warp, na); }); svar(i, null); }
      }
      r.warp.onclick = planleggWarp;
      r.tilInn.addEventListener('keydown', function (e) { if (e.key === 'Enter') planleggWarp(); });
      r.fjernWarp.onclick = function () { endre(function (s, na) { K.fjernWarp(s.timers[i], na); }); };
      r.tidsvar.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.v === 'ja' && ventendeWarp[i]) { var w = ventendeWarp[i]; endre(function (s, na) { K.brukWarp(s.timers[i], w, na); }); }
        ventendeWarp[i] = null; svar(i, null);
      });
      r.neste.addEventListener('click', function (e) {
        var b = e.target.closest('button');
        if (!b) return;
        if (b.dataset.v === 'go') endre(function (s, na) { K.goShow(s, i, na); });
        if (b.dataset.v === 'fjern') endre(function (s) { s.timers[i].next = null; });
      });
      r.liste.addEventListener('click', function (e) { listeKlikk(i, e); });
      return r;
    });
  }

  function svar(i, tekst, warpSporsmal) {
    var el = rader[i].tidsvar;
    if (!tekst) { el.hidden = true; el.innerHTML = ''; return; }
    el.hidden = false;
    el.className = 'tidsvar ' + (warpSporsmal ? 'warn' : 'feil');
    el.innerHTML = esc(tekst) + (warpSporsmal ? ' <span class="btns" style="margin-top:6px"><button class="knapp liten bla" type="button" data-v="ja">Aktiver warp</button><button class="knapp liten" type="button" data-v="nei">Avbryt</button></span>' : '');
  }

  // ---------- Tegning av det som ikke endrer seg hvert bilde ----------
  function tegnAlt() {
    document.querySelectorAll('.utgang button').forEach(function (b) { b.setAttribute('aria-pressed', show.output === b.dataset.ut ? 'true' : 'false'); });
    // Melding
    if (document.activeElement !== $('utkast')) $('utkast').value = show.draft || '';
    var paa = K.meldingPaScenen(show);
    $('visMelding').className = 'knapp' + (paa != null ? ' pa' : '');
    $('visMelding').querySelector('.prik').className = 'prik' + (paa != null ? ' pa' : '');
    $('visMelding').lastChild.textContent = paa != null ? 'Skjul melding' : 'Vis melding';
    $('paScenen').hidden = !(paa != null && paa !== show.draft);
    $('paScenen').textContent = paa != null ? 'På scenen: ' + paa : '';
    $('bank').innerHTML = show.bank.length ? show.bank.map(function (t, i) {
      return '<div class="linje"><span title="' + esc(t) + '">' + esc(t) + '</span>' +
        '<button class="knapp liten" type="button" data-bank="hent" data-i="' + i + '" title="Last inn i meldingsfeltet">↓</button>' +
        '<button class="knapp liten" type="button" data-bank="vis" data-i="' + i + '" title="Vis på scenen nå">→</button>' +
        '<button class="knapp liten" type="button" data-bank="fjern" data-i="' + i + '" title="Fjern fra banken">✕</button></div>';
    }).join('') : '<div class="tomt">Tom bank</div>';

    show.timers.forEach(function (t, i) {
      var r = rader[i];
      if (document.activeElement !== r.navn) r.navn.value = t.name;
      var gar = t.phase === 'running';
      r.start.innerHTML = (gar ? PAUSE : PLAY) + '<span>' + (gar ? 'Pause' : 'Start') + '</span>';
      r.start.className = 'knapp stor startknapp' + (gar ? '' : ' gronn');
      r.start.disabled = t.mode === 'clock';
      r.stopp.disabled = t.mode === 'clock';
      Array.prototype.forEach.call(r.juster, function (b) { b.disabled = t.mode === 'clock' || (t.mode === 'countup' && t.phase === 'stopped') || (t.phase === 'stopped' && !!t.countTo); });
      r.til.disabled = t.mode === 'clock';
      r.warp.disabled = t.mode !== 'countdown';
      r.fjernWarp.hidden = !t.warp;
      r.warpmerke.hidden = !t.warp;
      if (t.warp) {
        var farge = t.warp.over ? 'var(--warn)' : 'var(--accent)';
        r.warpmerke.textContent = 'Warp ' + (t.warp.percent >= 0 ? '+' : '') + t.warp.percent + ' %';
        r.warpmerke.style.cssText = 'color:' + farge + ';background:color-mix(in srgb,' + farge + ' 15%,transparent)';
      }
      var n = t.next;
      r.neste.innerHTML = '<span class="n">Neste</span>' + (n
        ? '<b title="' + esc(n.name) + '">' + esc(n.name) + '</b><span class="tid">' + esc(K.presetTekst(n)) + '</span><button class="knapp liten" type="button" data-v="fjern" title="Fjern neste">✕</button>'
        : '<span class="tom">Velg med «Neste» i ' + (show.rundown && show.rundown.timer === i ? 'kjøreplanen' : 'preset-lista') + '</span>') +
        '<button class="knapp bla go" type="button" data-v="go"' + (n ? '' : ' disabled') + ' title="Neste tar over og starter">GO</button>';
      tegnListe(i);
    });
  }

  // Presets til høyre, eller kjøreplanen for timeren som kjører den
  function tegnListe(i) {
    var r = rader[i], t = show.timers[i], kp = show.rundown && show.rundown.timer === i ? show.rundown : null;
    var html = '';
    if (kp) {
      html += '<div class="fanelinje"><button class="fane" type="button" data-fane="kp" aria-pressed="' + !visPresets[i] + '">Kjøreplan</button>' +
        '<button class="fane" type="button" data-fane="presets" aria-pressed="' + visPresets[i] + '">Presets</button>' +
        '<button class="rediger" type="button" data-rediger="' + (visPresets[i] ? 'presets' : 'kp') + '">Rediger …</button></div>';
    } else {
      html += '<div class="fanelinje"><span class="tittel">Presets</span><button class="rediger" type="button" data-rediger="kp" style="margin-left:auto">Kjøreplan …</button><button class="rediger" type="button" data-rediger="presets" style="margin-left:14px">Rediger …</button></div>';
    }
    if (kp && !visPresets[i]) html += kjoreplanHtml(kp, t);
    else html += presetsHtml(i, t);
    // Lista tegnes på nytt ved hver endring; rulleposisjonen beholdes, og når et nytt punkt
    // starter, rulles det fram til midten
    var gammel = r.liste.querySelector('.rulle'), topp = gammel ? gammel.scrollTop : 0, visning = (kp && !visPresets[i] ? 'kp' : 'p');
    r.liste.innerHTML = html;
    var rulle = r.liste.querySelector('.rulle');
    if (rulle && r.sistVisning === visning) rulle.scrollTop = topp;
    var na = kp && !visPresets[i] && kp.current != null ? r.liste.querySelector('.punkt.na') : null;
    if (na && rulle && (r.sistNa !== kp.current || r.sistVisning !== visning)) rulle.scrollTop = na.offsetTop - rulle.offsetTop - rulle.clientHeight / 2 + na.offsetHeight / 2;
    r.sistNa = kp ? kp.current : null; r.sistVisning = visning;
  }

  function presetsHtml(i, t) {
    var farge = 'var(--t' + (i + 1) + ')';
    if (!show.presets.length) return '<div class="rulle"><div class="tomt">Ingen presets. Legg til under Innstillinger → Presets.</div></div>';
    return '<div class="rulle">' + show.presets.map(function (p, pi) {
      var aktiv = t.activePreset === pi, neste = t.next && t.next.id === p.id;
      return '<div class="preset" style="' + (aktiv ? 'background:color-mix(in srgb,' + farge + ' 14%,transparent)' : '') + '">' +
        '<button class="knapp liten" type="button" data-last="' + pi + '" title="Last inn i timer ' + (i + 1) + ' nå (stopper den)">Last inn</button>' +
        '<button class="knapp liten' + (neste ? ' omriss' : '') + '" type="button" data-neste="' + pi + '" title="Gjør klar for GO">Neste</button>' +
        '<span class="navn" style="' + (aktiv ? 'color:' + farge : '') + '">' + esc(p.name) + '</span><span class="sum">' + esc(K.presetTekst(p)) + '</span></div>';
    }).join('') + '</div>';
  }

  function kjoreplanHtml(kp, t) {
    var nesteId = t.next && t.next.id;
    var h = '<div class="kp-hode"><b title="' + esc(kp.title) + '">' + esc(kp.title) + '</b><span class="kilde">' + esc(kp.source) + '</span><span class="avvik info" data-avvik>' + '</span></div>';
    h += '<div class="rulle">' + kp.items.map(function (p, pi) {
      var valgt = valgtPunkt === p.id;
      if (!(p.duration > 0)) {
        return '<div class="overskrift' + (valgt ? ' valgt' : '') + '" data-punkt="' + pi + '">' + esc(p.title) + (p.subtitle ? ' <span>' + esc(p.subtitle) + '</span>' : '') + (p.start ? ' <span>' + K.klokkeslettTekst(p.start) + '</span>' : '') + '</div>';
      }
      var kjores = K.punktKjores(kp, p), na = kp.current === pi, neste = nesteId === p.id;
      var detalj = [p.subtitle, kp.detailColumn ? p.notes[kp.detailColumn] : null].filter(Boolean).map(function (x) { return String(x).split(/\n/).join(' · '); }).join(' · ');
      return '<div class="punkt' + (na ? ' na' : '') + (valgt ? ' valgt' : '') + (!kjores && !na ? ' kort' : '') + '" data-punkt="' + pi + '">' +
        '<button class="knapp liten' + (neste ? ' omriss' : '') + '" type="button" data-nestepunkt="' + pi + '"' + (kjores ? '' : ' disabled') + ' title="' + (kjores ? 'Gjør klar for GO' : 'Kortere enn ' + tidTekst(kp.shortestRun) + ': hoppes over') + '">Neste</button>' +
        '<span class="nr">' + esc(p.number) + '</span><span class="kl">' + (p.start ? K.klokkeslettTekst(p.start) : '') + '</span>' +
        '<span class="tekst"><b>' + esc(p.title) + '</b>' + (detalj ? '<span>' + esc(detalj) + '</span>' : '') + '</span>' +
        (neste ? '<span class="merke" style="color:var(--accent);background:color-mix(in srgb,var(--accent) 15%,transparent)">Neste</span>' : '') +
        '<span class="lengde">' + tidTekst(p.duration) + '</span></div>';
    }).join('') + '</div>';
    var vist = null;
    if (valgtPunkt) { var vi = K.punktIndeks(kp, valgtPunkt); if (vi >= 0) vist = kp.items[vi]; }
    if (!vist && kp.current != null) vist = kp.items[kp.current];
    if (vist && Object.keys(vist.notes).length) {
      h += '<div class="notater"><h4>' + esc(vist.title) + '</h4>' + kp.columns.filter(function (c) { return vist.notes[c] != null; }).map(function (c) {
        return '<div><span>' + esc(c) + '</span><span>' + esc(vist.notes[c]) + '</span></div>';
      }).join('') + '</div>';
    }
    return h;
  }

  function listeKlikk(i, e) {
    var b = e.target.closest('button');
    if (b) {
      if (b.dataset.fane) { visPresets[i] = b.dataset.fane === 'presets'; tegnListe(i); return; }
      if (b.dataset.rediger) { apneInnst(b.dataset.rediger); return; }
      if (b.dataset.last != null) { endre(function (s) { K.lastPreset(s, +b.dataset.last, i); }); return; }
      if (b.dataset.neste != null) { endre(function (s) { K.settNeste(s, +b.dataset.neste, i); }); return; }
      if (b.dataset.nestepunkt != null) { endre(function (s) { K.settNestePunkt(s, +b.dataset.nestepunkt); }); return; }
      return;
    }
    var p = e.target.closest('[data-punkt]');
    if (p && show.rundown) {
      var id = show.rundown.items[+p.dataset.punkt].id;
      valgtPunkt = valgtPunkt === id ? null : id;
      tegnListe(i);
    }
  }

  // ---------- Hvert bilde: tallene, statusen, avviket og forhåndsvisningen ----------
  function paSkjerm(hex) {
    // I lyst fargesett blir hvite timerfarger usynlige på operatorsiden; de vises i tekstfarge
    if (document.documentElement.dataset.tema !== 'lys') return hex;
    var m = /^#?([0-9a-f]{6})$/i.exec(hex || '');
    if (!m) return hex;
    var n = parseInt(m[1], 16), lys = (0.299 * (n >> 16) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
    return lys > 0.8 ? 'var(--fg)' : hex;
  }
  function statusFor(t, d) {
    if (t.mode === 'clock') return ['', 'Klokke'];
    if (t.warp && t.phase === 'running') return [t.warp.over ? 'warpvarsel go' : 'warp go', 'Warp ' + (t.warp.percent >= 0 ? '+' : '') + t.warp.percent + ' % mot ' + K.klokkeslettTekst(t.warp.target)];
    if (t.phase === 'stopped') return ['', t.countTo ? 'Klar · til ' + K.klokkeslettTekst(t.countTo) : t.mode === 'countup' ? 'Klar · teller opp' : 'Klar'];
    if (t.phase === 'paused') return d.overtime ? ['over', 'Pauset i overtid'] : ['', 'Pauset'];
    if (d.overtime) return ['over go', 'Overtid'];
    if (t.countTo) return ['go', 'Går · til ' + K.klokkeslettTekst(t.countTo)];
    return ['go', t.mode === 'countup' ? 'Teller opp' : 'Går'];
  }
  var sisteForhand = 0;
  function ramme() {
    var na = Date.now();
    show.timers.forEach(function (t, i) {
      var r = rader[i], d = K.visning(t, na);
      if (r.tall.textContent !== d.text) { r.tall.textContent = d.text; r.tall.classList.toggle('lang', d.text.length > 5); }
      r.tall.style.color = paSkjerm(K.farge(t, d.tone));
      r.tall.style.opacity = d.blinks ? K.blink(na) : 1;
      var st = statusFor(t, d);
      r.status.className = 'status ' + st[0];
      if (r.statusTekst.textContent !== st[1]) r.statusTekst.textContent = st[1];
    });
    var badge = document.querySelector('[data-avvik]');
    if (badge && show.rundown) {
      var a = K.avvik(show.rundown, na), tekst, kl = 'avvik info';
      if (a == null) tekst = show.rundown.current == null ? 'Trykk GO for å starte' : 'Ingen plantid å sammenligne med';
      else {
        var slutt = K.ferdig(show.rundown, na);
        tekst = K.avvikTekst(a) + (slutt ? ' · ferdig ca. ' + K.klokke(new Date(slutt)).slice(0, 5) : '');
        kl = 'avvik ' + (a >= 1 ? 'bak' : 'foran');
      }
      if (badge.textContent !== tekst) badge.textContent = tekst;
      if (badge.className !== kl) badge.className = kl;
    }
    if (na - sisteForhand > 66) { sisteForhand = na; tegnForhand(na); }
    requestAnimationFrame(ramme);
  }

  function tegnForhand(na) {
    var aapen = scene && na - scene.sist < 2500;
    var W = aapen && scene.w ? scene.w : 1920, H = aapen && scene.h ? scene.h : 1080;
    var boks = $('forhand'), cv = $('forhandLerret');
    var forhold = (W / H).toFixed(4);
    if (boks.dataset.forhold !== forhold) { boks.dataset.forhold = forhold; boks.style.aspectRatio = W + ' / ' + H; }
    boks.classList.toggle('lukket', !aapen);
    var dpr = window.devicePixelRatio || 1, bw = Math.round(boks.clientWidth * dpr), bh = Math.round(boks.clientHeight * dpr);
    if (!bw || !bh) return;
    if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    var g = cv.getContext('2d');
    g.setTransform(bw / W, 0, 0, bh / H, 0, 0);
    HaptKlokkeSkjerm.tegn(g, W, H, show, na);
    var tekst = aapen ? 'Scenen er åpen · ' + scene.w + ' × ' + scene.h + (scene.full ? ' · fullskjerm' : '') : 'Scenen er ikke åpen';
    var st = $('sceneTekst');
    if (st.textContent !== tekst) { st.textContent = tekst; st.style.color = aapen ? 'var(--live)' : ''; }
    var knapp = $('apneScene');
    var kt = aapen ? 'Scene åpen' : 'Åpne scene';
    if (knapp.textContent !== kt) knapp.textContent = kt;
    knapp.classList.toggle('pa', !!aapen);
  }

  // ---------- Tid som går av seg selv: 0:00-handlinger ----------
  // Sjekkes fra en Web Worker, som nettleseren ikke bremser når vinduet ligger i bakgrunnen.
  function sjekk() { if (K.avgjor(show, Date.now())) { lagre(); tegnAlt(); } }
  try {
    var arbeider = new Worker(URL.createObjectURL(new Blob(['setInterval(function(){postMessage(0)},200)'], { type: 'text/javascript' })));
    arbeider.onmessage = sjekk;
  } catch (e) { setInterval(sjekk, 200); }

  // ---------- Scenen ----------
  if (kanal) kanal.onmessage = function (e) {
    if (!e.data || !('skjerm' in e.data)) return;
    scene = e.data.skjerm ? { w: e.data.skjerm.w, h: e.data.skjerm.h, full: e.data.skjerm.full, sist: Date.now() } : null;
  };
  $('apneScene').onclick = async function () {
    if (scene && Date.now() - scene.sist < 2500 && sceneVindu && !sceneVindu.closed) { sceneVindu.focus(); return; }
    var egenskaper = 'popup=yes,width=1280,height=720';
    // Har nettleseren lov til å se skjermene (Chrome), legges scenen rett på den andre skjermen
    try {
      if (window.getScreenDetails && navigator.permissions) {
        var tilgang = await navigator.permissions.query({ name: 'window-management' });
        if (tilgang.state === 'granted') {
          var d = await window.getScreenDetails(), andre = d.screens.filter(function (s) { return s !== d.currentScreen; })[0];
          if (andre) egenskaper = 'popup=yes,left=' + andre.availLeft + ',top=' + andre.availTop + ',width=' + andre.availWidth + ',height=' + andre.availHeight;
        }
      }
    } catch (e) {}
    sceneVindu = window.open('skjerm.html', 'hapt-klokke-scene', egenskaper);
    if (!sceneVindu) $('sceneTekst').textContent = 'Nettleseren stoppet vinduet. Tillat popup-vinduer for hapt.no.';
  };

  // ---------- Melding, bank og utgang ----------
  $('utkast').addEventListener('input', function () { show.draft = this.value; lagre(); });
  $('utkast').addEventListener('keydown', function (e) { if (e.key === 'Enter') { endre(function (s) { K.visMelding(s); }); this.blur(); } });
  $('tilBank').onclick = function () { endre(function (s) { K.leggIBank(s); }); };
  $('visMelding').onclick = function () { endre(function (s) { K.veksleMelding(s); }); };
  $('bank').addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var i = +b.dataset.i, tekst = show.bank[i];
    if (b.dataset.bank === 'hent') endre(function (s) { s.draft = tekst; });
    if (b.dataset.bank === 'vis') endre(function (s) { K.visMelding(s, tekst); });
    if (b.dataset.bank === 'fjern') endre(function (s) { s.bank.splice(i, 1); });
  });
  document.querySelectorAll('.utgang button').forEach(function (b) {
    b.onclick = function () { endre(function (s, na) { if (s.output !== b.dataset.ut) s.outputSince = na; s.output = b.dataset.ut; }); };
  });

  // ---------- Tastatur: mellomrom T1, Enter T2, M melding, R/T stopp ----------
  document.addEventListener('keydown', function (e) {
    if (e.metaKey || e.ctrlKey || e.altKey || $('innst').open) return;
    var mal = e.target;
    if (mal && (mal.tagName === 'INPUT' || mal.tagName === 'TEXTAREA' || mal.tagName === 'SELECT' || mal.isContentEditable)) return;
    if (mal && mal.tagName === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) mal.blur();
    var k = e.key;
    if (k === ' ') endre(function (s, na) { K.veksle(s.timers[0], na); });
    else if (k === 'Enter') endre(function (s, na) { K.veksle(s.timers[1], na); });
    else if (k === 'm' || k === 'M') endre(function (s) { K.veksleMelding(s); });
    else if (k === 'r' || k === 'R') endre(function (s) { K.stopp(s.timers[0]); });
    else if (k === 't' || k === 'T') endre(function (s) { K.stopp(s.timers[1]); });
    else return;
    e.preventDefault();
  });

  // ---------- Innstillinger ----------
  function apneInnst(side) {
    if (side) innstSide = side;
    tegnInnst();
    if (!$('innst').open) $('innst').showModal();
  }
  $('apneInnst').onclick = function () { apneInnst(); };
  $('lukkInnst').onclick = function () { $('innst').close(); };
  $('innstFaner').addEventListener('click', function (e) { var b = e.target.closest('[data-side]'); if (b) { innstSide = b.dataset.side; tegnInnst(); } });

  var VED0 = [['overtime', 'Gå i overtid (+0:01 …)'], ['stop', 'Stopp på 0:00'], ['message', 'Stopp og vis melding'], ['next', 'Start neste (eller overtid)']];
  var FARGENAVN = [['running', 'Går'], ['paused', 'Pauset'], ['stopped', 'Klar'], ['warning', 'Varsel'], ['danger', 'Fare'], ['overtime', 'Overtid']];
  function seg(navn, verdier, valgt) {
    return '<div class="seg" data-seg="' + navn + '">' + verdier.map(function (v) { return '<button type="button" data-v="' + v[0] + '" aria-pressed="' + (v[0] === valgt) + '">' + v[1] + '</button>'; }).join('') + '</div>';
  }
  function glider(k, tittel, min, maks, verdi, enhet) {
    return '<div class="field"><label>' + tittel + '</label><div class="glider"><input type="range" data-k="' + k + '" min="' + min + '" max="' + maks + '" value="' + verdi + '"><output>' + Math.round(verdi) + enhet + '</output></div></div>';
  }

  function tegnInnst() {
    $('innstFaner').querySelectorAll('[data-side]').forEach(function (b) { b.setAttribute('aria-pressed', b.dataset.side === innstSide ? 'true' : 'false'); });
    var h = '', boks = $('innstInnhold');
    if (innstSide === 't0' || innstSide === 't1') {
      var i = +innstSide.slice(1), t = show.timers[i], p = t.placement;
      h += '<div class="card"><h2>Timer ' + (i + 1) + '</h2>' +
        '<div class="field"><label for="i-navn">Navn</label><input type="text" id="i-navn" data-k="navn" value="' + esc(t.name) + '"></div>' +
        '<label>Modus</label>' + seg('modus', [['countdown', 'Nedtelling'], ['countup', 'Opptelling'], ['clock', 'Klokke']], t.mode) +
        '<div class="field"><label for="i-ved0">Ved 0:00</label><select id="i-ved0" data-k="ved0">' + VED0.map(function (v) { return '<option value="' + v[0] + '"' + (t.endAction === v[0] ? ' selected' : '') + '>' + v[1] + '</option>'; }).join('') + '</select></div>' +
        '<div class="field" data-vis="melding"' + (t.endAction === 'message' ? '' : ' hidden') + '><label for="i-slutt">Melding ved 0:00</label><input type="text" id="i-slutt" data-k="sluttmelding" value="' + esc(t.endMessage) + '"></div>' +
        '<div class="row3"><div class="field"><label for="i-varsel">Varsel (sek igjen)</label><input type="number" id="i-varsel" data-k="varsel" min="0" value="' + t.warningAt + '"></div>' +
        '<div class="field"><label for="i-fare">Fare (sek igjen)</label><input type="number" id="i-fare" data-k="fare" min="0" value="' + t.dangerAt + '"></div>' +
        '<div class="field"><label for="i-warpt">Spør ved warp over (%)</label><input type="number" id="i-warpt" data-k="warpt" min="0" value="' + t.warpWarnPercent + '"></div></div>' +
        '<label>Farger</label><div class="farger">' + FARGENAVN.map(function (f) { return '<label><input type="color" data-farge="' + f[0] + '" value="' + esc(t.colors[f[0]]) + '">' + f[1] + '</label>'; }).join('') + '</div>' +
        '<div class="btns" style="margin-top:10px"><button class="knapp liten" type="button" data-handling="standardfarger">Standardfarger</button></div></div>' +
        '<div class="card"><h2>På scenen</h2>' +
        '<label class="check"><input type="checkbox" data-k="synlig"' + (p.visible ? ' checked' : '') + '> Vis timeren på scenen</label>' +
        glider('storrelse', 'Størrelse', 0, 100, p.size, ' %') +
        '<div data-vis="fri"' + (show.layout === 'free' ? '' : ' hidden') + '>' + glider('x', 'Plassering bortover (X)', 0, 100, p.x, ' %') + glider('y', 'Plassering nedover (Y)', 0, 100, p.y, ' %') + '</div>' +
        '<p class="note" data-vis="jevn"' + (show.layout === 'free' ? ' hidden' : '') + '>Timerne står jevnt fordelt. Velg «Fri plassering» under Scene for å sette X og Y selv.</p>' +
        '<div class="farger"><label><input type="color" data-k="bakgrunn" value="' + esc(p.background) + '">Bakgrunn på scenen</label></div></div>';
    } else if (innstSide === 'scene') {
      h += '<div class="card"><h2>Scene</h2><label>Oppsett</label>' + seg('oppsett', [['stacked', 'Jevnt fordelt'], ['free', 'Fri plassering']], show.layout) +
        glider('lysstyrke', 'Lysstyrke', 10, 100, show.dim * 100, ' %') +
        glider('loft', 'Meldingen løftet fra bunnen (for skjermer der bunnen er skjult)', 0, 80, show.messageLift, ' %') +
        glider('meldstr', 'Størrelse på meldingen', 50, 300, show.messageScale, ' %') + '</div>' +
        '<div class="card"><h2>Logo</h2><p class="note" style="margin-top:0">' + (show.logo ? 'Eget bilde er valgt.' : 'HAPT-logoen vises, med samme animasjon som på hapt.no. Velg et eget bilde for kundens logo.') + '</p>' +
        '<div class="btns"><button class="knapp" type="button" data-handling="logo">Velg bilde …</button>' + (show.logo ? '<button class="knapp" type="button" data-handling="haptlogo">Bruk HAPT-logoen</button>' : '') + '</div><div class="feil" data-feil="logo" hidden></div></div>' +
        '<div class="card"><h2>Skjermer</h2><p class="note" style="margin-top:0">I Chrome og Edge kan scenen legges rett på den andre skjermen når nettleseren får lov til å se skjermene.</p>' +
        '<div class="btns"><button class="knapp" type="button" data-handling="skjermer">Gi tilgang til skjermene</button></div><div class="note" data-svar="skjermer"></div></div>';
    } else if (innstSide === 'presets') {
      h += '<div class="card"><h2>Presets</h2><div class="pliste">' + show.presets.map(function (p, pi) {
        var type = p.mode === 'countdown' && p.countTo ? 'til' : p.mode;
        var verdi = type === 'til' ? K.klokkeslettTekst(p.countTo) : type === 'countdown' ? tidTekst(p.duration) : '';
        return '<div class="prad" data-p="' + pi + '"><input type="text" data-pk="navn" value="' + esc(p.name) + '" aria-label="Navn">' +
          '<select data-pk="type" aria-label="Type">' + [['countdown', 'Nedtelling'], ['til', 'Til klokkeslett'], ['countup', 'Opptelling'], ['clock', 'Klokke']].map(function (o) { return '<option value="' + o[0] + '"' + (o[0] === type ? ' selected' : '') + '>' + o[1] + '</option>'; }).join('') + '</select>' +
          '<input type="text" data-pk="tid" value="' + verdi + '" placeholder="' + (type === 'til' ? 'hh:mm' : 'mm:ss') + '"' + (type === 'countup' || type === 'clock' ? ' disabled' : '') + ' aria-label="Tid">' +
          '<span class="flytt"><button class="knapp liten" type="button" data-pflytt="-1" title="Flytt opp"' + (pi ? '' : ' disabled') + '>↑</button><button class="knapp liten" type="button" data-pflytt="1" title="Flytt ned"' + (pi < show.presets.length - 1 ? '' : ' disabled') + '>↓</button><button class="knapp liten" type="button" data-pfjern title="Slett">✕</button></span></div>';
      }).join('') + '</div><div class="btns" style="margin-top:12px"><button class="knapp" type="button" data-handling="nypreset">+ Ny preset</button></div></div>';
    } else if (innstSide === 'kp') {
      var kp = show.rundown;
      h += '<div class="card"><h2>Kjøreplan</h2>';
      if (!kp) {
        h += '<p class="note" style="margin-top:0">Les inn Shoflo-eksporten (.xlsx), Excel eller CSV (komma, semikolon eller tab). Kolonner for tittel og varighet trengs; nummer, starttid og andre kolonner tas med. Varighet kan stå som 30m, 6m36s, 1h, 5:00 eller minutter. Punkter uten tid blir overskrifter.</p>';
      } else {
        var medTid = kp.items.filter(function (p) { return p.duration > 0; }).length;
        h += '<p style="margin-top:0"><b>' + esc(kp.title) + '</b> <span class="muted">· ' + esc(kp.source) + ' · ' + kp.items.length + ' punkter, ' + medTid + ' med tid</span></p>' +
          '<label>Kjøres av</label>' + seg('kptimer', [['0', '1 · ' + (show.timers[0].name || 'Timer 1')], ['1', '2 · ' + (show.timers[1].name || 'Timer 2')]], String(kp.timer)) +
          '<div class="row"><div class="field"><label for="i-kort">Hopp over punkter kortere enn</label><input type="text" id="i-kort" data-k="kortest" value="' + tidTekst(kp.shortestRun) + '" placeholder="mm:ss"></div>' +
          '<div class="field"><label for="i-detalj">Kolonne under titlene</label><select id="i-detalj" data-k="detalj"><option value="">Ingen</option>' + kp.columns.map(function (c) { return '<option' + (c === kp.detailColumn ? ' selected' : '') + '>' + esc(c) + '</option>'; }).join('') + '</select></div></div>' +
          '<p class="note">GO starter det som står under NESTE og gjør klar det neste med tid. Sett «Ved 0:00» til «Start neste» på timeren, så går kjøreplanen av seg selv.</p>';
      }
      h += '<div class="btns" style="margin-top:12px"><button class="knapp ' + (kp ? '' : 'bla') + '" type="button" data-handling="importer">' + (kp ? 'Les inn en annen …' : 'Les inn kjøreplan …') + '</button>' + (kp ? '<button class="knapp" type="button" data-handling="fjernkp">Fjern kjøreplanen</button>' : '') + '</div><div class="feil" data-feil="kp" hidden></div></div>';
    } else if (innstSide === 'fil') {
      h += '<div class="card"><h2>Show</h2><p class="note" style="margin-top:0">Showet lagres fortløpende i denne nettleseren, også timere som går. Lagre som fil for å ta det med til en annen maskin.</p>' +
        '<div class="btns"><button class="knapp" type="button" data-handling="lagrefil">Lagre show som fil</button><button class="knapp" type="button" data-handling="apnefil">Åpne show fra fil …</button></div><div class="feil" data-feil="fil" hidden></div></div>' +
        '<div class="card"><h2>Begynn på nytt</h2><p class="note" style="margin-top:0">Setter timere, presets, meldinger og kjøreplan tilbake til standard.</p><div class="btns"><button class="knapp" type="button" data-handling="nullstill">Nullstill alt</button></div></div>' +
        '<div class="card"><h2>Om nettversjonen</h2><p class="note" style="margin-top:0">Samme timere, scene, presets, meldinger og kjøreplan som hapt-o-clock-appen. Companion, OSC, disguise, nett-kjøreplan, logg og angre finnes bare i appen, fordi en nettside ikke kan ta imot signaler fra andre maskiner. Scenen må åpnes i samme nettleser som denne siden.</p></div>';
    }
    boks.innerHTML = h;
    boks.dataset.side = innstSide;
  }

  function feilmelding(navn, tekst) {
    var el = $('innstInnhold').querySelector('[data-feil="' + navn + '"]');
    if (el) { el.hidden = !tekst; el.textContent = tekst || ''; }
  }

  var innh = $('innstInnhold');
  innh.addEventListener('input', function (e) { innstEndring(e.target, false); });
  innh.addEventListener('change', function (e) { innstEndring(e.target, true); });
  function innstEndring(el, ferdig) {
    var side = innh.dataset.side, i = side === 't0' ? 0 : side === 't1' ? 1 : -1, t = show.timers[i];
    if (el.type === 'range' && el.nextElementSibling) el.nextElementSibling.textContent = el.value + (el.dataset.k === 'lysstyrke' || el.dataset.k === 'loft' || el.dataset.k === 'meldstr' || el.dataset.k === 'storrelse' || el.dataset.k === 'x' || el.dataset.k === 'y' ? ' %' : '');
    if (el.dataset.farge && t) { t.colors[el.dataset.farge] = el.value; lagre(); return; }
    var k = el.dataset.k;
    if (k && t) {
      if (k === 'navn') t.name = el.value;
      else if (k === 'ved0') { t.endAction = el.value; innh.querySelector('[data-vis="melding"]').hidden = el.value !== 'message'; }
      else if (k === 'sluttmelding') t.endMessage = el.value;
      else if (k === 'varsel') t.warningAt = Math.max(0, +el.value || 0);
      else if (k === 'fare') t.dangerAt = Math.max(0, +el.value || 0);
      else if (k === 'warpt') t.warpWarnPercent = Math.max(0, +el.value || 0);
      else if (k === 'synlig') t.placement.visible = el.checked;
      else if (k === 'storrelse') t.placement.size = +el.value;
      else if (k === 'x') t.placement.x = +el.value;
      else if (k === 'y') t.placement.y = +el.value;
      else if (k === 'bakgrunn') t.placement.background = el.value;
      lagre(); if (ferdig || k === 'navn') tegnAlt();
      return;
    }
    if (k === 'lysstyrke') { show.dim = +el.value / 100; lagre(); return; }
    if (k === 'loft') { show.messageLift = +el.value; lagre(); return; }
    if (k === 'meldstr') { show.messageScale = +el.value; lagre(); return; }
    if (k === 'kortest' && ferdig) {
      var sek = K.lesTid(el.value);
      if (sek == null) { feilmelding('kp', 'Skriv tiden som mm:ss, for eksempel 1:00.'); return; }
      feilmelding('kp', null); endre(function (s) { K.settKortest(s, sek); }); el.value = tidTekst(show.rundown.shortestRun); return;
    }
    if (k === 'detalj') { show.rundown.detailColumn = el.value || null; lagre(); tegnAlt(); return; }
    var rad = el.closest('[data-p]');
    if (rad && el.dataset.pk) {
      var p = show.presets[+rad.dataset.p], tid = rad.querySelector('[data-pk="tid"]');
      if (el.dataset.pk === 'navn') p.name = el.value;
      if (el.dataset.pk === 'type') {
        var ty = el.value;
        p.mode = ty === 'til' ? 'countdown' : ty;
        if (ty === 'til') { p.countTo = p.countTo || { h: 12, m: 0, s: 0 }; tid.value = K.klokkeslettTekst(p.countTo); tid.placeholder = 'hh:mm'; }
        else { p.countTo = null; tid.placeholder = 'mm:ss'; tid.value = ty === 'countdown' ? tidTekst(p.duration) : ''; }
        tid.disabled = ty === 'countup' || ty === 'clock';
      }
      if (el.dataset.pk === 'tid' && ferdig) {
        if (p.countTo) { var kk = K.lesKlokkeslett(el.value); if (kk) p.countTo = kk; el.value = K.klokkeslettTekst(p.countTo); }
        else { var ss = K.lesTid(el.value); if (ss != null) p.duration = ss; el.value = tidTekst(p.duration); }
      }
      lagre(); if (ferdig || el.dataset.pk === 'navn') tegnAlt();
    }
  }

  innh.addEventListener('click', function (e) {
    var b = e.target.closest('button');
    if (!b) return;
    var side = innh.dataset.side, i = side === 't0' ? 0 : side === 't1' ? 1 : -1;
    var segEl = b.closest('[data-seg]');
    if (segEl) {
      var v = b.dataset.v, navn = segEl.dataset.seg;
      if (navn === 'modus') endre(function (s) { K.settModus(s.timers[i], v); });
      if (navn === 'oppsett') endre(function (s) { s.layout = v; });
      if (navn === 'kptimer') endre(function (s) { K.settKjoreplanTimer(s, +v); });
      tegnInnst(); return;
    }
    var h = b.dataset.handling;
    if (h === 'standardfarger') { endre(function (s) { s.timers[i].colors = K.kopi(K.STANDARDFARGER); }); tegnInnst(); }
    else if (h === 'logo') $('velgLogo').click();
    else if (h === 'haptlogo') { endre(function (s, na) { s.logo = null; s.outputSince = na; }); tegnInnst(); }
    else if (h === 'skjermer') {
      var svarEl = innh.querySelector('[data-svar="skjermer"]');
      if (!window.getScreenDetails) { svarEl.textContent = 'Denne nettleseren kan ikke se skjermene. Dra scenevinduet dit det skal.'; return; }
      window.getScreenDetails().then(function (d) { svarEl.textContent = 'Fant ' + d.screens.length + ' skjerm' + (d.screens.length === 1 ? '' : 'er') + '. «Åpne scene» legger den på ' + (d.screens.length > 1 ? 'den andre skjermen.' : 'denne skjermen.'); })
        .catch(function () { svarEl.textContent = 'Fikk ikke tilgang. Dra scenevinduet dit det skal.'; });
    }
    else if (h === 'nypreset') { endre(function (s) { s.presets.push(K.nyPreset('Ny preset', 300)); }); tegnInnst(); var siste = innh.querySelectorAll('[data-pk="navn"]'); if (siste.length) { siste[siste.length - 1].focus(); siste[siste.length - 1].select(); } }
    else if (h === 'importer') $('velgKp').click();
    else if (h === 'fjernkp') { endre(function (s) { K.fjernKjoreplan(s); }); valgtPunkt = null; tegnInnst(); }
    else if (h === 'lagrefil') lagreFil();
    else if (h === 'apnefil') $('velgShow').click();
    else if (h === 'nullstill') {
      if (b.dataset.sikker) { show = K.nyttShow(); lagre(); tegnAlt(); tegnInnst(); }
      else { b.dataset.sikker = '1'; b.textContent = 'Trykk igjen for å nullstille'; b.classList.add('gronn'); b.style.background = 'var(--danger)'; }
    }
    var rad = b.closest('[data-p]');
    if (rad) {
      var pi = +rad.dataset.p;
      if (b.dataset.pflytt) {
        var til = pi + +b.dataset.pflytt;
        endre(function (s) {
          var p = s.presets.splice(pi, 1)[0]; s.presets.splice(til, 0, p);
          s.timers.forEach(function (t) { if (t.activePreset === pi) t.activePreset = til; else if (t.activePreset === til) t.activePreset = pi; });
        });
        tegnInnst();
      }
      if (b.dataset.pfjern != null) { endre(function (s) { K.fjernPreset(s, pi); }); tegnInnst(); }
    }
  });

  // ---------- Filer ----------
  function inflate(bytes) {
    return new Response(new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer().then(function (b) { return new Uint8Array(b); });
  }
  $('velgKp').addEventListener('change', async function () {
    var f = this.files[0]; this.value = '';
    if (!f) return;
    var navn = f.name.replace(/\.[^.]+$/, ''), ext = (f.name.match(/\.([^.]+)$/) || [])[1];
    ext = (ext || '').toLowerCase();
    try {
      var ark, kilde;
      if (ext === 'xlsx') {
        if (typeof DecompressionStream === 'undefined') throw new Error('Nettleseren er for gammel til å lese Excel-filer. Lagre som CSV, eller bruk en nyere nettleser.');
        ark = await K.lesXlsx(new Uint8Array(await f.arrayBuffer()), inflate); kilde = 'Excel';
      } else if (ext === 'csv' || ext === 'txt') {
        var bytes = new Uint8Array(await f.arrayBuffer()), tekst;
        try { tekst = new TextDecoder('utf-8', { fatal: true }).decode(bytes); } catch (e) { tekst = new TextDecoder('windows-1252').decode(bytes); }
        ark = [K.lesCsv(tekst, navn)]; kilde = 'CSV';
      } else throw new Error('Kan lese .xlsx (Excel, Shoflo) og .csv, ikke .' + ext);
      var kp = K.lagKjoreplan(ark, navn, kilde);
      if (show.rundown) { kp.timer = show.rundown.timer; kp.shortestRun = show.rundown.shortestRun; }
      endre(function (s) { K.lastKjoreplan(s, kp); });
      valgtPunkt = null; visPresets[kp.timer] = false;
      innstSide = 'kp'; tegnInnst();
    } catch (e) {
      innstSide = 'kp'; tegnInnst(); feilmelding('kp', e.message || String(e));
    }
  });
  function lagreFil() {
    var d = new Date(), dato = d.getFullYear() + '-' + ('0' + (d.getMonth() + 1)).slice(-2) + '-' + ('0' + d.getDate()).slice(-2);
    var a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([JSON.stringify(show, null, 1)], { type: 'application/json' }));
    a.download = 'hapt-o-clock-' + dato + '.json';
    document.body.appendChild(a); a.click(); a.remove();
  }
  $('velgShow').addEventListener('change', async function () {
    var f = this.files[0]; this.value = '';
    if (!f) return;
    try {
      var data = JSON.parse(await f.text());
      if (!data || !Array.isArray(data.timers)) throw new Error('Filen er ikke et show fra hapt-o-clock på nett.');
      show = K.rens(data);
      // Et åpnet show starter i standby med klokka på utgangen, som i appen
      show.timers.forEach(function (t) { if (t.phase === 'running') K.pause(t, Date.now()); });
      show.output = 'clock';
      lagre(); tegnAlt(); tegnInnst();
    } catch (e) { feilmelding('fil', e.message || 'Klarte ikke lese filen.'); }
  });
  $('velgLogo').addEventListener('change', function () {
    var f = this.files[0]; this.value = '';
    if (!f) return;
    if (f.size > 2.5e6) { feilmelding('logo', 'Bildet er for stort (over 2,5 MB). Bruk et mindre bilde.'); return; }
    var r = new FileReader();
    r.onload = function () { endre(function (s, na) { s.logo = r.result; s.outputSince = na; }); tegnInnst(); if (lagreFeil) feilmelding('logo', 'Bildet fikk ikke plass i nettleserens lagring. Det vises nå, men er borte neste gang siden åpnes.'); };
    r.readAsDataURL(f);
  });

  // ---------- Start ----------
  // Andre vinduer med operatoren (en fane til) holder seg oppdatert
  window.addEventListener('storage', function (e) { if (e.key === NOKKEL && e.newValue) { try { show = K.rens(JSON.parse(e.newValue)); tegnAlt(); } catch (x) {} } });
  byggTimere();
  tegnAlt();
  lagre();
  requestAnimationFrame(ramme);
})();
