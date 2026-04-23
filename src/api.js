// src/api.js — frontend API client with streaming support

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

  // ── Regular (non-streaming) AI call ─────────────────────────────────────────
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

  // ── STREAMING AI call — calls onDelta(chunk) as tokens arrive ─────────────
  // Usage:
  //   await callAIStream({ messages, max_tokens: 1200, requireDeep: true,
  //                         onDelta: (chunk) => setText(prev => prev + chunk) });
  async function callAIStream({
    messages,
    max_tokens = 1000,
    requireDeep,
    requireSearch,
    onDelta,
  }) {
    const r = await fetch(`${BASE}/api/ai`, {
      method:  "POST",
      headers: await authHeaders(),
      body: JSON.stringify({
        messages, max_tokens, requireDeep, requireSearch,
        stream: true,
      }),
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

    // Read SSE stream from Anthropic
    const reader = r.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";
    let fullText = "";

    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });

      // Parse Server-Sent Events (SSE)
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";  // keep incomplete line for next iteration

      for (const line of lines) {
        if (!line.startsWith("data: ")) continue;
        const payload = line.slice(6).trim();
        if (payload === "[DONE]") continue;

        try {
          const event = JSON.parse(payload);
          // Anthropic streaming: content_block_delta events carry the text
          if (event.type === "content_block_delta" && event.delta?.type === "text_delta") {
            const chunk = event.delta.text || "";
            fullText += chunk;
            if (onDelta) onDelta(chunk);
          }
        } catch {
          // Ignore parse errors on malformed SSE lines
        }
      }
    }

    return { content: [{ type: "text", text: fullText }] };
  }

  // ── Stripe Checkout ─────────────────────────────────────────────────────────
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

  // ── Stripe Customer Portal ──────────────────────────────────────────────────
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

  return { callAI, callAIStream, startCheckout, openPortal };
}

export class TierError extends Error {
  constructor(required) {
    super(`Requires ${required} tier`);
    this.required = required;
  }
}
