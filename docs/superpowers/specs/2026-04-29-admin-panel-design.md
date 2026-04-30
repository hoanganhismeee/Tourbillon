# Admin Panel — Full Design Spec
Date: 2026-04-29

## Context

The existing admin UI lives at `/scrape` — a single page built specifically for scraping operations that has grown to also handle watch editing, image uploads, and editorial management. It is not a real admin panel: there is no navigation shell, no brand/collection management, no media library, and the scraping tools are buried inline with watch management.

This spec defines a complete admin console at `/admin/*` that replaces `/scrape`, migrates all existing admin functionality, adds full brand/collection CRUD, and introduces a Media Library supporting both image and video uploads.

---

## Architecture

### Routing

Next.js App Router sub-pages under `app/admin/`. A shared `layout.tsx` provides the sidebar shell and auth guard (redirects to `/` if not admin).

| Route | Purpose | Source |
|---|---|---|
| `/admin` | Redirect → `/admin/watches` | — |
| `/admin/watches` | Watch CRUD, image management | Migrated from `/scrape` |
| `/admin/collections` | Collection CRUD | New |
| `/admin/brands` | Brand CRUD | New |
| `/admin/media` | Image + video media library | New |
| `/admin/editorial` | Editorial coverage + editing | Migrated from `/scrape` (inline) |
| `/admin/scraping` | All scraping tools | Migrated from `/scrape` (buttons) |
| `/admin/system` | Embeddings, query cache, audit, image migrations | Migrated from `/scrape` (buttons) |

The old `/scrape` route gets a `redirect()` to `/admin/watches` so existing bookmarks don't break.

### Sidebar Shell (`app/admin/layout.tsx`)

Persistent left sidebar (~180px wide). Auth-guarded: reads `isAdmin` from `AuthContext`, redirects non-admins. Groups:

- **Content** — Watches, Collections, Brands
- **Media** — Media Library
- **Publishing** — Editorial, Scraping
- **System** — Embeddings, Query Cache, Audit

Active route highlighted with gold left border. User email + sign-out link at the bottom.

---

## Section Designs

### 1. Watches (`/admin/watches`)

Direct migration of `app/scrape/page.tsx`. The existing components (`WatchEditorModal`, `AddWatchModal`, `ImageCropper`) move to `app/admin/watches/components/` with no logic changes. The watch grid (filter by brand/collection, search, edit/delete/add) is unchanged.

**Changes only:**
- File moves from `app/scrape/` → `app/admin/watches/`
- Page header adopts the new admin shell layout conventions
- The inline editorial editing panel is removed (editorial moves to its own page)

### 2. Collections (`/admin/collections`)

Table listing all collections with columns: name, brand, watch count, style tag, slug. Actions per row: Edit, Delete (disabled if collection has watches — show tooltip).

Create/Edit opens a side drawer with fields:
- Name (text)
- Brand (dropdown — fetches from `GET /api/brand`)
- Slug (auto-generated from name, editable)
- Style (dropdown: dress, sport, diver, complications, other)
- Description (textarea)

Backend endpoints needed:
- `POST /api/admin/collections` — create
- `PUT /api/admin/collections/{id}` — update
- `DELETE /api/admin/collections/{id}` — soft delete (sets `DeletedAt`)

### 3. Brands (`/admin/brands`)

Table: logo thumbnail, brand name, acronym, watch count, slug. Actions: Edit, Delete (disabled if brand has watches).

Create/Edit drawer fields:
- Name, Slug (auto-generated), Acronym (2–4 chars, used for image naming)
- Description (textarea)
- Logo image (upload via existing `adminUploadWatchImage` pattern to S3)

Backend endpoints needed:
- `POST /api/admin/brands` — create
- `PUT /api/admin/brands/{id}` — update
- `DELETE /api/admin/brands/{id}` — soft delete

### 4. Media Library (`/admin/media`)

