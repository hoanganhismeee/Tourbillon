# Tourbillon Backend Structure

## 📁 Directory Organization

### `/Controllers` - API Controllers
- **`SearchController.cs`** - Search functionality
- **`WatchController.cs`** - Watch CRUD operations
- **`BrandController.cs`** - Brand operations
- **`CollectionController.cs`** - Collection operations
- **`AuthenticationController.cs`** - Auth endpoints
- **`AccountController.cs`** - Account management
- **`ProfileController.cs`** - User profile operations

### `/Models` - Entity Models (PascalCase)
- **`User.cs`** - User entity
- **`Watch.cs`** - Watch entity
- **`Brand.cs`** - Brand entity
- **`Collection.cs`** - Collection entity
- **`PriceTrend.cs`** - Price history entity

### `/DTOs` - Data Transfer Objects
- **`LoginDto.cs`** - Login request/response
- **`RegisterDto.cs`** - Registration data
- **`UpdateUserDto.cs`** - User update data
- **`UserProfileDto.cs`** - User profile data
- **`DeleteAccountDto.cs`** - Account deletion

### `/Services` - Business Logic
- **`UserProfileService.cs`** - User profile operations
- **`PasswordChangeRateLimitService.cs`** - Rate limiting

### `/Data` - Data Access
- **`ApplicationDbContext.cs`** - Entity Framework context

### `/Database` - Database Management
- **`DbInitializer.cs`** - Database seeding

### `/Middleware` - Custom Middleware
- Authentication, logging, etc.

### `/Utilities` - Helper Classes (future)
- Common utilities and extensions

### `/Migrations` - Entity Framework Migrations
- Database schema changes

### `/Images` - Static Assets
- Image files and resources

## 🎯 Best Practices

1. **Naming Convention**: PascalCase for all C# files
2. **Separation of Concerns**: Controllers, Services, Models, DTOs
3. **Entity Framework**: Models in `/Models`, DTOs in `/DTOs`
4. **API Design**: RESTful endpoints in Controllers
5. **Business Logic**: Complex operations in Services

## 🔄 Migration Notes

- Renamed model files to PascalCase:
  - `user.cs` → `User.cs`
  - `watch.cs` → `Watch.cs`
  - `collection.cs` → `Collection.cs`
  - `brand.cs` → `Brand.cs`
  - `priceTrend.cs` → `PriceTrend.cs`
- DTOs already properly organized in `/DTOs` directory
- Created `/Utilities` directory for future helper classes

## 🏗️ Architecture

```
Controllers → Services → Data → Database
     ↓           ↓        ↓        ↓
   API Layer  Business  Data    Database
              Logic    Access   Schema
``` 