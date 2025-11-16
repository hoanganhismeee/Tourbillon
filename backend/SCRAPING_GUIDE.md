# Tourbillon Web Scraping Guide

## Overview
This guide provides step-by-step instructions for scraping watch data directly from **official luxury watch brand websites** (Patek Philippe, Vacheron Constantin, Audemars Piguet, etc.) for the Tourbillon e-commerce platform.

## Why Official Brand Websites?
✅ **Professional images** - High-quality Cloudinary CDN images
✅ **Accurate data** - Direct from manufacturer, no duplicates
✅ **Price on request** - Luxury aesthetic for haute horlogerie
✅ **Comprehensive specs** - Dial, Case, Strap, Movement details in structured JSON
✅ **No duplicates** - Clean reference number matching

## 🎯 **SHOWCASE WATCH IMAGE PRESERVATION**

### **The 9 Holy Trinity Showcase Watches**
These watches are seeded from CSV with curated images that will be **automatically preserved** during scraping:

| ID | Brand | Model | Curated Image |
|----|-------|-------|---------------|
| 2 | Patek Philippe | 5227G-010 Automatic Date | `PP5227G.png` |
| 4 | Patek Philippe | 5811/1G Blue Dial | `PP58111G.png` |
| 11 | Patek Philippe | 5303R Minute Repeater Tourbillon | `PP5303R.png` |
| 13 | Vacheron Constantin | 43175 Perpetual Calendar | `VC43175.webp` |
| 18 | Vacheron Constantin | 6000V Overseas Tourbillon | `VC6000V.webp` |
| 24 | Vacheron Constantin | 6007A Scorpio Celestial | `VC6007A.webp` |
| 28 | Audemars Piguet | 16202ST "Jumbo" Extra-Thin | `AP16202ST.webp` |
| 30 | Audemars Piguet | Perpetual Calendar | `APRO26574.png` |
| 35 | Audemars Piguet | Concept Flying Tourbillon GMT | `AP26589.webp` |

### **How Image Preservation Works**

1. **Reference Number Matching**: The system automatically matches watches by extracting reference numbers (e.g., `5227G`, `5811/1G`, `16202ST`) from both CSV and scraped names
2. **Smart Detection**: When scraping finds a watch matching one of the 9 showcase reference numbers, it:
   - ✅ Updates the price with current market data
   - ✅ **Preserves the curated image** (does not overwrite)
   - ✅ Logs: `"Preserved curated image for showcase watch ID X"`
3. **Automatic Process**: No manual intervention needed - just scrape normally!

**Example:**
- CSV has: `"5227G-010 Automatic Date"` with image `PP5227G.png`
- Official website scrapes: `"5227G-010"` (reference number only)
- System extracts `5227G` from both → **Match found** → Price/specs update, image preserved ✅

---

## 🏗️ **SCRAPING ARCHITECTURE**

### **Universal BrandScraperService**

The scraper uses a **single universal service** (`BrandScraperService.cs`) for all 15 brands. Each brand has a configuration defining its specific XPath selectors and collection URLs.

**Key Files:**
- `Services/BrandScraperService.cs` - Universal scraper (one service for all brands)
- `Models/BrandScraperConfig.cs` - Brand-specific XPath configurations
- `Models/WatchSpecs.cs` - Structured JSON specs (Dial, Case, Strap, Movement)
- `Services/Chrono24CacheService.cs` - Database operations (with showcase preservation)

### **How the Scraper Works**

**Step 1: Product Card Scraping**
- Fetches collection listing page (e.g., `patek.com/en/collection/calatrava/all-watches`)
- Extracts: reference number, collection name, material, image URL, detail page link

