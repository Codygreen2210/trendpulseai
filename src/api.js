// src/api.js — frontend API client

import { useAuth } from "@clerk/clerk-react";

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

  async function parseResponse(r) {
    const contentType = r.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return r.json();
    }
    const text = await r.text();
    throw new Error(`Server error (${r.status}): ${text.slice(0, 120)}`);
  }

  async function callAI({ messages, max_tokens = 1000, tools, requireDeep, requireSearch }) {
    const r = await fetch(`${BASE}/api/ai`, {
      method:  "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ messages, max_tokens, tools, requireDeep, requireSearch }),
    });

    if (r.status === 401) throw new Error("Not signed in");
    if (r.status === 403) {
      const { required } = await parseResponse(r);
      throw new TierError(required);
    }
    if (!r.ok) {
      const body = await parseResponse(r).catch(e => ({ error: e.message }));
      throw new Error(body.error || body.detail || `AI request failed (${r.status})`);
    }
    return parseResponse(r);
  }

  async function startCheckout(tier) {
    const r = await fetch(`${BASE}/api/checkout`, {
      method:  "POST",
      headers: await authHeaders(),
      body: JSON.stringify({ tier }),
    });
    if (!r.ok) {
      const body = await parseResponse(r).catch(e => ({ error: e.message }));
      throw new Error(body.error || body.detail || `Checkout failed (${r.status})`);
    }
    const { url } = await parseResponse(r);
    if (!url) throw new Error("No checkout URL returned");
    window.location.href = url;
  }

  async function openPortal() {
    const r = await fetch(`${BASE}/api/portal`, {
      method:  "POST",
      headers: await authHeaders(),
    });
    if (!r.ok) {
      const body = await parseResponse(r).catch(e => ({ error: e.message }));
      throw new Error(body.error || body.detail || `Portal failed (${r.status})`);
    }
    const { url } = await parseResponse(r);
    if (!url) throw new Error("No portal URL returned");
    window.location.href = url;
  }

  return { callAI, startCheckout, openPortal };
}

export class TierError extends Error {
  constructor(required) {
    super(`Requires ${required} tier`);
    this.required = required;
  }
}
