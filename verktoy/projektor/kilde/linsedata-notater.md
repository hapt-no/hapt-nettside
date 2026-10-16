# Linsedata – notater (generert 2026-10-15)

Fil: `linsedata.json`. Struktur: `{"_meta", "projektorer", "linser", "kilder"}`. Alle kilde-ID-er i `kilder`/`kilde`-feltene peker til `kilder[]` (URL).

## Formel og enheter
- Alle avstandsformler er regnet om til **L [m] = a · W [m] + b**, der W er bildebredde. `a` = effektiv kaststigning, `b` = offset i meter.
- Originalformelen er lagret under `formel.original` (Epson: cm = c·x + d, x = diagonal i tommer; Panasonic: m = c·SD + d, SD i tommer eller meter).
- Bredde per tomme diagonal: 16:10 = 0,021539 m, 16:9 = 0,022138 m.
- **Viktig:** Kastforholdet Epson og Panasonic skriver i spesifikasjonene er L/W ved ca. 100" *med* offset. Selve stigningen `a` er 1–3 % høyere, og `b` er negativ (typisk −3 til −39 cm). Sjekk: ELPLM15 på PU2200 → 1,6017·2,154 − 0,082 = 3,37 m ved 100", som stemmer med Epson-tabellen (337 cm). Oppgitt kastforhold er 1,57, men ren 1,57·W gir 3,38 m ved 100" og 0,6 m for kort ved 1000" (ELPLL08 tele: ca. 2,2 m for kort ved 1000"). Kalkulatoren bør bruke a og b, ikke kastforholdet.

## Hvor måles avstanden fra?
| Merke | Referanse | Status |
|---|---|---|
| Panasonic (3-chip ET-D75LE/D3LE og 1-chip ET-C1) | **Linsens front** ("distance from the front end of the projection lens to the screen") | Bekreftet (RQ35K-manual, ET-C1-spec) |
| Panasonic ET-D75LE95 (speil-UST) | **Speilets reflekterende flate.** Linsespiss = L1+0,029 m, kabinettfront = L1−0,292 m, bakkant = L1−1,072 m | Bekreftet |
| Panasonic: omregning til kabinettfront | L_front = L + L1 (linsefremspring, `linsefremspring_L1_m`) | Bekreftet for listede linser |
| Epson | Ikke oppgitt i tekst. Formlene er identiske på PU2010 (436 mm dypt kabinett) og PU2200 (492 mm) selv om fremspringet er ulikt, så referansen sitter på linsen, mest sannsynlig i linsefront. | **Utledet, ikke bekreftet** |
| Epson ELPLX01/X02/ELPLR04 (fold/speil) | Ukjent | Mål fysisk |
| Barco | Ikke oppgitt i dagens dokumentasjon. Barco viser til lens calculator (±5 %). Et eldre Barco TLD-dokument (2006) målte fra kabinettfront/linsering. Barco publiserer ingen offset, så `b = null`. | Ukjent |

Epsons kalkulator gir sannsynligvis samme tabellverdier. Avvikene brukeren ser kan komme av (1) at man regner med det avrundede kastforholdet i stedet for a/b, (2) at man måler fra kabinettfront: legg til Epsons "Amount of Lens Protrusion" (`fremspring_fra_kabinettfront_mm`), som er opptil 117 mm, (3) at Epson selv oppgir ±5 % toleranse.

## Usikkerheter (verdier satt til null eller merket)
- **Epson-fremspring:** Samme linse har ulikt fremspring i ulike spec-ark (ELPLM15: 26 mm på PU2200, −3,8 mm på L17xx med samme 586×185×492-kabinett, 53 mm på PU2010). Enten ulik målepraksis eller feil i et av arkene. Bør måles.
- **Epson PU1007 lens-kompatibilitet:** Tabellen ble feiltolket ved uttrekk. PU1007 er antatt lik PU1008, fordi ELPLM08 er standardlinse.
- **Epson PQ2200:** Spec-arket oppgir 1920×1080-paneler (4K via pikselskift) på 1,04". Vekten (28,8/29,2 kg) kunne ikke kobles sikkert til modell, så den er satt til null. ELPLX02-kompatibilitet per modell er usikker.
- **Epson ELPLX02-shift:** Bare figur i arket. L17xx-arket gir +20/−5 % V og ca. 15 % H.
- **Epson ELPLM12/ELPLX03 osv.:** Hører til EB-L20000U/L25000U/L30000U og passer ikke PU/L1000. Ikke kartlagt.
- **Panasonic ET-D75LE-formler** er hentet fra PT-RZ31K-spec (16:10). RZ21K-spec ga tall som stemmer nøyaktig hvis de er 16:9-koeffisienter (faktor 1,028), men det er min tolkning. RQ35K/RZ34K/RZ21K har samme 0,96"-DMD og står i samme gruppe i Panasonics linse-specs.
- **Panasonic ET-D3LEW200:** Koeffisientene passer bedre med 16:9 enn med 16:10 (ca. 3,5 % forskjell). Merket `estimert`.
- **Panasonic "ET-D75LE100"** finnes ikke hos Panasonic. Jeg antok at det betyr ET-D3LEU100/101 (0,37 UST). Formelen gir 0,355 ved 100" mot oppgitt 0,370 og kan være feillest. Merket `estimert`.
- **Panasonic ET-D75LE90:** Ingen formel funnet. Den er erstattet av LE95.
- **Panasonic RQ22K/RQ32K (WQXGA):** Ingen ET-D75LE-formler funnet, bare LE95 og D3LEW300. DMD ca. 0,9" er utledet. Vekten er ikke funnet.
- **Panasonic ET-C1W400/W500/T800:** Bare kastforhold, ingen formel.
- **Panasonic PT-MZ (LCD, ET-EM-linser):** Ikke dekket, fordi den er lite brukt i utleie for store venues. Kan legges til.
- **Barco shift per linse** publiseres ikke. Bare prosjektornivå er oppgitt ("avhengig av linse"). Barcos prosentdefinisjon er ikke bekreftet. HDX-tall per linse for faste linser er forhandlerdata (Audio General).
- **Barco TLD+ kastforhold:** Barcos egne sider er inkonsistente (f.eks. 1,87–2,56 og 1,89–2,55 for samme linse). JSON bruker tallene i UDX-produktsidens tilbehørsliste for WU, WQ og 0,98", med avvik i `merknad`.
- **Barco G-linser** fra brukerens liste (1,52–2,03, 2,0–4,0, 3,9–7,8) finnes ikke i dagens G62-manual. Der er det 1,52–2,92 og 2,90–5,50. 2,0–4,0 er en GC-linse for G100.
- **Barco GC 0,65–0,75, 4,0–7,2 og 7,2–10,8:** Delenummer er ikke funnet.
- **Barco G62:** DMD-størrelse er ikke oppgitt.
- **XLD 5,5–8,5** (HDQ-2K40) er ikke tatt med, fordi den ikke passer UDX/HDX.

## Anbefaling til kalkulatoren
1. Bruk a og b per linse og projektorfamilie. Vis hvilket referansepunkt avstanden gjelder (linsefront, kabinettfront eller speil).
2. La brukeren velge "fra linsefront" eller "fra kabinettfront" og legg til fremspringet.
3. For Barco: bruk kastforhold × bredde. Marker at offset er ukjent, og tilby en manuell korreksjon i mm.
4. Vis ±5 % toleranse, som alle tre produsentene oppgir.
