// api/ai.js — Vercel Serverless Function
// Proxies all Claude API calls. API key lives only in Vercel env vars.

import { verifyClerkToken } from "./clerk.js";

const CLAUDE_MODEL = "claude-sonnet-4-5";

const TIER_GATES = {
  free:   { deepAnalysis: false, aiSearch: false },
  growth: { deepAnalysis: true,  aiSearch: true  },
  pro:    { deepAnalysis: true,  aiSearch: true  },
};

export default async function handler(req, res) {
  res.setHeader("Content-Type", "application/json");

  try {
    if (req.method !== "POST") {
      return res.status(405).json({ error: "Method not allowed" });
    }

    const { tier, error } = await verifyClerkToken(req);
    if (error) return res.status(401).json({ error });

    let body = req.body;
    if (typeof body === "string") {
      try { body = JSON.parse(body); } catch { body = {}; }
    }
    body = body || {};

    const { messages, max_tokens = 1000, tools, requireDeep, requireSearch } = body;
    const gates = TIER_GATES[tier] || TIER_GATES.free;

    if (requireDeep && !gates.deepAnalysis) {
      return res.status(403).json({ error: "tier_required", required: "growth" });
    }
    if (requireSearch && !gates.aiSearch) {
      return res.status(403).json({ error: "tier_required", required: "growth" });
    }

    if (!process.env.ANTHROPIC_API_KEY) {
      return res.status(500).json({ error: "ANTHROPIC_API_KEY not configured" });
    }

    const aiBody = { model: CLAUDE_MODEL, max_tokens, messages };
    if (tools) aiBody.tools = tools;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(aiBody),
    });

    const data = await r.json();
    return res.status(r.ok ? 200 : r.status).json(data);

  } catch (err) {
    console.error("AI proxy error:", err.message, err.stack);
    return res.status(500).json({
      error: "AI request failed",
      detail: err.message,
    });
  }
}
