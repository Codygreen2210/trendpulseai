// src/api.js — frontend API client with stable function references

import { useAuth } from "@clerk/clerk-react";
import { useCallback } from "react";

const BASE = "";

export function useAPI() {
  const { getToken } = useAuth();

  // ── callAI — stable reference via useCallback ─────────────────────────────
  const callAI = useCallback(async ({
    messages, max_tokens = 1000, tools, requireDeep, requireSearch, signal,
  }) => {
    const token = await getToken();
    const r = await fetch(`${BASE}/api/ai`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ messages, max_tokens, tools, requireDeep, requireSearch }),
      signal, // ← lets the caller abort the request if the component unmounts
    });

    const contentType = r.headers.get("content-type") || "";
    const readBody = async () => {
      if (contentType.includes("application/json")) return r.json();
      const text = await r.text();
      return { error: `Server error (${r.status})`, detail: text.slice(0, 120) };
    };

    if (r.status === 401) throw new Error("Not signed in");
    if (r.status === 403) {
      const { required } = await readBody();
      throw new TierError(required);
    }
    if (!r.ok) {
      const body = await readBody();
      throw new Error(body.error || body.detail || `AI request failed (${r.status})`);
    }
    return readBody();
  }, [getToken]);

  // ── Stripe Checkout ───────────────────────────────────────────────────────
  const startCheckout = useCallback(async (tier) => {
    const token = await getToken();
    const r = await fetch(`${BASE}/api/checkout`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
      body: JSON.stringify({ tier }),
    });
    if (!r.ok) {
      const ct = r.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await r.json() : { error: await r.text() };
      throw new Error(body.error || body.detail || `Checkout failed (${r.status})`);
    }
    const { url } = await r.json();
    if (!url) throw new Error("No checkout URL returned");
    window.location.href = url;
  }, [getToken]);

  // ── Stripe Customer Portal ────────────────────────────────────────────────
  const openPortal = useCallback(async () => {
    const token = await getToken();
    const r = await fetch(`${BASE}/api/portal`, {
      method: "POST",
      headers: {
        "Content-Type":  "application/json",
        "Authorization": `Bearer ${token}`,
      },
    });
    if (!r.ok) {
      const ct = r.headers.get("content-type") || "";
      const body = ct.includes("application/json") ? await r.json() : { error: await r.text() };
      throw new Error(body.error || body.detail || `Portal failed (${r.status})`);
    }
    const { url } = await r.json();
    if (!url) throw new Error("No portal URL returned");
    window.location.href = url;
  }, [getToken]);

  return { callAI, startCheckout, openPortal };
}

export class TierError extends Error {
  constructor(required) {
    super(`Requires ${required} tier`);
    this.required = required;
  }
}
