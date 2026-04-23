// api/ai.js — Vercel Serverless Function
// Proxies Claude API calls. Supports streaming for instant-response UX.
// API key lives only in Vercel env vars.

import { verifyClerkToken } from "./clerk.js";

const CLAUDE_MODEL = "claude-sonnet-4-5";

const TIER_GATES = {
  free:   { deepAnalysis: false, aiSearch: false },
  growth: { deepAnalysis: true,  aiSearch: true  },
  pro:    { deepAnalysis: true,  aiSearch: true  },
};

export default async function handler(req, res) {
  try {
    if (req.method !== "POST") {
      res.setHeader("Content-Type", "application/json");
      return res.status(405).json({ error: "Method not allowed" });
    }

    // 1. Verify Clerk JWT → get userId + tier
    const { tier, error } = await verifyClerkToken(req);
    if (error) {
      res.setHeader("Content-Type", "application/json");
      return res.status(401).json({ error });
    }

    // 2. Parse body safely
    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const {
      messages,
      max_tokens = 1000,
      tools,
      requireDeep,
      requireSearch,
      stream = false,       // ← NEW: set true for streaming responses
    } = body;

    const gates = TIER_GATES[tier] || TIER_GATES.free;

    // 3. Enforce tier gates
    if (requireDeep && !gates.deepAnalysis) {
      res.setHeader("Content-Type", "application/json");
      return res.status(403).json({ error: "tier_required", required: "growth" });
    }
    if (requireSearch && !gates.aiSearch) {
      res.setHeader("Content-Type", "application/json");
      return res.status(403).json({ error: "tier_required", required: "growth" });
    }

    // 4. Validate env
    if (!process.env.ANTHROPIC_API_KEY) {
      res.setHeader("Content-Type", "application/json");
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    // 5. Forward to Anthropic
    const aiBody = { model: CLAUDE_MODEL, max_tokens, messages, stream };
    if (tools) aiBody.tools = tools;

    const anthropicRes = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(aiBody),
    });

    if (!anthropicRes.ok) {
      const errText = await anthropicRes.text();
      res.setHeader("Content-Type", "application/json");
      return res.status(anthropicRes.status).json({
        error: "Anthropic API error",
        detail: errText.slice(0, 500),
      });
    }

    // 6a. Streaming response — pipe SSE bytes directly to the browser
    if (stream) {
      res.setHeader("Content-Type", "text/event-stream");
      res.setHeader("Cache-Control", "no-cache, no-transform");
      res.setHeader("Connection", "keep-alive");
      res.setHeader("X-Accel-Buffering", "no");

      // Node readable stream from fetch body
      const reader = anthropicRes.body.getReader();
      const decoder = new TextDecoder();

      try {
        while (true) {
          const { value, done } = await reader.read();
          if (done) break;
          res.write(decoder.decode(value, { stream: true }));
        }
      } catch (streamErr) {
        console.error("Stream error:", streamErr.message);
      }
      res.end();
      return;
    }

    // 6b. Non-streaming (JSON) response
    res.setHeader("Content-Type", "application/json");
    const data = await anthropicRes.json();
    return res.status(200).json(data);

  } catch (err) {
    console.error("AI proxy error:", err.message, err.stack);
    res.setHeader("Content-Type", "application/json");
    return res.status(500).json({
      error: "AI request failed",
      detail: err.message,
    });
  }
}
