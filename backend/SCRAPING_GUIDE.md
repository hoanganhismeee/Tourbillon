# Tourbillon Web Scraping Guide
window cmd
**Configured Brands:** Patek Philippe ✅, Vacheron Constantin ✅, Audemars Piguet ✅, Jaeger-LeCoultre ✅, A. Lange & Söhne ✅
**Remaining:** 10 brands (Rolex, Omega, etc.)
**Note:** Use `+` for spaces in brand/collection names (e.g., `Audemars+Piguet`), not `%20` - prevents "Brand configuration not found" errors, if html contains redundant text like discover more, contact seller, exclude that, follow previous brands like patek's scrape structure
**Collection Targets:** Treat the listed watch counts as goals—if an official collection exposes fewer pieces, capture everything available and move on. (e.g if I need 7 watches per collection, but a collection only have 4, then it's fine)
When produce a scrape cmd command, show me brand all in one cmd, with 5s rest between each collection, we dont need to test out with small amount because we can easily delete brand by id number later if the result is bad. 

---

## 🆕 Recent Improvements

### JSON Configuration (v1.3)
- **Centralized Config**: All brand scraping settings are now in `backend/Configuration/brand-configs.json`.
- **No Recompilation**: Add new brands by editing the JSON file without touching C# code.
- **Template Support**: Use `backend/Pending_Brands_Config.md` to gather HTML elements before configuring.

### Image Scraping (v1.2)
- **Lazy-loading support**: Automatically detects and extracts from `data-src`, `data-srcset`, `srcset`, and `src` attributes
- **Data URI filtering**: Skips inline SVG placeholders (`data:image/svg+xml`) that cause upload failures
- **Priority order**: data-srcset → data-src → srcset → src (ensures highest quality images)

### Flexible Specs Extraction (v1.2)
- **Additional specs capture**: Automatically discovers and extracts brand-specific spec sections beyond the standard 4 (Dial, Case, Strap, Movement)
- **Pattern detection**: Handles VC's "Recto/Verso" details, AP's accordion sections, JLC's feature panels, etc.
- **Adaptive parsing**: Captures extra details following each brand's unique HTML structure
- **JSON storage**: All additional specs stored in `specs.additional` dictionary for frontend display

---

## Quick Start

**Scrape a brand immediately:**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9"
```

**Check stats:**
```cmd
curl "http://localhost:5248/api/admin/scrape-stats"
```

**Clear scraped watches (preserves 9 showcase):**
```cmd
curl -X DELETE "http://localhost:5248/api/admin/clear-watches"
```

**Clear specific brand only (for testing/retry):**
```cmd
curl -X DELETE "http://localhost:5248/api/admin/clear-watches?brandId="
```

**Patek Philippe (brandId 1, ~35 watches total):**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Calatrava&maxWatches=9" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Nautilus&maxWatches=9" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Aquanaut&maxWatches=9" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek+Philippe&collection=Grand+Complications&maxWatches=8" && timeout /t 5 /nobreak && curl "http://localhost:5248/api/admin/scrape-stats"
```

**Vacheron Constantin (brandId 2, ~35 watches total):**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Patrimony&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Overseas&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Historiques&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Metiers+d+Art&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron+Constantin&collection=Les+Cabinotiers&maxWatches=7" && timeout /t 5 /nobreak && curl "http://localhost:5248/api/admin/scrape-stats"
```

**Audemars Piguet (brandId 3, ~35 watches total):**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak&maxWatches=12" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak+Offshore&maxWatches=12" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars+Piguet&collection=Royal+Oak+Concept&maxWatches=11" && timeout /t 5 /nobreak && curl "http://localhost:5248/api/admin/scrape-stats"
```

**Jaeger-LeCoultre (brandId 4, ~30 watches total):**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Reverso&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Master+Ultra+Thin&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Polaris&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Jaeger-LeCoultre&collection=Duometre&maxWatches=7" && timeout /t 5 /nobreak && curl "http://localhost:5248/api/admin/scrape-stats"
```

**A. Lange & Söhne (brandId 5, ~29 watches total):**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Lange+1&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Zeitwerk&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Datograph&maxWatches=7" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Saxonia&maxWatches=7" && timeout /t 5 /nobreak && curl "http://localhost:5248/api/admin/scrape-stats"
```

---

## 🎯 Architecture Overview

### Core Components
- **BrandScraperService.cs** - Universal scraper (all brands use same code)
- **brand-configs.json** - JSON configuration for all brands
- **WatchCacheService.cs** - Database operations + duplicate prevention
- **WatchSpecs.cs** - Structured JSON for specs (Dial, Case, Strap, Movement)
- **CloudinaryService.cs** - Automatic image upload to Cloudinary CDN

### Scraping Flow (Official Brand Websites)
1. **Product Listing** → Extract reference number, collection, image URL from brand's website
2. **Detail Page** → Extract price, comprehensive specs, high-res image
3. **Cloudinary Upload** → Automatically upload & convert images to PNG format
4. **Database (PostgreSQL)** → Save Cloudinary URLs + duplicate prevention + showcase preservation
5. **Frontend** → Display images directly from Cloudinary CDN

---

## 🖼️ Image Handling Strategy

### Two Tiers (By Watch Type)

| Tier | Image Location | Load Speed | Use Case | Status |
|------|---|---|---|---|
| **Local** | `/backend/Images/*.png` | ⚡ Fast | 9 showcase watches | ✅ Working |
| **Cloudinary CDN** | Cloudinary optimized | ⚡ Fast | All scraped watches | ✅ Working |

### Cloudinary Integration

**How it works:**
1. **Download** - Images from brand websites downloaded during scraping
2. **Convert** - Images automatically converted to PNG format (faster load times)
3. **Upload** - PNG stored in Cloudinary CDN (permanent, independent from brand websites)
4. **Store** - PostgreSQL saves only the Cloudinary public_id reference
5. **Display** - Frontend retrieves images from Cloudinary (never accesses brand sites again)

**Result:**
- Showcase watches (9): Local files, instant ✅
- Scraped watches (all others): Cloudinary PNG, fast + independent ✅
- If brand website changes/blocks scraping → No impact (images already cached) ✅

### Frontend Configuration

The frontend is already configured to handle this:

**next.config.ts** - Whitelists luxury brand CDNs:
```typescript
remotePatterns: [
  { protocol: 'https', hostname: 'www.vacheron-constantin.com', pathname: '/dam/**' },
  { protocol: 'https', hostname: 'www.patek.com', pathname: '/**' },
  { protocol: 'https', hostname: 'www.audemarspiguet.com', pathname: '/**' },
]
```

**cloudinary.ts** - Detects watch brand URLs and serves directly (bypasses Cloudinary proxy):
```typescript
const isWatchBrandUrl = (url: string) => {
  const watchBrands = ['vacheron-constantin.com', 'patek.com', 'audemarspiguet.com'];
  return watchBrands.some(brand => url.includes(brand));
};

if (isHttpUrl(publicId) && isWatchBrandUrl(publicId)) {
  return publicId; // No transformation, direct access
}
```

---

## 📊 Holy Trinity Showcase Watches

These 9 watches have **curated local images** that are automatically preserved during scraping:

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

**Auto-Preservation Logic:**
- Watches are matched by reference number extraction (e.g., `5227G` from `5227G-010`)
- When matched → Price/specs update, **image preserved** ✅
- No manual intervention needed

---

## 🚀 Scraping Workflow


### Step 2: Check Showcase Watches Seeded
```cmd
curl "http://localhost:5248/api/admin/scrape-stats"
REM Response should show 9 watches (3 per brand)
```

### Step 3: Scrape a Brand

**Example: Patek Philippe (4 collections, ~9 watches each)**

```cmd
REM Collection 1 - Calatrava
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9"
timeout /t 30 /nobreak

```

### Step 4: Verify Results
```cmd
curl "http://localhost:5248/api/admin/scrape-stats"
REM Check total watch count increased correctly
```

---

## 🔧 Adding a New Brand (10 Remaining)

### Configuration Steps using JSON

1. **Gather HTML Data:**
   - Open `backend/Pending_Brands_Config.md`.
   - Visit the brand's website and inspect the Product Card and Detail Page.
   - Paste the HTML and URLs into the template for reference.

2. **Determine Selectors:**
   - Identify unique classes, IDs, or attributes for:
     - **Card Container:** The element wrapping each watch on the listing page.
     - **Reference Number:** Unique model ID.
     - **Price:** Current price.
     - **Specs:** Dial, Case, Strap, Movement details.

3. **Add to JSON Config:**
   - Open `backend/Configuration/brand-configs.json`.
   - Append a new object to the array:
   ```json
   {
     "BrandName": "Rolex",
     "BaseUrl": "https://www.rolex.com",
     "CollectionUrls": {
       "Submariner": "/en/watches/submariner",
       "Daytona": "/en/watches/cosmograph-daytona"
     },
     "ProductCard": {
       "CardContainer": "//div[@class='sc-product-card']",
       "ReferenceNumber": ".//span[@class='sc-ref']"
     },
     "DetailPage": {
       "Price": "//span[@class='price']"
     },
     "RequiresJavaScript": true,
     "Currency": "USD",
     "RequestDelayMs": 2000
   }
   ```

4. **Test:**
   - Run the scraper for one collection.
   - Verify data in the database or logs.

---

## 📋 All 15 Brands & Collections

### Holy Trinity (35 watches each)
| # | Brand | Collections | Total |
|---|-------|---|---|
| 1 | **Patek Philippe** | Calatrava, Nautilus, Aquanaut, Grand Complications | 35 |
| 2 | **Vacheron Constantin** | Patrimony, Overseas, Historiques, Métiers d'Art, Les Cabinotiers | 35 |
| 3 | **Audemars Piguet** | Royal Oak, Royal Oak Offshore, Royal Oak Concept | 35 |

### Premium Brands (25-30 watches each)
| # | Brand | Collections | Total |
|---|-------|---|---|
| 4 | **Rolex** | Submariner, Daytona, Datejust, GMT-Master II, Day-Date | 30 |
| 5 | **Omega** | Speedmaster, Seamaster, Constellation, De Ville | 30 |
| 6 | **Jaeger-LeCoultre** | Reverso, Master Ultra Thin, Polaris, Duomètre | 30 |
| 7 | **A. Lange & Söhne** | Lange 1, Zeitwerk, Datograph, Saxonia | 29 |
| 8 | **Glashütte Original** | Senator, PanoMatic, SeaQ, Spezialist | 28 |
| 9 | **Grand Seiko** | Heritage, Evolution 9, Elegance, Sport Collection | 28 |
| 10 | **Breguet** | Classique, Marine, Tradition, Reine de Naples | 25 |
| 11 | **Blancpain** | Fifty Fathoms, Villeret, Air Command, Ladybird | 25 |
| 12 | **IWC Schaffhausen** | Portugieser, Pilot's Watches, Ingenieur, Portofino | 25 |
| 13 | **F.P.Journe** | Chronomètre Souverain, Octa, Tourbillon Souverain | 25 |

### Boutique/Specialized (25 watches each)
| # | Brand | Collections | Total |
|---|-------|---|---|
| 14 | **Greubel Forsey** | Double Tourbillon 30°, Tourbillon 24 Secondes, Balancier Convexe, QP à Équation | 25 |
| 15 | **Frederique Constant** | Classics, Slimline, Manufacture, Highlife | 25 |

**Grand Total Target:** 440-450 watches across 15 brands

## 🗂️ Database Schema

### Watch Model
```csharp
public class Watch
{
    public int Id { get; set; }
    public string Name { get; set; }           // Reference number only: "5227G-010"
    public string Description { get; set; }   // Full description from website
    public string Image { get; set; }         // URL: "VC6000V.webp" or "https://..."
    public decimal CurrentPrice { get; set; } // Formatted: 93500.00
    public string Specs { get; set; }         // JSON: dial, case, strap, movement

    public int BrandId { get; set; }
    public Brand Brand { get; set; }
    public int? CollectionId { get; set; }
    public Collection Collection { get; set; }
}
```

### Specs JSON Structure
```json
{
  "dial": {
    "description": "...",
    "color": "Silver",
    "markers": "...",
    "hands": "..."
  },
  "case": {
    "material": "White Gold",
    "diameter": "39 mm",
    "thickness": "8.9 mm",
    "waterResistance": "30m",
    "crystal": "Sapphire",
    "caseBack": "..."
  },
  "strap": {
    "material": "Alligator leather",
    "color": "Black",
    "buckle": "Gold prong"
  },
  "movement": {
    "caliber": "2160",
    "type": "Automatic",
    "complications": ["Date", "Power reserve"],
    "frequency": "2.5 Hz",
    "powerReserve": "80 hours",
    "parts": 188,
    "jewels": 24
  }
}
```

---

## 🎯 Success Metrics

### Per Brand
- ✅ 95%+ of watches in collection scraped (some brands limit listings)
- ✅ All watches have reference numbers, prices, and specs
- ✅ Images load on frontend within 3 seconds
- ✅ No duplicate watches created

### Overall
- **Target:** 400-450 total watches across 15 brands
- **Current:** 29 watches (6% complete)
- **Holy Trinity Progress:** 2/3 complete (Patek ✅, Vacheron ✅, Audemars 🔧)

---

## 🔮 Future Roadmap (After 15 Brands Complete)

### Phase 1: Database Migration (From CSV to PostgreSQL)
**When:** After all 15 brands are scraped (~450 watches)
- Remove dependency on `/backend/Data/brands.csv` and `/backend/Data/collections.csv`
- Move all brand/collection definitions to PostgreSQL
- Admin UI to manage brands & collections directly (no more manual CSV edits)

### Phase 2: Cloud Storage & CDN
**When:** Phase 1 complete
- Upload all watch images from Cloudinary → Amazon S3
- Configure S3 + CloudFront CDN for faster global delivery
- Leverage professional infrastructure (caching, compression, auto-scaling)
- **Outcome:** Strongest practical experience in industry-standard tools

---

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `Controllers/AdminController.cs` | Scraping endpoints (POST scrape-brand-official, DELETE clear-watches) |
| `Services/BrandScraperService.cs` | Universal scraper logic + brand configurations |
| `Configuration/brand-configs.json` | JSON configuration for all brands |
| `Services/Chrono24CacheService.cs` | Database operations, duplicate prevention, showcase preservation |
| `Models/BrandScraperConfig.cs` | XPath selector definitions for each brand |
| `Models/WatchSpecs.cs` | Structured specs JSON schema |
| `Program.cs` | Static file serving at `/images` endpoint |
| `frontend/next.config.ts` | Whitelists luxury brand CDN domains |
| `frontend/lib/cloudinary.ts` | Detects watch brand URLs, bypasses transformation |

---

## 🔄 Workflow Checklist

- [ ] Verify backend running: `dotnet run` in `/backend`
- [ ] Check showcase watches seeded: 9 total watches
- [ ] Configure new brand in `backend/Configuration/brand-configs.json`
- [ ] Test with 1-2 watches first
- [ ] Verify reference numbers, prices, specs extracted
- [ ] Verify images are URLs (external or local)
- [ ] Scrape full collection
- [ ] Check frontend loading: http://localhost:3000
- [ ] Verify showcase images preserved (if applicable)
- [ ] Document any selector changes in git commit

---

**Questions?** Check backend logs:
```cmd
REM Terminal shows detailed scraping logs
REM Look for: "Extracted", "Error", "Preserved", "Matched by reference"
```

**For Future Maintainers:**
When referencing this guide as `@backend/SCRAPING_GUIDE.md`, you have:
- Complete scraping architecture understanding
- Step-by-step brand configuration process
- Image handling strategy (why external URLs, not cached)
- Database schema and specs format
- Status of all 15 brands
- Common troubleshooting solutions

Ready to add a brand? Follow the "Adding a New Brand" section above. Good luck! 🚀
