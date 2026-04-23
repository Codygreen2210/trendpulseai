// api/ai.js — Vercel Serverless Function
// Proxies all Claude API calls. API key lives only in Vercel env vars.

import { verifyClerkToken } from "./_clerk.js";

const TIER_GATES = {
  free:   { deepAnalysis: false, aiSearch: false },
  growth: { deepAnalysis: true,  aiSearch: true  },
  pro:    { deepAnalysis: true,  aiSearch: true  },
};

export default async function handler(req, res) {
  if (req.method !== "POST") return res.status(405).end();

  // 1. Verify Clerk JWT → get userId + tier
  const { userId, tier, error } = await verifyClerkToken(req);
  if (error) return res.status(401).json({ error });

  const { messages, max_tokens = 1000, tools, requireDeep, requireSearch } = req.body;
  const gates = TIER_GATES[tier] || TIER_GATES.free;

  // 2. Enforce tier gates
  if (requireDeep   && !gates.deepAnalysis) return res.status(403).json({ error: "tier_required", required: "growth" });
  if (requireSearch && !gates.aiSearch)     return res.status(403).json({ error: "tier_required", required: "growth" });

  // 3. Forward to Anthropic — key never leaves the server
  try {
    const body = { model: "claude-sonnet-4-20250514", max_tokens, messages };
    if (tools) body.tools = tools;

    const r = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type":      "application/json",
        "x-api-key":         process.env.ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
      },
      body: JSON.stringify(body),
    });

    const data = await r.json();
    return res.status(200).json(data);
  } catch (err) {
    return res.status(500).json({ error: "AI request failed" });
  }
}
