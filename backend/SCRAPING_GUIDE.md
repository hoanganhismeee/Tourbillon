# Tourbillon Watch Scraping Guide

**Backend port:** `5248`
**Note:** Use `+` for spaces in brand/collection names (e.g., `Audemars+Piguet`), not `%20`.

---

## Architecture Overview

Three scraping approaches:

| Method | Service | Endpoint | When to Use |
|--------|---------|----------|-------------|
| **Sitemap + Claude AI** | `SitemapScraperService.cs` | `scrape-sitemap` | Brands with accessible sitemaps (most brands) |
| **Listing Page + Claude AI** | `SitemapScraperService.cs` | `scrape-listing` | Brands that block sitemaps (Rolex, Omega, ALS, Blancpain) |
| **Legacy XPath** | `BrandScraperService.cs` | `scrape-brand-official` | Brands 1-5 with existing XPath config (PP, VC, AP, JLC, ALS) |

### Sitemap + Claude AI Pipeline (Primary)
```
Brand Sitemap XML
  -> Selenium fetches sitemap (bypasses bot protection)
  -> Extract watch product URLs from <url><loc> elements
  -> Filter out non-English URLs (/zh/, /cn/, /jp/, /ja/, /kr/, /ko/, /ar/, /ru/)
  -> Pre-filter URLs by collection slug (saves API cost)
  -> For each URL:
      -> Selenium loads full page (handles JS rendering)
      -> HTML preprocessed (strip scripts/styles/SVGs ~300KB -> ~20-30KB)
      -> Claude Haiku API extracts structured JSON
      -> Image uploaded to Cloudinary
      -> Watch saved to DB via WatchCacheService
```

### Listing Page + Claude AI Pipeline (For blocked sitemaps)
```
Brand listing/catalog page URL
  -> Selenium loads page, scrolls to trigger lazy loading
  -> Extract <a> tags, filter for product URLs by pattern
  -> If 0 found: fallback to Claude API to extract URLs from page HTML
  -> For each product URL:
      -> Same as sitemap pipeline (Selenium -> Claude -> Cloudinary -> DB)
```

### Legacy XPath Pipeline
```
Brand Config JSON (XPath selectors per brand)
  -> Selenium loads collection listing page
  -> Extract watch cards via XPath selectors
  -> Navigate to each detail page
  -> Extract specs via per-section XPath selectors
  -> Image uploaded to Cloudinary
  -> Watch saved to DB via WatchCacheService
```

**Note:** Legacy XPath is BROKEN for PP, VC, JLC as of March 2026 (websites changed HTML structure). Use sitemap+Claude instead. AP legacy still works.

## Development Environment Rules

**Terminal Optimization**: Always maintain a maximum of 3 active terminals to preserve context tokens and reduce memory waste. Close/terminate shell instances that are no longer actively executing processes. Reuse an existing terminal (like the backend window if no longer needed) before spinning up a new one.

---

## Watch Naming Convention

Card display follows this pattern:
```
  Collection Label        (small text above)
  {Ref} {Variant}         (main title - bold)
  $Price                  (below)
```

Examples:
- **Calatrava** / **5227G-010 Automatic Date** / $73,200.00
- **Senator** / **1-36-01-02-05-61 Excellence** / $12,800.00
- **Royal Oak** / **15500ST.OO.1220ST.01 Selfwinding** / $29,500.00

How it works in code (`SitemapScraperService.cs`):
- Claude API extracts `watchName` (e.g., "Senator Excellence") and `referenceNumber` (e.g., "1-36-01-02-05-61")
- `ExtractCollectionFromWatchName()` determines collection = "Senator"
- `StripCollectionPrefix()` removes "Senator" from "Senator Excellence" -> "Excellence"
- Duplicate ref stripped from variant, trailing collection names stripped
- Final: `Name = "{Ref} {Variant}"` = "1-36-01-02-05-61 Excellence"
- `Description` = brand name (e.g., "Glashutte Original") for detail page subtitle

---

## Brand Registry

### All 15 Brands & Collections

