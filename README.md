# TrendPulseAI

> AI-powered Amazon product trend radar. Find viral products before your competition.

## Features

- 🔥 **Top 20 Hot Items** — Ranked by cross-platform sales velocity
- ⚡ **Surge Detector** — Early velocity signals before mainstream trend lists
- 🔍 **Amazon Product Lookup** — Search any product by name or ASIN, get surge/risk/package scores
- 🤖 **AI Search** — Find emerging niches with AI-powered research
- 📦 **Bundle Deal Builder** — AI-curated product bundles with uplift projections
- 🧠 **AI Deep Analysis** — Full risk breakdown & bundle strategy for any product

## Pricing

| Tier | Price | Features |
|------|-------|----------|
| Free | $0/mo | Top 5 items + Amazon lookup |
| Growth | $10/mo | Top 20 + full AI features + bundles |
| Pro | $30/mo | Unlimited + API access + live tracker |

## Tech Stack

- **Frontend**: React 18 + Vite
- **Auth**: Clerk
- **Payments**: Stripe (subscriptions + customer portal)
- **AI**: Anthropic Claude API
- **Hosting**: Vercel (serverless functions + static site)

## Development

```bash
npm install
npm run dev
```

Requires a `.env` file with all keys from `.env.example`.

## Deployment

Push to GitHub and connect to Vercel. Add all environment variables from `.env.example` in Vercel dashboard. Deploys automatically on push.

---

Built with Claude 🤖
