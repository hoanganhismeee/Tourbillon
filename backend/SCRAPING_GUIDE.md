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

**A. Lange & Söhne (brandId 5, ~32 watches total - 3-level navigation):**
```cmd
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Lange+1&maxWatches=10" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Zeitwerk&maxWatches=8" && timeout /t 5 /nobreak && curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=A.+Lange+and+Sohne&collection=Saxonia&maxWatches=14" && timeout /t 5 /nobreak && curl "http://localhost:5248/api/admin/scrape-stats"
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

**📌 IMPORTANT:** Before starting, read the "📝 Best Practices for Brand Configuration" section below to avoid common pitfalls like missing images or collection names.

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

## 📝 Best Practices for Brand Configuration

### Lesson from JLC: Comprehensive Element Collection

**Before configuring any new brand:**

1. **Collect ALL collection examples** in `Brands_Scrape_Config.md`:
   - Don't just grab one product card—inspect 3-5 from EACH collection
   - Check if collection names vary (e.g., "Reverso" vs "Reverso Tribute")
   - Verify images load consistently across products
   - Note any products without images or collection names

2. **Document edge cases:**
   - Products with "Price on request" instead of numeric prices
   - Products using lazy-loading for images (`data-src`, `data-srcset`)
   - Sub-collections that need parsing (e.g., "Master Ultra Thin Moon" → "Master Ultra Thin")
   - Products that appear on wrong collection pages

3. **Quality-First Validation:**
   - Configure scraper to SKIP products missing required fields
   - Required fields: Collection name, Image URL, Reference number
   - Log skipped products for debugging, but don't save incomplete data
   - Better to have 25 perfect watches than 30 watches with 5 broken ones

### Configuration Checklist

Before adding a brand to `brand-configs.json`:

- [ ] Collected HTML for 3+ products from EACH collection
- [ ] Verified collection name selector works across all collections
- [ ] Verified image selector handles lazy-loading (data-src, data-srcset, srcset, src)
- [ ] Checked for sub-collection naming patterns
- [ ] Tested reference number extraction (URL patterns, HTML attributes, text content)
- [ ] Documented any edge cases in `Brands_Scrape_Config.md`

### Common Pitfalls

| Issue | Cause | Solution |
|-------|-------|----------|
| Missing collection names | Selector targets sub-collection variants | Parse first word or use broader selector |
| Missing images | Lazy-loading not handled | Check data-src/data-srcset before src |
| Wrong collection products | Brand website cross-links collections | Add validation to skip mismatched collections |
| Empty price fields | "Price on request" not handled | Regex should check for "request"/"contact" keywords |
| **0 watches for multi-word collections** | Card shows "Master" but request is "Master Ultra Thin" - one-way match fails | Check BOTH directions: `card.Contains(request) OR request.Contains(card)` |

### Debug Commands

When testing a new brand configuration:

```cmd
REM Test with 2 watches first
curl -X POST "http://localhost:5248/api/admin/scrape-brand-official?brand=BRAND&collection=COLLECTION&maxWatches=2"

REM Check backend logs for "Skipping" messages
REM Look for: missing collection, missing image, failed extraction

REM If issues found, update selectors and retry
curl -X DELETE "http://localhost:5248/api/admin/clear-watches?brandId=X"
```

---

## 🔬 ALS Case Study: Multi-Level Navigation Pattern

### The Challenge: 3-Level Page Navigation

**A. Lange & Söhne (ALS)** was the first brand requiring **3-level navigation**, unlike the standard 2-level (listing → detail) pattern used by other brands.

#### Page Structure
```
Level 1: Listing Page
  /au-en/timepieces/lange-1
  → Contains product cards with links to Level 2

Level 2: Intermediate Detail Page
  /au-en/timepieces/lange-1/lange-1-daymatic
  → Contains: Reference number, Model name, Subtitle
  → Contains: Link to Level 3 specs page
  → Does NOT contain: Technical specifications

Level 3: Final Specs Page
  /au-en/timepieces/lange-1/lange-1-daymatic-honeygold/lange-1-daymatic-honeygold-in-750-honeygold-320-050
  → Contains: Technical specifications (case, movement, etc.)
  → Does NOT contain: Reference number or model name