| ID | Brand | Collections (ID) | Scrape Method | Target |
|----|-------|-------------------|---------------|--------|
| 1 | Patek Philippe | Calatrava(1), Nautilus(2), Aquanaut(3), Grand Complications(4) | Sitemap+Claude | 35 max |
| 2 | Vacheron Constantin | Patrimony(5), Overseas(6), Historiques(7), Métiers d'Art(8), Les Cabinotiers(9) | Sitemap+Claude | 35 max |
| 3 | Audemars Piguet | Royal Oak(10), Royal Oak Offshore(11), Royal Oak Concept(12) | Legacy XPath or Sitemap | 35 max |
| 4 | Jaeger-LeCoultre | Reverso(13), Master Ultra Thin(14), Polaris(15), Duomètre(16) | Sitemap+Claude | 35 max |
| 5 | A. Lange & Söhne | Lange 1(17), Zeitwerk(18), Saxonia(20) | Listing Page+Claude | 35 max |
| 6 | Glashütte Original | Senator(21), PanoMatic(22), SeaQ(23), Spezialist(24) | Sitemap+Claude | 25 max |
| 7 | F.P. Journe | Chronomètre Souverain(25), Octa(26), Tourbillon Souverain(27) | Sitemap+Claude | 25 max |
| 8 | Greubel Forsey | Double Tourbillon 30°(28), Tourbillon 24 Secondes(29), Balancier Convexe(30), QP à Équation(31) | Sitemap+Claude | 25 max |
| 9 | Rolex | Submariner(32), Daytona(33), Datejust(34), GMT-Master II(35), Day-Date(36) | Listing Page+Claude | 25 max |
| 10 | Breguet | Classique(37), Marine(38), Tradition(39), Reine de Naples(40) | Sitemap+Claude | 25 max |
| 11 | Blancpain | Fifty Fathoms(41), Villeret(42), Air Command(43), Ladybird(44) | Listing Page+Claude | 25 max |
| 12 | Omega | Speedmaster(45), Seamaster(46), Constellation(47), De Ville(48) | Listing Page+Claude | 25 max |
| 13 | Grand Seiko | Heritage Collection(49), Evolution 9(50), Elegance Collection(51), Sport Collection(52) | Sitemap+Claude | 25 max |
| 14 | IWC Schaffhausen | Portugieser(53), Pilot's Watches(54), Ingenieur(55), Portofino(56) | Sitemap+Claude | 25 max |
| 15 | Frederique Constant | Classics(57), Slimline(58), Manufacture(59), Highlife(60) | Sitemap+Claude | 25 max |

**Grand Total Target:** ~350-400 watches (35 max brands 1-5, 25 max brands 6-15)

---

## API Endpoints

All on `http://localhost:5248`

### Sitemap Scrape (Universal)
```bash
POST /api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Senator&maxWatches=8
```

### Listing Page Scrape (For blocked sitemaps)
```bash
POST /api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/submariner&collection=Submariner&maxWatches=5
```

### Legacy Brand Scrape (XPath - brands 1-5 only)
```bash
POST /api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak&maxWatches=12
```

### Single URL Scrape (Quick Test)
```bash
POST /api/admin/scrape-url?url=https://www.glashuette-original.com/en/watches/senator/...&brand=Glashutte+Original
```

### Clear Watches Before Re-scraping
```bash
DELETE /api/admin/clear-watches?brandId=6
# No brandId = clear ALL non-showcase watches
DELETE /api/admin/clear-watches
```

### Check Stats
```bash
GET /api/admin/scrape-stats
```

---

## Scrape Commands (Ready to Copy-Paste)

**Important:** Run only 1-2 scrapes at a time. Each scrape opens a Selenium browser instance. Running too many in parallel will overwhelm the backend and cause timeouts. Use `sleep 15` between scrapes.

