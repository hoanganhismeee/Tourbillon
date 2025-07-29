# Tourbillon - Luxury Watch E-commerce Platform Documentation

## 🎯 Project Overview

**Tourbillon** is a full-stack e-commerce portfolio project focused on luxury watches, designed to reflect a refined, old money aesthetic. The project demonstrates clean architecture for scalable e-commerce with proper backend and database logic.

*This documentation showcases the Tourbillon luxury watch e-commerce platform, highlighting advanced backend logic, smart UX/UI features, and technical implementation excellence.* 

---

## 🏗️ **SOLID PRINCIPLES COMPLIANCE - CLEAN ARCHITECTURE**

The project follows SOLID principles to ensure maintainable, scalable, and extensible code architecture!

### **Cool Implementation:**
- **Frontend: 90% SOLID Compliance** - Clean separation of concerns with proper abstractions
- **Context Providers (AuthContext.tsx)** (lines 1-65): Single responsibility for state management
- **API Layer (api.ts)** (lines 1-179): Interface segregation with focused data contracts
- **Component Architecture (WatchCard.tsx)** (lines 1-50): Open/closed principle with extensible props
- **Dependency Injection (AuthProvider)** (lines 1-81): Dependency injection with context providers

### **Why It's Cool:**
- **Single Responsibility**: Each component/context has one clear purpose
- **Open/Closed**: Easy to extend functionality without modifying existing code
- **Liskov Substitution**: Proper TypeScript interfaces ensure type safety
- **Interface Segregation**: Focused, minimal interfaces for each domain
- **Dependency Inversion**: High-level modules depend on abstractions, not concretions

---

### Tech Stack
- **Frontend**: Next.js 14 (React), TypeScript, TailwindCSS
- **Backend**: ASP.NET Core Web API (.NET 8), Entity Framework Core
- **Database**: PostgreSQL with pgAdmin4
- **Styling**: Custom brown fade theme (soft brown and beige tones)
- **Animations**: Framer Motion
- **State Management**: React Context API

---

## 🚀 Cool Logic & Smart UX/UI Features Showcase

## 🧠 **SMART BACK NAVIGATION WITH POSITION MEMORY**

### **The Magic:**
When you click a watch card from the middle of Page 3, then click "Back" - you return to the EXACT same position!

### **Cool Implementation:**
- **NavigationContext.tsx** (lines 1-60): Global state management for navigation memory
- **WatchCard.tsx** `handleWatchClick()` (lines 40-50): Saves scroll position, page number, and timestamp
- **AllWatchesSection.tsx** `WatchCard` (lines 25-35): Same logic for grid cards
- **Watch Details Page** `handleBackClick()` (lines 25-45): Restores exact position with setTimeout

### **Why It's Cool:**
- Remembers scroll position down to the pixel
- Preserves page number across navigation
- Uses timestamp for state management
- Fallback gracefully if no state exists

---

## 🎭 **DYNAMIC NAVBAR WITH INTELLIGENT SCROLL BEHAVIOR**

### **The Magic:**
Navbar becomes transparent at top, solid when scrolling, hides on scroll down, shows on scroll up - just like Oura Ring!

### **Cool Implementation:**
- **NavBar.tsx** `handleScroll()` (lines 180-200): requestAnimationFrame throttling
- **NavBar.tsx** Dynamic background (lines 220-240): `Math.min(scrollY / 25, 1)` opacity calculation
- **NavBar.tsx** Search expansion (lines 250-270): 1000ms duration with backdrop blur
- **NavBar.tsx** Animated underlines (lines 280-300): `scale-x-0` to `scale-x-100` effects

### **Why It's Cool:**
- Performance optimized with requestAnimationFrame
- Smooth opacity transitions based on scroll distance
- Search bar expands with glass morphism effect
- Multiple animated underlines for depth

---

## 🎲 **SMART SHUFFLING WITH SESSION PERSISTENCE**

### **The Magic:**
Watches shuffle randomly on first load, but stay in the same order when navigating back - no annoying re-shuffling!

### **Cool Implementation:**
- **AllWatchesSection.tsx** `hasShuffledWatches` (lines 80-100): Prevents re-shuffling
- **AllWatchesSection.tsx** Filter logic (lines 110-130): Excludes Trinity Showcase watches
- **WatchesPageContext.tsx** Global state (lines 15-25): Shuffle state management
- **NavBar.tsx** `resetToPageOne()` (lines 200-210): Navbar navigation function

### **Why It's Cool:**
- Watches shuffle only once per session
- Trinity watches (Patek, VC, AP) are hardcoded and excluded from main display
- State persists across page navigation
- No jarring re-shuffling when using back button

---

