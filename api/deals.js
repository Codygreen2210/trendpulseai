// api/deals.js — fetches Amazon deals via Rainforest API
// Filters for arbitrage: price <= $25, real products only.
// Three modes: lightning (time-limited), best (stable discounts), trending (customer loved).

import { verifyClerkToken } from "./clerk.js";

const CACHE_TTL_SECONDS = 60 * 60 * 2; // 2 hours — deals rotate

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

// Each tab hits a different Amazon deals page. Different URLs = different deals.
const TAB_CONFIG = {
  "24h": {
    label:       "Lightning Deals",
    description: "Time-limited lightning deals under $25",
    url:         "https://www.amazon.com/deals?ref_=nav_cs_gb",
    filter:      (d) => d.is_lightning_deal === true,
  },
  "7d": {
    label:       "Today's Best Deals",
    description: "Today's stable bargains under $25",
    url:         "https://www.amazon.com/gp/goldbox",
    filter:      (d) => d.is_lightning_deal !== true,
  },
  "30d": {
    label:       "Customer Favorites",
    description: "Deeply discounted customer favorites",
    url:         "https://www.amazon.com/deals?ref_=nav_cs_gb",
    // Filter for highest discount deals (25%+ off)
    filter:      (d) => (d.percent_off || 0) >= 25,
  },
};

function normalizeDeal(item, rank, rangeId) {
  const title = item.title || "Unknown Product";
  const asin  = item.asin || "";
  const image = item.image || null;

  // Handle both deal_price and current_price (current is what user pays now)
  const currentVal = item.current_price?.value ?? item.deal_price?.value ?? null;
  const listVal    = item.list_price?.value ?? null;
  const priceStr   = item.current_price?.raw || item.deal_price?.raw || "$--";
  const origStr    = item.list_price?.raw || null;
  const percentOff = item.percent_off || 0;

  const link = item.link || (asin ? `https://www.amazon.com/dp/${asin}` : "");
  const endsAt   = item.ends_at   || null;
  const startsAt = item.starts_at || null;

  // Arbitrage score: weighted mix of discount%, price affordability, and deal type
  // Higher = better flip potential
  const priceScore    = currentVal ? Math.max(0, 100 - (currentVal * 2)) : 50;
  const discountScore = Math.min(percentOff * 1.5, 100);
  const lightningBoost = item.is_lightning_deal ? 10 : 0;
  const arbitrageScore = Math.round(
    (discountScore * 0.5) + (priceScore * 0.4) + lightningBoost
  );

  return {
    id:          `${rangeId}-${rank}-${asin || Math.random()}`,
    name:        title,
    brand:       "",
    asin,
    image,
    link,
    category:    item.is_lightning_deal ? "Lightning Deal" : "Best Deal",
    platforms:   ["Amazon"],
    surge:       Math.max(40, Math.min(99, arbitrageScore)),
    potential:   Math.max(40, Math.min(99, Math.round(arbitrageScore * 0.9))),
    sales30d:    0, // not available in deals endpoint
    reviews:     0,
    rating:      0,
    price:       priceStr,
    origPrice:   origStr,
    onSale:      true,
    trend:       `-${percentOff}%`,
    tags:        item.is_lightning_deal ? ["lightning", "urgent"] : ["deal"],
    description: `${percentOff}% off list price. Deal runs from ${startsAt?.slice(0,10) || "now"} to ${endsAt?.slice(0,10) || "TBD"}.`,
    pros: [
      `${percentOff}% off retail`,
      currentVal ? `Under $${Math.ceil(currentVal)}` : "Budget pick",
      item.is_lightning_deal ? "Time-limited — buy fast" : "Stable deal",
    ],
    cons: [
      "Verify seller reputation",
      "Check current stock",
      endsAt ? `Deal ends ${new Date(endsAt).toLocaleDateString()}` : "Monitor deal expiration",
    ],
    sourcing: {
      wholesaleEst: currentVal ? `$${(currentVal * 0.5).toFixed(2)}-$${(currentVal * 0.7).toFixed(2)}` : "Research",
      fbaFee:       "Varies",
      netMargin:    percentOff >= 30 ? "High" : "Moderate",
      sellerCount:  0,
      fulfillment:  "Amazon",
      moq:          "1",
      leadTime:     "Immediate",
    },
    // Extra fields specific to deals
    percentOff,
    endsAt,
    startsAt,
    isLightning: !!item.is_lightning_deal,
    currentPriceValue: currentVal,
    isReal: true,
  };
}