### Patek Philippe (brandId=1, 35 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Patek+Philippe&sitemapUrl=https://www.patek.com/en/sitemap.xml&collection=Calatrava&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Patek+Philippe&sitemapUrl=https://www.patek.com/en/sitemap.xml&collection=Nautilus&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Patek+Philippe&sitemapUrl=https://www.patek.com/en/sitemap.xml&collection=Aquanaut&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Patek+Philippe&sitemapUrl=https://www.patek.com/en/sitemap.xml&collection=Grand+Complications&maxWatches=8"
```

### Vacheron Constantin (brandId=2, 35 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Vacheron+Constantin&sitemapUrl=https://www.vacheron-constantin.com/en/sitemap.xml&collection=Patrimony&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Vacheron+Constantin&sitemapUrl=https://www.vacheron-constantin.com/en/sitemap.xml&collection=Overseas&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Vacheron+Constantin&sitemapUrl=https://www.vacheron-constantin.com/en/sitemap.xml&collection=Historiques&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Vacheron+Constantin&sitemapUrl=https://www.vacheron-constantin.com/en/sitemap.xml&collection=Traditionnelle&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Vacheron+Constantin&sitemapUrl=https://www.vacheron-constantin.com/en/sitemap.xml&collection=Les+Cabinotiers&maxWatches=7"
```

### Audemars Piguet (brandId=3, 35 max) — Legacy XPath (still works)
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak&maxWatches=14" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak+Offshore&maxWatches=12" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak+Concept&maxWatches=9"
```

### Jaeger-LeCoultre (brandId=4, 35 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Jaeger-LeCoultre&sitemapUrl=https://www.jaeger-lecoultre.com/sitemap.xml&collection=Reverso&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Jaeger-LeCoultre&sitemapUrl=https://www.jaeger-lecoultre.com/sitemap.xml&collection=Master&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Jaeger-LeCoultre&sitemapUrl=https://www.jaeger-lecoultre.com/sitemap.xml&collection=Polaris&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Jaeger-LeCoultre&sitemapUrl=https://www.jaeger-lecoultre.com/sitemap.xml&collection=Duometre&maxWatches=8"
```

### A. Lange & Söhne (brandId=5, 35 max) — Listing Page+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=A.+Lange+%26+Sohne&listingUrl=https://www.alange-soehne.com/en/timepieces/lange-1&collection=Lange+1&maxWatches=12" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=A.+Lange+%26+Sohne&listingUrl=https://www.alange-soehne.com/en/timepieces/zeitwerk&collection=Zeitwerk&maxWatches=8" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=A.+Lange+%26+Sohne&listingUrl=https://www.alange-soehne.com/en/timepieces/saxonia&collection=Saxonia&maxWatches=15"
```

### Glashütte Original (brandId=6, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Senator&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=PanoMatic&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=SeaQ&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Spezialist&maxWatches=6"
```

### F.P. Journe (brandId=7, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=F.P.+Journe&sitemapUrl=https://www.fpjourne.com/sitemap.xml&collection=Chronometre+Souverain&maxWatches=9" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=F.P.+Journe&sitemapUrl=https://www.fpjourne.com/sitemap.xml&collection=Octa&maxWatches=8" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=F.P.+Journe&sitemapUrl=https://www.fpjourne.com/sitemap.xml&collection=Tourbillon+Souverain&maxWatches=8"
```

### Greubel Forsey (brandId=8, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Greubel+Forsey&sitemapUrl=https://www.greubelforsey.com/sitemap.xml&collection=Double+Tourbillon&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Greubel+Forsey&sitemapUrl=https://www.greubelforsey.com/sitemap.xml&collection=Tourbillon+24+Secondes&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Greubel+Forsey&sitemapUrl=https://www.greubelforsey.com/sitemap.xml&collection=Balancier+Convexe&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Greubel+Forsey&sitemapUrl=https://www.greubelforsey.com/sitemap.xml&collection=QP+a+Equation&maxWatches=6"
```

### Rolex (brandId=9, 25 max) — Listing Page+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/submariner&collection=Submariner&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/cosmograph-daytona&collection=Daytona&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/datejust&collection=Datejust&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/gmt-master-ii&collection=GMT-Master+II&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Rolex&listingUrl=https://www.rolex.com/en-us/watches/day-date&collection=Day-Date&maxWatches=5"
```

### Breguet (brandId=10, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Breguet&sitemapUrl=https://www.breguet.com/en/sitemap.xml&collection=Classique&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Breguet&sitemapUrl=https://www.breguet.com/en/sitemap.xml&collection=Marine&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Breguet&sitemapUrl=https://www.breguet.com/en/sitemap.xml&collection=Tradition&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Breguet&sitemapUrl=https://www.breguet.com/en/sitemap.xml&collection=Reine+de+Naples&maxWatches=6"
```

