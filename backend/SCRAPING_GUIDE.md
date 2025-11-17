# Tourbillon Web Scraping Guide

**Last Updated:** November 2025
**Configured Brands:** Patek Philippe ✅, Vacheron Constantin ✅
**Remaining:** 13 brands (Audemars Piguet, Rolex, Omega, etc.)

---

## Quick Start

**Scrape a brand immediately:**
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9"
```

**Check stats:**
```bash
curl "http://localhost:5248/api/admin/scrape-stats"
```

**Clear scraped watches (preserves 9 showcase):**
```bash
curl -X DELETE "http://localhost:5248/api/admin/clear-watches"
```

---

## 🎯 Architecture Overview

### Core Components
- **BrandScraperService.cs** - Universal scraper (all brands use same code)
- **BrandScraperConfig.cs** - Brand-specific XPath selectors
- **Chrono24CacheService.cs** - Database operations + duplicate prevention
- **WatchSpecs.cs** - Structured JSON for specs (Dial, Case, Strap, Movement)

### Scraping Flow
1. **Product Listing** → Extract reference number, collection, image URL
2. **Detail Page** → Extract price, comprehensive specs, high-res image
3. **Database** → Save with duplicate prevention + showcase preservation
4. **Frontend** → Display with appropriate image loading strategy

---

## 🖼️ Image Handling Strategy

### Three Tiers (By Brand Type)

| Tier | Image Location | Load Speed | Use Case | Status |
|------|---|---|---|---|
| **Local** | `/backend/Images/*.png` | ⚡ Fast | 9 showcase watches | ✅ Working |
| **External CDN** | Luxury brand domain | 🐢 Slow | Scraped watches | ✅ Working |
| **Cloudinary** | Optimized proxy | ⚡ Fast | Future migration | 📋 Setup ready |

### Why External CDN? (Not Cached Locally)

**Problem:** Vacheron's CDN blocks server-to-server requests
**Evidence:** All backend image downloads timeout (30+ seconds)
**Solution:** Let browser fetch directly from brand CDN (browsers aren't blocked)

**Result:**
- Showcase watches (3 Vacheron): `"image":"VC6000V.webp"` → Local, fast ✅
- Scraped watches (20 Vacheron): `"image":"https://www.vacheron-constantin.com/dam/..."` → External, slow but works ✅

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

### Step 1: Verify Backend is Running
```bash
cd backend
dotnet run
# Should see: "Now listening on: http://localhost:5248"
```

### Step 2: Check Showcase Watches Seeded
```bash
curl "http://localhost:5248/api/admin/scrape-stats"
# Response should show 9 watches (3 per brand)
```

### Step 3: Scrape a Brand

**Example: Patek Philippe (4 collections, ~9 watches each)**

```bash
# Collection 1 - Calatrava
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9"
sleep 30

# Collection 2 - Nautilus
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Nautilus&maxWatches=9"
sleep 30

# Collection 3 - Aquanaut
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Aquanaut&maxWatches=9"
sleep 30

# Collection 4 - Grand Complications
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Grand%20Complications&maxWatches=8"
```

### Step 4: Verify Results
```bash
curl "http://localhost:5248/api/admin/scrape-stats"
# Check total watch count increased correctly
```

---

## 🔧 Adding a New Brand (13 Remaining)

### Required Brands
1. Audemars Piguet (Holy Trinity)
2. Rolex
3. Omega
4. Jaeger-LeCoultre
5. Grand Seiko
6. A. Lange & Söhne
7. Glashütte Original
8. IWC Schaffhausen
9. Breguet
10. Blancpain
11. F.P.Journe
12. Greubel Forsey
13. Frederique Constant

### Configuration Steps

**1. Open the brand's website and inspect HTML elements:**

Example (Audemars Piguet):
- Visit: `https://www.audemarspiguet.com`
- Right-click → Inspect → Find:
  - Product card container
  - Reference number selector
  - Image selector
  - Detail page URL pattern

**2. Add to `BrandScraperService.cs` InitializeBrandConfigs():**

```csharp
_brandConfigs["Audemars Piguet"] = new BrandScraperConfig
{
    BrandName = "Audemars Piguet",
    BaseUrl = "https://www.audemarspiguet.com",
    CollectionUrls = new Dictionary<string, string>
    {
        { "Royal Oak", "/en/watch/royal-oak/" },
        { "Royal Oak Offshore", "/en/watch/royal-oak-offshore/" },
        { "Royal Oak Concept", "/en/watch/royal-oak-concept/" }
    },
    ProductCard = new ProductCardSelectors
    {
        CardContainer = "a[class*='watch-card']",
        ReferenceNumber = "h3[class*='model']",
        CollectionName = "p[class*='collection']",
        CaseMaterial = "span[class*='material']",
        Image = "img[class*='watch-image']",
        DetailPageLink = ""
    },
    DetailPage = new DetailPageSelectors
    {
        Price = "div[class*='price'] span",
        ReferenceNumber = "h1[class*='model']",
        CollectionName = "p[class*='collection']",
        DialSpecs = "div[data-section='dial']",
        CaseSpecs = "div[data-section='case']",
        StrapSpecs = "div[data-section='strap']",
        MovementSpecs = "div[data-section='movement']"
    },
    RequiresJavaScript = true,
    Currency = "AUD",
    RequestDelayMs = 2000
};
```

**3. Test with 1-2 watches first:**
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars%20Piguet&collection=Royal%20Oak&maxWatches=2"
```

**4. Check response:**
- Verify reference numbers extracted correctly
- Check prices formatted as `$XX,XXX.00` or `Price on request`
- Ensure specs JSON populated
- Confirm images are stored as full URLs

**5. Scale up once verified:**
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Audemars%20Piguet&collection=Royal%20Oak&maxWatches=10"
```

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
| 7 | **A. Lange & Söhne** | Lange 1, Zeitwerk, Datograph, Saxonia | 30 |
| 8 | **Glashütte Original** | Senator, PanoMatic, SeaQ, Spezialist | 30 |
| 9 | **Grand Seiko** | Heritage, Evolution 9, Elegance, Sport Collection | 30 |
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

---

## ⚠️ Common Issues & Solutions

### **Watches aren't loading on frontend**
- Check `next.config.ts` has brand domain in `remotePatterns`
- Verify `cloudinary.ts` includes brand in `watchBrands` array
- Ensure backend is running on `http://localhost:5248`

### **Scraping fails with "No watches found"**
- Brand/collection names must match database exactly (case-sensitive)
- Check brand's website - collection URL may have changed
- Verify XPath selectors still work (website HTML might have been updated)

### **Prices show "Price on request"**
- This is intentional for luxury watches that don't show prices on website
- System falls back to "Price on request" when price element missing
- User can manually update price in database if available

### **Duplicate watches appearing**
- System matches by base reference number (e.g., `5227G` = `5227G-010`)
- Check `ExtractBaseReference()` in `Chrono24CacheService.cs`
- Clear and rescrape if needed: `DELETE /api/admin/clear-watches`

### **Showcase watch image got overwritten**
- This shouldn't happen - the system preserves images for IDs: 2, 4, 11, 13, 18, 24, 28, 30, 35
- Check backend logs for: `"Preserved curated image for showcase watch ID X"`
- If missing, restore from database backup or re-upload to `/Images/`

---

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

## 📚 Key Files Reference

| File | Purpose |
|------|---------|
| `Controllers/AdminController.cs` | Scraping endpoints (POST scrape-brand-official, DELETE clear-watches) |
| `Services/BrandScraperService.cs` | Universal scraper logic + brand configurations |
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
- [ ] Configure new brand in `BrandScraperService.cs`
- [ ] Test with 1-2 watches first
- [ ] Verify reference numbers, prices, specs extracted
- [ ] Verify images are URLs (external or local)
- [ ] Scrape full collection
- [ ] Check frontend loading: http://localhost:3000
- [ ] Verify showcase images preserved (if applicable)
- [ ] Document any selector changes in git commit

---

**Questions?** Check backend logs:
```bash
# Terminal shows detailed scraping logs
# Look for: "Extracted", "Error", "Preserved", "Matched by reference"
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