```

### 🚨 The Critical Mistake

**Initial Implementation:** Extract all data after navigating to specs page

```csharp
// ❌ WRONG ORDER - This will fail
var html = FetchDetailPage(level2Url);
doc.LoadHtml(html);

// Try to extract reference number
var refNum = doc.SelectSingleNode("//h3//span").InnerText;  // ❌ This selector exists on Level 2, not Level 3!

// Then navigate to specs
var specsLink = doc.SelectSingleNode(config.DetailPage.SpecsPageLink).GetAttribute("href");
var specsHtml = FetchDetailPage(specsUrl);
doc.LoadHtml(specsHtml);  // ❌ doc is now Level 3 - ref number is gone!

// Try to extract specs
var caseSpecs = doc.SelectSingleNode("//technical-details...").InnerText;
```

**Result:**
- ❌ Reference numbers empty (selector doesn't exist on Level 3)
- ❌ Duplicate watches (DOM rendering artifacts)
- ❌ Collection extraction unreliable (parsing HTML variants failed)

### ✅ The Solution: Extract Before Navigation

**Corrected Implementation:** Extract data from each level BEFORE navigating to next level

```csharp
// ✅ CORRECT ORDER - Extract from Level 2 FIRST
var html = FetchDetailPage(level2Url);
doc.LoadHtml(html);

// Extract EVERYTHING available on Level 2 immediately
var referenceNumber = doc.SelectSingleNode(config.DetailPage.ReferenceNumber)?.InnerText?.Trim() ?? "";
var modelName = doc.SelectSingleNode(config.DetailPage.ModelName)?.InnerText?.Trim() ?? "";
var subtitle = doc.DocumentNode.SelectSingleNode("//div[@data-cy='single-push']")?.GetAttributeValue("subtitle", "");

// NOW navigate to specs (Level 3)
var specsUrl = BuildSpecsUrl(doc, baseUrl);  // Extract from Level 2 before navigating
doc.LoadHtml(FetchDetailPage(specsUrl));

// Extract specs from Level 3
var caseSpecs = doc.SelectSingleNode("//technical-details...").InnerText;

// Save with data extracted from correct levels
SaveWatch(referenceNumber, modelName, subtitle, caseSpecs);
```

**Key Insight:** When navigating between pages, the document object (`HtmlDocument`) is replaced. Any selectors that exist on the previous page become invalid after `LoadHtml()` is called with new content.

### 🎯 Lessons for Future Brands

#### 1. **Inspect Multi-Level Navigation Early**
Before writing code, manually trace through all pages:
- [ ] Are reference numbers visible on Level 1? Level 2? Level 3?
- [ ] Where is each required field located?
- [ ] Do some fields exist on intermediate pages that won't appear on final pages?
- **Action:** Document page structure in `Brands_Scrape_Config.md` BEFORE coding

#### 2. **Use Configuration to Signal Multi-Level Navigation**
Added three new optional properties to detect multi-level patterns:

```csharp
public class DetailPageSelectors
{
    public string? SpecsPageLink { get; set; }    // Link from Level 2 → Level 3
    public string? ModelName { get; set; }        // Exists on Level 2 only
    public string? Subtitle { get; set; }         // Exists on Level 2 only
}
```

**Pattern Recognition:** If `SpecsPageLink` is configured, the scraper knows to:
1. Extract model name + subtitle from Level 2
2. Navigate to Level 3
3. Extract specs from Level 3

#### 3. **Prefer URL-Based Collection Extraction Over HTML Parsing**

**Why URL patterns are more reliable:**

```csharp
// ❌ HTML-based (fails for variants)
var collectionName = doc.SelectSingleNode("//h3[@class='collection']").InnerText;
// Returns: "LANGE 1 DAYMATIC" (variant), not "Lange 1" (database name)
// Requires complex parsing logic

