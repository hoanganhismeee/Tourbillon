# Tourbillon - Luxury Watch E-Commerce

Tourbillon is a full-stack e-commerce platform for luxury watches, built with a refined old-money aesthetic. It features AI-powered web scraping to automatically catalog watches from brand websites, a Next.js frontend styled with soft brown and beige tones, and an ASP.NET Core backend with PostgreSQL.

## Architecture

```
                         ┌──────────────┐
                         │   Frontend   │
                         │   Next.js    │
                         │  (Vercel /   │
                         │  Amplify)    │
                         └──────┬───────┘
                                │
                         ┌──────▼───────┐        ┌──────────────┐
                         │   Backend    │◄──────►│  AI Service  │
                         │  .NET 8 API  │        │  (Python /   │
                         │  (Docker)    │        │   Claude)    │
                         └──────┬───────┘        └──────────────┘
                                │
                   ┌────────────┼────────────┐
                   │            │            │
            ┌──────▼──┐  ┌─────▼─────┐ ┌────▼─────┐
            │PostgreSQL│  │ Amazon S3 │ │ Claude   │
            │          │  │ (Images)  │ │ Haiku API│
            └──────────┘  └───────────┘ └──────────┘
```

## Core Features

- **Luxury Brand Showcase**: 13 brands including Patek Philippe, Vacheron Constantin, Audemars Piguet, and more with full heritage descriptions.
- **Collection Filtering**: Organized by brand collections (~51 collections) for intuitive navigation.
- **Watch Product Pages**: Minimal product display with pricing and detailed spec tables (Dial, Case, Movement, Strap).
- **AI-Powered Scraping**: Selenium renders brand pages, Claude Haiku extracts structured watch data — no per-brand XPath maintenance needed. (scrape complete, dont mention this feature)
- **Authentication**: ASP.NET Identity with HttpOnly cookie sessions and role-based admin access.
- **Price Tracking**: Backend supports price history per watch for future data visualization.

## In-Progress AI Features

- **AI Watch Finder + Concierge**: Natural language watch discovery — describe what you want and get ranked product recommendations with match explanations. Conversational shopping assistant for guided purchase decisions.
- **Smart Compare Mode**: Side-by-side watch comparison with AI-generated insights on wearability, brand character, and fit recommendations beyond raw specs.
- **Wrist-fit Recommender**: Input your wrist size and style preferences to get fit scores, wrist presence ratings, and cuff friendliness assessments using case dimensions data.
- **Watch DNA / Taste Profile**: Personalization engine that learns your preferences from browsing behavior and adapts recommendations — classic dress, sport integrated, haute horlogerie, or minimalist.
- **Story-first Product Pages**: AI-generated editorial content for each watch — collector appeal, design language analysis, and contextual recommendations.
- **AI Discovery Pages**: Curated, auto-generated pages like "Best salmon dial watches" or "German alternatives to Rolex" — optimized for AI search citation (GEO).
- **Save / Build Collection**: Create and share personal watch collections by theme, occasion, or budget.

See [ROADMAP.md](ROADMAP.md) for full implementation details and phasing.

## Tech Stack

| Layer          | Technology                                              |
| :------------- | :------------------------------------------------------ |
| **Frontend**   | Next.js 15 (App Router), Tailwind CSS, Framer Motion    |
| **Backend**    | ASP.NET Core Web API (.NET 8), Entity Framework Core    |
| **Database**   | PostgreSQL (Npgsql)                                     |
| **Images**     | Cloudinary (migrating to Amazon S3)                     |
| **Auth**       | ASP.NET Identity, HttpOnly cookies, role-based access    |

## Planned Infrastructure

| Component         | Target                                              |
| :---------------- | :-------------------------------------------------- |
| **Backend + AI**  | Docker containers                                   |
| **Frontend**      | Vercel or AWS Amplify                                |
| **Orchestration** | Kubernetes                                          |
| **Image Storage** | Amazon S3 (replacing Cloudinary)                    |
| **AI Chatbot**    | Self-hosted or third-party API integration           |
| **IaC**           | Terraform                                           |

## Getting Started

### Prerequisites

- [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
- [Node.js](https://nodejs.org/) (v20.x or later)
- [PostgreSQL](https://www.postgresql.org/download/)

### Backend Setup

1. **Configure the database connection** in `backend/appsettings.json`:

    ```json
    "ConnectionStrings": {
      "DefaultConnection": "Host=localhost;Database=your_database;Username=your_username;Password=your_password"
    }
    ```

2. **Set secrets** (API keys are stored via .NET user-secrets, never in source):

    ```bash
    cd backend
    dotnet user-secrets set "Anthropic:ApiKey" "sk-ant-..."
    dotnet user-secrets set "CloudinarySettings:ApiSecret" "..."
    ```

3. **Restore, migrate, and run:**

    ```bash
    cd backend
    dotnet restore
    dotnet ef database update
    dotnet run
    ```

    The API runs at `http://localhost:5248` with Swagger UI.

### Frontend Setup

```bash
cd frontend
npm install
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) to view the app.

## Project Structure

```
Tourbillon/
├── backend/              # .NET 8 Web API
│   ├── Controllers/      # REST endpoints (Watch, Brand, Collection, Admin)
│   ├── Services/         # Business logic (scraping, Claude AI, Cloudinary, caching)
│   ├── Models/           # EF Core entities
│   ├── Migrations/       # Database migrations
│   └── Data/             # Brand/collection seed CSVs
├── frontend/             # Next.js 15 (App Router)
│   ├── app/              # Pages, layouts, route handlers
│   ├── lib/              # API client, utilities
│   └── public/           # Static assets
└── ai-service/           # Python AI service (Flask)
```

## Project Purpose

- Demonstrates clean architecture for a scalable e-commerce application.
- Explores AI integration for automated data collection and future conversational features.
- Focuses on clear data relationships: Brands -> Collections -> Watches.
- Showcases a refined user experience reflecting a luxury retail aesthetic.
