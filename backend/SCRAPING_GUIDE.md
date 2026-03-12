# Tourbillon Watch Scraping Guide

window cmd
**Note:** Use `+` for spaces in brand/collection names (e.g., `Audemars+Piguet`), not `%20`.
When producing scrape cmd commands, show all collections for a brand in one cmd with 5s rest between each. No need to test with small amounts - can easily delete by brandId if results are bad.

---

## Architecture Overview

Two scraping approaches:

| Method | Service | When to Use |
|--------|---------|-------------|
| **Sitemap + Claude AI** | `SitemapScraperService.cs` | New brands - universal, no XPath config needed |
| **Legacy XPath** | `BrandScraperService.cs` | Brands with existing config in `brand-configs.json` |

### Sitemap + Claude AI Pipeline (Preferred for New Brands)
```
Brand Sitemap XML
  -> Selenium fetches sitemap (bypasses bot protection)
  -> Extract watch product URLs from <url><loc> elements
  -> Pre-filter URLs by collection slug (saves API cost)
  -> For each URL:
      -> Selenium loads full page (handles JS rendering)
      -> HTML preprocessed (strip scripts/styles/SVGs ~300KB -> ~20-30KB)
      -> Claude Haiku API extracts structured JSON
      -> Image uploaded to Cloudinary
      -> Watch saved to DB via WatchCacheService
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
- Final: `Name = "{Ref} {Variant}"` = "1-36-01-02-05-61 Excellence"
- `Description` = brand name (e.g., "Glashutte Original") for detail page subtitle

---

## Brand Registry

### All 15 Brands & Collections

| ID | Brand | Collections (ID) | Scrape Method | Watch Target |
|----|-------|-------------------|---------------|-------------|
| 1 | Patek Philippe | Calatrava(1), Nautilus(2), Aquanaut(3), Grand Complications(4) | Legacy XPath | ~35 |
| 2 | Vacheron Constantin | Patrimony(5), Overseas(6), Historiques(7), Metiers d'Art(8), Les Cabinotiers(9) | Legacy XPath | ~35 |
| 3 | Audemars Piguet | Royal Oak(10), Royal Oak Offshore(11), Royal Oak Concept(12) | Legacy XPath | ~35 |
| 4 | Jaeger-LeCoultre | Reverso(13), Master Ultra Thin(14), Polaris(15), Duometre(16) | Legacy XPath | ~30 |
| 5 | A. Lange & Sohne | Lange 1(17), Zeitwerk(18), Saxonia(20) | Legacy XPath | ~32 |
| 6 | Glashutte Original | Senator(21), PanoMatic(22), SeaQ(23), Spezialist(24) | Sitemap + Claude AI | ~28 |
| 7 | F.P. Journe | Chronometre Souverain(25), Octa(26), Tourbillon Souverain(27) | Not yet scraped | ~25 |
| 8 | Greubel Forsey | Double Tourbillon 30(28), Tourbillon 24 Secondes(29), Balancier Convexe(30), QP a Equation(31) | Not yet scraped | ~25 |
| 9 | Rolex | Submariner(32), Daytona(33), Datejust(34), GMT-Master II(35), Day-Date(36) | Not yet scraped | ~30 |
| 10 | Breguet | Classique(37), Marine(38), Tradition(39), Reine de Naples(40) | Not yet scraped | ~25 |
| 11 | Blancpain | Fifty Fathoms(41), Villeret(42), Air Command(43), Ladybird(44) | Not yet scraped | ~25 |
| 12 | Omega | Speedmaster(45), Seamaster(46), Constellation(47), De Ville(48) | Not yet scraped | ~30 |
| 13 | Grand Seiko | Heritage Collection(49), Evolution 9(50) | Not yet scraped | ~28 |
| 14 | IWC Schaffhausen | Collections not yet defined | Not yet scraped | ~25 |
| 15 | Frederique Constant | Collections not yet defined | Not yet scraped | ~25 |

**Grand Total Target:** ~440-450 watches

---

## API Endpoints

### Sitemap Scrape (Universal)
```bash
POST /api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Senator&maxWatches=50
```

### Legacy Brand Scrape (XPath)
```bash
POST /api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Calatrava&maxWatches=9
```

### Single URL Scrape (Quick Test)
```bash
POST /api/admin/scrape-url?url=https://www.glashuette-original.com/en/watches/senator/...&brand=Glashutte+Original
```

### Clear Watches Before Re-scraping
```bash
DELETE /api/admin/clear-watches?brandId=6
```

### Check Stats
```bash
GET /api/admin/scrape-stats
```

---

## Scrape Commands (Ready to Copy-Paste)

**Patek Philippe (brandId=1, ~35 watches):**
```cmd
curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Calatrava&maxWatches=9" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Nautilus&maxWatches=9" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Aquanaut&maxWatches=9" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Grand+Complications&maxWatches=8"
```

**Vacheron Constantin (brandId=2, ~35 watches):**
```cmd
curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Patrimony&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Overseas&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Historiques&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Metiers+d+Art&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Les+Cabinotiers&maxWatches=7"
```

**Audemars Piguet (brandId=3, ~35 watches):**
```cmd
curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak&maxWatches=12" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak+Offshore&maxWatches=12" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak+Concept&maxWatches=11"
```

**Jaeger-LeCoultre (brandId=4, ~30 watches):**
```cmd
curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Reverso&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Master+Ultra+Thin&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Polaris&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Duometre&maxWatches=7"
```

**A. Lange & Sohne (brandId=5, ~32 watches):**
```cmd
curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Lange+1&maxWatches=10" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Zeitwerk&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Saxonia&maxWatches=14"
```

**Glashutte Original (brandId=6, ~28 watches) - Sitemap Scraper:**
```cmd
curl -X POST "http://localhost:5164/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Senator&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=PanoMatic&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=SeaQ&maxWatches=6" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5164/api/admin/scrape-sitemap?brand=Glashutte+Original&sitemapUrl=https://www.glashuette-original.com/en/sitemap.xml&collection=Spezialist&maxWatches=7"
```

---

## Data Model

### Structured Specs Schema (JSON in Watch.Specs)
```json
{
  "dial": { "color", "finish", "indices", "hands" },
  "case": { "material", "diameter", "thickness", "waterResistance", "crystal", "caseBack" },
  "movement": { "caliber", "type", "powerReserve", "frequency", "jewels", "functions[]" },
  "strap": { "material", "color", "buckle" }
}
```
- `movement.type`: normalized to "Automatic", "Manual", or "Quartz"
- `movement.functions`: array of strings (e.g., ["Hours", "Minutes", "Date", "Moon phase"])
- Null for any field not found on the page

### 9 Showcase Watches (Auto-Preserved During Scraping)

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
| `Services/SitemapScraperService.cs` | Sitemap + Claude AI scraper (universal, no per-brand config) |
| `Services/ClaudeApiService.cs` | Claude Haiku API: HTML preprocessing + structured extraction prompt |
| `Services/BrandScraperService.cs` | Legacy XPath scraper (Patek, VC, AP, JLC, ALS) |
| `Configuration/brand-configs.json` | XPath selectors per brand for legacy scraper |
| `Controllers/AdminController.cs` | REST endpoints for triggering scrapes |
| `Models/WatchSpecs.cs` | Standardized specs schema (dial/case/movement/strap) |
| `DTOs/WatchPageData.cs` | Response DTO from Claude API |
| `DTOs/ScrapedWatchDto.cs` | Watch data before DB insertion |
| `Services/WatchCacheService.cs` | DB insertion with duplicate checking |
| `Data/brands.csv` | Brand registry (ID, name, image) |
| `Data/collections.csv` | Collection registry (ID, name, brandId) |

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
curl -X DELETE "http://localhost:5164/api/admin/clear-watches?brandId=<ID>"
curl -X POST "http://localhost:5164/api/admin/scrape-sitemap?brand=<Name>&sitemapUrl=<URL>&collection=<Collection>&maxWatches=50"
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

---

## Brand-Specific Notes

### Glashutte Original (brandId=6)
- Sitemap: `https://www.glashuette-original.com/en/sitemap.xml`
- SeaQ watches live under `/watches/spezialist/` URL but have "seaq" in slug
- Sixties/Seventies models map to Spezialist collection
- Image domains: www.glashuette-original.com, service.glashuette-original.com

