// api/portal.js — opens Stripe Customer Portal so users can manage/cancel
import Stripe from "stripe";
import { verifyClerkToken } from "./clerk.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { userId, user, error: authError } = await verifyClerkToken(req);
    if (authError) return res.status(401).json({ error: authError });

    const stripeCustomerId = user?.publicMetadata?.stripeCustomerId;
    if (!stripeCustomerId) {
      return res.status(400).json({
        error: "No active subscription to manage",
      });
    }

    const appUrl = (process.env.NEXT_PUBLIC_APP_URL || "").replace(/\/$/, "");

    const session = await stripe.billingPortal.sessions.create({
      customer:    stripeCustomerId,
      return_url:  `${appUrl}/`,
    });

    return res.status(200).json({ url: session.url });

  } catch (err) {
    console.error("Portal error:", err.message, err.stack);
    return res.status(500).json({
      error: "Portal failed",
      detail: err.message,
    });
  }
}
