# Tourbillon Web Scraping Guide

## Overview
This guide provides step-by-step instructions for scraping watch data from Chrono24 for the Tourbillon e-commerce platform. All watches are scraped as **new/unworn** condition only.

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
- Chrono24 scrapes: `"Patek Philippe Calatrava 5227G-010 Full Set"`
- System extracts `5227G` from both → **Match found** → Price updates, image preserved ✅

## Important Notes
- **Delays**: Wait 30-60 seconds between requests to avoid detection
- **Manual Execution**: Scrape one brand at a time to appear less suspicious
- **Currency**: All prices are automatically converted to AUD
- **Condition Filter**: Only new/unworn watches are scraped (filter applied automatically)

## Product Distribution Strategy

### Holy Trinity Brands (35 products each)
- **Patek Philippe** - 4 collections
- **Vacheron Constantin** - 5 collections  
- **Audemars Piguet** - 3 collections

### Premium Brands (25 products each)
- **F.P. Journe** - 3 collections
- **Greubel Forsey** - 3 collections
- **Breguet** - 3 collections
- **Blancpain** - 3 collections
- **IWC Schaffhausen** - 3 collections
- **Frederique Constant** - 3 collections

### Other Brands (25-35 products each)
- **Jaeger-LeCoultre** - 4 collections
- **A. Lange & Söhne** - 4 collections
- **Glashütte Original** - 3 collections
- **Rolex** - 4 collections
- **Omega** - 3 collections
- **Grand Seiko** - 3 collections

---

## Scraping Workflow

### Step 1: Start with Patek Philippe (Holy Trinity)

**Target: 35 watches across 4 collections (~9 per collection)**

#### Collection 1: Calatrava (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 2: Nautilus (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Nautilus&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 3: Aquanaut (9 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Aquanaut&maxWatches=9"
```
*Wait 30-60 seconds*

#### Collection 4: Grand Complications (8 watches)
```bash
curl -X POST "http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Grand%20Complications&maxWatches=8"
```

**Total: ~35 watches for Patek Philippe**

---

### Step 2: Vacheron Constantin (Holy Trinity)

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