**Step 2: Detail Page Scraping**
- Visits each watch's detail page
- Extracts:
  - **Price** (converted to AUD `$XX,XXX.00` format or "Price on request")
  - **Comprehensive specs**:
    - Dial: description, color, markers, hands
    - Case: material, diameter, thickness, water resistance, crystal
    - Strap: material, color, buckle
    - Movement: caliber, type, complications, diameter, thickness, parts, jewels, power reserve, rotor, frequency, balance spring, hallmark
  - **High-resolution images** from Cloudinary CDN (highest quality from srcset)

**Step 3: Database Storage**
- **Watch.Name** = Reference number only (e.g., "5227G-010")
- **Watch.BrandId** / **Watch.CollectionId** = Separate fields
- **Watch.Specs** = Structured JSON (see WatchSpecs model)
- **Watch.Image** = Cloudinary URL (preserved for showcase watches)
- **Watch.CurrentPrice** = "$XX,XXX.00" or "Price on request"

**Step 4: Duplicate Prevention**
- Base reference matching: "5227G" matches "5227G-010"
- If showcase watch found: Updates price/specs, **PRESERVES image**
- If duplicate found: Skips (logs warning)
- If new watch: Creates with all data

---

## 🔌 **SCRAPING ENDPOINT**

### **API Endpoint**
```
POST /api/admin/scrape-brand-official?brand={brandName}&collection={collectionName}&maxWatches={number}
```

### **Parameters**
- `brand` - Brand name (must match database exactly, e.g., "Patek Philippe")
- `collection` - Collection name (must match database, e.g., "Calatrava")
- `maxWatches` - Maximum watches to scrape (default: 50)

### **Example Usage**
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Calatrava&maxWatches=10"
```

### **Response**
```json
{
  "Success": true,
  "Message": "Successfully cached 8 out of 10 watches",
  "Brand": "Patek Philippe",
  "Collection": "Calatrava",
  "WatchesScraped": 10,
  "WatchesAdded": 8,
  "Timestamp": "2025-11-16T23:30:00Z"
}
```

**Notes:**
- `WatchesScraped` = Total watches fetched from website
- `WatchesAdded` = New watches added (excludes duplicates and showcase watch updates)

---

## 📊 **STRUCTURED WATCH SPECIFICATIONS**

Watches store comprehensive specs as structured JSON in the `Watch.Specs` field:

```json
{
  "dial": {
    "description": "Lacquered black, white gold applied faceted trapeze-style hour markers",
    "color": "Black",
    "markers": "White gold faceted trapeze-style",
    "hands": "White gold faceted dauphine-style"
  },
  "case": {
    "material": "White gold",
    "diameter": "39 mm",
    "thickness": "9.24 mm",
    "waterResistance": "30m",
    "crystal": "Sapphire",
    "caseBack": "Sapphire crystal case back protected by dust cover"
  },
  "strap": {
    "material": "Alligator leather with square scales",
    "color": "Shiny black",
    "buckle": "White gold prong buckle"
  },
  "movement": {
    "caliber": "26-330 S C",
    "type": "Automatic (Self-winding)",
    "complications": ["Date in an aperture", "Sweep seconds"],
    "diameter": "27 mm",
    "thickness": "3.32 mm",
    "parts": 212,
    "jewels": 30,
    "powerReserve": "35-45 hours",
    "rotor": "21K gold central rotor",
    "frequency": "28,800 semi-oscillations/hour (4 Hz)",
    "balanceSpring": "Spiromax®",
    "hallmark": "Patek Philippe Seal"
  }
}
```

**Note:** If a brand's website doesn't list certain fields, they are left blank/null.

---

## 📝 **IMPORTANT NOTES**
- **Delays**: Wait 30 seconds between collections to avoid rate limiting
- **Sequential Execution**: Scrape one collection at a time
- **Currency**: All prices converted to AUD (format: `$XX,XXX.00`)
- **Watch Naming**: Reference number only (e.g., "5227G-010", not "Patek Philippe Calatrava 5227G-010")
- **Images**: Cloudinary URLs stored directly (no local download except showcase watches)

## 📦 **PRODUCT DISTRIBUTION STRATEGY**

### Holy Trinity Brands (35 products each)
- **Patek Philippe** - 4 collections (Calatrava, Nautilus, Aquanaut, Grand Complications)
- **Vacheron Constantin** - 5 collections (Patrimony, Overseas, Historiques, Métiers d'Art, Les Cabinotiers)
- **Audemars Piguet** - 3 collections (Royal Oak, Royal Oak Offshore, Royal Oak Concept)

### Premium Brands (25 products each)
- **F.P.Journe** - 3 collections (Chronomètre Souverain, Octa, Tourbillon Souverain)
- **Greubel Forsey** - 4 collections (Double Tourbillon 30°, Tourbillon 24 Secondes, Balancier Convexe, QP à Équation)
- **Breguet** - 4 collections (Classique, Marine, Tradition, Reine de Naples)
- **Blancpain** - 4 collections (Fifty Fathoms, Villeret, Air Command, Ladybird)
- **IWC Schaffhausen** - 4 collections (Portugieser, Pilot's Watches, Ingenieur, Portofino)
- **Frederique Constant** - 4 collections (Classics, Slimline, Manufacture, Highlife)

### Other Brands (25-35 products each)
- **Jaeger-LeCoultre** - 4 collections (Reverso, Master Ultra Thin, Polaris, Duomètre)
- **A. Lange & Söhne** - 4 collections (Lange 1, Zeitwerk, Datograph, Saxonia)
- **Glashütte Original** - 4 collections (Senator, PanoMatic, SeaQ, Spezialist)
- **Rolex** - 5 collections (Submariner, Daytona, Datejust, GMT-Master II, Day-Date)
- **Omega** - 4 collections (Speedmaster, Seamaster, Constellation, De Ville)
- **Grand Seiko** - 4 collections (Heritage Collection, Evolution 9, Elegance Collection, Sport Collection)

---

## 🚀 **SCRAPING WORKFLOW**

### 🔧 **CONFIGURED BRAND: Patek Philippe** (Ready to scrape)

**Target: 35 watches across 4 collections (~9 per collection)**

#### Collection 1: Calatrava (~9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9"
```
*Wait 30 seconds*

