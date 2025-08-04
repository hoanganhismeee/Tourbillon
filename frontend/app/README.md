# Tourbillon Frontend Structure

## 📁 Directory Organization

### `/app` - Next.js App Router
- **`layout.tsx`** - Root layout wrapper
- **`page.tsx`** - Home page
- **`globals.css`** - Global styles

### `/components` - Reusable Components
- **`/layout`** - Layout components
  - `NavBar.tsx` - Main navigation
- **`/sections`** - Page sections
  - `HeroSection.tsx` - Homepage hero
  - `AllWatchesSection.tsx` - Watches grid
  - `TrinityShowcase.tsx` - Holy Trinity brands
- **`/ui`** - Reusable UI components (future)

### `/types` - TypeScript Definitions
- **`index.ts`** - Central type definitions

### `/utils` - Utility Functions
- **`formatting.ts`** - Data formatting utilities

### `/constants` - Application Constants
- **`routes.ts`** - Route definitions

### `/hooks` - Custom React Hooks (future)

### `/api` - API Routes
- **`/search/route.ts`** - Search API proxy

### Page Directories
- **`/watches`** - Watch-related pages
- **`/brands`** - Brand pages
- **`/collections`** - Collection pages
- **`/search`** - Search functionality
- **`/login`, `/register`** - Authentication
- **`/account`** - User account
- **`/contact`, `/stories`, `/trend`, `/cart`** - Other pages

## 🎯 Best Practices

1. **Component Organization**: Large components go in `/components`
2. **Type Safety**: Use centralized types from `/types`
3. **Utilities**: Common functions in `/utils`
4. **Constants**: Route and config constants in `/constants`
5. **Naming**: PascalCase for components, camelCase for utilities

## 🔄 Migration Notes

- Moved `NavBar.tsx` → `components/layout/NavBar.tsx`
- Moved `HeroSection.tsx` → `components/sections/HeroSection.tsx`
- Moved `AllWatchesSection.tsx` → `components/sections/AllWatchesSection.tsx`
- Moved `TrinityShowcase.tsx` → `components/sections/TrinityShowcase.tsx`
- Updated all import paths accordingly 