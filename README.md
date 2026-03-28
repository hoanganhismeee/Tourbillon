# Tourbillon - Luxury Watch E-Commerce

Tourbillon is a full-stack e-commerce platform for luxury watches, built with a refined old-money aesthetic. It features a Next.js frontend styled with soft brown and beige tones, an ASP.NET Core backend with PostgreSQL, and an AI layer powered by Claude Haiku for natural language discovery, editorial content generation, and personalised recommendations.

## Core Features

- **Luxury Brand Showcase**: 13 maisons including Patek Philippe, Vacheron Constantin, and Audemars Piguet — each with full heritage descriptions and curated collections.
- **Collection Navigation**: ~51 brand collections organised for intuitive, editorial-style browsing.
- **Watch Product Pages**: Clean product display with pricing, spec tables (Dial, Case, Movement, Strap), and upcoming AI-generated editorial sections.
- **Side-by-side Comparison**: Compare any two watches on specs, with AI-generated wearability and brand-character insights.
- **Wrist-fit Recommender**: Fit scores and wrist presence ratings calculated from case dimensions — no AI cost, instant results.
- **AI Watch Finder**: Describe what you want in plain language and receive ranked product recommendations. Hybrid filtering — structured parts (brand, collection, price, case material, movement, water resistance) applied as hard SQL pre-filters; semantic parts (style, complications) ranked by vector cosine similarity with category-aware embeddings. Filter bar auto-populates to match what the query implied.
- **Chat Concierge**: Floating conversational assistant on every page. Handles product comparisons ("Overseas vs Aquanaut for the beach"), brand knowledge questions ("history of Vacheron"), and general watch advice — with inline watch cards and navigation links.
- **Favourites & Collections**: Save watches with a heart icon and organise them into personal named collections — think Spotify playlists but for watches. A dedicated `/favourites` page shows your saved pieces grouped by collection with filter and sort controls.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), Tailwind CSS, Framer Motion |
| **Backend** | ASP.NET Core Web API (.NET 8), Entity Framework Core |
| **Database** | PostgreSQL (Npgsql) |
| **AI** | Claude Haiku 4.5 (production) / Qwen 2.5 7B via Ollama (local) |
| **Images** | Cloudinary |
| **Auth** | ASP.NET Identity, HttpOnly cookies, role-based access |
| **Infrastructure** | Docker, EC2, RDS, S3 + CloudFront, Vercel |

## Project Purpose

Tourbillon demonstrates how AI can enhance a product discovery experience without replacing backend logic — filtering, scoring, and ranking remain in SQL and .NET, while Claude handles natural language understanding, explanation, and content generation. The result is a platform that feels editorially curated rather than algorithmically generic, at a cost well under $5/month in AI API fees.

See [ROADMAP.md](ROADMAP.md) for the full AI feature roadmap and cost model.