#### Collection 2: Nautilus (~9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Nautilus&maxWatches=9"
```
*Wait 30 seconds*

#### Collection 3: Aquanaut (~9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Aquanaut&maxWatches=9"
```
*Wait 30 seconds*

#### Collection 4: Grand Complications (~8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Patek%20Philippe&collection=Grand%20Complications&maxWatches=8"
```

**Total: ~35 watches for Patek Philippe**

---

### ⚙️ **UNCONFIGURED BRANDS** (Require configuration first)

The following 14 brands need their configurations added to `BrandScraperService.InitializeBrandConfigs()` before scraping:

1. **Vacheron Constantin** (Holy Trinity - 35 watches)
2. **Audemars Piguet** (Holy Trinity - 35 watches)
3. **Jaeger-LeCoultre** (30 watches)
4. **A. Lange & Söhne** (30 watches)
5. **Glashütte Original** (30 watches)
6. **F.P.Journe** (25 watches)
7. **Greubel Forsey** (25 watches)
8. **Rolex** (30 watches)
9. **Breguet** (25 watches)
10. **Blancpain** (25 watches)
11. **Omega** (30 watches)
12. **Grand Seiko** (30 watches)
13. **IWC Schaffhausen** (25 watches)
14. **Frederique Constant** (25 watches)

---

## 🛠️ **ADDING NEW BRANDS**

To add a new brand configuration (e.g., Vacheron Constantin):

### Step 1: Inspect HTML Elements

Visit the brand's official website and inspect the HTML:

**Product Listing Page:**
- Find the product card container selector
- Locate reference number, collection name, material text
- Find image element and detail page link

**Detail Page:**
- Locate price element
- Find specs sections: Dial, Case, Strap, Movement
- Note any special accordion/tab structures

### Step 2: Add Configuration to BrandScraperService

Edit `backend/Services/BrandScraperService.cs` in the `InitializeBrandConfigs()` method:

```csharp
_brandConfigs["Vacheron Constantin"] = new BrandScraperConfig
{
    BrandName = "Vacheron Constantin",
    BaseUrl = "https://www.vacheron-constantin.com",
    CollectionUrls = new Dictionary<string, string>
    {
        { "Patrimony", "/au/en/watches/all-collections/patrimony.html" },
        { "Overseas", "/au/en/watches/all-collections/overseas.html" },
        { "Historiques", "/au/en/watches/all-collections/historiques.html" },
        { "Métiers d'Art", "/au/en/watches/all-collections/metiers-dart.html" },
        { "Les Cabinotiers", "/au/en/watches/all-collections/les-cabinotiers.html" }
    },
    ProductCard = new ProductCardSelectors
    {
        CardContainer = "a[class*='product-card']",
        ReferenceNumber = "h2[class*='ref']",
        CollectionName = "h3[class*='collection']",
        CaseMaterial = "p[class*='material']",
        Image = "img[class*='product-image']",
        DetailPageLink = "" // Card itself is link
    },
    DetailPage = new DetailPageSelectors
    {
        Price = "div[class*='price'] p",
        ReferenceNumber = "h2[class*='title']",
        CollectionName = "h3[class*='subtitle']",
        DialSpecs = "div[data-section='dial']",
        CaseSpecs = "div[data-section='case']",
        StrapSpecs = "div[data-section='strap']",
        MovementSpecs = "div[data-section='movement']"
    },
    RequiresJavaScript = true, // If site uses React/Vue
    Currency = "AUD",
    RequestDelayMs = 2000
};
```

### Step 3: Test the Configuration

```bash
# Test with just 1-2 watches first
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron%20Constantin&collection=Overseas&maxWatches=2"
```

### Step 4: Verify Results

Check the response JSON and database to ensure:
- ✅ Reference numbers extracted correctly
- ✅ Prices formatted correctly ($XX,XXX.00 or "Price on request")
- ✅ Specs JSON populated with available fields
- ✅ Images are Cloudinary URLs
- ✅ No duplicates created

### Step 5: Scale Up

Once verified, scrape all collections for the brand:

```bash
# Vacheron Constantin - Patrimony (~7 watches)
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=Vacheron%20Constantin&collection=Patrimony&maxWatches=7"
```

---

## ✅ **VERIFICATION & TROUBLESHOOTING**

### Check Scraping Stats

```bash
curl -X GET "http://localhost:5248/api/admin/scrape-stats"
```

**Expected Response:**
```json
{
  "totalWatches": 44,
  "watchesByBrand": [
    {"brand": "Patek Philippe", "count": 35},
    {"brand": "Vacheron Constantin", "count": 3},
    {"brand": "Audemars Piguet", "count": 3}
  ]
}
```

### Clear Database (if needed)

To remove all **scraped** watches (preserves the 9 showcase watches):

```bash
curl -X DELETE "http://localhost:5248/api/admin/clear-watches"
```

**Note**: Showcase watches (IDs 2, 4, 11, 13, 18, 24, 28, 30, 35) are always preserved with their curated images.

### Verify Showcase Watch Preservation

After scraping, check backend logs for:
```
Matched by reference number: 5227G - Existing: 5227G-010 Automatic Date, Scraped: 5227G-010
Preserved curated image for showcase watch ID 2 (image: PP5227G.png)
```

This confirms curated images are being preserved! ✅

### Expected Totals

- **Total watches**: ~440-450 watches (including 9 showcase)
- **Holy Trinity**: 105 watches (35 each × 3 brands)
- **Premium brands**: 150 watches (25 each × 6 brands)
- **Other brands**: ~185-195 watches

---

## 🚨 **TROUBLESHOOTING**

### If scraping fails:
1. Check if brand website is accessible
2. Verify brand/collection names match database exactly (case-sensitive)
3. Inspect HTML structure hasn't changed (XPath selectors may need updating)
4. Check backend logs for detailed error messages
5. Ensure backend was restarted after code changes

### If prices seem wrong:
- All prices are automatically converted to AUD with `.00` format
- Exchange rates are hardcoded in `CurrencyConverter.cs`
- "Price on request" is used when price element is missing or says "contact"

### If showcase images aren't preserved:
1. Check backend logs for "Matched by reference number" messages
2. Verify the 9 showcase watches seeded correctly (IDs 2, 4, 11, 13, 18, 24, 28, 30, 35)
3. Make sure reference numbers in CSV match scraped data (e.g., `5227G`, `5811/1G`)
4. The system matches by extracting reference numbers - watch names don't need to match exactly

### If duplicate watches appear:
- The system uses base reference matching: "5227G" matches "5227G-010"
- If duplicates occur, check `ExtractBaseReference()` in `Chrono24CacheService.cs`
- Verify watch names from scraper contain clear reference numbers

### If specs are missing:
- Check that detail page XPath selectors are correct
- Some brands may not provide all spec fields - blank fields are normal
- Verify specs are being parsed correctly in `ExtractSpecs()` method

---

## 📚 **INITIAL SETUP** (First Time Only)

Before scraping, ensure the database is properly seeded:

1. **Start the backend** (auto-seeds brands, collections, and 9 showcase watches):
```bash
cd backend
dotnet run
```

2. **Verify showcase watches loaded**:
```bash
curl -X GET "http://localhost:5248/api/admin/scrape-stats"
```

You should see:
```json
{
  "totalWatches": 9,
  "watchesByBrand": [
    {"brand": "Patek Philippe", "count": 3},
    {"brand": "Vacheron Constantin", "count": 3},
    {"brand": "Audemars Piguet", "count": 3}
  ]
}
```

✅ **If you see 9 watches (3 per brand), you're ready to start scraping!**

---

## 🎯 **SUMMARY**

**Current Status:**
- ✅ Patek Philippe - CONFIGURED (ready to scrape)
- ⚙️ 14 brands - NEED CONFIGURATION (send HTML elements to add)

**Next Steps:**
1. Scrape Patek Philippe collections (4 collections, ~35 watches)
2. Send HTML elements for Vacheron Constantin
3. Add VC configuration and test
4. Repeat for remaining 13 brands

**For Future Sessions:**
- Reference this guide with `@backend/SCRAPING_GUIDE.md`
- All scraper architecture and patterns are documented above
- Just provide HTML elements, update configurations, and scrape!

---

### 📝 **OLD WORKFLOW (DEPRECATED - DO NOT USE)**

The following sections document the legacy Chrono24 scraping workflow. **This is no longer used.** All scraping is now done from official brand websites.

<details>
<summary>Click to view old Chrono24 workflow (deprecated)</summary>

### Step 2: Vacheron Constantin (Holy Trinity - DEPRECATED)

**Target: 35 watches across 5 collections (~7 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Patrimony (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Patrimony&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 2: Overseas (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Overseas&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 3: Historiques (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Historiques&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 4: Métiers d'Art (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=M%C3%A9tiers%20d%27Art&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 5: Les Cabinotiers (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Les%20Cabinotiers&maxWatches=7"
```