**Purpose:** Standalone asset store for images and videos not managed via the watch editor. Admin uploads assets here, then decides how to use them (attach to watches, collections, brands, or use in editorial).

**Grid view:** Thumbnail grid of all `MediaAsset` records. Video assets show a play icon badge. Filter bar: search by filename, filter by type (All / Image / Video), sort by date.

**Asset detail panel (right side on click):**
- Full image preview (click to open lightbox) or inline `<video controls>` player
- Metadata: filename, S3 key, MIME type, file size, upload date
- Buttons: Copy URL, Re-edit on Cloudinary (images only), Delete

**Upload:**
- Drag-and-drop zone or `+ Upload` button
- File type detected on select:
  - **Image** → stage on Cloudinary (`adminStageOnCloudinary`) → admin edits in Cloudinary widget → `adminFinalizeFromCloudinary` → saved to `MediaAsset`
  - **Video** → call `POST /api/admin/media/video-presign` → get presigned S3 PUT URL → browser uploads directly with `XMLHttpRequest` (for progress events) → on completion call `POST /api/admin/media/video-confirm` → saved to `MediaAsset`

**DB model — `MediaAssets` table (new EF migration):**

```csharp
public class MediaAsset
{
    public int Id { get; set; }
    public string Key { get; set; }               // S3 object key: "media/images/..." or "media/videos/..."
    public string FileName { get; set; }
    public string MediaType { get; set; }          // "image" | "video"
    public string MimeType { get; set; }
    public long SizeBytes { get; set; }
    public DateTime UploadedAt { get; set; }
    public string? CloudinaryPublicId { get; set; } // set for images; used to re-open Cloudinary editor
}
```

S3 key conventions: images use `media/images/{sanitizedFileName}`, videos use `media/videos/{sanitizedFileName}`.

**New backend endpoints (`AdminController`):**
- `GET /api/admin/media` — list all `MediaAsset` records, newest first
- `POST /api/admin/media/video-presign` — body: `{ fileName, contentType }` → returns `{ presignedUrl, key }`
- `POST /api/admin/media/video-confirm` — body: `{ key, fileName, mimeType, sizeBytes }` → creates `MediaAsset`, returns record
- `DELETE /api/admin/media/{id}` — deletes from S3 + removes `MediaAsset` row

**S3StorageService additions:**
- `GeneratePresignedUploadUrlAsync(key, contentType, expiryMinutes)` → signed PUT URL (AWS SDK `GetPreSignedURL`)
- `DeleteObjectAsync(key)` — for video deletes (images already handled by existing `DeleteImageAsync`)

Presigned URL expiry: 15 minutes. Max video size: no hard limit imposed server-side (S3 handles it). Frontend warns if file > 2 GB.

### 5. Editorial (`/admin/editorial`)

Extracted from the inline expansion rows in `/scrape`. Dedicated page with:
- Stats card at top: total watches, % with editorial, last generated
- Action buttons: Seed All (enqueues Hangfire job), Clear All
- Table: watch name, collection, `whyItMatters` preview (truncated), last updated, Edit button
- Edit opens existing inline fields (`whyItMatters`, `collectorAppeal`, `designLanguage`, `bestFor`)

No new backend endpoints needed — uses existing `/api/admin/editorial/*`.

### 6. Scraping (`/admin/scraping`)

All scraping controls from the old `/scrape` page grouped into tabs:
- **Brand Official** — brand + collection + maxWatches, calls `adminScrapeOfficialSite`
- **Sitemap** — brand + sitemap URL + collection + maxWatches
- **Listing Page** — brand + listing URL + collection + maxWatches
- **Single URL** — URL + brand
- **Bulk** — JSON array of scrape targets
- **Add Watches** — paste JSON array

Each tab: input form on left, scrollable log output on right (streams job result or Hangfire job ID).

No new backend endpoints needed.

### 7. System (`/admin/system`)

Three collapsible cards:

