// api/portal.js — opens Stripe Customer Portal for managing / cancelling subscription
import Stripe from "stripe";
import { verifyClerkToken, clerk } from "./_clerk.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const { userId, error } = await verifyClerkToken(req);
  if (error) return res.status(401).json({ error });

  const user = await clerk.users.getUser(userId);
  const customerId = user.publicMetadata?.stripeCustomerId;
  if (!customerId) return res.status(400).json({ error: "No active subscription" });

  const session = await stripe.billingPortal.sessions.create({
    customer:   customerId,
    return_url: `${process.env.NEXT_PUBLIC_APP_URL}/dashboard`,
  });

  return res.status(200).json({ url: session.url });
}