## 👑 **TRINITY SHOWCASE WITH DYNAMIC CONTENT**

### **The Magic:**
Specific luxury watches are showcased with dynamic brand summaries fetched from the database!

### **Cool Implementation:**
- **TrinityShowcase.tsx** Hardcoded IDs (lines 20-30): Specific watch IDs for each brand
- **TrinityShowcase.tsx** Dynamic tagline (lines 40-50): Brand summary fetching
- **AllWatchesSection.tsx** Filter logic (lines 90-95): Excludes Trinity watches from main grid
- **Brand.cs** Model (lines 10-15): Brand summary field for dynamic content

### **Why It's Cool:**
- Hardcoded specific watch IDs for each luxury brand
- Brand summaries are fetched dynamically from database
- Trinity watches don't appear in "All Watches" to avoid duplication
- Creates exclusive showcase feeling

---

## 📄 **INTELLIGENT PAGINATION WITH STATE MANAGEMENT**

### **The Magic:**
Page 1 shows 16 watches, "Show More" reveals 20, Pages 2+ show all 20 - with perfect state persistence!

### **Cool Implementation:**
- **AllWatchesSection.tsx** `showAllWatches` (lines 150-170): Controls display state
- **AllWatchesSection.tsx** Conditional rendering (lines 180-200): Grid vs pagination logic
- **WatchesPageContext.tsx** Global state (lines 10-20): Page state management
- **AllWatchesSection.tsx** Pagination controls (lines 220-240): Smart visibility logic

### **Why It's Cool:**
- Page 1 has special "Show More" behavior
- Pages 2+ automatically show full pagination
- State persists when navigating between pages
- Smooth transitions between different display modes

---

## 🎨 **LUXURY AESTHETICS WITH GLASS MORPHISM**

### **The Magic:**
Every component has subtle glass effects, luxury color scheme, and smooth animations!

### **Cool Implementation:**
- **NavBar.tsx** Backdrop blur (lines 230-250): Gradient backgrounds with glass effect
- **WatchCard.tsx** Hover effects (lines 50-60): Scale and shadow transitions
- **AllWatchesSection.tsx** Card styling (lines 15-25): Glass morphism implementation
- **tailwind.config.ts** Color palette (lines 10-15): Custom luxury browns

### **Why It's Cool:**
- Consistent glass morphism throughout the app
- Luxury color scheme (soft browns and beiges)
- Smooth hover animations with scale effects
- Professional, refined aesthetic

---

## 🔗 **SMART DATA RELATIONSHIPS WITH CASCADING DELETES**

### **The Magic:**
Delete a brand and all its collections and watches are automatically removed - perfect data integrity!

### **Cool Implementation:**
- **TourbillonContext.cs** Relationships (lines 30-50): Entity Framework configuration
- **Brand.cs** Navigation properties (lines 10-15): Collections relationship
- **Collection.cs** Navigation properties (lines 10-15): Watches relationship
- **BrandController.cs** Include() (lines 40-60): Efficient data fetching

### **Why It's Cool:**
- Automatic cascading deletes maintain data integrity
- Single query fetches brand with all collections and watches
- Foreign key constraints prevent orphaned data
- Efficient data traversal with navigation properties

---

## 🎯 **INTELLIGENT ERROR HANDLING WITH GRACEFUL DEGRADATION**

### **The Magic:**
Images fail gracefully, API errors show user-friendly messages, loading states are smooth!

### **Cool Implementation:**
- **WatchCard.tsx** Image error handling (lines 70-90): Fallback UI implementation
- **Watch Details Page** Loading states (lines 50-70): Skeleton animations
- **BrandController.cs** Try-catch (lines 80-100): Proper HTTP status codes
- **api.ts** Error handling (lines 20-30): User-friendly error messages

### **Why It's Cool:**
- Images show elegant fallbacks instead of broken links
- Loading states prevent layout shifts
- API errors are handled gracefully
- User experience remains smooth even with failures

---

## 🚀 **PERFORMANCE OPTIMIZATIONS WITH SMART CACHING**

### **The Magic:**
Images lazy load, components memoize, API responses are optimized!

### **Cool Implementation:**
- **WatchCard.tsx** Image loading (lines 30-40): Opacity transitions with loading states
- **AllWatchesSection.tsx** useEffect (lines 60-80): Proper dependency arrays
- **BrandController.cs** Include() (lines 20-30): Single-query data fetching
- **api.ts** Credentials (lines 10-20): Session management

### **Why It's Cool:**
- Images load smoothly with loading states
- Database queries are optimized with eager loading
- Components only re-render when necessary
- Session state is preserved across requests

---

## 🎪 **SMOOTH ANIMATIONS WITH FRAMER MOTION**