**Total: ~35 watches for Vacheron Constantin**

---

### Step 3: Audemars Piguet (Holy Trinity)

**Target: 35 watches across 3 collections (~12 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Royal Oak (12 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Audemars%20Piguet&collection=Royal%20Oak&maxWatches=12"
```
*Wait 30-60 seconds*

#### Collection 2: Royal Oak Offshore (12 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Audemars%20Piguet&collection=Royal%20Oak%20Offshore&maxWatches=12"
```
*Wait 30-60 seconds*

#### Collection 3: Royal Oak Concept (11 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Audemars%20Piguet&collection=Royal%20Oak%20Concept&maxWatches=11"
```

**Total: ~35 watches for Audemars Piguet**

---

### Step 4: Jaeger-LeCoultre

**Target: 30 watches across 4 collections (~7-8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Reverso (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Reverso&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 2: Master Ultra Thin (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Master%20Ultra%20Thin&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Polaris (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Polaris&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 4: Duomètre (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Duom%C3%A8tre&maxWatches=7"
```

**Total: ~30 watches for Jaeger-LeCoultre**

---

### Step 5: A. Lange & Söhne

**Target: 30 watches across 4 collections (~7-8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Lange 1 (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Lange%201&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 2: Zeitwerk (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Zeitwerk&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Datograph (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Datograph&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 4: Saxonia (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Saxonia&maxWatches=7"
```

**Total: ~30 watches for A. Lange & Söhne**

---

### Step 6: Glashütte Original

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Senator (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Glash%C3%BCtte%20Original&collection=Senator&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: PanoMatic (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Glash%C3%BCtte%20Original&collection=PanoMatic&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: SeaQ (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Glash%C3%BCtte%20Original&collection=SeaQ&maxWatches=8"
```

**Total: ~25 watches for Glashütte Original**

---

### Step 7: F.P. Journe (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Chronomètre Souverain (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=F.P.Journe&collection=Chronom%C3%A8tre%20Souverain&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Octa (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=F.P.Journe&collection=Octa&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Tourbillon Souverain (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=F.P.Journe&collection=Tourbillon%20Souverain&maxWatches=8"
```

**Total: ~25 watches for F.P. Journe**

---

### Step 8: Greubel Forsey (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Double Tourbillon 30° (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Greubel%20Forsey&collection=Double%20Tourbillon%2030%C2%B0&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Tourbillon 24 Secondes (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Greubel%20Forsey&collection=Tourbillon%2024%20Secondes&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Balancier Convexe (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Greubel%20Forsey&collection=Balancier%20Convexe&maxWatches=8"
```

**Total: ~25 watches for Greubel Forsey**

---

### Step 9: Rolex

**Target: 30 watches across 4 collections (~7-8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Submariner (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=Submariner&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 2: Daytona (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=Daytona&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: GMT-Master II (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=GMT-Master%20II&maxWatches=7"
```
*Wait 30-60 seconds*

#### Collection 4: Day-Date (7 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=Day-Date&maxWatches=7"
```

**Total: ~30 watches for Rolex**

---

### Step 10: Breguet (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Classique (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Breguet&collection=Classique&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Marine (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Breguet&collection=Marine&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Tradition (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Breguet&collection=Tradition&maxWatches=8"
```

**Total: ~25 watches for Breguet**

---

### Step 11: Blancpain (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Fifty Fathoms (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Blancpain&collection=Fifty%20Fathoms&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Villeret (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Blancpain&collection=Villeret&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Air Command (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Blancpain&collection=Air%20Command&maxWatches=8"
```

**Total: ~25 watches for Blancpain**

---

### Step 12: Omega

**Target: 30 watches across 3 collections (~10 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Speedmaster (10 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Omega&collection=Speedmaster&maxWatches=10"
```
*Wait 30-60 seconds*

#### Collection 2: Seamaster (10 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Omega&collection=Seamaster&maxWatches=10"
```
*Wait 30-60 seconds*

#### Collection 3: Constellation (10 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Omega&collection=Constellation&maxWatches=10"
```

**Total: ~30 watches for Omega**

---

### Step 13: Grand Seiko

**Target: 30 watches across 3 collections (~10 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Heritage Collection (10 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Grand%20Seiko&collection=Heritage%20Collection&maxWatches=10"
```
*Wait 30-60 seconds*

#### Collection 2: Evolution 9 (10 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Grand%20Seiko&collection=Evolution%209&maxWatches=10"
```
*Wait 30-60 seconds*

#### Collection 3: Sport Collection (10 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Grand%20Seiko&collection=Sport%20Collection&maxWatches=10"
```

**Total: ~30 watches for Grand Seiko**

---

### Step 14: IWC Schaffhausen (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Portugieser (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=IWC%20Schaffhausen&collection=Portugieser&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Pilot's Watches (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=IWC%20Schaffhausen&collection=Pilot%27s%20Watches&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Ingenieur (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=IWC%20Schaffhausen&collection=Ingenieur&maxWatches=8"
```

**Total: ~25 watches for IWC Schaffhausen**

---

### Step 15: Frederique Constant (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Classics (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Frederique%20Constant&collection=Classics&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Slimline (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Frederique%20Constant&collection=Slimline&maxWatches=8"
```
*Wait 30-60 seconds*

#### Collection 3: Manufacture (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Frederique%20Constant&collection=Manufacture&maxWatches=8"
```

**Total: ~25 watches for Frederique Constant**

---

## Initial Setup (First Time Only)

Before scraping, ensure the database is properly seeded:

1. **Start the backend** (this automatically seeds brands, collections, and the 9 showcase watches):
```bash
cd backend
dotnet run
```

2. **Verify showcase watches loaded**:
```bash
curl -X GET "http://localhost:5248/api/admin/scrape-stats"
```

You should see:
```json
{
  "totalWatches": 9,
  "watchesByBrand": [
    {"brand": "Patek Philippe", "count": 3},
    {"brand": "Vacheron Constantin", "count": 3},
    {"brand": "Audemars Piguet", "count": 3}
  ]
}
```

✅ **If you see 9 watches (3 per brand), you're ready to start scraping!**

---

## Verification

After scraping, verify your data:

```bash
curl -X GET "http://localhost:5248/api/admin/scrape-stats"
```

### Clear Database (if needed)
To remove all **scraped** watches (keeps the 9 showcase watches):

```bash
curl -X DELETE "http://localhost:5248/api/admin/clear-watches"
```

**Note**: The 9 showcase watches (IDs 2, 4, 11, 13, 18, 24, 28, 30, 35) are always preserved with their curated images.

### Expected Totals
- **Total watches**: ~440-450 watches (including 9 showcase)
- **Holy Trinity**: 105 watches (35 each × 3 brands)
- **Premium brands**: 150 watches (25 each × 6 brands)
- **Other brands**: ~185-195 watches

### Verifying Showcase Watch Image Preservation

After scraping, check the backend logs for messages like:
```
Matched by reference number: 5227G - Existing: 5227G-010 Automatic Date, Scraped: Patek Philippe Calatrava 5227G...
Preserved curated image for showcase watch ID 2: ... (image: PP5227G.png)
```

This confirms the curated images are being preserved! ✅

---

## Troubleshooting

### If scraping fails:
1. Check if Chrono24 is accessible
2. Verify the brand/collection names match exactly (case-sensitive)
3. Increase delays between requests
4. Check logs for detailed error messages
5. Ensure backend was restarted after code changes

### If prices seem wrong:
- All prices are automatically converted to AUD with `.000` format
- Chrono24 shows USD/EUR by default, converter handles this
- Exchange rates are hardcoded in `CurrencyConverter.cs`

### If showcase images aren't preserved:
1. Check backend logs for "Matched by reference number" messages
2. Verify the 9 showcase watches seeded correctly (should see IDs 2, 4, 11, 13, 18, 24, 28, 30, 35)
3. Make sure reference numbers in CSV match scraped data (e.g., `5227G`, `5811/1G`, `16202ST`)
4. The system matches by extracting reference numbers - watch names don't need to match exactly

### If duplicate watches appear:
- The system uses reference number extraction to match watches
- If duplicates occur, verify `ExtractReferenceNumber()` in `Chrono24CacheService.cs` is working correctly
- Check that watch names contain clear reference numbers (e.g., `5227G`, `16202ST`)