### Blancpain (brandId=11, 25 max) — Listing Page+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Blancpain&listingUrl=https://www.blancpain.com/en/fifty-fathoms&collection=Fifty+Fathoms&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Blancpain&listingUrl=https://www.blancpain.com/en/villeret&collection=Villeret&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Blancpain&listingUrl=https://www.blancpain.com/en/air-command&collection=Air+Command&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Blancpain&listingUrl=https://www.blancpain.com/en/ladybird&collection=Ladybird&maxWatches=6"
```

### Omega (brandId=12, 25 max) — Listing Page+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Omega&listingUrl=https://www.omegawatches.com/en-us/watches/speedmaster&collection=Speedmaster&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Omega&listingUrl=https://www.omegawatches.com/en-us/watches/seamaster&collection=Seamaster&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Omega&listingUrl=https://www.omegawatches.com/en-us/watches/constellation&collection=Constellation&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-listing?brand=Omega&listingUrl=https://www.omegawatches.com/en-us/watches/de-ville&collection=De+Ville&maxWatches=5"
```

### Grand Seiko (brandId=13, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Grand+Seiko&sitemapUrl=https://www.grand-seiko.com/us-en/sitemap.xml&collection=Heritage+Collection&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Grand+Seiko&sitemapUrl=https://www.grand-seiko.com/us-en/sitemap.xml&collection=Evolution+9&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Grand+Seiko&sitemapUrl=https://www.grand-seiko.com/us-en/sitemap.xml&collection=Elegance+Collection&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Grand+Seiko&sitemapUrl=https://www.grand-seiko.com/us-en/sitemap.xml&collection=Sport+Collection&maxWatches=6"
```

### IWC Schaffhausen (brandId=14, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=IWC+Schaffhausen&sitemapUrl=https://www.iwc.com/en/en-sitemap.xml&collection=Portugieser&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=IWC+Schaffhausen&sitemapUrl=https://www.iwc.com/en/en-sitemap.xml&collection=Pilot&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=IWC+Schaffhausen&sitemapUrl=https://www.iwc.com/en/en-sitemap.xml&collection=Ingenieur&maxWatches=5" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=IWC+Schaffhausen&sitemapUrl=https://www.iwc.com/en/en-sitemap.xml&collection=Portofino&maxWatches=6"
```

### Frederique Constant (brandId=15, 25 max) — Sitemap+Claude
```bash
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Frederique+Constant&sitemapUrl=https://frederiqueconstant.com/product-sitemap.xml&collection=Classics&maxWatches=7" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Frederique+Constant&sitemapUrl=https://frederiqueconstant.com/product-sitemap.xml&collection=Slimline&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Frederique+Constant&sitemapUrl=https://frederiqueconstant.com/product-sitemap.xml&collection=Manufacture&maxWatches=6" && sleep 15 && curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=Frederique+Constant&sitemapUrl=https://frederiqueconstant.com/product-sitemap.xml&collection=Highlife&maxWatches=6"
```

---

## Data Model

### Required Fields for Every Watch

Every watch in the database MUST have:

1. **Name** — Reference number (e.g., "6119R-001", "1-36-01-02-05-61 Excellence")
2. **Description** — Brand name or "Brand Collection" subtitle (e.g., "Glashutte Original", "Patek Philippe Calatrava")
3. **Specs** — Structured JSON with movement, case, dial, strap sections (see schema below). **Never leave specs empty.** If the brand website has a specs/specifications section, extract all available data.
4. **Image** — Must be stored in Cloudinary (public_id starting with `watches/`). **Never store external CDN URLs directly.** Download the image and upload to Cloudinary via `CloudinaryService`.
5. **CollectionId** — Must map to an existing collection in the DB. Never leave null.
6. **CurrentPrice** — Decimal value. Use 0 if "Price on request".

### Image Storage Rules

