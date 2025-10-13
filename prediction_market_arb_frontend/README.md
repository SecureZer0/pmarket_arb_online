# Prediction Market Arbitrage Frontend

A single-page Next.js application for viewing and managing prediction market arbitrage opportunities across different platforms.

## Features

- **Market Matches View**: Display all matched markets with detailed information
- **Cross-Platform Data**: View markets from Kalshi, Polymarket, and other platforms
- **Match Status Tracking**: Monitor AI, user, and overall match statuses
- **Responsive Design**: Modern UI built with Tailwind CSS
- **TypeScript**: Full type safety throughout the application

## Tech Stack

- **Framework**: Next.js 14 with App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Database**: PostgreSQL with connection pooling
- **Deployment**: Vercel-ready

## Getting Started

### Prerequisites

- Node.js 18+ 
- PostgreSQL database
- Environment variables configured

### Installation

1. Clone the repository
2. Install dependencies:
   ```bash
   npm install
   ```

3. Copy the environment template:
   ```bash
   cp env.example .env.local
   ```

4. Configure your database connection in `.env.local`:
   ```env
   DATABASE_USERNAME_HETZNER=your_username
   DATABASE_HOST_HETZNER=your_host
   DATABASE_NAME_HETZNER_PREDICTION_MARKETS=your_database_name
   DATABASE_PASSWORD_HETZNER=your_password
   DATABASE_PORT_HETZNER=5432
   ```

5. Run the development server:
   ```bash
   npm run dev
   ```

6. Open [http://localhost:3000](http://localhost:3000) in your browser

## API Endpoints

### GET /api/market-matches
Fetches all market matches with detailed market information from both sides of the match.

**Response includes:**
- Match details (ID, method, score, status)
- Market A information (title, platform, URL, outcome type, dates)
- Market B information (title, platform, URL, outcome type, dates)
- Platform names and match metadata

### POST /api/market-matches
Creates a new market match.

**Required fields:**
- `market_id_a`: First market ID
- `market_id_b`: Second market ID  
- `method`: Matching method used
- `score`: Match confidence score (0-1)

## Database Schema

The application connects to a PostgreSQL database with the following key tables:

- **markets**: Core market information from all platforms
- **market_matches**: Matches between markets with status tracking
- **platforms**: Platform information (Kalshi, Polymarket, etc.)
- **market_name_variants**: Alternative names for markets
- **market_embeddings**: Vector embeddings for similarity matching

## Project Structure

```
src/
├── app/                    # Next.js App Router
│   ├── api/               # API routes
│   │   └── market-matches/ # Market matches API
│   └── page.tsx           # Single-page app (market matches)
├── types/                 # TypeScript type definitions
│   └── market.ts          # Market-related interfaces
└── predictionMarket_db.ts  # Database connection
```

## Development

- **Build**: `npm run build`
- **Lint**: `npm run lint`
- **Type Check**: `npm run type-check`

## Deployment

This project is configured for Vercel deployment. Simply connect your repository to Vercel and deploy.

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Submit a pull request

## License

[Add your license here]
