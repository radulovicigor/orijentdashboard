# Orijent — klijentski dashboard

Izvještaj o Meta reklamama i Shopify prodaji koji Vuk (agencija) šalje klijentu
Orijent (orijentalna parfimerija, Podgorica, orijent.me). Klijent otvori URL,
unese lozinku jednom, i vidi statičan izvještaj — bez menija, bez podešavanja.

**Publika je klijent, ne marketar.** Svaka metrika ima objašnjenje na hover ili
u Pojmovniku na dnu. Jezik je crnogorski (ijekavica), valuta EUR, format brojeva
`sr-Latn-ME` (1.234,56 €).

---

## Stack

| | |
|---|---|
| Next.js | 15.5.25, App Router, React Server Components |
| React | 19.1.9 |
| TypeScript | 5.9.2 |
| Grafikoni | Recharts 2.15.4 |
| Hosting | Vercel, tim `Radule`, projekat `orijent-dashboard`, region `fra1` |
| Produkcija | https://orijent-dashboard-radule.vercel.app |
| Repo | https://github.com/radulovicigor/orijentdashboard (grana `main`) |

`export const revalidate = 900` na `app/page.tsx` — stranica se keširа 15 minuta.

Fontovi se učitavaju preko `<link>` na Google Fonts u `app/layout.tsx`
(Cormorant Garamond + Inter). **Ne koristiti `next/font`** — build na Vercelu
ne može uvijek da dohvati fontove i pada.

---

## Odakle dolaze podaci

Ovo je najvažniji dio za razumjeti — nije standardna postavka.

### Meta reklame → uživo sa Graph API-ja

Klijent je verifikovao Meta nalog i napravio System User token (od 20.9.2026).
`lib/meta.ts` zove Graph API direktno, bez posrednika:

- `META_ACCESS_TOKEN` — System User token, scope `ads_read`, **bez isteka**
  (`expires_at: 0`, `data_access_expires_at: 0` — provjereno preko `/debug_token`).
- `META_AD_ACCOUNT_ID` = `976499834476142`, `META_API_VERSION` = `v23.0`.
- Dnevni redovi (`level=account|campaign|ad`, `time_increment=1`) za spend/
  impresije/klikove/akcije (link click, landing page view, add to cart,
  initiate checkout, purchase) — sabiraju se po danu, isto kao ranije.