### A. Lange & Sohne (brandId=5) - 3-Level Navigation
- Level 1: Listing page -> product cards
- Level 2: Intermediate detail page (has ref number, model name, link to specs)
- Level 3: Final specs page (has technical details, no ref number)
- Must extract ref/model from Level 2 BEFORE navigating to Level 3

---

## Common Issues

| Issue | Solution |
|-------|----------|
| Claude API "credit balance too low" | Buy credits at console.anthropic.com (separate from Claude Code subscription) |
| Next.js "hostname not configured" | Add domain to `frontend/next.config.ts` remotePatterns |
| Collection misclassification | Check prefix order in `ExtractCollectionFromWatchName` - longer prefixes first |
| Wasting API calls on wrong collection | Add URL pre-filtering in `PreFilterUrlsByCollection` |
| File lock error (MSB3027) | Kill dotnet: `powershell -Command "Stop-Process -Name backend -Force"` |
| Specs raw JSON on frontend | Frontend `parseStructuredSpecs` handles `{dial,case,movement,strap}` format |
| Cloudinary 404 for brand/collection images | These are logo/thumbnail images - check Cloudinary dashboard for correct public IDs |
| 0 watches for multi-word collections | Check BOTH directions: `card.Contains(request) OR request.Contains(card)` |

## Scrape Workflow
1. Kill backend: `powershell -Command "Stop-Process -Name backend -Force"`
2. Build: `cd backend && dotnet build`
3. Start: `dotnet run` (background)
4. Clear: `DELETE /api/admin/clear-watches?brandId=X`
5. Scrape: `POST /api/admin/scrape-sitemap?...` or `POST /api/admin/scrape-brand-official?...`
6. Verify in frontend

**Note**: `[AllowAnonymous]` is on scrape-url, scrape-sitemap, and clear-watches endpoints temporarily for testing. Remove after production deployment.
