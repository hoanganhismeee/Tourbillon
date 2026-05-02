# Tourbillon - Luxury Watch E-Commerce

Tourbillon is a full-stack e-commerce platform for luxury watches, built with a refined old-money aesthetic. It features a Next.js frontend styled with soft brown and beige tones, an ASP.NET Core backend with PostgreSQL, and an AI layer powered by Claude Haiku for natural language discovery, editorial content generation, and personalised recommendations.

## Core Features

- **Luxury Brand Showcase**: 13 maisons including Patek Philippe, Vacheron Constantin, and Audemars Piguet, each with full heritage descriptions and curated collections.
- **Collection Navigation**: ~51 brand collections organised for intuitive, editorial-style browsing.
- **Watch Product Pages**: Clean product display with pricing, spec tables (Dial, Case, Movement, Strap), and upcoming AI-generated editorial sections.
- **Side-by-side Comparison**: Compare any two watches on specs, with AI-generated wearability and brand-character insights.
- **Wrist-fit Recommender**: Fit scores and wrist presence ratings calculated from case dimensions, with no AI cost.
- **AI Watch Finder**: Describe what you want in plain language and receive ranked product recommendations. Hybrid filtering applies structured parts (brand, collection, price, case material, movement, water resistance) as hard SQL pre-filters, while semantic parts (style, complications) are ranked by vector cosine similarity with category-aware embeddings.
- **Chat Concierge**: Floating conversational assistant on every page for product comparisons, brand knowledge, and general watch advice, with inline watch cards, follow-up memory, compare/cursor actions, and navigation links. Backend routing owns feature triggering and catalogue workflows, while the LLM handles grounded concierge wording.
- **Favourites & Collections**: Save watches with a heart icon and organise them into personal named collections.
- **Watch DNA**: Personalised taste fingerprint built from browsing behaviour and optional manual taste notes. The Trend page auto-runs behavior analysis for signed-in users, shows the latest inferred direction, and lets users refine it manually. Anonymous visitors are tracked from the first page view, but newly created accounts start clean; only existing-account sign-ins can merge that browser history into the account. The watches grid keeps a stable base order, then applies capped trend-led boosts so recent signals help discovery without turning the feed into a single-brand wall.

## Tech Stack

| Layer | Technology |
| :--- | :--- |
| **Frontend** | Next.js 15 (App Router), Tailwind CSS, Framer Motion |
| **Backend** | ASP.NET Core Web API (.NET 8), Entity Framework Core |
| **Database** | PostgreSQL (Npgsql) |
| **AI** | Claude Haiku 4.5 (production) / Qwen 2.5 7B via Ollama (local) |
| **Images** | Storage abstraction with Cloudinary or S3, delivered through CloudFront |
| **Auth** | ASP.NET Identity, HttpOnly cookies, role-based access |
| **Infrastructure** | Docker, Railway, Neon, Upstash, S3 + CloudFront, Vercel |

## Project Purpose

Tourbillon demonstrates how AI can enhance a product discovery experience without replacing backend logic. Filtering, scoring, and ranking remain in SQL and .NET, while Claude handles natural language understanding, explanation, and content generation. The result is a platform that feels editorially curated rather than algorithmically generic, at a cost well under $5/month in AI API fees.

See [ROADMAP.md](ROADMAP.md) for the full AI feature roadmap and cost model.