- `reach`/`frequency` se čitaju **posebnim pozivom bez `time_increment`** za
  tačno traženi period — Graph API vraća pravi jedinstveni doseg za bilo koji
  opseg, pa je `reachKnown` sad uvijek `true` (nema više "poklapanja sa
  snimkom" — to je bio Supabase problem, direktan API ga nema).
- Breakdown-ovi (starost/pol, platforma+pozicija, grad) se čitaju uživo preko
  `breakdowns=` parametra za tačno izabrani period — `breakdownPeriod` je
  uvijek isti kao `since`/`until` iz filtera, ne kasni za njim.
- `objective`/`status`/`daily_budget` dolaze sa `/campaigns` i `/ads`
  endpoint-a (nisu dio insights-a). **`daily_budget` je u centima** — dijeli
  se sa 100.
- "Rezultati" po kampanji: `OBJECTIVE_RESULT` mapira cilj kampanje (npr.
  `OUTCOME_SALES`) na odgovarajuću metriku (purchases/landingPageViews/
  linkClicks). Za `OUTCOME_AWARENESS`/`BRAND_AWARENESS`/`REACH` ostaje `—`
  (dnevni doseg se i dalje ne može sabirati kroz kampanju na ovaj način).
- **Pažnja na `previousRange()`**: kad prethodnog perioda nema, vraća
  sentinel `"2000-01-01"`. Taj datum se **nikad** ne šalje Meti (Graph API
  baca grešku #3018 — opseg stariji od ~37 mjeseci); `fetchSince` u
  `lib/meta.ts` to eksplicitno provjerava protiv `MIN_DATE`.

Supabase (`czdtlmimtilvvtsytqpx`, tabele `meta_daily`/`meta_snapshot`) i
zakazani dnevni sync preko Meta Ads MCP konektora **više se ne koriste** za
ovaj izvještaj — to je bio privremeni zaobilazni put dok klijent nije imao
token. Sync zadatak se može ugasiti (provjeri kod korisnika da li postoji
i da li je vezan za nešto drugo prije brisanja).

### Shopify → uživo

`lib/shopify.ts`, Admin GraphQL API `2026-07`. Autentikacija ide na
`client_credentials` grant (`POST /admin/oauth/access_token`, token traje 24h,
keširan u memoriji), sa fallbackom na `SHOPIFY_ACCESS_TOKEN` (`shpat_`).

`ordersQuery(withCustomer, withJourney)` ima **tri varijante** i pada unazad:
ako prodavnica nema odobren pristup zaštićenim podacima o kupcima,
`customerJourneySummary` i `customer` se izbacuju iz upita. Ne uklanjati taj
fallback — bez njega cijela sekcija Prodavnica pukne na nekim prodavnicama.

### Kad ključeva nema

`lib/data.ts` → `loadDashboard()` vrti `Promise.allSettled` nad oba izvora.
Svaki izvor može pasti nezavisno; greška se prikaže kao baner na vrhu, a ostatak
izvještaja se i dalje renderuje. Bez ijednog ključa prikazuje se demo
(`lib/demo.ts`). `?demo=1` uvijek forsira demo — **koristi to za rad na dizajnu.**

---

## Pravila koja se ne krše

### Podaci od 1. septembra 2026.

`lib/range.ts` → `MIN_DATE = "2026-09-01"`. Agencija je preuzela marketing tog
datuma, pa sve prije toga ne postoji za ovaj izvještaj. `resolveRange()` reže
`since` na `MIN_DATE`. `previousRange()` vraća prazan opseg (`2000-01-01`) kad
cijeli prethodni period pada prije `MIN_DATE` — zato se poređenja ("▲ 12%") u
tom slučaju uopšte ne prikazuju. Provjera je `hasPrev` u `app/page.tsx`.

### Kampanje hronološki

`lib/meta.ts` sortira kampanje po `firstDate`, pa po `lastDate` — ne po potrošnji.
Klijent čita izvještaj kao priču: šta smo radili prvo, šta poslije.

### Tajne nikad u kodu

Nijedan ključ ne ide u izvor niti u deploy payload. Sve kroz `process.env.*`,
sa `.trim()` (Vercel zna da ostavi razmak pri copy-paste). Ako se ključ nađe u
fajlu, deploy će biti odbijen.

### Grafikoni

Pravila iz `dataviz` skilla, ono što je bitno zadržati:

- **Nikad dvije y-ose.** Prihod i potrošnja su zato dva odvojena grafikona
  koja dijele `syncId="dan"` — hover na jednom pomjera oba.
- Paleta serija: `#ad8838` (zlatna) i `#7c8fd9` (plava). Ove dvije su
  validirane na tamnoj podlozi (kontrast, daltonizam, ΔE ≥ 8). Ako mijenjaš
  boje serija, provjeri ih prije nego što ih ostaviš.
- Legenda uvijek kad ima ≥ 2 serije. Mreža i ose recesivne.
- Ljevak („Put do kupovine") je na **logaritamskoj skali** — na linearnoj se
  donji koraci (2 kupovine vs 287k impresija) ne vide uopšte.

---

## Struktura

```
app/
  page.tsx            cijeli izvještaj (jedna strana, server component)
  layout.tsx          fontovi, <html lang="sr-Latn-ME">
  globals.css         cio dizajn sistem — nema CSS modula, nema Tailwinda
  login/page.tsx      forma za lozinku
  api/login|logout    postavljanje/brisanje kolačića
  icon.png            favicon (amblem iz logotipa)
components/
  ui.tsx              Metric, Delta, Bars, Status, Panel, SectionHead
  Charts.tsx          RevenueSpendChart, TrafficChart, AgeGenderChart, OrdersChart
lib/
  range.ts            opsezi datuma + MIN_DATE
  meta.ts             Graph API uživo + labele (objective, rezultat, platforma, grad)
  shopify.ts          Admin GraphQL, agregacije po danu/proizvodu/izvoru
  data.ts             loadDashboard() — spaja oba izvora
  format.ts           eur, num, pct, dec, roas, safeDiv
  demo.ts             izmišljeni podaci
  types.ts
middleware.ts         kapija sa lozinkom
public/
  logo.png            logo klijenta (357×110)
  ornament.png        amblem iz logotipa, za dekoraciju
```

---

## Poznate zamke

- **Logo se rastegne.** `.title-block` je flex kolona; `align-items` je podrazumijevano
  `stretch`, pa se `<img class="logo">` sa `width:auto` razvuče na punu širinu
  kontejnera dok mu je visina fiksirana. Rješenje: `align-self: flex-start`
  (ili `width: fit-content`). `width:auto` sam po sebi **ne** pomaže.
- **Meta piksel na orijent.me ne bilježi sve kupovine.** Zato `pixelHasSales`
  u `app/page.tsx` uslovno sakriva Meta-ROAS i korake ljevka koji zavise od piksela.
  Mjerodavna prodaja je Shopify. Ne prikazivati Meta ROAS kao glavnu metriku.
- **Deploy ide preko GitHub-a** (`radulovicigor/orijentdashboard`, grana `main`).
  `git push`, pa `create_deployment` sa `gitSource` (org/repo/ref/sha) —
  Vercel sam povuče repo, brzo je (~40s build). Ne vraćati se na ručno slanje
  fajlova kroz MCP (`files` sa base64) — radi, ali je sporo i lomljivo za
  ovoliko fajlova; probano i napušteno.
- **Deployment Protection**: `ssoProtection` je ograničen na `preview`, da bi
  produkcijski URL bio javan (lozinka u aplikaciji je ta koja čuva pristup).
- Cormorant Garamond ima prave glifove za č/ć/š/ž, ali su akcenti visoko
  postavljeni i na velikim veličinama izgledaju odvojeno. Nije bug fonta —
  provjereno, glif postoji i latin-ext se učitava.

---

## Rad na dizajnu

```bash
npm install
npm run dev
# pa otvori http://localhost:3000/?demo=1
```

Demo mod ne traži nijedan ključ i daje pune podatke u svim sekcijama, uključujući
one koje bi na produkciji bile prazne.

Za deploy: `git push` na `main` (repo je `radulovicigor/orijentdashboard`).
Environment varijable su već postavljene na Vercelu — ne treba ih ponovo
unositi, samo ne brisati.

---

## Šta bi sljedeće moglo

- Piksel na orijent.me djelimično radi (šalje ViewContent, AddToCart i
  Purchase se povremeno vide — provjeri da li je stabilno prije nego što
  `pixelHasSales` postane trajno pouzdan signal).
- Ugasiti stari dnevni sync zadatak (Meta Ads MCP → Supabase) ako i dalje
  postoji — više ništa ne čita iz `meta_daily`/`meta_snapshot`.
- Trajno povezati Vercel projekat na GitHub repo (Project Settings → Git) da
  svaki `git push` sam pokrene deploy, bez ručnog `create_deployment` poziva.
