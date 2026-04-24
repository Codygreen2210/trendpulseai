// api/trending.js — fetches real Amazon bestsellers via Rainforest API
// Caches in Upstash Redis for 6 hours if available; falls back to direct calls otherwise.

import { verifyClerkToken } from "./clerk.js";

const CACHE_TTL_SECONDS = 60 * 60 * 6; // 6 hours

// ── Lazy Upstash client. If env vars aren't set, caching is disabled. ──────
async function getKV() {
  if (!process.env.KV_REST_API_URL || !process.env.KV_REST_API_TOKEN) {
    return null;
  }
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

// ── Amazon bestseller categories mapped per timeframe ──────────────────────
// For v1 we treat "24h / 7d / 30d" as different snapshots of the bestsellers
// list — Rainforest doesn't offer time-range bestsellers natively.
// We diversify by pulling from different bestseller CATEGORIES for each tab,
// which gives the illusion of different time windows with real data.
const TIMEFRAME_CATEGORIES = {
  "24h": ["16225007011", "284507", "3367581"],    // Home, Beauty, Kitchen
  "7d":  ["172282", "16310091", "468642"],        // Electronics, Office, Baby
  "30d": ["3760901", "165793011", "11091801"],    // Pet Supplies, Sports, Tools
};

// ── Normalize a Rainforest bestseller product → our app's schema ────────────
function normalizeProduct(rfProduct, rank, rangeId) {
  const title   = rfProduct.title || rfProduct.product?.title || "Unknown Product";
  const asin    = rfProduct.asin  || rfProduct.product?.asin  || "";
  const image   = rfProduct.image || rfProduct.product?.images?.[0]?.link
                || rfProduct.product?.main_image?.link || null;
  const price   = rfProduct.price?.raw || rfProduct.buybox_winner?.price?.raw || "";
  const origPrice = rfProduct.price_upper?.raw || null;
  const rating  = rfProduct.rating || rfProduct.product?.rating || 0;
  const reviews = rfProduct.ratings_total || rfProduct.product?.ratings_total || 0;
  const link    = rfProduct.link || rfProduct.product?.link
                || (asin ? `https://www.amazon.com/dp/${asin}` : "");
  const categoryName = rfProduct.category || "General";

  // Derive synthetic surge/potential scores from rank + review count
  const surge     = Math.max(40, Math.min(99, 100 - rank * 2));
  const potential = Math.max(50, Math.min(99, 95 - Math.floor(rank * 1.5)));

  return {
    id:          `${rangeId}-${rank}-${asin || Math.random()}`,
    name:        title,
    brand:       rfProduct.brand || "",
    asin,
    image,
    link,
    category:    categoryName,
    platforms:   ["Amazon"],
    surge,
    potential,
    sales30d:    Math.round(reviews * 0.4), // rough estimate
    reviews,
    rating,
    price:       price || "$--",
    origPrice,
    onSale:      !!origPrice,
    trend:       `#${rank} bestseller`,
    tags:        ["bestseller"],
    description: `Currently #${rank} in ${categoryName} on Amazon.`,
    pros:        ["Real-time Amazon data", `${reviews.toLocaleString()} reviews`, `${rating}/5 rating`],
    cons:        ["Check current stock", "Monitor price changes"],
    sourcing: {
      wholesaleEst: "Research required",
      fbaFee:       "Varies",
      netMargin:    "Calculate based on sourcing",
      sellerCount:  0,
      fulfillment:  "Amazon",
      moq:          "N/A",
      leadTime:     "N/A",
    },
    isReal: true,
  };
}

// ── Fetch bestsellers from Rainforest for a given category ──────────────────
async function fetchBestsellers(categoryId, amazonDomain = "amazon.com") {
  const url = new URL("https://api.rainforestapi.com/request");
  url.searchParams.set("api_key",                process.env.RAINFOREST_API_KEY);
  url.searchParams.set("type",                   "bestsellers");
  url.searchParams.set("amazon_domain",          amazonDomain);
  url.searchParams.set("bestsellers_category_id", categoryId);

  const r = await fetch(url.toString());
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

    // Verify Clerk auth
    const { error } = await verifyClerkToken(req);
    if (error) return res.status(401).json({ error });

    // Parse timeframe from body or query
    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const timeframe = (body?.timeframe || req.query?.timeframe || "7d").toLowerCase();
    if (!TIMEFRAME_CATEGORIES[timeframe]) {
      return res.status(400).json({ error: `Invalid timeframe: ${timeframe}` });
    }

    if (!process.env.RAINFOREST_API_KEY) {
      return res.status(500).json({ error: "RAINFOREST_API_KEY not configured" });
    }

    // ── Check cache first ──────────────────────────────────────────────────
    const kv = await getKV();
    const cacheKey = `trending:${timeframe}`;
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

    // ── Cache miss → hit Rainforest ────────────────────────────────────────
    const categories = TIMEFRAME_CATEGORIES[timeframe];
    const allProducts = [];
    const seenAsins = new Set();

    for (const categoryId of categories) {
      try {
        const items = await fetchBestsellers(categoryId);
        for (const item of items) {
          const asin = item.asin || item.product?.asin;
          if (asin && !seenAsins.has(asin)) {
            seenAsins.add(asin);
            allProducts.push({ raw: item, category: categoryId });
          }
          if (allProducts.length >= 50) break;
        }
        if (allProducts.length >= 50) break;
      } catch (err) {
        console.error(`Category ${categoryId} failed:`, err.message);
      }
    }

    if (allProducts.length === 0) {
      return res.status(502).json({
        error: "No products returned from Rainforest",
        detail: "Rainforest API may be down or rate-limited",
      });
    }

    // Normalize + rank
    const products = allProducts
      .slice(0, 50)
      .map((p, idx) => normalizeProduct(p.raw, idx + 1, timeframe));

    // Store in cache
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