// ✅ URL-based (always accurate)
var urlMatch = Regex.Match(url, @"/timepieces/([^/]+)/");
if (urlMatch.Success)
{
    var collectionSlug = urlMatch.Groups[1].Value;  // "lange-1"
    var collectionName = collectionSlug switch
    {
        "lange-1" => "Lange 1",
        "zeitwerk" => "Zeitwerk",
        "saxonia" => "Saxonia",
        _ => ""
    };
}
```

**Advantage:** URL slugs are controlled by the brand (they don't change), whereas HTML text varies (LANGE 1, LANGE 1 DAYMATIC, LANGE 1 DAYMATIC HONEYGOLD, etc.).

#### 4. **Handle DOM Duplication**

Product cards can appear twice in the rendered HTML (Selenium rendering artifact):

```csharp
var seenDetailUrls = new HashSet<string>();

foreach (var productCard in doc.SelectNodes(config.ProductCard.CardContainer))
{
    var detailUrl = ExtractUrl(productCard);

    // Skip if we've already processed this URL
    if (seenDetailUrls.Contains(detailUrl))
    {
        _logger.LogWarning("Skipping duplicate detail URL: {Url}", detailUrl);
        continue;
    }

    seenDetailUrls.Add(detailUrl);
    // Process product...
}
```

**Why URL deduplication is better than reference number:**
- Product cards don't always contain reference numbers
- URL is always unique per product
- Catches DOM rendering artifacts early (before database operations)

#### 5. **Extract from HTML Attributes, Not Just Text Content**

ALS uses HTML attributes for variant information:

```html
<div class="single-push" collection="LANGE 1" subtitle="in 750 HONEYGOLD®">
  <!-- Content here -->
</div>
```

**Configuration approach:**
```json
{
  "CollectionName": "//div[contains(@class, 'single-push')]/@collection",
  "Subtitle": "@subtitle"
}
```

**Parser logic:**
```csharp
if (config.DetailPage.Subtitle.StartsWith("@"))
{
    var attrName = config.DetailPage.Subtitle.TrimStart('@');
    var containerNode = doc.DocumentNode.SelectSingleNode("//div[@data-cy='single-push']");
    var subtitleText = containerNode?.GetAttributeValue(attrName, "") ?? "";
}
```

### 📊 Configuration Template for Multi-Level Brands

When you encounter a brand with 3+ page levels:

```json
{
  "BrandName": "New Brand",
  "BaseUrl": "https://example.com",
  "CollectionUrls": { },
  "ProductCard": {
    "CardContainer": "//selector/to/card",
    "ReferenceNumber": "",  // Empty if not on listing page
    "CollectionName": "",   // Empty if not on listing page
    "DetailPageLink": ".//a[href]/@href"
  },
  "DetailPage": {
    "ReferenceNumber": "//h3//span",           // Level 2
    "ModelName": "//h2",                       // Level 2
    "Subtitle": "@subtitle-attribute",        // Level 2
    "SpecsPageLink": "//a[@class='btn']/@href",  // NEW: Link to Level 3
    "Price": "//span[@class='price']",        // Level 2
    "Image": "//img[1]",                      // Level 2 or Level 3
    "CaseSpecs": "//div[@class='specs']//li"  // Level 3
  },
  "RequiresJavaScript": true,
  "Currency": "USD"
}
```

### 🔍 Testing Checklist for Multi-Level Brands

After implementation:

- [ ] **Reference Numbers Not Empty**: Verify scraper extracts from correct level
- [ ] **No Duplicates**: Check deduplication logic catches DOM artifacts
- [ ] **Collection Names Match Database**: Test URL extraction + mapping for all collections
- [ ] **Images Present**: Verify image extraction from correct level (often the final level)
- [ ] **Specs Complete**: Test that specs from final level are captured correctly
- [ ] **All Levels Navigate Correctly**: Check backend logs for navigation confirmation

### 📝 Real Numbers: ALS Scraping Results

**Before fixes:**
- 0 watches scraped (reference numbers empty)

**After execution order fix:**
- 2 duplicate watches (same reference number)

**After URL deduplication + collection extraction:**
- ~32 unique watches across 3 collections ✅
- All reference numbers present ✅
- Collections correctly mapped ✅
- Images from Level 3 specs page ✅

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