async function fetchDealsFromUrl(amazonUrl) {
  const apiUrl = new URL("https://api.rainforestapi.com/request");
  apiUrl.searchParams.set("api_key", process.env.RAINFOREST_API_KEY);
  apiUrl.searchParams.set("type",    "deals");
  apiUrl.searchParams.set("url",     amazonUrl);

  const r = await fetch(apiUrl.toString());
  if (!r.ok) {
    const text = await r.text();
    throw new Error(`Rainforest ${r.status}: ${text.slice(0, 200)}`);
  }
  const data = await r.json();
  return data.deals_results || [];
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
    const config = TAB_CONFIG[timeframe];
    if (!config) {
      return res.status(400).json({ error: `Invalid timeframe: ${timeframe}` });
    }

    if (!process.env.RAINFOREST_API_KEY) {
      return res.status(500).json({ error: "RAINFOREST_API_KEY not configured" });
    }

    // Cache check
    const kv = await getKV();
    const cacheKey = `deals:v1:${timeframe}`;
    if (kv) {
      try {
        const cached = await kv.get(cacheKey);
        if (cached) {
          return res.status(200).json({
            products: cached,
            cached:   true,
            timeframe,
            label:    config.label,
          });
        }
      } catch (err) { console.error("KV read:", err.message); }
    }

    // Cache miss -> hit Rainforest
    let allDeals;
    try {
      allDeals = await fetchDealsFromUrl(config.url);
    } catch (err) {
      return res.status(502).json({
        error:  "Rainforest deals fetch failed",
        detail: err.message,
      });
    }

    // Apply tab-specific filter + arbitrage filters
    const MAX_PRICE = 25;
    const filtered = allDeals.filter(d => {
      if (!config.filter(d)) return false;
      if (!d.title || !d.asin) return false;
      const price = d.current_price?.value ?? d.deal_price?.value;
      if (!price || price > MAX_PRICE) return false;
      return true;
    });

    if (filtered.length === 0) {
      // If strict filtering returned nothing, loosen the filter: drop the tab-type requirement
      const loosened = allDeals.filter(d => {
        if (!d.title || !d.asin) return false;
        const price = d.current_price?.value ?? d.deal_price?.value;
        if (!price || price > MAX_PRICE) return false;
        return true;
      });
      if (loosened.length === 0) {
        return res.status(502).json({
          error:  "No deals matched arbitrage filters",
          detail: "Try again later — Amazon's deal mix changes hourly",
        });
      }
      // Sort by biggest discount first
      loosened.sort((a, b) => (b.percent_off || 0) - (a.percent_off || 0));
      const products = loosened.slice(0, 50).map((d, i) => normalizeDeal(d, i + 1, timeframe));

      if (kv) {
        try { await kv.set(cacheKey, products, { ex: CACHE_TTL_SECONDS }); }
        catch (err) { console.error("KV write:", err.message); }
      }

      return res.status(200).json({
        products, cached: false, timeframe, label: config.label,
        fetchedAt: Date.now(), loosenedFilter: true,
      });
    }

    // Sort by arbitrage value: biggest discount first, cheapest second
    filtered.sort((a, b) => {
      const discountDiff = (b.percent_off || 0) - (a.percent_off || 0);
      if (discountDiff !== 0) return discountDiff;
      const priceA = a.current_price?.value || 999;
      const priceB = b.current_price?.value || 999;
      return priceA - priceB;
    });

    const products = filtered.slice(0, 50).map((d, i) => normalizeDeal(d, i + 1, timeframe));

    if (kv) {
      try { await kv.set(cacheKey, products, { ex: CACHE_TTL_SECONDS }); }
      catch (err) { console.error("KV write:", err.message); }
    }

    return res.status(200).json({
      products, cached: false, timeframe, label: config.label,
      fetchedAt: Date.now(),
    });

  } catch (err) {
    console.error("Deals error:", err.message, err.stack);
    return res.status(500).json({
      error:  "Deals fetch failed",
      detail: err.message,
    });
  }
}