- **All watch images MUST be uploaded to Cloudinary** — never store external URLs (e.g., `https://patek-res.cloudinary.com/...`) directly in the `Image` field
- The Selenium + Claude pipeline already handles this: `SitemapScraperService` downloads the image and uploads via `CloudinaryService`
- Image field stores the Cloudinary `public_id` (e.g., `watches/PatekPhilippe_6119R-001`)
- Frontend resolves Cloudinary URLs via the `getImageUrl()` helper
- If using the manual `add-watches` endpoint, you must upload images to Cloudinary separately first
- **CRITICAL AESTHETIC RULE**: Every scraped image MUST match the visual style and quality of the 9 showcase watches (e.g., IDs 2, 4, 11, 13, 18, 24). They must strictly feature a plain/isolated background, be a straight-on front face view, and contain NO hands, wrists, or lifestyle backgrounds. Do not settle for subpar images; browse the entire internet if needed (e.g., using watchbase, watchfinder, chrono24).

### Structured Specs Schema (JSON in Watch.Specs)

All watches should have specs in this JSON format:
```json
{
  "dial": { "color": "Silver", "finish": "Sunburst", "indices": "Applied gold", "hands": "Dauphine" },
  "case": { "material": "18K Rose Gold", "diameter": "39mm", "thickness": "8.08mm", "waterResistance": "30m", "crystal": "Sapphire", "caseBack": "Sapphire" },
  "movement": { "caliber": "30-255 PS", "type": "Automatic", "powerReserve": "48h", "frequency": "28,800 vph", "jewels": "29", "functions": ["Hours", "Minutes", "Small seconds"] },
  "strap": { "material": "Alligator leather", "color": "Brown", "buckle": "Fold-over clasp" }
}
```
- `movement.type`: normalized to "Automatic", "Manual", or "Quartz"
- `movement.functions`: array of strings (e.g., ["Hours", "Minutes", "Date", "Moon phase"])
- Null for any field not found on the page
- **The Claude API prompt already extracts this format** — specs come from the product detail page HTML
- For brands that show specs in tables (GO, PP, JLC, ALS), Claude parses the table rows into this schema
- If a brand doesn't show specs on their website, leave fields as null but still provide the JSON structure

### 9 Showcase Watches (Auto-Preserved During Scraping)

IDs: 2, 4, 11, 13, 18, 24, 28, 30, 35 — these are NEVER deleted or updated by scrape operations.

| ID | Brand | Model | Image |
|----|-------|-------|-------|
| 2 | Patek Philippe | 5227G-010 | `PP5227G.png` |
| 4 | Patek Philippe | 5811/1G | `PP58111G.png` |
| 11 | Patek Philippe | 5303R | `PP5303R.png` |
| 13 | Vacheron Constantin | 43175 | `VC43175.webp` |
| 18 | Vacheron Constantin | 6000V | `VC6000V.webp` |
| 24 | Vacheron Constantin | 6007A | `VC6007A.webp` |
| 28 | Audemars Piguet | 16202ST | `AP16202ST.webp` |
| 30 | Audemars Piguet | 26574 | `APRO26574.png` |
| 35 | Audemars Piguet | 26589 | `AP26589.webp` |

---

## Key Files

| File | Purpose |
|------|---------|
| `Services/SitemapScraperService.cs` | Sitemap + Listing Page + Claude AI scraper |
| `Services/ClaudeApiService.cs` | Claude Haiku API: HTML preprocessing, watch extraction, URL extraction from listings |
| `Services/BrandScraperService.cs` | Legacy XPath scraper (AP only still works) |
| `Configuration/brand-configs.json` | XPath selectors per brand for legacy scraper |
| `Controllers/AdminController.cs` | REST endpoints: scrape-sitemap, scrape-listing, scrape-url, scrape-brand-official, clear-watches |
| `Models/WatchSpecs.cs` | Standardized specs schema (dial/case/movement/strap) |
| `DTOs/WatchPageData.cs` | Response DTO from Claude API |
| `DTOs/ScrapedWatchDto.cs` | Watch data before DB insertion |
| `Services/WatchCacheService.cs` | DB insertion with duplicate checking |
| `Data/brands.csv` | Brand registry (ID 1-15) |
| `Data/collections.csv` | Collection registry (ID 1-60) |

---

## How to Add a New Brand via Sitemap Scraping

### 1. Find the Sitemap URL
Most brands: `https://www.brand.com/sitemap.xml` or `/en/sitemap.xml`

### 2. Add Collection Prefix Mappings
In `SitemapScraperService.cs` > `ExtractCollectionFromWatchName()`:
```csharp
("CollectionPrefix", "CollectionName"),
```
**Order matters**: longer/more-specific prefixes first (e.g., "Seventies" before "Pano").

