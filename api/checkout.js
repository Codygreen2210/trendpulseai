// api/checkout.js — creates a Stripe Checkout session and returns the URL
import Stripe from "stripe";
import { verifyClerkToken } from "./_clerk.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

const PRICE_IDS = {
  growth: process.env.STRIPE_PRICE_GROWTH,
  pro:    process.env.STRIPE_PRICE_PRO,
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { userId, error } = await verifyClerkToken(req);
  if (error) return res.status(401).json({ error });

  const { tier } = req.body;
  if (!PRICE_IDS[tier]) return res.status(400).json({ error: "Invalid tier" });

  const session = await stripe.checkout.sessions.create({
    mode: "subscription",
    payment_method_types: ["card"],
    line_items: [{ price: PRICE_IDS[tier], quantity: 1 }],
    success_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard?upgraded=true`,
    cancel_url:  `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
    metadata: { userId, tier },
  });

  return res.status(200).json({ url: session.url });
}
