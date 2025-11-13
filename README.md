# Tourbillon - Luxury Watch E-Commerce

Tourbillon is a full-stack e-commerce portfolio project focused on luxury watches, designed to reflect a refined, old money aesthetic. The project features a Next.js frontend styled with soft brown and beige tones to evoke a classic and timeless atmosphere, paired with an ASP.NET Core backend powered by Entity Framework Core and PostgreSQL for clean and maintainable data management.

## Core Features

-   **Luxury Brand Showcase**: Brands like Rolex, Omega, and Patek Philippe with full heritage descriptions.
-   **Collection Filtering**: Organized by brand collections (e.g., Submariner, Speedmaster) for easier navigation.
-   **Watch Product Pages**: Clean, minimal product display with live pricing and specs.
-   **Price Trend Tracking**: Backend includes price history per watch for future data visualization.
-   **Authentication System**: Login/register feature using a simple user model.

## Tech Stack

| Area       | Technology                                           |
| :--------- | :--------------------------------------------------- |
| **Frontend** | Next.js (React), Tailwind CSS (brown classic theme)  |
| **Backend**  | ASP.NET Core Web API (.NET 8), Entity Framework Core |
| **Database** | PostgreSQL with pgAdmin4/Neon                             |

## Getting Started

Follow these instructions to get a copy of the project up and running on your local machine for development and testing purposes.

### Prerequisites

-   [.NET 8 SDK](https://dotnet.microsoft.com/download/dotnet/8.0)
-   [Node.js](https://nodejs.org/) (v20.x or later)
-   [PostgreSQL](https://www.postgresql.org/download/)

### Backend Setup

1.  **Configure the database connection:**
    Open `backend/appsettings.json` and update the `DefaultConnection` string with your PostgreSQL credentials.

    ```json
    "ConnectionStrings": {
      "DefaultConnection": "Host=localhost;Database=your_database;Username=your_username;Password=your_password"
    }
    ```

2.  **Navigate to the backend directory:**
    ```bash
    cd backend
    ```

3.  **Restore dependencies:**
    ```bash
    dotnet restore
    ```

4.  **Apply database migrations:**
    This will create the database and tables based on the existing migration files.
    ```bash
    dotnet ef database update
    ```

5.  **Run the backend server:**
    ```bash
    dotnet run
    ```

    The backend API will be running at `http://localhost:5000`.

### Frontend Setup

1.  **Navigate to the frontend directory:**
    ```bash
    cd frontend
    ```

2.  **Install dependencies:**
    ```bash
    npm install
    ```

3.  **Run the frontend development server:**
    ```bash
    npm run dev
    ```

    Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

## Project Purpose

-   Demonstrates clean architecture for a scalable e-commerce application.
-   Focuses on clear data relationships: Brands → Collections → Watches.
-   Showcases a refined user experience reflecting a luxury retail feel.
-   Serves as a complete full-stack project suitable for a portfolio to showcase to employers. 