Also update `StripCollectionPrefix()` with the same prefix -> collection mappings.

### 3. Add URL Pre-filtering (Recommended)
In `SitemapScraperService.cs` > `PreFilterUrlsByCollection()`:
```csharp
"collectionname" => urls.Where(u => u.Contains("/watches/slug/")).ToList(),
```

### 4. Add Image Domain to Next.js Config
In `frontend/next.config.ts`:
```ts
{ hostname: 'www.brand-domain.com' },
```

### 5. Run the Scrape
```bash
curl -X DELETE "http://localhost:5248/api/admin/clear-watches?brandId=<ID>"
curl -s -m 600 -X POST "http://localhost:5248/api/admin/scrape-sitemap?brand=<Name>&sitemapUrl=<URL>&collection=<Collection>&maxWatches=8"
```

---

## Claude API Configuration
- Model: `claude-haiku-4-5-20251001` (in appsettings.json under `Anthropic:Model`)
- Max tokens: 2000
- API key: `dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."`
- Cost: ~$0.001 per extraction (separate billing from Claude Code subscription)
- Manage credits at console.anthropic.com

### HTML Preprocessing (ClaudeApiService.cs)
Before sending to Claude, HTML is cleaned (~300KB -> ~20-30KB):
1. Remove `<script>`, `<style>`, `<svg>`, `<noscript>`, `<header>`, `<footer>`, `<nav>`, `<iframe>`, `<video>`, `<audio>`
2. Remove HTML comments
3. Strip all attributes except: `class`, `id`, `alt`, `src`, `href`, `content`, `property`, `name`, `data-price`, `data-ref`, `data-sku`
4. Collapse whitespace
5. If still >50KB, extract only `<main>` or product/watch/article container + meta tags

### ClaudeApiService Methods
- `ExtractWatchDataFromHtmlAsync()` — Extract watch data (name, ref, price, specs, image) from product page HTML
- `ExtractProductUrlsFromListingAsync()` — Extract product page URLs from listing page HTML (fallback for JS-heavy sites)

---

## Brand-Specific Notes

### Glashütte Original (brandId=6)
- Sitemap: `https://www.glashuette-original.com/en/sitemap.xml`
- SeaQ watches live under `/watches/spezialist/` URL but have "seaq" in slug
- Sixties/Seventies models map to Spezialist collection
- Image domains: www.glashuette-original.com, service.glashuette-original.com

### F.P. Journe (brandId=7)
- Sitemap: `https://www.fpjourne.com/sitemap.xml`
- Has Chinese/Japanese page variants — non-English URL filter required
- Filter: skip URLs containing `/zh/`, `/cn/`, `/jp/`, `/ja/`, `/kr/`, `/ko/`, `/ar/`, `/ru/`, `/zh-hans/`, `/zh-hant/`

### Grand Seiko (brandId=13)
- Model codes map to collections: SLGA/SLGS/SLGC→Evolution 9, SBGA/SBGJ/SBGH/SBGM/SBGR/SBGP→Heritage, SBGK/SBGY/SBGW→Elegance, SBGE/SBGX→Sport
- These mappings are in `ExtractCollectionFromWatchName()` but NOT in `StripCollectionPrefix()` (model codes are part of the ref number)

### Rolex (brandId=9)
- No sitemap access — must use listing page scraper
- Listing URLs: `https://www.rolex.com/en-us/watches/{collection-slug}`
- Never shows prices

### Blancpain (brandId=11) & Omega (brandId=12)
- JS-heavy sites, sitemap may not work
- Use listing page scraper with Claude URL extraction fallback
- If that fails, manually provide product URLs via `scrape-url` endpoint

### A. Lange & Söhne (brandId=5)
- 3-Level navigation: Listing → Intermediate detail → Final specs page
- Must extract ref/model from Level 2 BEFORE navigating to Level 3
- Use listing page scraper, not sitemap

