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

### Meta reklame → preko Supabase, ne direktno

Klijent **nema** radan Meta API token. Kratko (20-24.9.2026) je postojao
direktan Graph API pristup preko System User tokena (`ads_read`, bez isteka),
ali je Meta blokirala pristup tražeći ličnu verifikaciju identiteta
("API access blocked", OAuthException code 200), a SMS kod za tu verifikaciju
**Meta ne isporučuje na crnogorske brojeve** — ni klijentu ni drugom
adminu na Business Manager nalogu. Nema alternative (poziv, WhatsApp, ID
upload) ponuđene na tom ekranu. Ćorsokak dok Meta to ne popravi na svojoj
strani; ne gubiti vrijeme ponovo na to bez novog signala od klijenta.

Zato:

1. Zakazani zadatak jednom dnevno (~06:00-06:20 po Podgorici, provjereno
   preko `meta_snapshot.sync.last_sync`) čita Meta Ads podatke preko Meta
   Ads MCP konektora (`mcp__c7...__ads_*` alati) — to je odvojena
   autentikacija od developer app/System User tokena i **nije pogođena**
   blokom identiteta (provjereno: `ads_get_ad_accounts` i dalje vidi
   `Orijent`, `act_976499834476142`, `is_queryable: true`). Taj sync ne
   živi u ovoj Claude Code sesiji (`list_scheduled_tasks` ovdje ga ne vidi),
   pa ga ne restartovati/brisati odavde bez provjere kod korisnika.
2. Upisuje ih u Supabase, projekat `czdtlmimtilvvtsytqpx`:
   - `public.meta_daily` — jedan red po (kind, date, entity_id);
     `kind` je `account` | `campaign` | `ad`. PK je (kind, date, entity_id).
   - `public.meta_snapshot` — `key` + `data jsonb`; drži breakdown-ove
     (starost/pol, platforme, pozicije, gradovi) i `reach` za konkretan period.
3. `lib/meta.ts` čita iz Supabase preko PostgREST-a, sa headerom
   `apikey: <publishable key>`. RLS je uključen, anon ima samo SELECT.

Posljedica: `lib/meta.ts` **nikad ne zove Metu.** Ako treba svježiji podatak,
mijenja se sync, ne app.

`reach` se ne može sabirati po danima (isti ljudi se ponavljaju). Zato se uzima
iz snapshot-a samo kad se `since`/`until` tačno poklapaju sa snimljenim periodom —
`m.reachKnown` govori da li smije da se prikaže. Ako ne, prikazuje se `—`.

`MetaCampaign` ima i `daily` (dnevna potrošnja te kampanje) i `ads` (sve
reklame te kampanje, ne samo top 12) — koristi ih "Detalji po kampanji" na
stranici. Oboje se izvode iz istih `meta_daily` redova koje `loadRows()` već
čita (grupisano po `entity_id`/`parent_name`), nema dodatnih poziva.

**Direktan Graph API kod (`META_ACCESS_TOKEN`/`META_AD_ACCOUNT_ID`/
`META_API_VERSION`, `daily_budget` u centima, `OBJECTIVE_RESULT` mapiranje)
postoji u git istoriji** (commit `49f443e` i `6632fc9` prije revert-a) — ako
klijent ikad riješi verifikaciju, taj kod se može vratiti umjesto ponovnog
pisanja. Env varijable su i dalje na Vercelu (nekorišćene, bezopasno ih
ostaviti).

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
  meta.ts             čitanje iz Supabase + labele (objective, rezultat, platforma, grad)
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
- Meta traži ličnu verifikaciju identiteta za direktan Graph API pristup, a
  SMS kod ne stiže na crnogorske brojeve (ni klijentu ni drugom adminu, bez
  ponuđene alternative). Dok se to ne riješi na Meta strani, ostati na
  Supabase sync-u — ne dirati dnevni zadatak, on radi dobro.
- Trajno povezati Vercel projekat na GitHub repo (Project Settings → Git) da
  svaki `git push` sam pokrene deploy, bez ručnog `create_deployment` poziva.
