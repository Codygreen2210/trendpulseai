// api/webhook.js — Stripe webhook handler
// Runs after checkout.session.completed or subscription.deleted
// Updates the user's tier in Clerk public metadata automatically.

import Stripe from "stripe";
import { clerk } from "./_clerk.js";

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

// Vercel serverless functions parse the body by default — we need raw bytes
export const config = { api: { bodyParser: false } };

async function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", chunk => chunks.push(chunk));
    req.on("end",  ()    => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  const rawBody = await getRawBody(req);
  let event;

  try {
    event = stripe.webhooks.constructEvent(
      rawBody,
      req.headers["stripe-signature"],
      process.env.STRIPE_WEBHOOK_SECRET
    );
  } catch {
    return res.status(400).json({ error: "Webhook signature verification failed" });
  }

  const obj = event.data.object;

  // ── Payment succeeded → upgrade tier ──────────────────────────────────────
  if (event.type === "checkout.session.completed") {
    const { userId, tier } = obj.metadata;
    await clerk.users.updateUser(userId, {
      publicMetadata: {
        tier,
        stripeCustomerId:     obj.customer,
        stripeSubscriptionId: obj.subscription,
      },
    });
    console.log(`✅ Upgraded user ${userId} to ${tier}`);
  }

  // ── Subscription cancelled → downgrade to free ────────────────────────────
  if (event.type === "customer.subscription.deleted") {
    const { data: allUsers } = await clerk.users.getUserList({ limit: 500 });
    const user = allUsers.find(u => u.publicMetadata?.stripeCustomerId === obj.customer);
    if (user) {
      await clerk.users.updateUser(user.id, {
        publicMetadata: { ...user.publicMetadata, tier: "free" },
      });
      console.log(`⬇️ Downgraded user ${user.id} to free`);
    }
  }

  return res.status(200).json({ received: true });
}