**Embeddings**
- Status bar: X of Y watches have embeddings (from `GET /api/admin/embeddings/status`)
- Buttons: Generate Missing, Regenerate All (with confirmation)

**Query Cache**
- Stats table by feature (from `GET /api/admin/query-cache/status`)
- Buttons: Seed Cache, Clear Cache (with confirmation)

**Data Maintenance**
- Audit Report button → renders result table
- Normalize Image Names (dry-run toggle) → shows preview diff, then Apply
- Migrate to S3 (inline toggle) → shows progress
- Refresh Image Cache (brand filter optional)
- Orphan Cleanup (dry-run first)

No new backend endpoints needed.

---

## Data Flow Summary

```
Browser
  ├── Image upload  →  adminStageOnCloudinary  →  Cloudinary edit  →  adminFinalizeFromCloudinary  →  S3 + MediaAsset row
  ├── Video upload  →  /api/admin/media/video-presign  →  PUT direct to S3  →  /api/admin/media/video-confirm  →  MediaAsset row
  ├── Watch image   →  adminStageOnCloudinary  →  Cloudinary edit  →  adminFinalizeFromCloudinary  →  Watch.Image updated
  └── Brand/Coll.   →  /api/admin/brands|collections (new CRUD endpoints)  →  PostgreSQL
```

---

## Backend Changes Summary

| File | Change |
|---|---|
| `AdminController.cs` | Add media endpoints (presign, confirm, list, delete), brand CRUD, collection CRUD |
| `S3StorageService.cs` | Add `GeneratePresignedUploadUrlAsync`, `DeleteObjectAsync(key)` |
| `IStorageService.cs` | Add presigned URL + delete-by-key interface methods |
| New migration | `AddMediaAssetsTable` — creates `MediaAssets` table |
| New migration (if needed) | `AddDeletedAtToBrandsAndCollections` — adds `DeletedAt` to `Brands` and `Collections` if not already present |
| `TourbillonContext.cs` | Add `DbSet<MediaAsset>` |
| New model | `backend/Models/MediaAsset.cs` |

## Frontend Changes Summary

| File | Change |
|---|---|
| `app/admin/layout.tsx` | New — sidebar shell, auth guard |
| `app/admin/page.tsx` | New — redirect to /admin/watches |
| `app/admin/watches/` | Move from `app/scrape/`, strip editorial inline panel |
| `app/admin/collections/page.tsx` | New — collection CRUD |
| `app/admin/brands/page.tsx` | New — brand CRUD |
| `app/admin/media/page.tsx` | New — media library |
| `app/admin/editorial/page.tsx` | New — editorial management |
| `app/admin/scraping/page.tsx` | New — scraping tools |
| `app/admin/system/page.tsx` | New — system maintenance |
| `app/scrape/page.tsx` | Replace with `redirect('/admin/watches')` |
| `frontend/lib/api.ts` | Add media API functions (presign, confirm, list, delete), brand/collection CRUD functions |

---

## Verification

1. Navigate to `/admin` — should redirect to `/admin/watches`
2. `/scrape` — should redirect to `/admin/watches`
3. Non-admin user accessing `/admin/*` — should redirect to `/`
4. Watches page: filter, edit a watch, upload a new watch image through the Cloudinary flow
5. Collections page: create a collection, edit it, verify it appears in watch dropdowns
6. Brands page: create a brand, verify it appears in collection dropdowns
7. Media Library — upload an image: stage on Cloudinary, finalize, confirm it appears in grid with correct S3 key
8. Media Library — upload a video: confirm progress bar, confirm it lands in S3 under `media/videos/`, confirm `MediaAsset` row created
9. Media Library — click video asset: inline `<video>` player plays the file
10. Media Library — click image asset: lightbox opens full resolution
11. Editorial page: generate editorial for one watch, edit fields inline
12. Scraping page: run a single-URL scrape, confirm log output
13. System page: check embedding status, run audit report
