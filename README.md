# hapt.no

Nettsiden til HAPT AS. Én statisk side (`index.html`) publisert med GitHub Pages på hapt.no.

- `fonts/` – Barlow (SIL Open Font License, se `fonts/OFL.txt`)
- `CNAME` – eget domene for GitHub Pages
- `verktoy/` – interne verktøy på hapt.no/verktoy (LED-vegg, projektor, testbilde, pixelmap, syncfilm, opptak, EDID, Stumpfl Vario, hapt-o-clock). Ikke lenket fra forsiden, merket noindex og bak en enkel PIN-kode (`verktoy/las.js`, sjekkes i nettleseren, så den holder bare tilfeldige besøkende ute). Alt regnes ut i nettleseren.
- `tid/` – hapt.no/tid videresender til nettvisningen i hapt-o-clock (Mac-appen) via Tailscale Funnel, for publikum/kunder uten innlogging. Adressen i `tid/index.html` endres hvis showet kjøres fra en annen Mac. Merket noindex, ikke lenket fra forsiden.
