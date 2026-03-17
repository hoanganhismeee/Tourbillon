# Next.js Admin Watch Management Interface

## Goal Description

The user needs a robust, reliable way to review and overwrite scraped watch data. Relying purely on automated image scraping has proven fragile, as many brands use lifestyle backgrounds or hands in their official product shots. The solution is a dedicated **Admin Watch Management Page** within the Next.js frontend. This interface allows the admin to manually edit any watch's name, specs, price, and most importantly, replace its image via direct file upload.

> **Decision**: A manual editing dashboard with file upload guarantees you get exactly the image you want, acts as a permanent fail-safe for any future data errors, and puts you in complete control. A wizard that scrapes 6 images and asks you to pick one is clever but ultimately less reliable and harder to maintain.

---

## Implementation Status: COMPLETE

### Backend

#### `backend/DTOs/UpdateWatchDto.cs` [NEW]
Data Transfer Object for receiving watch update payloads. Fields: `Name`, `Description`, `CurrentPrice` (decimal, AUD), `Image` (Cloudinary public_id), `CollectionId` (nullable int), `Specs` (JSON string).

#### `backend/Controllers/AdminController.cs` [MODIFIED]
Added CRUD and image upload endpoints:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/api/admin/watches` | GET | List all watches for admin grid |
| `/api/admin/watches/{id}` | GET | Full watch details including specs |
| `/api/admin/watches/{id}` | PUT | Update watch data (name, price, image, specs, collection). Validates price >= 0, collection belongs to brand, specs is valid JSON |
| `/api/admin/watches/upload-image` | POST | Accept `IFormFile` (max 10MB, PNG/JPG/WEBP), stream to Cloudinary, return `{ success, publicId }` |

#### `backend/Services/CloudinaryService.cs` [EXISTING]
- `UploadImageFromUrlAsync(url, publicId, folder)` — downloads image from URL, uploads to Cloudinary with `watches/{publicId}` path. Used by the scrape pipeline.
- `UploadImageAsync(stream, filename, folder)` — uploads from stream directly. Used by the manual file upload endpoint.
- `DeleteImageAsync(publicId)` — removes image from Cloudinary.
- All uploads use `Overwrite = true` to allow re-uploading.

### Frontend

#### `frontend/lib/api.ts` [MODIFIED]
Added admin functions:
- `adminFetchWatches()` — GET all watches for admin grid
- `adminFetchWatchById(id)` — GET full watch details
- `adminUpdateWatch(id, data: UpdateWatchDto)` — PUT to update watch
- `adminUploadWatchImage(file, slug?)` — POST multipart form to upload image, returns `{ success, publicId }`

#### `frontend/app/scrape/page.tsx` [NEW]
"Watch Review Studio" — admin page at `/scrape` with:
- Brand and collection cascading filter dropdowns
- Watch data table (ID, Image thumbnail, Name, Price, Actions)
- "Review / Edit" button per watch opens the editor modal

#### `frontend/app/scrape/components/WatchEditorModal.tsx` [NEW]
Two-column modal for editing individual watches:

**Left column — Image Review:**
- Current image preview (400px tall) using Cloudinary transformations
- Public ID display (read-only)
- Click-to-upload file input (PNG, JPG, WEBP)
- **Ctrl+V paste support** — paste an image from clipboard, auto-renamed to `{slugified-watch-name}-{timestamp}.png`, uploaded to Cloudinary immediately

**Right column — Data Editing:**
- Name input (shows original for comparison)
- Price input in AUD (shows "Price on request" when original is 0)
- Raw Specs JSON textarea with "Reset" button to revert
- Save / Cancel buttons

**Key behavior:**
- On file upload or paste: file is renamed to `{slugified-name}-{timestamp}.{ext}` before uploading
- Upload goes to `POST /api/admin/watches/upload-image` → Cloudinary → returns `publicId`
- On save: sends `UpdateWatchDto` with the Cloudinary `publicId` (not a URL) to `PUT /api/admin/watches/{id}`

### URL-to-Cloudinary Conversion

#### In the scrape pipeline (`SitemapScraperService.cs`):
1. Claude API extracts `imageUrl` from the product page HTML
2. If it's an HTTP URL, the service sanitizes the brand name + reference number into a `publicId`
3. Calls `CloudinaryService.UploadImageFromUrlAsync(imageUrl, publicId, "watches")`
4. Stores the returned `watches/{publicId}` string in the database (not the original URL)

#### In the frontend (`frontend/lib/cloudinary.ts`):
- `imageTransformations.card(publicId)` — 400×400 for grid cards
- `imageTransformations.detail(publicId)` — 1200×1200 for detail view
- `imageTransformations.thumbnail(publicId)` — 200×200 for admin table
- All include `dpr_auto,q_auto,f_auto` for optimization
- Special handling: watch brand CDN URLs (patek.com, vacheron-constantin.com, etc.) are passed through directly because Cloudinary Fetch times out on them

### Scraper Proxy (`frontend/app/api/scraper-proxy/route.ts`)
Minimal Next.js API route that proxies requests to the .NET backend. Currently only fetches Greubel Forsey watches (brandId 8) as a filtered endpoint.

---

## Scraping Architecture (3 strategies)

1. **Sitemap + Selenium + Claude Haiku** — Production method. `POST /api/admin/scrape-sitemap`. Universal, no per-brand XPath. ~$0.001/extraction.
2. **Listing Page + Selenium + Claude Haiku** — `POST /api/admin/scrape-listing`. For brands that block sitemap access (Rolex, Omega, ALS).
3. **Single URL** — `POST /api/admin/scrape-url`. Paste one product page URL, get everything extracted.

Key files: `SitemapScraperService.cs`, `ClaudeApiService.cs`, `AdminController.cs`.

---

## Security Notes

- `[AllowAnonymous]` is currently ON for `/scrape-url`, `/scrape-listing`, `/add-watches` — **remove when all scraping is done**
- Role-based `[Authorize(Roles = "Admin")]` is commented out on `AdminController` — re-enable for production

---

## Verification Plan

1. Navigate to `/scrape` in local environment
2. Select a watch with a bad image (e.g., lifestyle photo with wrist)
3. Modify the name slightly and upload a clean PNG from desktop (or paste from clipboard)
4. Save and verify the new image renders instantly (admin dashboard invalidates cache)
5. Confirm the Cloudinary public_id is stored in DB, not an external URL