// PIN-kode foran verktøyene. Sjekkes i nettleseren og huskes på enheten etter første gang.
// Dette holder tilfeldige besøkende ute fra sidene, men er ingen ekte lås: koden til verktøyene
// ligger åpent på GitHub. Ny kode: regn ut sjekk('hapt-verktoy:' + kode) og bytt ut FASIT.
(function () {
  var FASIT = 'otm20prqay', NOKKEL = 'hapt-pin';
  var rot = document.documentElement;

  // cyrb53: liten, rask tekst-hash (ikke kryptografisk, og trenger det ikke her)
  function sjekk(s) {
    var h1 = 0xdeadbeef, h2 = 0x41c6ce57;
    for (var i = 0, c; i < s.length; i++) {
      c = s.charCodeAt(i);
      h1 = Math.imul(h1 ^ c, 2654435761); h2 = Math.imul(h2 ^ c, 1597334677);
    }
    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);
    return (4294967296 * (2097151 & h2) + (h1 >>> 0)).toString(36);
  }
  function husket() {
    try { if (localStorage.getItem(NOKKEL) === FASIT) return true; } catch (e) {}
    try { if (sessionStorage.getItem(NOKKEL) === FASIT) return true; } catch (e) {}
    return false;
  }
  if (husket()) return;

  // Skjul siden før den tegnes, så innholdet ikke blinker forbi
  rot.classList.add('laast');

  document.addEventListener('DOMContentLoaded', function () {
    var topp = document.querySelector('header.site');
    var mork = topp && topp.querySelector('.logo-mork'), lys = topp && topp.querySelector('.logo-lys');
    var t = window.HaptSprak ? HaptSprak.t : function (no) { return no; };
    var boks = document.createElement('div');
    boks.className = 'pinlas';
    boks.innerHTML =
      '<form autocomplete="off" novalidate>' +
        '<div class="merke">' +
          (mork ? '<img class="logo-mork" alt="HAPT" src="' + mork.getAttribute('src') + '">' : '<b>HAPT</b>') +
          (lys ? '<img class="logo-lys" alt="" src="' + lys.getAttribute('src') + '">' : '') +
          '<span data-en="tools">verktøy</span>' +
        '</div>' +
        '<label for="pinkode" data-en="PIN code">PIN-kode</label>' +
        '<input id="pinkode" type="password" inputmode="numeric" autocomplete="off" enterkeyhint="go" maxlength="20">' +
        '<p class="pinfeil" aria-live="polite"></p>' +
        '<button class="btn" type="submit" data-en="Unlock">Lås opp</button>' +
      '</form>';
    document.body.appendChild(boks);
    if (window.HaptSprak) HaptSprak.bruk(boks);
    var felt = boks.querySelector('input'), feil = boks.querySelector('.pinfeil');
    felt.focus();
    felt.addEventListener('input', function () { feil.textContent = ''; felt.removeAttribute('aria-invalid'); });
    boks.querySelector('form').addEventListener('submit', function (ev) {
      ev.preventDefault();
      // Godta mellomrom og +47 eller 0047 foran, slik telefonnumre ofte skrives
      var kode = felt.value.replace(/\D/g, '');
      if (kode.length === 12 && kode.indexOf('0047') === 0) kode = kode.slice(4);
      if (kode.length === 10 && kode.indexOf('47') === 0) kode = kode.slice(2);
      if (sjekk('hapt-verktoy:' + kode) === FASIT) {
        try { localStorage.setItem(NOKKEL, FASIT); } catch (e) { try { sessionStorage.setItem(NOKKEL, FASIT); } catch (e2) {} }
        boks.remove();
        rot.classList.remove('laast');
        if (window.haptMidtstillFane) window.haptMidtstillFane();
      } else {
        feil.textContent = t('Feil kode. Prøv igjen.', 'Wrong code. Try again.');
        felt.setAttribute('aria-invalid', 'true');
        felt.select();
      }
    });
  });
})();