### **The Magic:**
Every page transition, card hover, and scroll effect is buttery smooth!

### **Cool Implementation:**
- **ScrollFade.tsx** Intersection Observer (lines 10-20): Scroll-triggered animations
- **StaggeredFade.tsx** Staggered delays (lines 15-25): Grid item animations
- **MotionMain.tsx** Page transitions (lines 10-15): Smooth page changes
- **WatchCard.tsx** Hover animations (lines 50-60): Scale and shadow effects

### **Why It's Cool:**
- Scroll-triggered animations feel natural
- Staggered animations create visual hierarchy
- Page transitions are smooth and professional
- Hover effects provide immediate feedback

---

## 🧩 **MODULAR COMPONENT ARCHITECTURE**

### **The Magic:**
Every component is reusable, well-documented, and follows consistent patterns!

### **Cool Implementation:**
- **WatchCard.tsx** Documentation (lines 1-10): Comprehensive component docs
- **AllWatchesSection.tsx** Separation (lines 1-15): Clear concerns separation
- **AuthContext.tsx** Patterns (lines 1-20): Clean state management
- **api.ts** Error handling (lines 1-15): Consistent typing and errors

### **Why It's Cool:**
- Components are highly reusable across pages
- Clear documentation makes maintenance easy
- Consistent patterns reduce cognitive load
- TypeScript ensures type safety throughout

---

## 🔌 API Endpoints

### Brand Endpoints
- `GET /brand` - Get all brands
- `GET /brand/{id}` - Get brand by ID
- `POST /brand` - Create new brand
- `PUT /brand/{id}` - Update brand
- `DELETE /brand/{id}` - Delete brand

### Collection Endpoints
- `GET /collection` - Get all collections
- `GET /collection/{id}` - Get collection by ID
- `GET /collection/brand/{brandId}` - Get collections by brand
- `POST /collection` - Create new collection
- `PUT /collection/{id}` - Update collection
- `DELETE /collection/{id}` - Delete collection

### Watch Endpoints
- `GET /watch` - Get all watches
- `GET /watch/{id}` - Get watch by ID
- `GET /watch/brand/{brandId}` - Get watches by brand
- `GET /watch/collection/{collectionId}` - Get watches by collection
- `POST /watch` - Create new watch
- `PUT /watch/{id}` - Update watch
- `DELETE /watch/{id}` - Delete watch

### Authentication Endpoints
- `POST /account/login` - User login
- `POST /account/register` - User registration

---

## 📊 Data Management

### CSV Data Structure

#### brands.csv
```csv
Id,Name,Description,Summary,Image
1,Patek Philippe,Luxury Swiss watchmaker,Heritage of excellence,...
```

#### collections.csv
```csv
Id,Name,Description,Image,BrandId
1,Calatrava,Classic dress watches,calatrava.jpg,1
```

#### watches.csv
```csv
Id,Name,Description,CurrentPrice,Image,Specs,BrandId,CollectionId
1,6119G Clous de Paris,Classic elegance,84000,watch1.jpg,{...},1,1
```

### Data Relationships in Code

#### Backend Relationships
```csharp
// Brand with collections
var brandWithCollections = await context.Brands
    .Include(b => b.Collections)
    .ThenInclude(c => c.Watches)
    .FirstOrDefaultAsync(b => b.Id == brandId);

// Collection with watches
var collectionWithWatches = await context.Collections
    .Include(c => c.Watches)
    .Include(c => c.Brand)
    .FirstOrDefaultAsync(c => c.Id == collectionId);
```

#### Frontend Data Fetching
```typescript
// Fetch watches by brand
export const fetchWatchesByBrand = async (brandId: number): Promise<Watch[]> => {
  const response = await fetch(`${API_BASE_URL}/watch/brand/${brandId}`, { 
    credentials: 'include' 
  });
  return response.json();
};

// Fetch collections by brand
export const fetchCollectionsByBrand = async (brandId: number): Promise<Collection[]> => {
  const response = await fetch(`${API_BASE_URL}/collection/brand/${brandId}`, { 
    credentials: 'include' 
  });
  return response.json();
};
```

---

## 🗄️ Database Design & Relationships

### Entity Relationships

#### 1. **Brand → Collection → Watch** (One-to-Many Chain)
```
Brand (1) → Collection (Many)
Collection (1) → Watch (Many)
```

**Key Features:**
- **Cascading Relationships**: Deleting a brand cascades to collections and watches
- **Foreign Key Constraints**: Ensures data integrity
- **Navigation Properties**: Enables easy data traversal

#### 2. **User Authentication System**
```
User (1) → Login/Register DTOs
```
- **Simple User Model**: Expandable to JWT authentication
- **DTO Pattern**: Separate data transfer objects for API communication

