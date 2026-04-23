// src/api.js — drop this in your React app's src/ folder
// All AI calls, checkout, and portal management go through here.
// The Anthropic API key is never in the browser.

import { useAuth } from "@clerk/clerk-react";

// In dev: hits localhost Vercel dev server. In prod: same origin, no CORS needed.
const BASE = "";

export function useAPI() {
  const { getToken } = useAuth();

  async function authHeaders() {
    const token = await getToken();
    return {
      "Content-Type":  "application/json",
      "Authorization": `Bearer ${token}`,
    };
  }

  // ── Drop-in replacement for fetch("https://api.anthropic.com/...") ─────────
  // Usage: const data = await callAI({ messages, max_tokens: 1000 });
  async function callAI({ messages, max_tokens = 1000, tools, requireDeep, requireSearch }) {
    const r = await fetch(`${BASE}/api/ai`, {
      method:  "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ messages, max_tokens, tools, requireDeep, requireSearch }),
    });

    if (r.status === 401) throw new Error("Not signed in");
    if (r.status === 403) {
      const { required } = await r.json();
      throw new TierError(required);
    }
    if (!r.ok) throw new Error("AI request failed");
    return r.json();   // same shape as Anthropic's response
  }

  // ── Redirect to Stripe Checkout ────────────────────────────────────────────
  // Usage: await startCheckout("growth")  or  await startCheckout("pro")
  async function startCheckout(tier) {
    const r = await fetch(`${BASE}/api/checkout`, {
      method:  "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ tier }),
    });
    const { url } = await r.json();
    window.location.href = url;
  }

  // ── Redirect to Stripe Customer Portal (manage/cancel) ────────────────────
  async function openPortal() {
    const r = await fetch(`${BASE}/api/portal`, {
      method:  "POST",
      headers: await authHeaders(),
    });
    const { url } = await r.json();
    window.location.href = url;
  }

  return { callAI, startCheckout, openPortal };
}

// Throw this when a feature needs a paid tier
export class TierError extends Error {
  constructor(required) {
    super(`Requires ${required} tier`);
    this.required = required;
  }
}
