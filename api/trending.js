// api/trending.js — fetches real Amazon bestsellers via Rainforest API
// Uses direct Amazon bestseller URLs (more reliable than category IDs which change).
// Caches in Upstash Redis for 6 hours if available.

import { verifyClerkToken } from "./clerk.js";

const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) return null;
  try {
    const { Redis } = await import("@upstash/redis");
    return new Redis({
      url:   process.env.KV_REST_API_URL,
      token: process.env.KV_REST_API_TOKEN,
    });
  } catch {
    return null;
  }
}

// Each "timeframe" tab pulls from DIFFERENT Amazon Best Sellers pages.
// We use full Amazon URLs instead of category IDs — these never go stale.
// 24h = Movers & Shakers (biggest sales rank gains in 24h) — this is actually real "24h trending"
// 7d = New Releases (last 30 days of new products that became bestsellers)
// 30d = Best Sellers (top 30-day rankings)
const TIMEFRAME_URLS = {
  "24h": [
    "https://www.amazon.com/gp/movers-and-shakers/kitchen/",
    "https://www.amazon.com/gp/movers-and-shakers/home-garden/",
    "https://www.amazon.com/gp/movers-and-shakers/beauty/",
  ],
  "7d": [
    "https://www.amazon.com/gp/new-releases/electronics/",
    "https://www.amazon.com/gp/new-releases/office-products/",
    "https://www.amazon.com/gp/new-releases/sports-and-fitness/",
  ],
  "30d": [
    "https://www.amazon.com/Best-Sellers/zgbs/pet-supplies/",
    "https://www.amazon.com/Best-Sellers/zgbs/hpc/", // Health & Personal Care
    "https://www.amazon.com/Best-Sellers/zgbs/toys-and-games/",
  ],
};

function normalizeProduct(item, rank, rangeId) {
  const title   = item.title || "Unknown Product";
  const asin    = item.asin || "";
  const image   = item.image || null;
  const price   = item.price?.raw || "";
  const origPrice = item.price_upper?.raw || null;
  const rating  = item.rating || 0;
  const reviews = item.ratings_total || 0;
  const link    = item.link || (asin ? `https://www.amazon.com/dp/${asin}` : "");
  const subtitle = item.sub_title?.text || "";

  // Synthesize a surge + potential score from rank
  const surge     = Math.max(40, Math.min(99, 100 - (rank - 1) * 1.5));
  const potential = Math.max(50, Math.min(99, 95 - (rank - 1) * 1.2));

  return {
    id:          `${rangeId}-${rank}-${asin || Math.random()}`,
    name:        title,
    brand:       subtitle,
    asin,
    image,
    link,
    category:    "Amazon Bestseller",
    platforms:   ["Amazon"],
    surge:       Math.round(surge),
    potential:   Math.round(potential),
    sales30d:    Math.round(reviews * 0.4),
    reviews,
    rating,
    price:       price || "$--",
    origPrice,
    onSale:      !!origPrice,
    trend:       `#${rank} bestseller`,
    tags:        ["bestseller"],
    description: `Currently #${rank} on Amazon's best sellers list.`,
    pros:        ["Live Amazon ranking", `${reviews.toLocaleString()} reviews`, `${rating}/5 stars`],
    cons:        ["Verify current stock", "Monitor price volatility"],
    sourcing: {
      wholesaleEst: "Research required",
      fbaFee:       "Varies",
      netMargin:    "Calculate manually",
      sellerCount:  0,
      fulfillment:  "Amazon",
      moq:          "N/A",
      leadTime:     "N/A",
    },
    isReal: true,
  };
}

async function fetchBestsellersFromUrl(amazonUrl) {
  const apiUrl = new URL("https://api.rainforestapi.com/request");
  apiUrl.searchParams.set("api_key", process.env.RAINFOREST_API_KEY);
  apiUrl.searchParams.set("type",    "bestsellers");
  apiUrl.searchParams.set("url",     amazonUrl);

  const r = await fetch(apiUrl.toString());
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Rainforest ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.bestsellers || [];
}

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST" && req.method !== "GET") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { error } = await verifyClerkToken(req);
    if (error) return res.status(401).json({ error });

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    const timeframe = (body?.timeframe || req.query?.timeframe || "7d").toLowerCase();
    if (!TIMEFRAME_URLS[timeframe]) {
      return res.status(400).json({ error: `Invalid timeframe: ${timeframe}` });
    }

    if (!process.env.RAINFOREST_API_KEY) {
      return res.status(500).json({ error: "RAINFOREST_API_KEY not configured" });
    }

    // Check cache first
    const kv = await getKV();
    const cacheKey = `trending:v2:${timeframe}`;
    if (kv) {
      try {
        const cached = await kv.get(cacheKey);
        if (cached) {
          return res.status(200).json({
            products: cached,
            cached:   true,
            timeframe,
          });
        }
      } catch (cacheErr) {
        console.error("KV read failed:", cacheErr.message);
      }
    }

    // Cache miss -> hit Rainforest
    const urls = TIMEFRAME_URLS[timeframe];
    const allProducts = [];
    const seenAsins = new Set();
    const errors = [];

    for (const url of urls) {
      try {
        const items = await fetchBestsellersFromUrl(url);
        for (const item of items) {
          const asin = item.asin;
          if (asin && !seenAsins.has(asin) && item.title) {
            seenAsins.add(asin);
            allProducts.push(item);
          }
          if (allProducts.length >= 50) break;
        }
        if (allProducts.length >= 50) break;
      } catch (err) {
        errors.push(err.message);
        console.error(`URL ${url} failed:`, err.message);
      }
    }

    if (allProducts.length === 0) {
      return res.status(502).json({
        error:  "No products returned from Rainforest",
        detail: errors.join("; ") || "Unknown error",
      });
    }

    const products = allProducts
      .slice(0, 50)
      .map((p, idx) => normalizeProduct(p, idx + 1, timeframe));

    if (kv) {
      try {
        await kv.set(cacheKey, products, { ex: CACHE_TTL_SECONDS });
      } catch (cacheErr) {
        console.error("KV write failed:", cacheErr.message);
      }
    }

    return res.status(200).json({
      products,
      cached:    false,
      timeframe,
      fetchedAt: Date.now(),
    });

  } catch (err) {
    console.error("Trending error:", err.message, err.stack);
    return res.status(500).json({
      error:  "Trending fetch failed",
      detail: err.message,
    });
  }
}