#### 3. **Price Trend Tracking**
```
Watch (1) → PriceTrend (Many)
```
- **Historical Data**: Tracks price changes over time
- **Future-Ready**: Prepared for data visualization (Plotly/Pandas)

### Data Models

#### Brand Model
```csharp
public class Brand
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Summary { get; set; }
    public string Image { get; set; }
    public virtual ICollection<Collection> Collections { get; set; }
}
```

#### Collection Model
```csharp
public class Collection
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public string Image { get; set; }
    public int BrandId { get; set; }
    public virtual Brand Brand { get; set; }
    public virtual ICollection<Watch> Watches { get; set; }
}
```

#### Watch Model
```csharp
public class Watch
{
    public int Id { get; set; }
    public string Name { get; set; }
    public string Description { get; set; }
    public decimal CurrentPrice { get; set; }
    public string Image { get; set; }
    public string Specs { get; set; }
    public int BrandId { get; set; }
    public int CollectionId { get; set; }
    public virtual Brand Brand { get; set; }
    public virtual Collection Collection { get; set; }
    public virtual ICollection<PriceTrend> PriceTrends { get; set; }
}
```

---

## 🔧 Technical Implementation

### 1. **Entity Framework Core Configuration**

#### DbContext Setup
```csharp
public class TourbillonContext : DbContext
{
    public DbSet<Brand> Brands { get; set; }
    public DbSet<Collection> Collections { get; set; }
    public DbSet<Watch> Watches { get; set; }
    public DbSet<User> Users { get; set; }
    public DbSet<PriceTrend> PriceTrends { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        // Configure relationships
        modelBuilder.Entity<Collection>()
            .HasOne(c => c.Brand)
            .WithMany(b => b.Collections)
            .HasForeignKey(c => c.BrandId)
            .OnDelete(DeleteBehavior.Cascade);

        modelBuilder.Entity<Watch>()
            .HasOne(w => w.Collection)
            .WithMany(c => c.Watches)
            .HasForeignKey(w => w.CollectionId)
            .OnDelete(DeleteBehavior.Cascade);
    }
}
```

### 2. **API Controller Patterns**

#### RESTful Endpoints
```csharp
[ApiController]
[Route("[controller]")]
public class BrandController : ControllerBase
{
    private readonly TourbillonContext _context;

    public BrandController(TourbillonContext context)
    {
        _context = context;
    }

    [HttpGet]
    public async Task<ActionResult<IEnumerable<Brand>>> GetBrands()
    {
        return await _context.Brands.ToListAsync();
    }

    [HttpGet("{id}")]
    public async Task<ActionResult<Brand>> GetBrand(int id)
    {
        var brand = await _context.Brands
            .Include(b => b.Collections)
            .FirstOrDefaultAsync(b => b.Id == id);

        if (brand == null)
            return NotFound();

        return brand;
    }
}
```

### 3. **Frontend State Management**

#### Context Provider Pattern
```typescript
// WatchesPageContext for pagination
export const WatchesPageProvider = ({ children }: { children: ReactNode }) => {
  const [currentPage, setCurrentPage] = useState(1);
  const [hasShuffledWatches, setHasShuffledWatches] = useState(false);

  const resetToPageOne = () => {
    setCurrentPage(1);
  };

  return (
    <WatchesPageContext.Provider value={{
      currentPage,
      setCurrentPage,
      hasShuffledWatches,
      setHasShuffledWatches,
      resetToPageOne,
    }}>
      {children}
    </WatchesPageContext.Provider>
  );
};
```

### 4. **Error Handling & Loading States**

#### Backend Error Handling
```csharp
[HttpGet("{id}")]
public async Task<ActionResult<Watch>> GetWatch(int id)
{
    try
    {
        var watch = await _context.Watches
            .Include(w => w.Brand)
            .Include(w => w.Collection)
            .FirstOrDefaultAsync(w => w.Id == id);

        if (watch == null)
            return NotFound($"Watch with ID {id} not found");

        return Ok(watch);
    }
    catch (Exception ex)
    {
        return StatusCode(500, "Internal server error");
    }
}
```

#### Frontend Error Handling
```typescript
const [error, setError] = useState<string | null>(null);
const [loading, setLoading] = useState(true);

useEffect(() => {
  const fetchData = async () => {
    try {
      setLoading(true);
      const data = await fetchWatchById(id);
      setWatch(data);
    } catch (err) {
      setError('Failed to fetch watch details');
    } finally {
      setLoading(false);
    }
  };
  fetchData();
}, [id]);
```

---

*This documentation showcases the Tourbillon luxury watch e-commerce platform, highlighting advanced backend logic, smart UX/UI features, and technical implementation excellence.* 