# Scrape Status — Last Updated 2026-03-13

## Database State

| Brand | ID | Watches | Target | Collections in DB |
|-------|----|---------|--------|-------------------|
| Patek Philippe | 1 | 31 | 35 | Calatrava(1), Nautilus(2), Aquanaut(3), Grand Complications(4) |
| Vacheron Constantin | 2 | 3 | 35 | Patrimony(5), Overseas(6), Historiques(7), Métiers d'Art(8), Les Cabinotiers(9) |
| Audemars Piguet | 3 | 34 | 35 | Royal Oak(10), Royal Oak Offshore(11), Royal Oak Concept(12) |
| Jaeger-LeCoultre | 4 | 35 | 35 | Reverso(13), Master Ultra Thin(14), Polaris(15), Duomètre(16) |
| A. Lange & Söhne | 5 | 33 | 35 | Lange 1(17), Zeitwerk(18), Datograph(19), Saxonia(20) |
| Glashütte Original | 6 | 25 | 25 | Senator(21), PanoMatic(22), SeaQ(23), Spezialist(24) |
| F.P.Journe | 7 | 25 | 25 | Chronomètre Souverain(25), Octa(26), Tourbillon Souverain(27) |
| Greubel Forsey | 8 | 7 | 25 | Double Tourbillon 30°(28), Tourbillon 24 Secondes(29), Balancier Convexe(30), QP à Équation(31) |
| Rolex | 9 | 15 | 25 | Submariner(32), Daytona(33), Datejust(34), GMT-Master II(35), Day-Date(36) |
| Breguet | 10 | 7 | 25 | Classique(37), Marine(38), Tradition(39), Reine de Naples(40) |
| Omega | 12 | 10 | 25 | Speedmaster(45), Seamaster(46), Constellation(47), De Ville(48) |
| Grand Seiko | 13 | 3 | 25 | Heritage Collection(49), Evolution 9(50), Elegance Collection(51), Sport Collection(52) |
| Frederique Constant | 15 | 9 | 25 | Classics(57), Slimline(58), Manufacture(59), Highlife(60) |

**Total watches: 174 across 13 brands**

## Quality Rules (MUST follow for every watch)

### Every watch MUST have:
1. **Specs JSON** — `{dial, case, movement, strap}` structure (see SCRAPING_GUIDE.md). If scraping fails to get specs, perform manual web search to rebuild the JSON.
2. **Cloudinary image** — stored as public_id like `watches/BrandName_RefNumber`, NOT external URLs. MUST closely match the visual standards of the 9 showcase watches (IDs 2, 4, 11, 13, 18, 24). Plain/isolated backgrounds ONLY. NO hands or wrists allowed in the shot. Wait to update the DB until a satisfactory image is found anywhere on the internet.
3. **Valid collectionId** — must map to an existing collection in collections.csv. If no match, DO NOT add the watch
4. **Price** — actual retail price in AUD. If price is "Price on request" / POR, research the USD price and convert to AUD (~1.55 rate). **Never delete a watch just because its price is 0; 0 means "Price on Request" (PoR)**, especially common for AP.
5. **Name** — reference number (e.g., "5226G-001")
6. **Description** — "Brand ModelName" format (e.g., "Patek Philippe Calatrava")

### Fix, don't rescrape:
- Always fix the scraped batch (update price, collectionId, etc. via SQL) rather than clearing and rescraping
- Rescraping wastes time and costs more money. Only rescrape individual watches when the data is fundamentally wrong
- Double check for duplicate reference numbers and names before adding watches to the DB to prevent duplicating result lists.

### Collection mapping rules:
- Only use collections listed in `collections.csv` — NEVER create new collections
- If a watch doesn't belong to any listed collection for its brand, skip it entirely
- When Claude API returns a truncated/wrong collection name, manually fix the collectionId via SQL

### Image storage rules:
- All images must be uploaded to Cloudinary via the scrape-url pipeline
- Image column stores Cloudinary public_id (e.g., `watches/PatekPhilippe_5226G-001`)
- Showcase watches (IDs: 2, 4, 11, 13, 18, 24, 28, 30, 35) use local image names — NEVER modify these

## Price Status

- **PP (brand 1)**: All 31 watches have AUD prices (scraped from patek.com + USD conversion for Golden Ellipse)
- **All other brands**: Most watches have price 0 — need price research and update. 0 is valid for PoR.
- Prices from Patek scrape came as "A$111,900" format but CacheService stored 0 — always verify prices after scraping

## Completed Work

1. PP scraped to 31/35 via `scrape-url` with full specs + Cloudinary images
2. PP prices updated for all 31 watches (23 from scrape data, 5 via USD→AUD conversion, 3 showcase existing)
3. Fixed PP NULL collectionIds: Grand Complications→4, Complications→1 (Calatrava), Golden Ellipse→1 (Calatrava)
5. Fixed brand name mismatch for F.P.Journe via `NormalizeBrandName()`
6. Scraped 35 JLC watches (Brand 4) via custom Node.js script using direct HTML/JSON-LD parsing to bypass bot protection and Claude API deprecation. Uploaded images to Cloudinary.
6. Fixed Grand Seiko null collectionId (watch ID 644)
7. Deleted Blancpain (ID 11) and IWC (ID 14) — scraping consistently failed
8. `[AllowAnonymous]` currently ON for scrape-url and add-watches — REMOVE when all scraping done
9. Audemars Piguet scraped to 34/35. Detected that 28 watches were missing specs. Rebuilt specs JSON through manual web search and applied them in bulk using scripts.
10. Re-scraped 25 F.P. Journe watches (Brand 7), restoring Price on Request ($0) values and adhering to the new data retention policy against mass deletion.
11. **Experimental**: Re-scraped 25 Rolex and 12 Greubel Forsey watches using the new "Hybrid Image Sourcing" technique (extracting names and specs from official sites, but using the `googlethis` npm package to search and patch high-quality front-face accurate images to bypass generic lifestyle website banners).

## Scraping Architecture

- **Method**: Selenium + Claude Haiku API (universal, no per-brand XPath)
- **Best endpoint**: `scrape-url` — visits individual product page, extracts specs via Claude, uploads image to Cloudinary
- **Other endpoints**: `scrape-sitemap`, `scrape-listing` (for batch discovery)
- **Key files**: `SitemapScraperService.cs`, `ClaudeApiService.cs`, `AdminController.cs`
- **Cost**: ~$0.001/extraction via Claude Haiku
- **Known issue**: Some brand sites block Selenium on listing pages but allow individual product pages
- See `SCRAPING_GUIDE.md` for full documentation