### IWC (brandId=14)
- Sitemap URL: `https://www.iwc.com/en/en-sitemap.xml` — may need to try variations
- If sitemap returns 0, try listing page approach

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Claude API "credit balance too low" | Buy credits at console.anthropic.com (separate from Claude Code subscription) |
| Next.js "hostname not configured" | Add domain to `frontend/next.config.ts` remotePatterns |
| Collection misclassification | Check prefix order in `ExtractCollectionFromWatchName` — longer prefixes first |
| Wasting API calls on wrong collection | Add URL pre-filtering in `PreFilterUrlsByCollection` |
| File lock error (MSB3027) | Kill dotnet: `taskkill /F /IM dotnet.exe` or `taskkill /F /PID <pid>` |
| Backend unresponsive during scrapes | Too many concurrent Selenium instances — kill Chrome processes and restart |
| 0 watches for multi-word collections | Check BOTH directions: `card.Contains(request) OR request.Contains(card)` |
| Non-English watches scraped (FPJ) | URL filter in `ExtractWatchUrlsFromXml` strips /zh/, /cn/, etc. |
| Duplicate ref in watch name | Name building logic strips duplicate ref and trailing collection names |
| `!` in bash inline node -e | Use temp .js files instead of inline `-e` (bash escapes `!`) |
| Backend port 5248 in use | `taskkill /F /PID <pid>` then restart |
| Specs raw JSON on frontend | Frontend `parseStructuredSpecs` handles `{dial,case,movement,strap}` format |

## Scrape Workflow
1. Kill backend if running: `taskkill /F /IM dotnet.exe`
2. Kill stale Chrome: `taskkill /F /IM chromedriver.exe` then `taskkill /F /IM chrome.exe`
3. Build: `cd backend && dotnet build`
4. Start: `dotnet run --urls "http://localhost:5248"` (background)
5. Clear: `DELETE /api/admin/clear-watches?brandId=X`
6. Scrape: Run commands above (ONE brand at a time to avoid overload)
7. Verify each watch has: **specs JSON**, **Cloudinary image** (not external URL), correct **collectionId**
8. Check in frontend: image loads, specs render in sectioned table format

### Quality Checklist (Per Watch)
- [ ] `Name` = reference number (e.g., "6119R-001")
- [ ] `Description` = brand name or "Brand Collection" subtitle
- [ ] `Specs` = valid JSON with `{dial, case, movement, strap}` sections — **not empty**
- [ ] `Image` = Cloudinary public_id (starts with `watches/`) — **not an external URL**
- [ ] `CollectionId` = maps to existing collection — **not null**
- [ ] `CurrentPrice` = decimal value (0 if "price on request"). **Never delete watches simply because their price is 0.**
- [ ] `Duplicates` = check the database to ensure you do not add existing reference numbers or identical names. Limit each brand to the exact quota.

### Data Retention Policy & Failure Handling
- **DO NOT clear entire brands** if a scrape fails or returns incomplete data.
- **Double-check what can be saved** from existing watches in the database. All the spec details might be perfectly fine.
- If a watch only has minor errors (e.g., incorrect name formatting, missing reference number, wrong carousel image, missing price), **keep it and fix it via a targeted update script** instead of rescraping the entire watch.
- **Hybrid Image Sourcing (Experimental)**: If a brand's official site uses generic lifestyle banners instead of clean watch images (e.g., Rolex, Greubel Forsey), do NOT delete the watches. Scrape the names, prices, and specs normally. Then, write a targeted Node.js script (using a package like `googlethis`) to perform a Google Image search for `{Brand} {Ref} watch front face high quality`, download the image, upload to Cloudinary, and patch the specific DB rows. This preserves accurate textual data while bypassing broken official media.
- **Only delete severely errored watches** (e.g., completely wrong collection, corrupted image link with no recovery possible, missing specs entirely if unable to re-extract).
- Use `DELETE /api/admin/clear-watches?brandId=X` ONLY when doing a completely fresh scrape for a brand that currently has useless data.

### Manual Add-Watches Endpoint
`POST /api/admin/add-watches` accepts `List<ScrapedWatchDto>` JSON body. Use this only as a last resort when Selenium + Claude fails. **Important:** watches added via this endpoint will NOT have specs or Cloudinary images unless you provide them in the JSON body. Always prefer `scrape-url` or `scrape-sitemap` which handle specs extraction and image upload automatically.

**Note**: `[AllowAnonymous]` is on `add-watches` endpoint temporarily for testing. Remove after production deployment. All other admin endpoints require `[Authorize(Roles = "Admin")]`.
