// api/checkout.js — creates a Stripe Checkout session and returns the URL
import Stripe from "stripe";
import { verifyClerkToken } from "./_clerk.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro:    process.env.STRIPE_PRICE_PRO,
};

export default async function handler(req, res) {
  // Always return JSON — never HTML
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    // Verify Clerk JWT
    const { userId, error: authError } = await verifyClerkToken(req);
    if (authError) {
      console.error("Checkout auth failed:", authError);
      return res.status(401).json({ error: authError });
    }

    // Parse body (Vercel doesn't always auto-parse)
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const { tier } = body;
    if (!tier || !PRICE_IDS[tier]) {
      return res.status(400).json({ error: `Invalid tier: ${tier}` });
    }

    // Sanity check — make sure env vars are set
    if (!process.env.STRIPE_SECRET_KEY) {
      return res.status(500).json({ error: "STRIPE_SECRET_KEY not configured" });
    }
    if (!PRICE_IDS[tier]) {
      return res.status(500).json({ error: `STRIPE_PRICE_${tier.toUpperCase()} not configured` });
    }
    if (!process.env.NEXT_PUBLIC_APP_URL) {
      return res.status(500).json({ error: "NEXT_PUBLIC_APP_URL not configured" });
    }

    // Create Stripe Checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL.replace(/\/$/, ""); // trim trailing slash
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      payment_method_types: ["card"],
      line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
      success_url: `${appUrl}/?upgraded=true`,
      cancel_url:  `${appUrl}/?upgraded=cancelled`,
      metadata: { userId, tier },
      client_reference_id: userId,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Checkout error:", err.message, err.stack);
    return res.status(500).json({
      error: "Checkout failed",
      detail: err.message,
    });
  }
}
