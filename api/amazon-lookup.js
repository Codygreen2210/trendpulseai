// api/amazon-lookup.js — real-time Amazon product search via Rainforest API
// Lets users search "stanley cup", "gaming mouse", etc. and get real products.

import { verifyClerkToken } from "./clerk.js";

// Short cache for search results — 1 hour (searches change less than bestsellers)
const SEARCH_CACHE_TTL = 60 * 60;

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

function normalizeSearchResult(item, idx) {
  const asin  = item.asin || "";
  const title = item.title || "Unknown";
  const image = item.image || item.main_image?.link || null;
  const price = item.price?.raw || item.prices?.[0]?.raw || "";
  const origPrice = item.price_upper?.raw || null;
  const rating  = item.rating || 0;
  const reviews = item.ratings_total || 0;
  const link = item.link || (asin ? `https://www.amazon.com/dp/${asin}` : "");

  const surge = Math.max(40, Math.min(99, 80 - idx * 1.2));
  const potential = Math.max(45, Math.min(99, 88 - idx * 1.3));

  return {
    id:          `search-${idx}-${asin || Math.random()}`,
    name:        title,
    brand:       item.brand || "",
    asin,
    image,
    link,
    category:    item.categories?.[0]?.name || "Search",
    platforms:   ["Amazon"],
    surge:       Math.round(surge),
    potential:   Math.round(potential),
    sales30d:    Math.round(reviews * 0.4),
    reviews,
    rating,
    price:       price || "$--",
    origPrice,
    onSale:      !!origPrice,
    trend:       item.is_prime ? "Prime" : "",
    tags:        item.is_prime ? ["prime"] : [],
    description: title.slice(0, 140),
    pros:        [`${reviews.toLocaleString()} reviews`, `${rating}/5 rating`, item.is_prime ? "Prime eligible" : "Standard shipping"].filter(Boolean),
    cons:        ["Verify current stock", "Check seller ratings"],
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

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { error } = await verifyClerkToken(req);
    if (error) return res.status(401).json({ error });

    let body = req.body;
    if (typeof body === "string") { try { body = JSON.parse(body); } catch { body = {}; } }
    const query = (body?.query || "").trim();
    if (!query) return res.status(400).json({ error: "Missing search query" });
    if (query.length > 100) return res.status(400).json({ error: "Query too long" });

    if (!process.env.RAINFOREST_API_KEY) {
      return res.status(500).json({ error: "RAINFOREST_API_KEY not configured" });
    }

    // Cache check
    const kv = await getKV();
    const cacheKey = `search:${query.toLowerCase().replace(/\s+/g, "-").slice(0, 80)}`;
    if (kv) {
      try {
        const cached = await kv.get(cacheKey);
        if (cached) {
          return res.status(200).json({ products: cached, cached: true, query });
        }
      } catch (e) { console.error("KV read:", e.message); }
    }

    // Hit Rainforest search endpoint
    const url = new URL("https://api.rainforestapi.com/request");
    url.searchParams.set("api_key",       process.env.RAINFOREST_API_KEY);
    url.searchParams.set("type",          "search");
    url.searchParams.set("amazon_domain", "amazon.com");
    url.searchParams.set("search_term",   query);

    const rfRes = await fetch(url.toString());
    if (!rfRes.ok) {
      const text = await rfRes.text();
      return res.status(502).json({
        error: `Rainforest search failed (${rfRes.status})`,
        detail: text.slice(0, 200),
      });
    }
    const data = await rfRes.json();
    const results = (data.search_results || []).slice(0, 10);

    if (results.length === 0) {
      return res.status(200).json({ products: [], query, noResults: true });
    }

    const products = results.map((item, idx) => normalizeSearchResult(item, idx));

    // Store in cache
    if (kv) {
      try { await kv.set(cacheKey, products, { ex: SEARCH_CACHE_TTL }); }
      catch (e) { console.error("KV write:", e.message); }
    }

    return res.status(200).json({ products, cached: false, query, fetchedAt: Date.now() });

  } catch (err) {
    console.error("Amazon lookup error:", err.message, err.stack);
    return res.status(500).json({
      error:  "Amazon lookup failed",
      detail: err.message,
    });
  }
}
