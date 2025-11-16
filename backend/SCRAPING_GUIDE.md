# Tourbillon Web Scraping Guide

## Overview
This guide provides step-by-step instructions for scraping watch data from Chrono24 for the Tourbillon e-commerce platform. All watches are scraped as **new/unworn** condition only.

## Important Notes
- **Delays**: Wait 30-60 seconds between requests to avoid detection
- **Manual Execution**: Scrape one brand at a time to appear less suspicious
- **Curated Images**: The 9 showcase watches will automatically use curated images instead of scraped ones
- **Currency**: All prices are automatically converted to AUD

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
POST http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Calatrava&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Nautilus (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Nautilus&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 3: Aquanaut (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Aquanaut&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 4: Grand Complications (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Patek%20Philippe&collection=Grand%20Complications&maxWatches=8
```

**Total: ~35 watches for Patek Philippe**

---

### Step 2: Vacheron Constantin (Holy Trinity)

**Target: 35 watches across 5 collections (~7 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Patrimony (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Patrimony&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 2: Overseas (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Overseas&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 3: Historiques (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Historiques&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 4: Métiers d'Art (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=M%C3%A9tiers%20d%27Art&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 5: Les Cabinotiers (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Vacheron%20Constantin&collection=Les%20Cabinotiers&maxWatches=7
```

**Total: ~35 watches for Vacheron Constantin**

---

### Step 3: Audemars Piguet (Holy Trinity)

**Target: 35 watches across 3 collections (~12 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Royal Oak (12 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Audemars%20Piguet&collection=Royal%20Oak&maxWatches=12
```
*Wait 30-60 seconds*

#### Collection 2: Royal Oak Offshore (12 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Audemars%20Piguet&collection=Royal%20Oak%20Offshore&maxWatches=12
```
*Wait 30-60 seconds*

#### Collection 3: Royal Oak Concept (11 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Audemars%20Piguet&collection=Royal%20Oak%20Concept&maxWatches=11
```

**Total: ~35 watches for Audemars Piguet**

---

### Step 4: Jaeger-LeCoultre

**Target: 30 watches across 4 collections (~7-8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Reverso (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Reverso&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 2: Master Ultra Thin (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Master%20Ultra%20Thin&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Polaris (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Polaris&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 4: Duomètre (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Jaeger-LeCoultre&collection=Duom%C3%A8tre&maxWatches=7
```

**Total: ~30 watches for Jaeger-LeCoultre**

---

### Step 5: A. Lange & Söhne

**Target: 30 watches across 4 collections (~7-8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Lange 1 (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Lange%201&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 2: Zeitwerk (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Zeitwerk&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Datograph (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Datograph&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 4: Saxonia (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=A.%20Lange%20%26%20S%C3%B6hne&collection=Saxonia&maxWatches=7
```

**Total: ~30 watches for A. Lange & Söhne**

---

### Step 6: Glashütte Original

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Senator (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Glash%C3%BCtte%20Original&collection=Senator&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: PanoMatic (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Glash%C3%BCtte%20Original&collection=PanoMatic&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: SeaQ (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Glash%C3%BCtte%20Original&collection=SeaQ&maxWatches=8
```

**Total: ~25 watches for Glashütte Original**

---

### Step 7: F.P. Journe (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Chronomètre Souverain (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=F.P.Journe&collection=Chronom%C3%A8tre%20Souverain&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Octa (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=F.P.Journe&collection=Octa&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Tourbillon Souverain (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=F.P.Journe&collection=Tourbillon%20Souverain&maxWatches=8
```

**Total: ~25 watches for F.P. Journe**

---

### Step 8: Greubel Forsey (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Double Tourbillon 30° (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Greubel%20Forsey&collection=Double%20Tourbillon%2030%C2%B0&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Tourbillon 24 Secondes (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Greubel%20Forsey&collection=Tourbillon%2024%20Secondes&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Balancier Convexe (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Greubel%20Forsey&collection=Balancier%20Convexe&maxWatches=8
```

**Total: ~25 watches for Greubel Forsey**

---

### Step 9: Rolex

**Target: 30 watches across 4 collections (~7-8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Submariner (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=Submariner&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 2: Daytona (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=Daytona&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: GMT-Master II (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=GMT-Master%20II&maxWatches=7
```
*Wait 30-60 seconds*

#### Collection 4: Day-Date (7 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Rolex&collection=Day-Date&maxWatches=7
```

**Total: ~30 watches for Rolex**

---

### Step 10: Breguet (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Classique (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Breguet&collection=Classique&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Marine (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Breguet&collection=Marine&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Tradition (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Breguet&collection=Tradition&maxWatches=8
```

**Total: ~25 watches for Breguet**

---

### Step 11: Blancpain (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Fifty Fathoms (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Blancpain&collection=Fifty%20Fathoms&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Villeret (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Blancpain&collection=Villeret&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Air Command (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Blancpain&collection=Air%20Command&maxWatches=8
```

**Total: ~25 watches for Blancpain**

---

### Step 12: Omega

**Target: 30 watches across 3 collections (~10 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Speedmaster (10 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Omega&collection=Speedmaster&maxWatches=10
```
*Wait 30-60 seconds*

#### Collection 2: Seamaster (10 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Omega&collection=Seamaster&maxWatches=10
```
*Wait 30-60 seconds*

#### Collection 3: Constellation (10 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Omega&collection=Constellation&maxWatches=10
```

**Total: ~30 watches for Omega**

---

### Step 13: Grand Seiko

**Target: 30 watches across 3 collections (~10 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Heritage Collection (10 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Grand%20Seiko&collection=Heritage%20Collection&maxWatches=10
```
*Wait 30-60 seconds*

#### Collection 2: Evolution 9 (10 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Grand%20Seiko&collection=Evolution%209&maxWatches=10
```
*Wait 30-60 seconds*

#### Collection 3: Sport Collection (10 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Grand%20Seiko&collection=Sport%20Collection&maxWatches=10
```

**Total: ~30 watches for Grand Seiko**

---

### Step 14: IWC Schaffhausen (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Portugieser (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=IWC%20Schaffhausen&collection=Portugieser&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Pilot's Watches (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=IWC%20Schaffhausen&collection=Pilot%27s%20Watches&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Ingenieur (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=IWC%20Schaffhausen&collection=Ingenieur&maxWatches=8
```

**Total: ~25 watches for IWC Schaffhausen**

---

### Step 15: Frederique Constant (Premium Brand)

**Target: 25 watches across 3 collections (~8 per collection)**

*Wait 2-3 minutes before starting this brand*

#### Collection 1: Classics (9 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Frederique%20Constant&collection=Classics&maxWatches=9
```
*Wait 30-60 seconds*

#### Collection 2: Slimline (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Frederique%20Constant&collection=Slimline&maxWatches=8
```
*Wait 30-60 seconds*

#### Collection 3: Manufacture (8 watches)
```bash
POST http://localhost:5248/api/admin/scrape-collection?brand=Frederique%20Constant&collection=Manufacture&maxWatches=8
```

**Total: ~25 watches for Frederique Constant**

---

## Verification

After scraping, verify your data:

```bash
GET http://localhost:5248/api/admin/scrape-stats
```

### Expected Totals
- **Total watches**: ~440-450 watches
- **Holy Trinity**: 105 watches (35 each × 3 brands)
- **Premium brands**: 150 watches (25 each × 6 brands)
- **Other brands**: ~185-195 watches

### Showcase Watches with Curated Images
The following 9 watches should use curated images (automatically detected by name):
1. Patek Philippe Calatrava Automatic Date → `PP5227G.png`
2. Patek Philippe Nautilus 5811 Blue Dial → `PP58111G.png`
3. Patek Philippe Minute Repeater Tourbillon → `PP5303R.png`
4. Vacheron Constantin Patrimony Perpetual Calendar → `VC43175.webp`
5. Vacheron Constantin Overseas Tourbillon → `VC6000V.webp`
6. Vacheron Constantin Métiers d'Art Scorpio → `VC6007A.jpg`
7. Audemars Piguet Royal Oak Jumbo 16202 → `AP16202ST.webp`
8. Audemars Piguet Royal Oak Perpetual Calendar → `APRO26574.png`
9. Audemars Piguet Royal Oak Concept Flying Tourbillon → `APROCONCEPTGMT.png`

---

## Troubleshooting

### If scraping fails:
1. Check if Chrono24 is accessible
2. Verify the brand/collection names match exactly (case-sensitive)
3. Increase delays between requests
4. Check logs for detailed error messages

### If prices seem wrong:
- All prices are automatically converted to AUD
- Chrono24 shows USD/EUR by default, converter handles this

### If showcase images don't match:
- Check `ShowcaseWatchMapping.cs` for name pattern matching
- Ensure curated image files exist in `backend/Images/` directory

