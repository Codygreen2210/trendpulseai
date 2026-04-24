import { useState, useEffect, useRef, useCallback, useMemo } from "react";
import { useUser, UserButton } from "@clerk/clerk-react";
import { useAPI } from "./api.js";

// ─── MODEL CONFIG ─────────────────────────────────────────────────────────────
// Kept at top-level so model upgrades are a one-line change.
// The old "claude-sonnet-4-20250514" is deprecated (retires June 15 2026).
const CLAUDE_MODEL = "claude-sonnet-4-5";

// ─── CONSTANTS ────────────────────────────────────────────────────────────────

const TIERS = {
  free:   { name:"Free",   price:"$0/mo",  color:"#94a3b8", badge:"FREE",    limit:5   },
  growth: { name:"Growth", price:"$10/mo", color:"#00d4aa", badge:"POPULAR", limit:20  },
  pro:    { name:"Pro",    price:"$30/mo", color:"#f59e0b", badge:"PRO",      limit:999 },
};

const TIER_FEATURES = {
  free: [
    "Top 5 trending items",
    "Basic surge scores",
    "🔍 Amazon Lookup — any product, any tier",
    "Computed risk & package score on any product",
    "3 platforms tracked",
    "Browse mode (limited)",
  ],
  growth: [
    "Top 20 trending items",
    "Full surge + potential scores",
    "All tracked platforms",
    "Browse all items",
    "Sale alerts",
    "Add up to 2 custom sites",
    "Amazon lookup + AI deep risk/bundle analysis",
    "📦 Bundle Deal Builder (3 bundles/day)",
    "🤖 AI Product Search across all platforms",
  ],
  pro: [
    "Unlimited trending items",
    "AI deep insights on any product",
    "All platforms + unlimited custom sites",
    "Full browse + filter",
    "Real-time sale alerts",
    "Live user tracker",
    "Competitor intelligence",
    "API access",
    "📦 Unlimited bundle deals + full deep analysis",
    "🤖 AI Search + complete risk/package strategy",
  ],
};

const DEFAULT_PLATFORMS = [
  { id:"amazon",   name:"Amazon",   color:"#ff9900", icon:"📦", active:true },
  { id:"tiktok",   name:"TikTok",   color:"#ff2d55", icon:"🎵", active:true },
  { id:"etsy",     name:"Etsy",     color:"#f1641e", icon:"🎨", active:true },
  { id:"shopify",  name:"Shopify",  color:"#96bf48", icon:"🛍️", active:true },
  { id:"facebook", name:"Facebook", color:"#1877f2", icon:"👥", active:true },
  { id:"walmart",  name:"Walmart",  color:"#0071ce", icon:"🏪", active:true },
  { id:"ebay",     name:"eBay",     color:"#e53238", icon:"🏷️", active:true },
];

const CATEGORIES = ["All","Beauty","Tech","Home","Fashion","Fitness","Food","Pets","Kids","Jewelry","Tools","Outdoor"];

const HOT_PRODUCTS = [
  { id:1,  name:"Stanley Quencher Tumbler 40oz", category:"Home",    platforms:["Amazon","TikTok","Shopify"],   surge:94, potential:96, sales30d:128400, reviews:47200, rating:4.8, price:"$45",  origPrice:null,   onSale:false, trend:"+312%", tags:["viral","gifting"] },
  { id:2,  name:"LED Strip Lights RGB Smart",    category:"Home",    platforms:["TikTok","Amazon","Shopify"],   surge:88, potential:91, sales30d:98200,  reviews:22100, rating:4.6, price:"$22",  origPrice:null,   onSale:false, trend:"+198%", tags:["viral","dorm"] },
  { id:3,  name:"Portable Mini Blender USB",     category:"Fitness", platforms:["Amazon","TikTok","Facebook"],  surge:82, potential:88, sales30d:76500,  reviews:18900, rating:4.7, price:"$29",  origPrice:"$44",  onSale:true,  trend:"+145%", tags:["health","travel"] },
  { id:4,  name:"Linen Barrel Wide-Leg Pants",   category:"Fashion", platforms:["TikTok","Etsy","Shopify"],     surge:79, potential:85, sales30d:62100,  reviews:8400,  rating:4.5, price:"$38",  origPrice:null,   onSale:false, trend:"+128%", tags:["summer","trending"] },
  { id:5,  name:"Mushroom Gummy Supplements",    category:"Food",    platforms:["Amazon","Shopify","Facebook"], surge:76, potential:82, sales30d:54800,  reviews:31200, rating:4.4, price:"$34",  origPrice:"$49",  onSale:true,  trend:"+115%", tags:["wellness","subscription"] },
  { id:6,  name:"Aesthetic Arc Floor Lamp",      category:"Home",    platforms:["Amazon","TikTok","Etsy"],      surge:71, potential:79, sales30d:49300,  reviews:14600, rating:4.6, price:"$67",  origPrice:null,   onSale:false, trend:"+98%",  tags:["interior","gifting"] },
  { id:7,  name:"Pet Camera Treat Dispenser",    category:"Pets",    platforms:["Amazon","Shopify","Facebook"], surge:68, potential:90, sales30d:43100,  reviews:9800,  rating:4.7, price:"$89",  origPrice:"$119", onSale:true,  trend:"+87%",  tags:["pets","tech"] },
  { id:8,  name:"Pressed Flower Resin Frame",    category:"Home",    platforms:["Etsy","TikTok","Shopify"],     surge:64, potential:76, sales30d:38200,  reviews:5600,  rating:4.9, price:"$42",  origPrice:null,   onSale:false, trend:"+76%",  tags:["handmade","gifting"] },
  { id:9,  name:"Kids Magnetic Drawing Board",   category:"Kids",    platforms:["Amazon","Facebook","Shopify"], surge:61, potential:72, sales30d:34500,  reviews:28700, rating:4.5, price:"$19",  origPrice:"$27",  onSale:true,  trend:"+69%",  tags:["kids","edu"] },
  { id:10, name:"Micro Derma Roller 0.25mm",     category:"Beauty",  platforms:["TikTok","Amazon","Shopify"],   surge:57, potential:80, sales30d:31900,  reviews:16200, rating:4.3, price:"$27",  origPrice:null,   onSale:false, trend:"+61%",  tags:["skincare","viral"] },
  { id:11, name:"Scalp Massager Shampoo Brush",  category:"Beauty",  platforms:["TikTok","Amazon"],             surge:99, potential:97, sales30d:12400,  reviews:4300,  rating:4.8, price:"$14",  origPrice:"$20",  onSale:true,  trend:"+540%", tags:["emerging","haircare"] },
  { id:12, name:"Cloud Plush Throw Pillow",      category:"Home",    platforms:["TikTok","Etsy","Shopify"],     surge:97, potential:93, sales30d:9800,   reviews:2100,  rating:4.9, price:"$38",  origPrice:null,   onSale:false, trend:"+490%", tags:["emerging","cozy"] },
  { id:13, name:"Matcha Ceremonial Whisk Set",   category:"Food",    platforms:["TikTok","Amazon","Etsy"],      surge:95, potential:89, sales30d:8200,   reviews:3400,  rating:4.7, price:"$31",  origPrice:"$45",  onSale:true,  trend:"+420%", tags:["emerging","wellness"] },
  { id:14, name:"Resistance Hip Circle Band",    category:"Fitness", platforms:["TikTok","Shopify","Amazon"],   surge:91, potential:86, sales30d:7100,   reviews:5600,  rating:4.6, price:"$18",  origPrice:null,   onSale:false, trend:"+380%", tags:["gym","emerging"] },
  { id:15, name:"Glass Crystal Nail File",       category:"Beauty",  platforms:["TikTok","Etsy"],               surge:88, potential:84, sales30d:6400,   reviews:1800,  rating:4.8, price:"$12",  origPrice:"$18",  onSale:true,  trend:"+340%", tags:["nails","emerging"] },
  { id:16, name:"Portable UV Sanitizer Box",     category:"Tech",    platforms:["Amazon","Shopify"],            surge:84, potential:78, sales30d:5900,   reviews:7200,  rating:4.4, price:"$44",  origPrice:null,   onSale:false, trend:"+290%", tags:["health","tech"] },
  { id:17, name:"Weighted Eye Sleep Mask",       category:"Fitness", platforms:["Amazon","TikTok","Shopify"],   surge:80, potential:88, sales30d:18400,  reviews:9100,  rating:4.7, price:"$26",  origPrice:"$38",  onSale:true,  trend:"+210%", tags:["sleep","wellness"] },
  { id:18, name:"Cottagecore Ceramic Mug Set",   category:"Home",    platforms:["Etsy","TikTok","Shopify"],     surge:74, potential:81, sales30d:14200,  reviews:3900,  rating:4.8, price:"$34",  origPrice:null,   onSale:false, trend:"+160%", tags:["gifting","aesthetic"] },
  { id:19, name:"Foldable Foam Roller Deep",     category:"Fitness", platforms:["Amazon","Walmart","Shopify"],  surge:69, potential:75, sales30d:22600,  reviews:11200, rating:4.5, price:"$29",  origPrice:"$42",  onSale:true,  trend:"+88%",  tags:["recovery","gym"] },
  { id:20, name:"Smart LED Desk Clock Display",  category:"Tech",    platforms:["Amazon","TikTok","eBay"],      surge:65, potential:83, sales30d:17800,  reviews:6700,  rating:4.4, price:"$39",  origPrice:null,   onSale:false, trend:"+74%",  tags:["desk","tech"] },
];

const SALE_PRODUCTS = HOT_PRODUCTS.filter(p => p.onSale);

const PACKAGE_SEEDS = [
  { name:"Morning Wellness Ritual",  items:[5,13,17], theme:"🌿 Wellness",      description:"Three high-surge wellness items that together tell a complete self-care story.",        bundleSavings:"$12–$18", potentialUplift:"+43%", targetAudience:"Wellness-conscious women 25–45" },
  { name:"WFH Glow-Up Bundle",       items:[6,20,2],  theme:"💻 Work From Home", description:"Desk lamp, smart clock, and LED strips — the perfect aesthetic workspace setup.",        bundleSavings:"$15–$25", potentialUplift:"+61%", targetAudience:"Remote workers, students, creators" },
  { name:"Viral Beauty Starter Kit", items:[10,15,11],theme:"✨ Beauty",          description:"Three TikTok-viral beauty tools that each amplify the results of the others.",          bundleSavings:"$8–$14",  potentialUplift:"+55%", targetAudience:"Beauty enthusiasts, TikTok shoppers" },
  { name:"Pet Parent Essentials",    items:[7,9,3],   theme:"🐾 Pets & Kids",    description:"Pet camera, kids drawing board, and mini blender — highly giftable family bundle.",     bundleSavings:"$20–$30", potentialUplift:"+38%", targetAudience:"Parents with pets, family shoppers" },
  { name:"Fit Life Recovery Pack",   items:[14,19,17],theme:"💪 Fitness",         description:"Hip circle bands, foam roller, and sleep mask — complete recovery + training package.", bundleSavings:"$10–$18", potentialUplift:"+49%", targetAudience:"Gym-goers, fitness influencers" },
];

// ─── AMAZON PAAPI PROXY STUB ──────────────────────────────────────────────────
async function fetchAmazonProducts(keywords) {
  return null;
}

// ─── UTILITIES ────────────────────────────────────────────────────────────────

function fmtK(n) {
  if (!n) return "0";
  return n >= 1000 ? (n / 1000).toFixed(1) + "K" : n;
}

function rand(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

// Computes risk score and package score from product sales data
function computeProductScores(product) {
  const sales30d  = product.sales30d  || 0;
  const reviews   = product.reviews   || 0;
  const rating    = product.rating    || 3;
  const surge     = product.surge     || 50;
  const potential = product.potential || 50;

  // Stability 0–100 (inverse of risk)
  const salesStab  = Math.min(sales30d / 80000, 1) * 35;
  const reviewStab = Math.min(reviews  / 30000, 1) * 30;
  const ratingStab = ((rating - 1) / 4)            * 20;
  const surgeStab  = (surge / 100)                 * 15;
  const stability  = salesStab + reviewStab + ratingStab + surgeStab;
  const riskScore  = Math.max(5, Math.min(95, Math.round(100 - stability)));

  const riskLevel  = riskScore < 35 ? "Low" : riskScore < 65 ? "Medium" : "High";
  const riskColor  = riskScore < 35 ? "#00d4aa" : riskScore < 65 ? "#f59e0b" : "#ff4444";

  // Package potential
  const price      = parseFloat((product.price || "$0").replace(/[^0-9.]/g, "")) || 0;
  const priceBonus = price >= 15 && price <= 90 ? 15 : price < 15 ? 8 : 10;
  const packageScore = Math.max(10, Math.min(98, Math.round((surge * 0.4) + (potential * 0.4) + priceBonus)));
  const packageLevel = packageScore >= 75 ? "Excellent" : packageScore >= 55 ? "Good" : "Limited";
  const packageColor = packageScore >= 75 ? "#f59e0b" : packageScore >= 55 ? "#a78bfa" : "#94a3b8";

  return { riskScore, riskLevel, riskColor, packageScore, packageLevel, packageColor };
}

// ─── SHARED COMPONENTS ────────────────────────────────────────────────────────


// ─── SHARED HELPERS ───────────────────────────────────────────────────────────

// Safely extracts text from an Anthropic API response, throws on API errors
// Detects common issues (rate limits, auth, etc.) and returns friendly messages.
function extractText(d) {
  if (!d) throw new Error("Network error — check your connection and try again.");

  // Rate limit / quota exceeded — top-level or nested
  const typ = d?.type || d?.error?.type || d?.status || "";
  if (String(typ).toLowerCase().includes("exceeded_limit") ||
      String(typ).toLowerCase().includes("rate_limit") ||
      d?.error?.type === "rate_limit_error") {
    throw new Error("🕓 Daily usage limit reached. Please try again later or upgrade your plan.");
  }

  // Auth failures
  if (d?.error?.type === "authentication_error" || d?.status === 401) {
    throw new Error("Authentication issue — please sign in again.");
  }

  // Overloaded
  if (d?.error?.type === "overloaded_error" || d?.status === 529) {
    throw new Error("🔄 Servers are busy right now. Try again in a moment.");
  }

  // Generic API error
  if (d.error) {
    const msg = d.error.message || "Service temporarily unavailable";
    // Strip any raw JSON/URLs from the message so it stays clean in the UI
    throw new Error(msg.length > 140 ? "Service temporarily unavailable. Please try again." : msg);
  }

  const text = (d.content || [])
    .filter(b => b.type === "text")
    .map(b => b.text)
    .join("")
    .trim();
  if (!text) throw new Error("Empty response — please try again.");
  return text;
}

// Pulls the first valid JSON object OR array out of a string, tolerating
// markdown fences, leading prose, and trailing text.
function extractJSON(str) {
  // Strip markdown code fences
  const cleaned = str.replace(/```json|```/gi, "").trim();
  // Try direct parse first
  try { return JSON.parse(cleaned); } catch {}
  // Walk forward looking for { or [
  for (let i = 0; i < cleaned.length; i++) {
    if (cleaned[i] !== "{" && cleaned[i] !== "[") continue;
    const closer = cleaned[i] === "{" ? "}" : "]";
    let depth = 0, inStr = false, esc = false;
    for (let j = i; j < cleaned.length; j++) {
      const ch = cleaned[j];
      if (esc) { esc = false; continue; }
      if (ch === "\\" && inStr) { esc = true; continue; }
      if (ch === '"' && !esc) { inStr = !inStr; continue; }
      if (inStr) continue;
      if (ch === cleaned[i] || (ch === "{" || ch === "[")) depth++;
      if (ch === closer || (ch === "}" || ch === "]")) {
        depth--;
        if (depth === 0) {
          try { return JSON.parse(cleaned.slice(i, j + 1)); } catch { break; }
        }
      }
    }
  }
  throw new Error("Could not parse JSON from response");
}

function ScoreRing({ value, color, size = 48, label }) {
  const r    = (size / 2) - 5;
  const circ = 2 * Math.PI * r;
  const numVal = typeof value === "number" ? value : 0;
  const fill = circ - (circ * numVal / 100);
  return (
    <div style={{ display:"flex", flexDirection:"column", alignItems:"center", gap:3 }}>
      <svg width={size} height={size} style={{ transform:"rotate(-90deg)" }}>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke="rgba(255,255,255,0.06)" strokeWidth={4}/>
        <circle cx={size/2} cy={size/2} r={r} fill="none"
          stroke={color} strokeWidth={4}
          strokeDasharray={circ} strokeDashoffset={fill} strokeLinecap="round"
          style={{ transition:"stroke-dashoffset 1.2s cubic-bezier(.4,0,.2,1)",
            filter:`drop-shadow(0 0 4px ${color}88)` }}/>
        <text x={size/2} y={size/2+1} textAnchor="middle" dominantBaseline="middle"
          fill="#f0f0f0" fontSize={size>40?12:10} fontWeight={800}
          style={{ transform:"rotate(90deg)", transformOrigin:`${size/2}px ${size/2}px` }}>
          {typeof value === "number" ? value : "?"}
        </text>
      </svg>
      {label && <div style={{ fontSize:9, color:"#555", letterSpacing:"0.06em" }}>{label}</div>}
    </div>
  );
}

function PlatBadge({ name, platforms }) {
  const c = platforms.find(p => p.name === name)?.color || "#666";
  return (
    <span style={{ fontSize:10, fontWeight:700, padding:"2px 7px", borderRadius:4,
      background:c+"22", color:c, border:`1px solid ${c}33` }}>
      {name}
    </span>
  );
}

function TierGate({ tier, required, children }) {
  const order = { free:0, growth:1, pro:2 };
  if (order[tier] >= order[required]) return children;
  return (
    <div style={{ textAlign:"center", padding:"48px 24px",
      background:"rgba(255,255,255,0.02)",
      border:"1px dashed rgba(255,255,255,0.1)", borderRadius:16, marginTop:24 }}>
      <div style={{ fontSize:32, marginBottom:12 }}>🔒</div>
      <div style={{ fontSize:14, color:"#555", marginBottom:6 }}>
        Requires{" "}
        <span style={{ color:required==="growth"?"#00d4aa":"#f59e0b", fontWeight:700 }}>
          {TIERS[required].name} — {TIERS[required].price}
        </span>
      </div>
      <div style={{ fontSize:12, color:"#333" }}>Select that tier in the top-right to unlock</div>
    </div>
  );
}

// ─── PRODUCT CARD ─────────────────────────────────────────────────────────────

function ProductCard({ product, rank, accentColor, tier, onAnalyze, platforms, compact = false }) {
  const [hov, setHov] = useState(false);
  const canAnalyze    = tier !== "free";
  const showPotential = true; // potential visible on all tiers

  return (
    <div
      onMouseEnter={() => setHov(true)}
      onMouseLeave={() => setHov(false)}
      style={{
        background: hov
          ? `linear-gradient(135deg,${accentColor}10,rgba(255,255,255,0.03))`
          : "linear-gradient(135deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))",
        border:`1px solid ${hov ? accentColor+"55" : "rgba(255,255,255,0.07)"}`,
        borderRadius:16, padding:compact?"14px 16px":"18px 20px",
        position:"relative", transition:"all 0.25s",
        boxShadow:hov ? `0 8px 32px ${accentColor}18` : "none",
        transform:hov ? "translateY(-2px)" : "none",
      }}>

      {rank && rank <= 3 && (
        <div style={{ position:"absolute", top:-10, left:16,
          background:`linear-gradient(135deg,${accentColor},${accentColor}99)`,
          color:"#000", fontWeight:900, fontSize:11, padding:"3px 10px", borderRadius:20 }}>
          #{rank} HOT
        </div>
      )}
      {rank && rank > 3 && (
        <div style={{ position:"absolute", top:-10, left:16,
          background:"rgba(255,255,255,0.08)", color:"#777", fontWeight:700,
          fontSize:10, padding:"3px 10px", borderRadius:20 }}>
          #{rank}
        </div>
      )}
      {product.onSale && (
        <div style={{ position:"absolute", top:-10, right:16,
          background:"linear-gradient(135deg,#ff2d55,#ff6b35)", color:"#fff",
          fontWeight:800, fontSize:10, padding:"3px 10px", borderRadius:20 }}>
          🏷️ SALE
        </div>
      )}
      {product.tags?.includes("emerging") && !product.onSale && (
        <div style={{ position:"absolute", top:-10, right:16,
          background:"linear-gradient(135deg,#a78bfa,#7c3aed)", color:"#fff",
          fontWeight:800, fontSize:10, padding:"3px 10px", borderRadius:20,
          animation:"pulse 2s infinite" }}>
          ⚡ SURGE
        </div>
      )}

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start",
        marginBottom:10, marginTop:(rank || product.onSale) ? 8 : 0 }}>
        {/* Product image (for real Rainforest products) */}
        {product.image && (
          <div style={{ width: compact?50:60, height: compact?50:60, flexShrink:0,
            marginRight:10, borderRadius:8, overflow:"hidden",
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.06)" }}>
            <img src={product.image} alt=""
              style={{ width:"100%", height:"100%", objectFit:"contain" }}
              onError={(e) => { e.target.style.display = "none"; }}/>
          </div>
        )}
        <div style={{ flex:1, paddingRight:12 }}>
          <div style={{ fontWeight:700, fontSize:compact?13:14, color:"#f0f0f0",
            lineHeight:1.3, marginBottom:3 }}>{product.name}</div>
          <div style={{ fontSize:10, color:"#555", marginBottom:7 }}>{product.category}</div>
          <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
            {product.platforms.slice(0,3).map(p =>
              <PlatBadge key={p} name={p} platforms={platforms}/>
            )}
          </div>
        </div>
        <div style={{ textAlign:"right", flexShrink:0 }}>
          <div style={{ fontSize:compact?16:20, fontWeight:900, color:"#f0f0f0" }}>{product.price}</div>
          {product.origPrice && (
            <div style={{ fontSize:11, color:"#444", textDecoration:"line-through" }}>{product.origPrice}</div>
          )}
          {product.trend && (
            <div style={{ fontSize:13, fontWeight:800,
              color:product.trend.startsWith("+") ? "#00d4aa" : "#ff4444",
              background:product.trend.startsWith("+") ? "rgba(0,212,170,0.1)" : "rgba(255,68,68,0.1)",
              padding:"2px 8px", borderRadius:6, marginTop:4 }}>
              {product.trend}
            </div>
          )}
        </div>
      </div>

      <div style={{ display:"flex", gap:12, marginBottom:10, justifyContent:"center" }}>
        <ScoreRing value={product.surge} color="#00d4aa" size={52} label="SURGE"/>
        <ScoreRing value={showPotential ? product.potential : "?"} color="#f59e0b" size={52} label="POTENTIAL"/>
      </div>

      <div style={{ display:"flex", justifyContent:"space-between",
        borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:10 }}>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#e0e0e0" }}>{fmtK(product.sales30d)}</div>
          <div style={{ fontSize:9, color:"#444" }}>30d Sales</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#e0e0e0" }}>{fmtK(product.reviews)}</div>
          <div style={{ fontSize:9, color:"#444" }}>Reviews</div>
        </div>
        <div style={{ textAlign:"center" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#f59e0b" }}>
            {"★".repeat(Math.round(product.rating))}
          </div>
          <div style={{ fontSize:9, color:"#444" }}>{product.rating}/5</div>
        </div>
        <button
          onClick={() => canAnalyze ? onAnalyze(product, "insight") : null}
          style={{ background:canAnalyze
            ? `linear-gradient(135deg,${accentColor}22,${accentColor}11)`
            : "rgba(255,255,255,0.04)",
            border:`1px solid ${canAnalyze ? accentColor+"44" : "rgba(255,255,255,0.08)"}`,
            color:canAnalyze ? accentColor : "#333", borderRadius:8, padding:"6px 12px",
            fontSize:10, fontWeight:700,
            cursor:canAnalyze ? "pointer" : "not-allowed", transition:"all 0.2s" }}>
          {canAnalyze ? "AI Insight" : "🔒 Locked"}
        </button>
      </div>

      {/* View on Amazon link — only for real products with links */}
      {product.link && (
        <div style={{ marginTop:8, textAlign:"center" }}>
          <a href={product.link} target="_blank" rel="noopener noreferrer"
            style={{
              display:"inline-flex", alignItems:"center", gap:4,
              fontSize:10, fontWeight:700, color:"#ff9900",
              textDecoration:"none", letterSpacing:"0.03em",
              padding:"3px 10px", borderRadius:6,
              background:"rgba(255,153,0,0.08)",
              border:"1px solid rgba(255,153,0,0.2)",
            }}>
            VIEW ON AMAZON →
          </a>
        </div>
      )}
    </div>
  );
}

// ─── AI MODAL ─────────────────────────────────────────────────────────────────

function AIModal({ product, onClose, type = "insight" }) {
  const [text, setText]     = useState("");
  const [loading, setLoading] = useState(true);
  const { callAI } = useAPI();
  const ac = type === "sale" ? "#ff2d55" : "#00d4aa";

  useEffect(() => {
    if (!product) return;
    setLoading(true);
    setText("");

    const prompt = type === "insight"
      ? `Be concise. Analyze this product in <300 words:
${product.name} | ${product.category} | ${product.price} | ${product.trend} | Surge ${product.surge}/100

Format (keep each section to 1-2 sentences):
**Why It's Trending**
**Target Audience**
**Profit Potential**
**3 Action Steps**
**Risk**`
      : `Be concise. Sale analysis in <250 words:
${product.name} | Sale ${product.price} (was ${product.origPrice}) | Surge ${product.surge}/100

Format:
**Sale Score (1-10)**
**Why Buy Now** (1 sentence)
**Bundle Idea** (1 sentence)
**Revenue Potential**
**Timing**`;

    let cancelled = false;
    const controller = new AbortController();
    callAI({
      messages: [{ role:"user", content:prompt }],
      max_tokens: 600,
      requireDeep: true,
      signal: controller.signal,
    })
      .then(d => {
        if (cancelled) return;
        setText(extractText(d));
        setLoading(false);
      })
      .catch(err => {
        if (cancelled || err.name === "AbortError") return;
        setText("⚠️ " + err.message + "\n\nPlease try again in a moment.");
        setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [product, type, callAI]);

  const fmt = t => t.split("\n").map((l, i) => {
    if (/^\d+\.\s+\*\*/.test(l) || l.startsWith("**"))
      return <div key={i} style={{ fontWeight:700, color:ac, marginTop:i>0?14:0, fontSize:13 }}>{l.replace(/\*\*/g,"")}</div>;
    if (!l.trim()) return <div key={i} style={{ height:4 }}/>;
    const parts = l.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i} style={{ color:"#bbb", fontSize:13, lineHeight:1.7 }}>
        {parts.map((s, j) => s.startsWith("**")
          ? <strong key={j} style={{ color:"#e0e0e0" }}>{s.replace(/\*\*/g,"")}</strong>
          : s)}
      </div>
    );
  });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)",
      backdropFilter:"blur(16px)", display:"flex", alignItems:"center",
      justifyContent:"center", padding:24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"linear-gradient(135deg,#0c0f1a,#131826)",
        border:`1px solid ${ac}44`, borderRadius:24, padding:32, maxWidth:640,
        width:"100%", maxHeight:"88vh", overflow:"auto",
        boxShadow:`0 32px 80px ${ac}18` }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:10, color:ac, fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>
              {type === "sale" ? "SALE OPPORTUNITY ANALYSIS" : "AI PRODUCT ANALYSIS"}
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:"#f0f0f0" }}>{product.name}</div>
          </div>
          <button onClick={onClose}
            style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"#888",
              width:36, height:36, borderRadius:10, cursor:"pointer", fontSize:18 }}>×</button>
        </div>

        <div style={{ display:"flex", gap:10, marginBottom:24, flexWrap:"wrap" }}>
          {[
            { l:"Trend",     v:product.trend,          c:"#00d4aa" },
            { l:"Surge",     v:`${product.surge}`,     c:ac        },
            { l:"Potential", v:`${product.potential}`, c:"#f59e0b" },
            { l:"Rating",    v:`${product.rating}★`,   c:"#ff9900" },
          ].map(s => (
            <div key={s.l} style={{ flex:1, minWidth:80,
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.07)", borderRadius:10,
              padding:"10px 14px", textAlign:"center" }}>
              <div style={{ fontSize:15, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:9, color:"#444", marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ width:44, height:44, borderRadius:"50%",
              border:`3px solid ${ac}22`, borderTop:`3px solid ${ac}`,
              animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
            <div style={{ color:"#555", fontSize:13 }}>Analyzing market data...</div>
          </div>
        ) : (
          <div style={{ lineHeight:1.8 }}>{fmt(text)}</div>
        )}
      </div>
    </div>
  );
}

// ─── PACKAGE ANALYSIS MODAL ───────────────────────────────────────────────────

function PackageAnalysisModal({ pkg, onClose }) {
  const [text, setText]       = useState("");
  const [loading, setLoading] = useState(true);
  const { callAI } = useAPI();
  const items = pkg.items.map(id => HOT_PRODUCTS.find(p => p.id === id)).filter(Boolean);

  useEffect(() => {
    if (!pkg) return;
    setLoading(true);
    setText("");

    const itemList = items.map(p => `${p.name} (${p.price})`).join(", ");
    const prompt =
`Be concise. Bundle analysis in <300 words:
${pkg.name} | Theme: ${pkg.theme} | Items: ${itemList} | Audience: ${pkg.targetAudience}

Format (1-2 sentences each):
**Market Opportunity**
**Buyer Persona**
**Best Platform**
**Pricing**
**Marketing Angle**
**90-Day Revenue**
**Risks**`;

    let cancelled = false;
    const controller = new AbortController();
    callAI({
      messages: [{ role:"user", content:prompt }],
      max_tokens: 600,
      requireDeep: true,
      signal: controller.signal,
    })
      .then(d => {
        if (cancelled) return;
        setText(extractText(d));
        setLoading(false);
      })
      .catch(err => {
        if (cancelled || err.name === "AbortError") return;
        setText("⚠️ " + err.message + "\n\nPlease try again.");
        setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [pkg, callAI]);

  const fmt = t => t.split("\n").map((l, i) => {
    if (/^\d+\.\s+\*\*/.test(l) || l.startsWith("**"))
      return <div key={i} style={{ fontWeight:700, color:"#f59e0b", marginTop:i>0?14:0, fontSize:13 }}>{l.replace(/\*\*/g,"")}</div>;
    if (!l.trim()) return <div key={i} style={{ height:4 }}/>;
    const parts = l.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i} style={{ color:"#bbb", fontSize:13, lineHeight:1.7 }}>
        {parts.map((s, j) => s.startsWith("**")
          ? <strong key={j} style={{ color:"#e0e0e0" }}>{s.replace(/\*\*/g,"")}</strong>
          : s)}
      </div>
    );
  });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)",
      backdropFilter:"blur(16px)", display:"flex", alignItems:"center",
      justifyContent:"center", padding:24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"linear-gradient(135deg,#0c0f1a,#131826)",
        border:"1px solid rgba(245,158,11,0.4)", borderRadius:24, padding:32,
        maxWidth:640, width:"100%", maxHeight:"88vh", overflow:"auto",
        boxShadow:"0 32px 80px rgba(245,158,11,0.12)" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:24 }}>
          <div>
            <div style={{ fontSize:10, color:"#f59e0b", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>
              BUNDLE DEEP ANALYSIS
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:"#f0f0f0" }}>{pkg.name}</div>
            <div style={{ fontSize:12, color:"#666", marginTop:2 }}>{pkg.theme} · {pkg.targetAudience}</div>
          </div>
          <button onClick={onClose}
            style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"#888",
              width:36, height:36, borderRadius:10, cursor:"pointer", fontSize:18 }}>×</button>
        </div>

        <div style={{ display:"flex", gap:8, marginBottom:20, flexWrap:"wrap" }}>
          {items.map(item => (
            <div key={item.id} style={{ flex:1, minWidth:120,
              background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.07)", borderRadius:10,
              padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:700, color:"#e0e0e0", marginBottom:2 }}>{item.name}</div>
              <div style={{ fontSize:13, fontWeight:800, color:"#f0f0f0" }}>{item.price}</div>
              <div style={{ fontSize:10, color:"#00d4aa", fontWeight:700 }}>{item.trend}</div>
            </div>
          ))}
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"40px 0" }}>
            <div style={{ width:44, height:44, borderRadius:"50%",
              border:"3px solid rgba(245,158,11,0.2)", borderTop:"3px solid #f59e0b",
              animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
            <div style={{ color:"#555", fontSize:13 }}>Building bundle strategy...</div>
          </div>
        ) : (
          <div style={{ lineHeight:1.8 }}>{fmt(text)}</div>
        )}
      </div>
    </div>
  );
}

// ─── PACKAGE CARD ─────────────────────────────────────────────────────────────

function PackageCard({ pkg, tier, onAnalyze }) {
  const items      = pkg.items.map(id => HOT_PRODUCTS.find(p => p.id === id)).filter(Boolean);
  const totalPrice = items.reduce((s, p) => s + parseFloat(p.price.replace("$","")), 0);
  const avgSurge     = Math.round(items.reduce((s, p) => s + p.surge,     0) / items.length);
  const avgPotential = Math.round(items.reduce((s, p) => s + p.potential, 0) / items.length);
  const [hov, setHov] = useState(false);

  return (
    <div onMouseEnter={() => setHov(true)} onMouseLeave={() => setHov(false)}
      style={{ background:hov?"rgba(255,255,255,0.05)":"rgba(255,255,255,0.02)",
        border:`1px solid ${hov?"rgba(245,158,11,0.4)":"rgba(255,255,255,0.07)"}`,
        borderRadius:18, padding:22, transition:"all 0.25s",
        boxShadow:hov?"0 8px 32px rgba(245,158,11,0.12)":"none",
        transform:hov?"translateY(-2px)":"none" }}>

      <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:14 }}>
        <div>
          <div style={{ fontSize:12, color:"#f59e0b", fontWeight:700, marginBottom:4 }}>{pkg.theme}</div>
          <div style={{ fontSize:17, fontWeight:800, color:"#f0f0f0", lineHeight:1.2 }}>{pkg.name}</div>
        </div>
        <div style={{ textAlign:"right" }}>
          <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>Bundle Est.</div>
          <div style={{ fontSize:20, fontWeight:900, color:"#f0f0f0" }}>${totalPrice.toFixed(0)}</div>
          <div style={{ fontSize:11, color:"#00d4aa", fontWeight:700 }}>Save {pkg.bundleSavings}</div>
        </div>
      </div>

      <div style={{ fontSize:12, color:"#888", lineHeight:1.7, marginBottom:14 }}>{pkg.description}</div>

      <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
        {items.map(item => (
          <div key={item.id} style={{ flex:1, minWidth:120,
            background:"rgba(255,255,255,0.04)",
            border:"1px solid rgba(255,255,255,0.07)", borderRadius:10, padding:"10px 12px" }}>
            <div style={{ fontSize:11, fontWeight:700, color:"#e0e0e0", marginBottom:4, lineHeight:1.3 }}>{item.name}</div>
            <div style={{ display:"flex", gap:8, alignItems:"center" }}>
              <span style={{ fontSize:13, fontWeight:800, color:"#f0f0f0" }}>{item.price}</span>
              <span style={{ fontSize:10, color:"#00d4aa", fontWeight:700 }}>{item.trend}</span>
            </div>
          </div>
        ))}
      </div>

      <div style={{ display:"flex", gap:16, alignItems:"center",
        borderTop:"1px solid rgba(255,255,255,0.05)", paddingTop:14 }}>
        <ScoreRing value={avgSurge}     color="#00d4aa" size={46} label="AVG SURGE"/>
        <ScoreRing value={avgPotential} color="#f59e0b" size={46} label="POTENTIAL"/>
        <div style={{ flex:1 }}>
          <div style={{ fontSize:10, color:"#555", marginBottom:2 }}>Target Audience</div>
          <div style={{ fontSize:11, color:"#aaa", fontWeight:600 }}>{pkg.targetAudience}</div>
          <div style={{ fontSize:12, color:"#f59e0b", fontWeight:800, marginTop:4 }}>Uplift: {pkg.potentialUplift}</div>
        </div>
        {tier === "pro" ? (
          <button onClick={() => onAnalyze(pkg)}
            style={{ background:"rgba(245,158,11,0.15)",
              border:"1px solid rgba(245,158,11,0.35)", color:"#f59e0b",
              borderRadius:10, padding:"8px 16px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
            Deep Analysis
          </button>
        ) : (
          <div style={{ fontSize:10, color:"#333" }}>🔒 Pro only</div>
        )}
      </div>
    </div>
  );
}

// ─── AMAZON SOURCING CARD ────────────────────────────────────────────────────

function AmazonSourcingCard({ product, scores, tier, platforms, onDeepAnalysis, savedIds, onSave, animDelay }) {
  const [expanded, setExpanded] = useState(false);
  const { riskScore, riskLevel, riskColor, packageScore, packageLevel, packageColor } = scores;
  const canDeepAnalyze = tier !== "free";
  const isSaved        = savedIds.has(product.id);

  // Build the best possible Amazon link: direct dp/ASIN page, else search URL
  // Always use search URL — AI-generated ASINs are estimates and may not resolve.
  // Search by name+ASIN hint reliably lands on the right product.
  const amazonSearchUrl = product.asin && !/^B0X+$/i.test(product.asin)
    ? `https://www.amazon.com/s?k=${encodeURIComponent(product.name + " " + product.asin)}`
    : `https://www.amazon.com/s?k=${encodeURIComponent(product.name)}`;

  const sourcing = product.sourcing || {};

  return (
    <div style={{
      background:"linear-gradient(145deg,rgba(255,153,0,0.06),rgba(255,255,255,0.015))",
      border:`1px solid ${expanded ? "rgba(255,153,0,0.45)" : "rgba(255,153,0,0.2)"}`,
      borderRadius:20, overflow:"hidden",
      transition:"all 0.3s", boxShadow:expanded ? "0 12px 44px rgba(255,153,0,0.1)" : "none",
      animation:`slideIn 0.4s ease ${animDelay||0}s both`,
    }}>

      {/* ── TOP STRIP: Name + price + source button ── */}
      <div style={{ padding:"18px 20px 0" }}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:12 }}>
          <div style={{ flex:1, paddingRight:14 }}>
            {product.asin && (
              <div style={{ fontSize:9, color:"#555", fontFamily:"monospace", marginBottom:4, letterSpacing:"0.04em" }}>
                ASIN: {product.asin}
              </div>
            )}
            <div style={{ fontSize:16, fontWeight:800, color:"#f0f0f0", lineHeight:1.3, marginBottom:3 }}>
              {product.name}
            </div>
            <div style={{ fontSize:10, color:"#555", marginBottom:6 }}>
              {product.category}{product.brand ? ` · ${product.brand}` : ""}
            </div>
            <div style={{ display:"flex", gap:4, flexWrap:"wrap" }}>
              {(product.platforms || ["Amazon"]).map(p =>
                <PlatBadge key={p} name={p} platforms={platforms}/>
              )}
            </div>
          </div>
          <div style={{ textAlign:"right", flexShrink:0 }}>
            <div style={{ fontSize:26, fontWeight:900, color:"#f0f0f0" }}>{product.price}</div>
            {product.origPrice && (
              <div style={{ fontSize:11, color:"#444", textDecoration:"line-through" }}>{product.origPrice}</div>
            )}
            <div style={{ fontSize:12, fontWeight:800,
              color: product.trend?.startsWith("+") ? "#00d4aa" : "#ff4444",
              background: product.trend?.startsWith("+") ? "rgba(0,212,170,0.1)" : "rgba(255,68,68,0.1)",
              padding:"2px 8px", borderRadius:6, marginTop:4, display:"inline-block" }}>
              {product.trend}
            </div>
          </div>
        </div>

        {/* ── SOURCE NOW BUTTON — the star of the show ── */}
        <a href={amazonSearchUrl} target="_blank" rel="noopener noreferrer"
          style={{ display:"flex", alignItems:"center", justifyContent:"center", gap:10,
            background:"linear-gradient(135deg,#ff9900,#e07000)",
            borderRadius:12, padding:"12px 0", marginBottom:14,
            textDecoration:"none", transition:"opacity 0.2s", cursor:"pointer" }}
          onMouseEnter={e => e.currentTarget.style.opacity="0.88"}
          onMouseLeave={e => e.currentTarget.style.opacity="1"}>
          <span style={{ fontSize:16 }}>📦</span>
          <span style={{ fontSize:13, fontWeight:900, color:"#000" }}>
            Source on Amazon{product.asin ? ` · ASIN ${product.asin}` : ""}
          </span>
          <span style={{ fontSize:11, color:"rgba(0,0,0,0.55)", fontWeight:700 }}>↗</span>
        </a>

        {/* ── SCORES ROW ── */}
        <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr 1fr", gap:8, marginBottom:14 }}>
          {[
            { label:"SURGE", val:product.surge, color:"#00d4aa", sub:"Velocity" },
            { label:"RISK",  val:riskScore,      color:riskColor,    sub:riskLevel  },
            { label:"PKG",   val:packageScore,   color:packageColor, sub:packageLevel },
          ].map(s => (
            <div key={s.label} style={{ background:`${s.color}09`, border:`1px solid ${s.color}20`,
              borderRadius:12, padding:"10px 6px", textAlign:"center" }}>
              <ScoreRing value={s.val} color={s.color} size={46}/>
              <div style={{ fontSize:9, fontWeight:800, color:s.color, marginTop:5, letterSpacing:"0.06em" }}>{s.label}</div>
              <div style={{ fontSize:8, color:"#444", marginTop:1 }}>{s.sub}</div>
            </div>
          ))}
        </div>

        {/* ── SOURCING INTEL ROW ── */}
        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:6, marginBottom:14 }}>
          {[
            { label:"30d Sales",    value:fmtK(product.sales30d) },
            { label:"Reviews",      value:fmtK(product.reviews)  },
            { label:"Rating",       value:`${product.rating}★`,   color:"#ff9900" },
            { label:"Sellers",      value:sourcing.sellerCount ? `${sourcing.sellerCount}+` : "N/A" },
          ].map(s => (
            <div key={s.label} style={{ background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.06)", borderRadius:9, padding:"7px 5px", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:800, color:s.color||"#e0e0e0" }}>{s.value}</div>
              <div style={{ fontSize:8, color:"#444", marginTop:1 }}>{s.label}</div>
            </div>
          ))}
        </div>

        {/* ── PROFIT STRIP ── */}
        {(sourcing.wholesaleEst || sourcing.fbaFee || sourcing.netMargin) && (
          <div style={{ display:"flex", gap:8, marginBottom:14, flexWrap:"wrap" }}>
            {sourcing.wholesaleEst && (
              <div style={{ flex:1, minWidth:90, background:"rgba(0,212,170,0.07)",
                border:"1px solid rgba(0,212,170,0.18)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#00d4aa" }}>{sourcing.wholesaleEst}</div>
                <div style={{ fontSize:8, color:"#444", marginTop:1 }}>Wholesale Est.</div>
              </div>
            )}
            {sourcing.fbaFee && (
              <div style={{ flex:1, minWidth:90, background:"rgba(245,158,11,0.07)",
                border:"1px solid rgba(245,158,11,0.18)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#f59e0b" }}>{sourcing.fbaFee}</div>
                <div style={{ fontSize:8, color:"#444", marginTop:1 }}>FBA Fee Est.</div>
              </div>
            )}
            {sourcing.netMargin && (
              <div style={{ flex:1, minWidth:90, background:"rgba(167,139,250,0.07)",
                border:"1px solid rgba(167,139,250,0.18)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#a78bfa" }}>{sourcing.netMargin}</div>
                <div style={{ fontSize:8, color:"#444", marginTop:1 }}>Net Margin Est.</div>
              </div>
            )}
            {sourcing.fulfillment && (
              <div style={{ flex:1, minWidth:90, background:"rgba(255,255,255,0.03)",
                border:"1px solid rgba(255,255,255,0.08)", borderRadius:9, padding:"8px 10px", textAlign:"center" }}>
                <div style={{ fontSize:11, fontWeight:800, color:"#e0e0e0" }}>{sourcing.fulfillment}</div>
                <div style={{ fontSize:8, color:"#444", marginTop:1 }}>Fulfillment</div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── EXPAND TOGGLE ── */}
      <button onClick={() => setExpanded(!expanded)}
        style={{ width:"100%", background:expanded?"rgba(255,153,0,0.06)":"rgba(255,255,255,0.02)",
          border:"none", borderTop:"1px solid rgba(255,255,255,0.05)",
          color:"#555", padding:"10px", fontSize:11, fontWeight:700,
          cursor:"pointer", letterSpacing:"0.06em" }}>
        {expanded ? "▲ HIDE DETAILS" : "▼ SHOW STRENGTHS · RISK · BUNDLE · DEEP ANALYSIS"}
      </button>

      {/* ── EXPANDED CONTENT ── */}
      {expanded && (
        <div style={{ padding:"16px 20px 20px" }}>

          {/* Description */}
          {product.description && (
            <div style={{ fontSize:12, color:"#888", lineHeight:1.7, marginBottom:14,
              padding:"10px 14px", background:"rgba(255,255,255,0.03)",
              border:"1px solid rgba(255,255,255,0.06)", borderRadius:10 }}>
              {product.description}
            </div>
          )}

          {/* Pros & Cons */}
          {(product.pros?.length > 0 || product.cons?.length > 0) && (
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:14 }}>
              {product.pros?.length > 0 && (
                <div style={{ background:"rgba(0,212,170,0.05)", border:"1px solid rgba(0,212,170,0.12)",
                  borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#00d4aa", marginBottom:6 }}>STRENGTHS</div>
                  {product.pros.slice(0,4).map((p,i) => (
                    <div key={i} style={{ fontSize:10, color:"#888", marginBottom:3, display:"flex", gap:6 }}>
                      <span style={{ color:"#00d4aa", flexShrink:0 }}>+</span>{p}
                    </div>
                  ))}
                </div>
              )}
              {product.cons?.length > 0 && (
                <div style={{ background:"rgba(255,68,68,0.05)", border:"1px solid rgba(255,68,68,0.12)",
                  borderRadius:10, padding:"10px 12px" }}>
                  <div style={{ fontSize:10, fontWeight:700, color:"#ff6666", marginBottom:6 }}>WATCH OUTS</div>
                  {product.cons.slice(0,4).map((c,i) => (
                    <div key={i} style={{ fontSize:10, color:"#888", marginBottom:3, display:"flex", gap:6 }}>
                      <span style={{ color:"#ff6666", flexShrink:0 }}>−</span>{c}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {/* Risk + Package explanations */}
          <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8, marginBottom:16 }}>
            <div style={{ background:`${riskColor}08`, border:`1px solid ${riskColor}20`,
              borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:riskColor, marginBottom:4 }}>
                {riskLevel === "Low" ? "✅" : riskLevel === "Medium" ? "⚠️" : "🔴"} {riskLevel} Risk · {riskScore}/100
              </div>
              <div style={{ fontSize:10, color:"#666", lineHeight:1.6 }}>
                Based on {fmtK(product.sales30d)} monthly sales &amp; {fmtK(product.reviews)} reviews.{" "}
                {riskLevel === "Low" ? "Stable, proven demand." :
                 riskLevel === "Medium" ? "Moderate volatility — monitor closely." :
                 "Emerging with higher uncertainty."}
              </div>
            </div>
            <div style={{ background:`${packageColor}08`, border:`1px solid ${packageColor}20`,
              borderRadius:10, padding:"10px 12px" }}>
              <div style={{ fontSize:10, fontWeight:700, color:packageColor, marginBottom:4 }}>
                {packageLevel === "Excellent" ? "🌟" : packageLevel === "Good" ? "✨" : "💡"} {packageLevel} Bundle · {packageScore}/100
              </div>
              <div style={{ fontSize:10, color:"#666", lineHeight:1.6 }}>
                {packageLevel === "Excellent" ? "Top bundling candidate — strong margin flexibility." :
                 packageLevel === "Good"      ? "Solid add-on or anchor for a bundle." :
                 "Works better standalone; limited bundle lift."}
              </div>
            </div>
          </div>

          {/* Sourcing notes */}
          {sourcing.moq && (
            <div style={{ marginBottom:14, padding:"10px 14px",
              background:"rgba(255,255,255,0.03)", border:"1px solid rgba(255,255,255,0.06)",
              borderRadius:10, display:"flex", alignItems:"center", gap:10 }}>
              <span style={{ fontSize:14 }}>📋</span>
              <div>
                <span style={{ fontSize:10, fontWeight:700, color:"#aaa" }}>Sourcing Note: </span>
                <span style={{ fontSize:10, color:"#666" }}>
                  Min. order qty ~{sourcing.moq} units.{" "}
                  {sourcing.leadTime ? `Lead time: ${sourcing.leadTime}.` : ""}
                  {" "}Check Alibaba or AliExpress for comparable wholesale listings.
                </span>
              </div>
            </div>
          )}

          {/* Supplier shortcut links */}
          <div style={{ display:"flex", gap:8, marginBottom:16, flexWrap:"wrap" }}>
            <div style={{ fontSize:10, color:"#555", fontWeight:700, alignSelf:"center" }}>Also source from:</div>
            {[
              { label:"Alibaba", url:`https://www.alibaba.com/trade/search?SearchText=${encodeURIComponent(product.name)}`, color:"#ff6200" },
              { label:"AliExpress", url:`https://www.aliexpress.com/wholesale?SearchText=${encodeURIComponent(product.name)}`, color:"#e62e04" },
              { label:"Walmart", url:`https://www.walmart.com/search?q=${encodeURIComponent(product.name)}`, color:"#0071ce" },
              { label:"eBay", url:`https://www.ebay.com/sch/i.html?_nkw=${encodeURIComponent(product.name)}`, color:"#e53238" },
            ].map(s => (
              <a key={s.label} href={s.url} target="_blank" rel="noopener noreferrer"
                style={{ fontSize:10, fontWeight:700, padding:"5px 12px", borderRadius:8,
                  background:`${s.color}18`, color:s.color,
                  border:`1px solid ${s.color}33`, textDecoration:"none",
                  transition:"opacity 0.2s", cursor:"pointer" }}
                onMouseEnter={e => e.currentTarget.style.opacity="0.7"}
                onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                {s.label} ↗
              </a>
            ))}
          </div>

          {/* Bottom action row */}
          <div style={{ display:"flex", gap:10 }}>
            {/* Save button */}
            <button onClick={() => onSave(product)}
              style={{ flex:"0 0 auto",
                background:isSaved ? "rgba(167,139,250,0.15)" : "rgba(255,255,255,0.04)",
                border:`1px solid ${isSaved ? "rgba(167,139,250,0.4)" : "rgba(255,255,255,0.1)"}`,
                color:isSaved ? "#a78bfa" : "#555",
                borderRadius:10, padding:"10px 16px", fontSize:11, fontWeight:700, cursor:"pointer" }}>
              {isSaved ? "✓ Saved" : "＋ Save"}
            </button>

            {/* Deep Analysis button */}
            {canDeepAnalyze ? (
              <button onClick={() => onDeepAnalysis(product, scores)}
                style={{ flex:1,
                  background:"linear-gradient(135deg,rgba(255,153,0,0.16),rgba(255,100,0,0.08))",
                  border:"1px solid rgba(255,153,0,0.38)", color:"#ff9900",
                  borderRadius:10, padding:"10px 0", fontSize:12, fontWeight:800, cursor:"pointer" }}>
                🧠 AI Deep Analysis — Risk + Bundle Strategy
              </button>
            ) : (
              <div style={{ flex:1, display:"flex", alignItems:"center", justifyContent:"center",
                gap:8, padding:"10px", background:"rgba(255,255,255,0.02)",
                border:"1px dashed rgba(255,255,255,0.07)", borderRadius:10 }}>
                <span>🔒</span>
                <span style={{ fontSize:10, color:"#444" }}>
                  AI Deep Analysis — <strong style={{ color:"#00d4aa" }}>Growth+</strong>
                </span>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── AMAZON LOOKUP TAB ────────────────────────────────────────────────────────

function AmazonLookupTab({ tier, platforms, onDeepAnalysis }) {
  const { callAI } = useAPI();
  const [query,    setQuery]    = useState("");
  const [mode,     setMode]     = useState("search"); // "search" | "asin"
  const [loading,  setLoading]  = useState(false);
  const [results,  setResults]  = useState(null);   // array of products
  const [summary,  setSummary]  = useState("");
  const [error,    setError]    = useState("");
  const [savedIds, setSavedIds] = useState(new Set());
  const [saved,    setSaved]    = useState([]);

  const handleSave = (product) => {
    setSavedIds(prev => {
      const next = new Set(prev);
      if (next.has(product.id)) {
        next.delete(product.id);
        setSaved(s => s.filter(p => p.id !== product.id));
      } else {
        next.add(product.id);
        setSaved(s => [...s, product]);
      }
      return next;
    });
  };

  const handleSearch = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setResults(null);
    setSummary("");
    setError("");

    const isAsin = mode === "asin" || /^B0[A-Z0-9]{8}$/i.test(query.trim());

    const asinClean = query.trim().toUpperCase();
    const prompt = isAsin
      ? `You are an Amazon product analyst with deep knowledge of Amazon listings.

ASIN: ${asinClean}

Using your training knowledge of Amazon products, provide realistic data for this ASIN.
Respond with ONLY a raw JSON array — no markdown, no backticks, no explanation:

[{"id":101,"name":"full product title","brand":"brand","asin":"${asinClean}","category":"Home","platforms":["Amazon"],"surge":72,"potential":78,"sales30d":35000,"reviews":14200,"rating":4.5,"price":"$29.99","origPrice":null,"onSale":false,"trend":"+84%","tags":["trending","amazon"],"description":"Two sentences on why this sells well and who buys it.","pros":["Clear strength 1","Clear strength 2","Clear strength 3"],"cons":["Watch out 1","Watch out 2"],"sourcing":{"wholesaleEst":"$8-$12","fbaFee":"$4.50","netMargin":"28-35%","sellerCount":45,"fulfillment":"FBA","moq":"50","leadTime":"3-5 weeks"}}]

Fill all fields with realistic estimates. Return ONLY the JSON array, nothing else.`

      : `You are an Amazon product research analyst. A seller is researching: "${query}"

Return the 4 best-selling Amazon products for this search using your training knowledge.
Respond with ONLY a raw JSON object — no markdown, no backticks, no explanation before or after:

{"summary":"One sentence on this category's Amazon opportunity.","products":[
{"id":101,"name":"Realistic product name matching the search","brand":"Brand","asin":"B0XXXXXXXXX","category":"category","platforms":["Amazon"],"surge":74,"potential":81,"sales30d":42000,"reviews":16800,"rating":4.6,"price":"$24.99","origPrice":null,"onSale":false,"trend":"+120%","tags":["tag1","tag2"],"description":"Two sentences on why this sells and who buys it.","pros":["Strength 1","Strength 2","Strength 3"],"cons":["Risk 1","Risk 2"],"sourcing":{"wholesaleEst":"$7-$11","fbaFee":"$3.80","netMargin":"30-38%","sellerCount":38,"fulfillment":"FBA","moq":"100","leadTime":"2-4 weeks"}}
]}

Include 4 distinct, realistic products. Use plausible ASINs starting with B0. Return ONLY the JSON object, nothing else.`;

    try {
      const d = await callAI({
        messages: [{ role:"user", content:prompt }],
        max_tokens: 2800,
      });
      const txt    = extractText(d);
      const parsed = extractJSON(txt);

      let products = [];
      let sumText  = "";
      if (Array.isArray(parsed)) {
        products = parsed;
      } else if (parsed.products) {
        products = parsed.products;
        sumText  = parsed.summary || "";
      } else {
        products = [parsed];
      }
      if (!products.length) throw new Error("No products returned — try a different search term");
      products = products.map((p, i) => ({ ...p, id: p.id || (200 + i) }));
      setResults(products);
      setSummary(sumText);
    } catch (err) {
      setError(err.message || "Could not retrieve data. Try a more specific product name or ASIN.");
    }
    setLoading(false);
  };

  return (
    <div>
      {/* ── HEADER ── */}
      <div style={{ marginBottom:20 }}>
        <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
          <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
            🔍 Amazon <span style={{ color:"#ff9900" }}>Source &amp; Score</span>
          </div>
          <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20,
            background:"rgba(0,212,170,0.12)", color:"#00d4aa",
            border:"1px solid rgba(0,212,170,0.25)" }}>ALL TIERS</span>
        </div>
        <div style={{ fontSize:11, color:"#444" }}>
          Search any keyword or paste an ASIN — get live scores, sourcing intel &amp; a direct Amazon link
        </div>
      </div>

      {/* ── SEARCH BAR + MODE TOGGLE ── */}
      <div style={{ marginBottom:12 }}>
        <div style={{ display:"flex", gap:4, marginBottom:10 }}>
          {[
            { id:"search", label:"🔍 Keyword Search" },
            { id:"asin",   label:"🔑 ASIN Lookup" },
          ].map(m => (
            <button key={m.id} onClick={() => setMode(m.id)}
              style={{ background:mode===m.id?"rgba(255,153,0,0.14)":"rgba(255,255,255,0.03)",
                border:`1px solid ${mode===m.id?"rgba(255,153,0,0.4)":"rgba(255,255,255,0.07)"}`,
                color:mode===m.id?"#ff9900":"#444",
                borderRadius:9, padding:"6px 14px", fontSize:11, fontWeight:700, cursor:"pointer",
                transition:"all 0.2s" }}>
              {m.label}
            </button>
          ))}
        </div>
        <div style={{ display:"flex", gap:10 }}>
          <input
            value={query}
            onChange={e => setQuery(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSearch()}
            placeholder={mode==="asin"
              ? "Paste Amazon ASIN — e.g. B09G9FPHY6"
              : 'Search any product — e.g. "silicone molds", "posture corrector", "mini projector"'}
            style={{ flex:1, background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,153,0,0.3)", borderRadius:11,
              padding:"12px 16px", color:"#e0e0e0", fontSize:14, fontFamily:"inherit" }}
          />
          <button onClick={handleSearch} disabled={loading}
            style={{ background:"linear-gradient(135deg,#ff9900,#e07000)", border:"none",
              color:"#000", borderRadius:11, padding:"12px 26px", fontSize:13, fontWeight:900,
              cursor:loading ? "wait" : "pointer", opacity:loading ? 0.7 : 1, whiteSpace:"nowrap",
              boxShadow:loading?"none":"0 4px 16px rgba(255,153,0,0.3)" }}>
            {loading ? "Scanning..." : mode==="asin" ? "Look Up ASIN" : "Search Amazon"}
          </button>
        </div>
      </div>

      {/* ── FREE TIER NOTE ── */}
      {tier === "free" && (
        <div style={{ marginBottom:14, padding:"9px 14px",
          background:"rgba(148,163,184,0.05)", border:"1px solid rgba(148,163,184,0.13)",
          borderRadius:9, fontSize:11, color:"#555",
          display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
          <span>Full risk &amp; package scores on any product. <strong style={{ color:"#00d4aa" }}>Growth+</strong> unlocks AI deep analysis.</span>
        </div>
      )}

      {/* ── SAVED PRODUCTS STRIP ── */}
      {saved.length > 0 && (
        <div style={{ marginBottom:18, padding:"12px 16px",
          background:"rgba(167,139,250,0.07)", border:"1px solid rgba(167,139,250,0.2)",
          borderRadius:12 }}>
          <div style={{ fontSize:10, fontWeight:800, color:"#a78bfa", letterSpacing:"0.08em", marginBottom:10 }}>
            ✓ SAVED PRODUCTS ({saved.length})
          </div>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {saved.map(p => {
              const url = p.asin && !/^B0X+$/i.test(p.asin)
                ? `https://www.amazon.com/s?k=${encodeURIComponent(p.name + " " + p.asin)}`
                : `https://www.amazon.com/s?k=${encodeURIComponent(p.name)}`;
              return (
                <a key={p.id} href={url} target="_blank" rel="noopener noreferrer"
                  style={{ display:"flex", alignItems:"center", gap:7,
                    background:"rgba(255,255,255,0.04)", border:"1px solid rgba(167,139,250,0.2)",
                    borderRadius:9, padding:"6px 12px", textDecoration:"none", cursor:"pointer",
                    transition:"opacity 0.2s" }}
                  onMouseEnter={e => e.currentTarget.style.opacity="0.75"}
                  onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                  <span style={{ fontSize:11, fontWeight:700, color:"#e0e0e0" }}>{p.name}</span>
                  <span style={{ fontSize:10, color:"#ff9900", fontWeight:700 }}>{p.price}</span>
                  <span style={{ fontSize:9, color:"#555" }}>↗</span>
                </a>
              );
            })}
          </div>
        </div>
      )}

      {/* ── LOADING ── */}
      {loading && (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ width:54, height:54, borderRadius:"50%",
            border:"3px solid rgba(255,153,0,0.1)", borderTop:"3px solid #ff9900",
            animation:"spin 0.8s linear infinite", margin:"0 auto 18px" }}/>
          <div style={{ color:"#555", fontSize:13, marginBottom:4 }}>
            {mode==="asin" ? "Fetching ASIN listing..." : "Scanning Amazon..."}
          </div>
          <div style={{ color:"#333", fontSize:11 }}>Sales · reviews · sourcing intel · trend signals</div>
        </div>
      )}

      {/* ── ERROR ── */}
      {error && !loading && (
        <div style={{ padding:"14px 18px", background:"rgba(255,68,68,0.06)",
          border:"1px solid rgba(255,68,68,0.16)", borderRadius:12, color:"#ff8888", fontSize:12 }}>
          {error}
        </div>
      )}

      {/* ── SUMMARY ── */}
      {summary && !loading && (
        <div style={{ marginBottom:16, padding:"10px 16px",
          background:"rgba(255,153,0,0.06)", border:"1px solid rgba(255,153,0,0.18)",
          borderRadius:9, fontSize:12, color:"#aaa" }}>
          <span style={{ color:"#ff9900", fontWeight:700 }}>Market Snapshot: </span>{summary}
        </div>
      )}

      {/* ── RESULTS GRID ── */}
      {results && !loading && (
        <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,460px),1fr))", gap:16 }}>
          {results.map((p, i) => (
            <AmazonSourcingCard
              key={p.id}
              product={p}
              scores={computeProductScores(p)}
              tier={tier}
              platforms={platforms}
              onDeepAnalysis={onDeepAnalysis}
              savedIds={savedIds}
              onSave={handleSave}
              animDelay={i * 0.07}
            />
          ))}
        </div>
      )}

      {/* ── EMPTY STATE ── */}
      {!results && !loading && !error && (
        <div style={{ textAlign:"center", padding:"60px 0" }}>
          <div style={{ fontSize:48, marginBottom:16 }}>📦</div>
          <div style={{ fontSize:15, color:"#333", marginBottom:8, fontWeight:700 }}>
            Source any product from Amazon
          </div>
          <div style={{ fontSize:11, color:"#2a2d3a", maxWidth:400, margin:"0 auto", lineHeight:1.8 }}>
            Search by keyword to find top listings, or paste an ASIN for an exact product lookup.
            Every result gets a direct <span style={{ color:"#ff9900" }}>Source on Amazon</span> link,
            wholesale estimates, FBA fee, margin, risk score &amp; bundle score.
          </div>
          <div style={{ marginTop:24, display:"flex", gap:8, justifyContent:"center", flexWrap:"wrap" }}>
            {["silicone molds","posture corrector","mini projector","resistance bands","led light strips"].map(s => (
              <button key={s} onClick={() => { setQuery(s); setMode("search"); }}
                style={{ background:"rgba(255,153,0,0.08)", border:"1px solid rgba(255,153,0,0.2)",
                  color:"#ff9900", borderRadius:20, padding:"5px 14px", fontSize:11,
                  fontWeight:600, cursor:"pointer" }}>
                {s}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── RISK/PACKAGE DEEP ANALYSIS MODAL ────────────────────────────────────────

function RiskPackageModal({ product, scores, onClose }) {
  const [text,    setText]    = useState("");
  const [loading, setLoading] = useState(true);
  const { callAI } = useAPI();
  const { riskScore, riskLevel, riskColor, packageScore, packageLevel, packageColor } = scores;

  useEffect(() => {
    if (!product) return;
    setLoading(true);
    setText("");

    const prompt =
`Be concise. FBA seller analysis in <400 words:
${product.name} | ${product.price} | ${(product.sales30d || 0).toLocaleString()} units/30d | ${product.rating}★
Risk ${riskScore}/100 (${riskLevel}) | Bundle ${packageScore}/100 (${packageLevel})

Format (2 sentences each):
**Risk Breakdown**
**Competition**
**Sales Velocity**
**3 Bundle Picks** (list only)
**Bundle Price Point**
**30-Day Action Plan** (5 bullets)
**Verdict** (Buy/Build/Hold/Pass + 1 reason)`;

    let cancelled = false;
    const controller = new AbortController();
    callAI({
      messages: [{ role:"user", content:prompt }],
      max_tokens: 700,
      requireDeep: true,
      signal: controller.signal,
    })
      .then(d => {
        if (cancelled) return;
        setText(extractText(d));
        setLoading(false);
      })
      .catch(err => {
        if (cancelled || err.name === "AbortError") return;
        setText("⚠️ " + err.message + "\n\nPlease try again.");
        setLoading(false);
      });
    return () => { cancelled = true; controller.abort(); };
  }, [product, callAI]);

  const fmt = t => t.split("\n").map((l, i) => {
    if (/^\d+\.\s+\*\*/.test(l) || l.startsWith("**"))
      return <div key={i} style={{ fontWeight:700, color:"#ff9900", marginTop:i>0?16:0, fontSize:13 }}>{l.replace(/\*\*/g,"")}</div>;
    if (!l.trim()) return <div key={i} style={{ height:4 }}/>;
    const parts = l.split(/(\*\*[^*]+\*\*)/g);
    return (
      <div key={i} style={{ color:"#bbb", fontSize:13, lineHeight:1.75 }}>
        {parts.map((s, j) => s.startsWith("**")
          ? <strong key={j} style={{ color:"#e0e0e0" }}>{s.replace(/\*\*/g,"")}</strong>
          : s)}
      </div>
    );
  });

  return (
    <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)",
      backdropFilter:"blur(16px)", display:"flex", alignItems:"center",
      justifyContent:"center", padding:24 }}
      onClick={e => e.target === e.currentTarget && onClose()}>
      <div style={{ background:"linear-gradient(135deg,#0c0f1a,#131826)",
        border:"1px solid rgba(255,153,0,0.3)", borderRadius:24, padding:32,
        maxWidth:660, width:"100%", maxHeight:"88vh", overflow:"auto",
        boxShadow:"0 32px 80px rgba(255,153,0,0.14)" }}>

        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:20 }}>
          <div>
            <div style={{ fontSize:10, color:"#ff9900", fontWeight:700, letterSpacing:"0.1em", marginBottom:4 }}>
              🧠 RISK &amp; PACKAGE DEEP ANALYSIS
            </div>
            <div style={{ fontSize:17, fontWeight:800, color:"#f0f0f0" }}>{product.name}</div>
            <div style={{ fontSize:11, color:"#555", marginTop:2 }}>{product.category} · {product.price}</div>
          </div>
          <button onClick={onClose}
            style={{ background:"rgba(255,255,255,0.08)", border:"none", color:"#888",
              width:36, height:36, borderRadius:10, cursor:"pointer", fontSize:18 }}>×</button>
        </div>

        <div style={{ display:"grid", gridTemplateColumns:"repeat(4,1fr)", gap:8, marginBottom:20 }}>
          {[
            { l:"Surge",    v:`${product.surge}`,               c:"#00d4aa"    },
            { l:"Potential",v:`${product.potential}`,            c:"#a78bfa"    },
            { l:"Risk",     v:`${riskScore} · ${riskLevel}`,     c:riskColor    },
            { l:"Package",  v:`${packageScore} · ${packageLevel}`,c:packageColor },
          ].map(s => (
            <div key={s.l} style={{ background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.07)", borderRadius:10,
              padding:"10px 12px", textAlign:"center" }}>
              <div style={{ fontSize:11, fontWeight:800, color:s.c }}>{s.v}</div>
              <div style={{ fontSize:9, color:"#444", marginTop:2 }}>{s.l}</div>
            </div>
          ))}
        </div>

        {/* Sales signal bar */}
        <div style={{ marginBottom:20, padding:"10px 14px",
          background:"rgba(255,153,0,0.06)", border:"1px solid rgba(255,153,0,0.15)",
          borderRadius:10, display:"flex", gap:16, flexWrap:"wrap" }}>
          <div>
            <span style={{ fontSize:10, color:"#555" }}>30d Sales: </span>
            <strong style={{ fontSize:12, color:"#ff9900" }}>{fmtK(product.sales30d)} units</strong>
          </div>
          <div>
            <span style={{ fontSize:10, color:"#555" }}>Reviews: </span>
            <strong style={{ fontSize:12, color:"#ff9900" }}>{fmtK(product.reviews)}</strong>
          </div>
          <div>
            <span style={{ fontSize:10, color:"#555" }}>Rating: </span>
            <strong style={{ fontSize:12, color:"#ff9900" }}>{product.rating}★</strong>
          </div>
        </div>

        {loading ? (
          <div style={{ textAlign:"center", padding:"44px 0" }}>
            <div style={{ width:48, height:48, borderRadius:"50%",
              border:"3px solid rgba(255,153,0,0.12)", borderTop:"3px solid #ff9900",
              animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
            <div style={{ color:"#555", fontSize:13 }}>Running risk &amp; bundle analysis...</div>
            <div style={{ color:"#333", fontSize:11, marginTop:4 }}>Analyzing sales velocity &amp; market signals</div>
          </div>
        ) : (
          <div style={{ lineHeight:1.8 }}>{fmt(text)}</div>
        )}
      </div>
    </div>
  );
}

// ─── LIVE TRACKER ─────────────────────────────────────────────────────────────

function LiveTracker() {
  const [users, setUsers]     = useState(() => rand(142, 180));
  const [history, setHistory] = useState(() =>
    Array.from({ length:20 }, (_, i) => ({ t:i, v:rand(120, 170) }))
  );
  const [events, setEvents] = useState([
    { id:1, msg:"User in Austin, TX upgraded to Pro",   time:"just now", type:"upgrade" },
    { id:2, msg:"New signup from Chicago, IL",          time:"12s ago",  type:"signup"  },
    { id:3, msg:"User exported report: 'Pet Niche Q2'", time:"34s ago",  type:"action"  },
    { id:4, msg:"AI Search: 'summer beauty'",           time:"1m ago",   type:"search"  },
    { id:5, msg:"New signup from London, UK",           time:"1m ago",   type:"signup"  },
  ]);

  const todayStats = useRef({
    signups:     rand(24, 31),
    proUpgrades: rand(6, 12),
    aiSearches:  rand(180, 240),
  });

  const tickRef = useRef(0);

  useEffect(() => {
    const iv = setInterval(() => {
      const delta = rand(-4, 6);
      setUsers(u => Math.max(80, u + delta));
      tickRef.current++;
      setHistory(h => [
        ...h.slice(1),
        { t:h[h.length-1].t + 1, v:Math.max(80, h[h.length-1].v + delta) },
      ]);
      if (tickRef.current % 8 === 0) {
        const msgs = [
          "New signup from Seattle, WA",   "User upgraded to Growth",
          "AI Search: 'trending home decor'", "User in Toronto upgraded to Pro",
          "Report exported: 'Beauty Top 10'", "New signup from Sydney, AU",
        ];
        setEvents(ev => [
          { id:Date.now(), msg:msgs[rand(0, msgs.length-1)], time:"just now",
            type:["signup","upgrade","action","search"][rand(0,3)] },
          ...ev.slice(0, 7),
        ]);
      }
    }, 2000);
    return () => clearInterval(iv);
  }, []);

  const maxV = Math.max(...history.map(h => h.v));
  const minV = Math.min(...history.map(h => h.v));
  const W = 320, H = 80;
  const pts = history
    .map((h, i) => `${(i/(history.length-1))*W},${H - ((h.v-minV)/(maxV-minV||1))*(H-10) - 5}`)
    .join(" ");

  const typeColors = { signup:"#00d4aa", upgrade:"#f59e0b", action:"#a78bfa", search:"#1877f2" };

  return (
    <div>
      <div style={{ display:"flex", gap:16, marginBottom:24, flexWrap:"wrap" }}>
        {[
          { label:"Live Users",      value:users,                          sub:"right now",  color:"#00d4aa", icon:"🟢" },
          { label:"Today's Signups", value:todayStats.current.signups,     sub:"last 24hrs", color:"#a78bfa", icon:"📈" },
          { label:"Pro Upgrades",    value:todayStats.current.proUpgrades, sub:"today",      color:"#f59e0b", icon:"⭐" },
          { label:"AI Searches",     value:todayStats.current.aiSearches,  sub:"today",      color:"#1877f2", icon:"🔍" },
        ].map(s => (
          <div key={s.label} style={{ flex:1, minWidth:140,
            background:"rgba(255,255,255,0.03)",
            border:`1px solid ${s.color}33`, borderRadius:14, padding:"18px 20px" }}>
            <div style={{ fontSize:24, marginBottom:4 }}>{s.icon}</div>
            <div style={{ fontSize:28, fontWeight:900, color:s.color }}>{s.value}</div>
            <div style={{ fontSize:12, fontWeight:700, color:"#e0e0e0", marginBottom:2 }}>{s.label}</div>
            <div style={{ fontSize:10, color:"#444" }}>{s.sub}</div>
          </div>
        ))}
      </div>

      <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:16 }}>
        <div style={{ background:"rgba(255,255,255,0.02)",
          border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:20 }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#888", marginBottom:12, letterSpacing:"0.08em" }}>
            ACTIVE USERS (LIVE)
          </div>
          <svg width="100%" viewBox={`0 0 ${W} ${H}`} style={{ overflow:"visible" }}>
            <defs>
              <linearGradient id="ug" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%"   stopColor="#00d4aa" stopOpacity="0.3"/>
                <stop offset="100%" stopColor="#00d4aa" stopOpacity="0"/>
              </linearGradient>
            </defs>
            <polygon points={`0,${H} ${pts} ${W},${H}`} fill="url(#ug)"/>
            <polyline points={pts} fill="none" stroke="#00d4aa" strokeWidth={2}/>
            <circle
              cx={W}
              cy={H - ((history[history.length-1].v - minV) / (maxV - minV || 1)) * (H-10) - 5}
              r={4} fill="#00d4aa"/>
          </svg>
          <div style={{ display:"flex", justifyContent:"space-between", marginTop:8 }}>
            <span style={{ fontSize:10, color:"#333" }}>20 ticks ago</span>
            <span style={{ fontSize:13, fontWeight:800, color:"#00d4aa" }}>{users} now</span>
          </div>
        </div>

        <div style={{ background:"rgba(255,255,255,0.02)",
          border:"1px solid rgba(255,255,255,0.07)", borderRadius:14,
          padding:20, overflow:"hidden" }}>
          <div style={{ fontSize:12, fontWeight:700, color:"#888", marginBottom:12, letterSpacing:"0.08em" }}>
            LIVE EVENTS
          </div>
          <div style={{ display:"flex", flexDirection:"column", gap:8, maxHeight:120, overflowY:"auto" }}>
            {events.map(ev => (
              <div key={ev.id} style={{ display:"flex", gap:10, alignItems:"flex-start" }}>
                <div style={{ width:6, height:6, borderRadius:"50%",
                  background:typeColors[ev.type], marginTop:5, flexShrink:0 }}/>
                <div>
                  <div style={{ fontSize:11, color:"#bbb" }}>{ev.msg}</div>
                  <div style={{ fontSize:9, color:"#444" }}>{ev.time}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

// ─── SITE MANAGER ─────────────────────────────────────────────────────────────

function SiteManager({ platforms, setPlatforms, tier }) {
  const [newName,  setNewName]  = useState("");
  const [newUrl,   setNewUrl]   = useState("");
  const [newColor, setNewColor] = useState("#6366f1");

  const customCount = platforms.filter(p =>
    !DEFAULT_PLATFORMS.find(d => d.id === p.id)
  ).length;

  const canAdd = tier === "pro" || (tier === "growth" && customCount < 2);

  const addSite = () => {
    if (!newName.trim()) return;
    const id = newName.toLowerCase().replace(/\s+/g, "-");
    setPlatforms(prev => [...prev, {
      id, name:newName.trim(), color:newColor, icon:"🌐", active:true, custom:true, url:newUrl,
    }]);
    setNewName(""); setNewUrl(""); setNewColor("#6366f1");
  };

  return (
    <div>
      <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(200px,1fr))",
        gap:12, marginBottom:24 }}>
        {platforms.map(p => (
          <div key={p.id} style={{ background:"rgba(255,255,255,0.03)",
            border:`1px solid ${p.active ? p.color+"44" : "rgba(255,255,255,0.06)"}`,
            borderRadius:12, padding:"14px 16px",
            display:"flex", justifyContent:"space-between", alignItems:"center" }}>
            <div style={{ display:"flex", gap:10, alignItems:"center" }}>
              <span style={{ fontSize:20 }}>{p.icon}</span>
              <div>
                <div style={{ fontSize:13, fontWeight:700, color:p.active?"#e0e0e0":"#555" }}>{p.name}</div>
                {p.custom && <div style={{ fontSize:9, color:"#444" }}>custom</div>}
              </div>
            </div>
            <div style={{ display:"flex", flexDirection:"column", gap:4, alignItems:"flex-end" }}>
              <button
                onClick={() => setPlatforms(prev =>
                  prev.map(x => x.id===p.id ? {...x,active:!x.active} : x)
                )}
                style={{ background:p.active?p.color+"22":"rgba(255,255,255,0.04)",
                  border:`1px solid ${p.active?p.color+"44":"rgba(255,255,255,0.08)"}`,
                  color:p.active?p.color:"#555", borderRadius:6, padding:"3px 10px",
                  fontSize:10, fontWeight:700, cursor:"pointer" }}>
                {p.active ? "Active" : "Off"}
              </button>
              {p.custom && (
                <button
                  onClick={() => setPlatforms(prev => prev.filter(x => x.id !== p.id))}
                  style={{ background:"rgba(255,68,68,0.1)",
                    border:"1px solid rgba(255,68,68,0.2)", color:"#ff4444",
                    borderRadius:6, padding:"3px 10px", fontSize:10, fontWeight:700, cursor:"pointer" }}>
                  Remove
                </button>
              )}
            </div>
          </div>
        ))}
      </div>

      <div style={{ background:"rgba(255,255,255,0.02)",
        border:"1px solid rgba(255,255,255,0.07)", borderRadius:14, padding:20 }}>
        <div style={{ fontSize:13, fontWeight:700, color:"#888", marginBottom:14 }}>
          ADD CUSTOM SITE
          {!canAdd && <span style={{ color:"#ff4444", fontSize:10 }}> — Upgrade needed</span>}
        </div>
        <div style={{ display:"flex", gap:10, flexWrap:"wrap" }}>
          <input value={newName} onChange={e => setNewName(e.target.value)}
            placeholder="Site name" disabled={!canAdd}
            style={{ flex:1, minWidth:130, background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:10,
              padding:"10px 14px", color:"#e0e0e0", fontSize:13, fontFamily:"inherit",
              opacity:canAdd?1:0.4 }}/>
          <input value={newUrl} onChange={e => setNewUrl(e.target.value)}
            placeholder="URL (optional)" disabled={!canAdd}
            style={{ flex:2, minWidth:160, background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.1)", borderRadius:10,
              padding:"10px 14px", color:"#e0e0e0", fontSize:13, fontFamily:"inherit",
              opacity:canAdd?1:0.4 }}/>
          <div style={{ display:"flex", gap:8, alignItems:"center" }}>
            <input type="color" value={newColor} onChange={e => setNewColor(e.target.value)}
              disabled={!canAdd}
              style={{ width:38, height:38, borderRadius:8,
                border:"1px solid rgba(255,255,255,0.1)", background:"none",
                cursor:canAdd?"pointer":"not-allowed", opacity:canAdd?1:0.4 }}/>
            <button onClick={addSite} disabled={!canAdd || !newName.trim()}
              style={{ background:canAdd&&newName
                ? "linear-gradient(135deg,#00d4aa,#00b894)"
                : "rgba(255,255,255,0.05)",
                border:"none", color:canAdd&&newName?"#000":"#444",
                borderRadius:10, padding:"10px 20px", fontSize:13, fontWeight:700,
                cursor:canAdd&&newName?"pointer":"not-allowed" }}>
              + Add
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}



// ─── TRENDING PRODUCTS SECTION — 24h / 7d / 30d AI-researched ─────────────────
// Three sub-tabs, each fetches AI-researched trending Amazon products.
// Products never repeat across tabs. Falls back to HOT_PRODUCTS if AI fails.

function TrendingProductsSection({ tier, accentColor, platforms, onAnalyze }) {
  const { fetchDeals } = useAPI();
  const [activeRange, setActiveRange] = useState("7d");
  const [cache, setCache]             = useState({});
  const [loading, setLoading]         = useState({});
  const [errors, setErrors]           = useState({});
  const [lastUpdated, setLastUpdated] = useState({});
  const [currentPage, setCurrentPage] = useState({ "24h": 1, "7d": 1, "30d": 1 });

  const targetCount = tier === "free" ? 10 : 50;
  const perPage = 10;

  const ranges = [
    { id: "24h", label: "⚡ LIGHTNING", description: "Time-limited lightning deals under $25" },
    { id: "7d",  label: "🏷️ BEST DEALS", description: "Today's stable bargains under $25" },
    { id: "30d", label: "💰 DEEP DISCOUNTS", description: "25%+ off customer favorites under $25" },
  ];

  // Fetch arbitrage deals from Rainforest (cached 2 hours on backend)
  const fetchRange = useCallback(async (rangeId, force = false) => {
    if (!force && cache[rangeId]?.length > 0) return;
    setLoading(l => ({ ...l, [rangeId]: true }));
    setErrors(e => ({ ...e, [rangeId]: null }));

    try {
      const { products } = await fetchDeals(rangeId);
      if (!products || products.length === 0) throw new Error("No deals returned");
      const capped = products.slice(0, targetCount);
      setCache(c => ({ ...c, [rangeId]: capped }));
      setLastUpdated(u => ({ ...u, [rangeId]: Date.now() }));
    } catch (err) {
      console.error(`Fetch ${rangeId} failed:`, err);
      setErrors(e => ({ ...e, [rangeId]: err.message }));
      const fallback = HOT_PRODUCTS
        .slice(rangeId === "24h" ? 0 : rangeId === "7d" ? 7 : 14,
               rangeId === "24h" ? 7 : rangeId === "7d" ? 14 : 21)
        .map((p, i) => ({ ...p, id: `${rangeId}-fb-${i}` }));
      setCache(c => ({ ...c, [rangeId]: fallback }));
    } finally {
      setLoading(l => ({ ...l, [rangeId]: false }));
    }
  }, [cache, fetchDeals, targetCount]);

  useEffect(() => {
    if (!cache[activeRange]) fetchRange(activeRange);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeRange]);

  const rangeData    = cache[activeRange] || [];
  const isLoading    = !!loading[activeRange];
  const hasFallback  = !!errors[activeRange] && rangeData.length > 0;

  const page         = currentPage[activeRange] || 1;
  const totalPages   = Math.max(1, Math.ceil(rangeData.length / perPage));
  const pagedItems   = rangeData.slice((page - 1) * perPage, page * perPage);

  const formatTime = (ts) => {
    if (!ts) return "";
    const mins = Math.floor((Date.now() - ts) / 60000);
    if (mins < 1) return "just now";
    if (mins < 60) return `${mins}m ago`;
    const hrs = Math.floor(mins / 60);
    if (hrs < 24) return `${hrs}h ago`;
    return `${Math.floor(hrs / 24)}d ago`;
  };

  const setPage = (p) => setCurrentPage(cp => ({ ...cp, [activeRange]: p }));

  return (
    <div style={{ marginTop:24 }}>
      {/* Section header */}
      <div style={{ marginBottom:14 }}>
        <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:16, color:"#f0f0f0" }}>
          💰 <span style={{ color:accentColor }}>Arbitrage Deals</span> · Under $25
        </div>
        <div style={{ fontSize:10, color:"#444", marginTop:2 }}>
          Real Amazon deals filtered for quick-flip margins
        </div>
      </div>

      {/* Range sub-tabs */}
      <div style={{ display:"flex", gap:6, marginBottom:10, flexWrap:"wrap",
        borderBottom:"1px solid rgba(255,255,255,0.05)", paddingBottom:2 }}>
        {ranges.map(r => (
          <button key={r.id} onClick={() => setActiveRange(r.id)}
            style={{
              background: activeRange === r.id
                ? `linear-gradient(135deg,${accentColor}22,${accentColor}11)`
                : "transparent",
              border: "none",
              borderBottom: `2px solid ${activeRange === r.id ? accentColor : "transparent"}`,
              color: activeRange === r.id ? accentColor : "#555",
              padding: "8px 14px", fontSize: 11, fontWeight: 800,
              letterSpacing: "0.05em", cursor: "pointer",
              transition: "all 0.2s", marginBottom: -1,
              display: "flex", alignItems: "center", gap: 6,
            }}>
            {r.label}
            {loading[r.id] && (
              <span style={{ width: 8, height: 8, borderRadius: "50%",
                border: `1.5px solid ${accentColor}66`,
                borderTopColor: accentColor,
                animation: "spin 0.7s linear infinite", display: "inline-block" }}/>
            )}
            {cache[r.id] && !loading[r.id] && (
              <span style={{ fontSize: 9, color: "#333", fontWeight: 600 }}>
                ({cache[r.id].length})
              </span>
            )}
          </button>
        ))}
        <div style={{ flex: 1 }}/>
        <div style={{ fontSize: 10, color: "#333", alignSelf: "center", fontStyle: "italic" }}>
          {lastUpdated[activeRange] ? `updated ${formatTime(lastUpdated[activeRange])}` : ""}
        </div>
      </div>

      {/* Description + progress */}
      <div style={{ marginBottom: 12, fontSize: 11, color: "#444", fontStyle: "italic",
        display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:8 }}>
        <span>
          {ranges.find(r => r.id === activeRange)?.description}
          {hasFallback && (
            <span style={{ marginLeft: 8, color: "#ff9900", fontStyle: "normal", fontSize: 10 }}>
              · showing cached picks
            </span>
          )}
        </span>
        {isLoading && (
          <span style={{ color: accentColor, fontSize: 10, fontStyle: "normal",
            fontWeight: 700, letterSpacing: "0.05em" }}>
            HUNTING DEALS… (~5s)
          </span>
        )}
      </div>

      {/* Loading skeletons — show when we have NO data yet */}
      {isLoading && rangeData.length === 0 && (
        <div style={{ display:"grid",
          gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))", gap:14 }}>
          {Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{
              background: "rgba(255,255,255,0.02)",
              border: "1px solid rgba(255,255,255,0.04)",
              borderRadius: 16, padding: "18px 20px", minHeight: 180,
              animation: `pulse 1.6s ease-in-out ${i * 0.1}s infinite`,
            }}>
              <div style={{ height:12, background:"rgba(255,255,255,0.06)",
                borderRadius:4, marginBottom:10, width:"70%" }}/>
              <div style={{ height:9, background:"rgba(255,255,255,0.04)",
                borderRadius:4, marginBottom:20, width:"40%" }}/>
              <div style={{ display:"flex", gap:8, marginBottom:14 }}>
                {[0,1,2].map(j => (
                  <div key={j} style={{ width:40, height:40, borderRadius:"50%",
                    background:"rgba(255,255,255,0.04)" }}/>
                ))}
              </div>
              <div style={{ height:8, background:"rgba(255,255,255,0.03)",
                borderRadius:4, width:"90%", marginBottom:6 }}/>
              <div style={{ height:8, background:"rgba(255,255,255,0.03)",
                borderRadius:4, width:"60%" }}/>
            </div>
          ))}
        </div>
      )}

      {/* Product grid — paginated */}
      {rangeData.length > 0 && (
        <>
          <div style={{ display:"grid",
            gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))", gap:14 }}>
            {pagedItems.map((p, i) => (
              <div key={p.id} style={{ animation:`slideIn 0.4s ease ${i*0.04}s both` }}>
                <ProductCard
                  product={p}
                  rank={(page - 1) * perPage + i + 1}
                  accentColor={accentColor}
                  tier={tier}
                  platforms={platforms}
                  onAnalyze={onAnalyze}
                />
              </div>
            ))}
          </div>

          {/* Pagination controls */}
          {totalPages > 1 && (
            <div style={{ display:"flex", justifyContent:"center", alignItems:"center",
              gap:4, marginTop:22, flexWrap:"wrap" }}>
              <button
                disabled={page === 1}
                onClick={() => setPage(Math.max(1, page - 1))}
                style={{
                  background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  color: page === 1 ? "#222" : "#888",
                  borderRadius:7, padding:"6px 11px",
                  fontSize:11, fontWeight:700,
                  cursor: page === 1 ? "default" : "pointer",
                }}>‹ PREV</button>

              {/* Page number buttons (show all if <=7, else windowed) */}
              {(() => {
                const pages = [];
                if (totalPages <= 7) {
                  for (let i = 1; i <= totalPages; i++) pages.push(i);
                } else {
                  pages.push(1);
                  if (page > 3) pages.push("…");
                  for (let i = Math.max(2, page - 1); i <= Math.min(totalPages - 1, page + 1); i++) {
                    pages.push(i);
                  }
                  if (page < totalPages - 2) pages.push("…");
                  pages.push(totalPages);
                }
                return pages.map((p, idx) =>
                  p === "…" ? (
                    <span key={`dot${idx}`} style={{ color:"#333", padding:"0 4px" }}>…</span>
                  ) : (
                    <button key={p} onClick={() => setPage(p)}
                      style={{
                        background: p === page
                          ? `linear-gradient(135deg,${accentColor}33,${accentColor}11)`
                          : "rgba(255,255,255,0.03)",
                        border: p === page
                          ? `1px solid ${accentColor}66`
                          : "1px solid rgba(255,255,255,0.07)",
                        color: p === page ? accentColor : "#888",
                        borderRadius:7,
                        padding:"6px 11px", minWidth:32,
                        fontSize:11, fontWeight:800,
                        cursor:"pointer",
                      }}>{p}</button>
                  )
                );
              })()}

              <button
                disabled={page === totalPages}
                onClick={() => setPage(Math.min(totalPages, page + 1))}
                style={{
                  background:"rgba(255,255,255,0.03)",
                  border:"1px solid rgba(255,255,255,0.07)",
                  color: page === totalPages ? "#222" : "#888",
                  borderRadius:7, padding:"6px 11px",
                  fontSize:11, fontWeight:700,
                  cursor: page === totalPages ? "default" : "pointer",
                }}>NEXT ›</button>
            </div>
          )}

          <div style={{ textAlign:"center", marginTop:12, fontSize:10, color:"#333" }}>
            Page {page} of {totalPages} · {rangeData.length} products total
          </div>
        </>
      )}

      {/* Refresh button */}
      <div style={{ textAlign:"center", marginTop:16 }}>
        <button
          onClick={() => { setPage(1); fetchRange(activeRange, true); }}
          disabled={isLoading}
          style={{
            background: "rgba(255,255,255,0.03)",
            border: "1px solid rgba(255,255,255,0.07)",
            color: isLoading ? "#333" : "#666",
            borderRadius: 9, padding: "6px 16px",
            fontSize: 10, fontWeight: 700, letterSpacing: "0.05em",
            cursor: isLoading ? "wait" : "pointer",
          }}>
          {isLoading ? "REFRESHING…" : "↻ REFRESH"}
        </button>
      </div>
    </div>
  );
}

// ─── INLINE AMAZON PRODUCT LOOKUP (embeds into Hot / Browse tabs) ─────────────
// Lets users pull up ANY Amazon product and renders it as a full ProductCard
// with surge, potential, risk, and package scores — all tiers.

function InlineAmazonLookup({ tier, platforms, accentColor, onAnalyze }) {
  const { lookupAmazon } = useAPI();
  const [query,   setQuery]   = useState("");
  const [loading, setLoading] = useState(false);
  const [cards,   setCards]   = useState([]);   // accumulated results
  const [error,   setError]   = useState("");
  const [open,    setOpen]    = useState(false);

  const search = async () => {
    if (!query.trim()) return;
    setLoading(true);
    setError("");

    try {
      const { products, noResults } = await lookupAmazon(query.trim());
      if (noResults || !products || products.length === 0) {
        throw new Error("No results for that search");
      }

      // Take the top result, compute scores, mark as a lookup card
      const top = products[0];
      const scores = computeProductScores(top);
      const product = {
        ...top,
        id: Date.now() + Math.random(),
        platforms: top.platforms || ["Amazon"],
        tags:      top.tags      || [],
        trend:     top.trend     || "",
        potential: top.potential || scores.packageScore,
        _scores:   scores,
        _fromLookup: true,
      };

      setCards(prev => [product, ...prev.filter(c => c.name !== product.name)]);
      setQuery("");
    } catch (err) {
      setError(err.message || "Could not find product. Try a different keyword or ASIN.");
    }
    setLoading(false);
  };

  const amazonUrl = (p) => p.link ||
    (p.asin && !/^B0X+$/i.test(p.asin)
      ? `https://www.amazon.com/dp/${p.asin}`
      : `https://www.amazon.com/s?k=${encodeURIComponent(p.name)}`);

  return (
    <div style={{ marginTop:32 }}>
      {/* Section header / toggle */}
      <div
        onClick={() => setOpen(o => !o)}
        style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
          cursor:"pointer", marginBottom:open ? 16 : 0,
          padding:"14px 18px",
          background: open ? "rgba(255,153,0,0.07)" : "rgba(255,255,255,0.02)",
          border:`1px solid ${open ? "rgba(255,153,0,0.3)" : "rgba(255,255,255,0.07)"}`,
          borderRadius:14, transition:"all 0.2s" }}>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          <span style={{ fontSize:18 }}>🔍</span>
          <div>
            <div style={{ fontFamily:"Syne,sans-serif", fontWeight:800, fontSize:15, color:"#f0f0f0" }}>
              Look Up Any Amazon Product
            </div>
            <div style={{ fontSize:11, color:"#555", marginTop:1 }}>
              Search by name or ASIN — get surge, potential, risk &amp; package scores instantly
            </div>
          </div>
        </div>
        <div style={{ display:"flex", alignItems:"center", gap:10 }}>
          {cards.length > 0 && (
            <span style={{ fontSize:10, fontWeight:700, color:"#ff9900",
              background:"rgba(255,153,0,0.12)", border:"1px solid rgba(255,153,0,0.25)",
              padding:"3px 9px", borderRadius:20 }}>
              {cards.length} looked up
            </span>
          )}
          <span style={{ fontSize:18, color:"#444" }}>{open ? "▲" : "▼"}</span>
        </div>
      </div>

      {open && (
        <div style={{ animation:"slideIn 0.25s ease both" }}>
          {/* Search input */}
          <div style={{ display:"flex", gap:10, marginBottom:error ? 10 : 16 }}>
            <input
              value={query}
              onChange={e => setQuery(e.target.value)}
              onKeyDown={e => e.key === "Enter" && search()}
              placeholder='Product name or ASIN — e.g. "foam roller", "B09G9FPHY6", "blue light glasses"'
              style={{ flex:1, background:"rgba(255,255,255,0.04)",
                border:"1px solid rgba(255,153,0,0.35)", borderRadius:11,
                padding:"12px 16px", color:"#e0e0e0", fontSize:13, fontFamily:"inherit" }}
            />
            <button onClick={search} disabled={loading || !query.trim()}
              style={{ background: loading ? "rgba(255,153,0,0.3)" : "linear-gradient(135deg,#ff9900,#e07000)",
                border:"none", color:"#000", borderRadius:11,
                padding:"12px 22px", fontSize:13, fontWeight:900,
                cursor: loading || !query.trim() ? "not-allowed" : "pointer",
                opacity: !query.trim() ? 0.5 : 1, whiteSpace:"nowrap",
                boxShadow: loading ? "none" : "0 4px 14px rgba(255,153,0,0.25)" }}>
              {loading ? "Fetching…" : "Look Up"}
            </button>
          </div>

          {error && (
            <div style={{ marginBottom:14, padding:"12px 16px",
              background:"rgba(255,68,68,0.06)", border:"1px solid rgba(255,68,68,0.15)",
              borderRadius:10, fontSize:12, color:"#ff8888",
              wordBreak:"break-word", overflowWrap:"anywhere", lineHeight:1.5,
              maxHeight:120, overflow:"hidden" }}>
              {error}
            </div>
          )}

          {loading && (
            <div style={{ textAlign:"center", padding:"32px 0" }}>
              <div style={{ width:40, height:40, borderRadius:"50%",
                border:"3px solid rgba(255,153,0,0.1)", borderTop:"3px solid #ff9900",
                animation:"spin 0.8s linear infinite", margin:"0 auto 12px" }}/>
              <div style={{ color:"#555", fontSize:12 }}>Fetching product data from Amazon…</div>
            </div>
          )}

          {/* Results grid */}
          {cards.length > 0 && (
            <div>
              <div style={{ display:"flex", alignItems:"center", justifyContent:"space-between",
                marginBottom:12 }}>
                <div style={{ fontSize:11, color:"#555", fontWeight:700, letterSpacing:"0.06em" }}>
                  LOOKED-UP PRODUCTS — FULL SCORES + POTENTIAL
                </div>
                <button onClick={() => setCards([])}
                  style={{ fontSize:10, color:"#444", background:"none", border:"none",
                    cursor:"pointer", textDecoration:"underline" }}>
                  Clear all
                </button>
              </div>
              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))", gap:14 }}>
                {cards.map((p, i) => (
                  <div key={p.id} style={{ position:"relative",
                    animation:`slideIn 0.35s ease ${i * 0.06}s both` }}>
                    {/* Amazon source link overlay tag */}
                    <a href={amazonUrl(p)} target="_blank" rel="noopener noreferrer"
                      style={{ position:"absolute", top:-10, right:16, zIndex:10,
                        display:"flex", alignItems:"center", gap:5,
                        background:"linear-gradient(135deg,#ff9900,#e07000)",
                        color:"#000", fontWeight:900, fontSize:10,
                        padding:"3px 10px", borderRadius:20,
                        textDecoration:"none", cursor:"pointer" }}
                      onMouseEnter={e => e.currentTarget.style.opacity="0.85"}
                      onMouseLeave={e => e.currentTarget.style.opacity="1"}>
                      📦 Source ↗
                    </a>
                    <ProductCard
                      product={p}
                      accentColor="#ff9900"
                      tier={tier}
                      platforms={platforms}
                      onAnalyze={onAnalyze}
                    />
                    {/* Scores ribbon under the card */}
                    {p._scores && (
                      <div style={{ display:"flex", gap:6, marginTop:6, flexWrap:"wrap" }}>
                        {[
                          { label:"Risk",    val:`${p._scores.riskScore}/100`,    color:p._scores.riskColor,    bg:p._scores.riskColor+"12"    },
                          { label:"Package", val:`${p._scores.packageScore}/100`, color:p._scores.packageColor, bg:p._scores.packageColor+"12" },
                          { label:"Verdict", val:p._scores.riskLevel === "Low" ? "✅ Safe Buy" : p._scores.riskLevel === "Medium" ? "⚠️ Monitor" : "🔴 High Risk",
                            color:p._scores.riskColor, bg:p._scores.riskColor+"12" },
                        ].map(s => (
                          <div key={s.label} style={{ flex:1, minWidth:90,
                            background:s.bg, border:`1px solid ${s.color}22`,
                            borderRadius:8, padding:"6px 10px", textAlign:"center" }}>
                            <div style={{ fontSize:11, fontWeight:800, color:s.color }}>{s.val}</div>
                            <div style={{ fontSize:8, color:"#444", marginTop:1 }}>{s.label}</div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {cards.length === 0 && !loading && (
            <div style={{ textAlign:"center", padding:"28px 0", color:"#2a2d3a" }}>
              <div style={{ fontSize:10, color:"#333", lineHeight:1.8 }}>
                Type any product name or Amazon ASIN above.<br/>
                Results appear here with surge · potential · risk · package scores.
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── ROOT APP ─────────────────────────────────────────────────────────────────

export default function App() {
  const { user } = useUser();
  const clerkTier = user?.publicMetadata?.tier || "free";
  const [tier, setTier] = useState(clerkTier);
  // Keep local tier synced with Clerk tier (updates after Stripe payment)
  useEffect(() => { setTier(clerkTier); }, [clerkTier]);
  const { callAI, startCheckout, openPortal } = useAPI();
  const [activeTab,         setActiveTab]         = useState("hot");
  const [platforms,         setPlatforms]         = useState(DEFAULT_PLATFORMS);
  const [selCat,            setSelCat]            = useState("All");
  const [selPlat,           setSelPlat]           = useState("All");
  const [searchQ,           setSearchQ]           = useState("");
  const [aiSearchQ,         setAiSearchQ]         = useState("");
  const [isSearching,       setIsSearching]       = useState(false);
  const [searchResults,     setSearchResults]     = useState(null);
  const [searchSummary,     setSearchSummary]     = useState("");
  const [analyzingProduct,  setAnalyzingProduct]  = useState(null);
  const [analyzeType,       setAnalyzeType]       = useState("insight");
  const [pkgAnalyzing,      setPkgAnalyzing]      = useState(null);
  const [showTierModal,     setShowTierModal]      = useState(false);
  // Amazon lookup deep analysis state
  const [lookupAnalysisProduct, setLookupAnalysisProduct] = useState(null);
  const [lookupAnalysisScores,  setLookupAnalysisScores]  = useState(null);

  const ac = tier==="free" ? "#94a3b8" : tier==="growth" ? "#00d4aa" : "#f59e0b";
  const activePlatforms = platforms.filter(p => p.active);

  const applyFilters = useCallback(arr => arr.filter(p =>
    (selCat  === "All" || p.category === selCat) &&
    (selPlat === "All" || p.platforms.includes(selPlat)) &&
    (searchQ === ""    || p.name.toLowerCase().includes(searchQ.toLowerCase()))
  ), [selCat, selPlat, searchQ]);

  const visibleHot    = useMemo(() =>
    applyFilters(HOT_PRODUCTS).slice(0, tier==="free"?5 : tier==="growth"?20 : 999),
    [applyFilters, tier]);
  const visibleSale   = useMemo(() => applyFilters(SALE_PRODUCTS),  [applyFilters]);
  const visibleBrowse = useMemo(() => applyFilters(HOT_PRODUCTS),   [applyFilters]);

  const handleAiSearch = useCallback(async () => {
    if (!aiSearchQ.trim()) return;
    setIsSearching(true);
    setSearchResults(null);
    setSearchSummary("");

    const amazonData = await fetchAmazonProducts(aiSearchQ);

    const prompt = amazonData
      ? `You are an e-commerce AI. Here is live Amazon data for "${aiSearchQ}":\n${JSON.stringify(amazonData)}\nAnalyze and respond ONLY with valid JSON (no markdown, no backticks):\n{"summary":"2-sentence overview","insight":"one key insight","products":[{"id":100,"name":"product","category":"cat","platforms":["Amazon"],"surge":85,"potential":88,"sales30d":45000,"reviews":12000,"rating":4.6,"price":"$XX","origPrice":null,"onSale":false,"trend":"+XXX%","tags":["tag1"]}]}`
      : `You are an e-commerce AI. Research: "${aiSearchQ}" across Amazon, TikTok, Etsy, Shopify, Facebook, Walmart, eBay.\nRespond ONLY with valid JSON (no markdown, no backticks):\n{"summary":"2-sentence overview","insight":"one key insight","products":[{"id":100,"name":"product","category":"cat","platforms":["Amazon"],"surge":85,"potential":88,"sales30d":45000,"reviews":12000,"rating":4.6,"price":"$XX","origPrice":null,"onSale":false,"trend":"+XXX%","tags":["tag1"]}]}\nGenerate 6 realistic products.`;

    try {
      const d = await callAI({
        messages: [{ role:"user", content:prompt }],
        max_tokens: 1400,
        requireSearch: true,
      });
      const txt    = extractText(d);
      const parsed = extractJSON(txt);
      setSearchResults(parsed.products || []);
      setSearchSummary(([parsed.summary, parsed.insight].filter(Boolean)).join(" "));
    } catch (err) {
      setSearchSummary("Search error: " + err.message + ". Try a different query.");
      setSearchResults([]);
    }
    setIsSearching(false);
  }, [aiSearchQ, callAI]);

  // Tab definitions — analytics tabs separated from premium tool tabs
  const TABS_ANALYTICS = [
    { id:"hot",    label:"🔥 Hot Items",  locked:false         },
    { id:"surge",  label:"⚡ Surge",       locked:false         },
    { id:"lookup", label:"🔍 Amazon",      locked:false         },
    { id:"browse", label:"🛒 Browse",      locked:tier==="free" },
    { id:"sale",   label:"🏷️ On Sale",     locked:tier==="free" },
  ];
  const TABS_TOOLS = [
    { id:"bundles",label:"📦 Bundles",     locked:tier==="free" },
    { id:"search", label:"🤖 AI Search",   locked:tier==="free" },
    { id:"sites",  label:"⚙️ Sites",       locked:false         },
    { id:"users",  label:"👥 Live Users",  locked:tier!=="pro"  },
  ];
  const ALL_TABS = [...TABS_ANALYTICS, ...TABS_TOOLS];

  return (
    <div style={{ minHeight:"100vh", background:"#07090f", color:"#e0e0e0",
      fontFamily:"'DM Sans','Segoe UI',sans-serif", overflowX:"hidden" }}>
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=DM+Sans:wght@300;400;500;700;800;900&family=Syne:wght@700;800;900&display=swap');
        @keyframes spin    { to { transform:rotate(360deg) } }
        @keyframes pulse   { 0%,100%{opacity:1} 50%{opacity:.55} }
        @keyframes slideIn { from{opacity:0;transform:translateY(14px)} to{opacity:1;transform:translateY(0)} }
        ::-webkit-scrollbar       { width:4px; height:4px }
        ::-webkit-scrollbar-track { background:#0a0c14 }
        ::-webkit-scrollbar-thumb { background:#1e2235; border-radius:2px }
        * { box-sizing:border-box }
        input::placeholder { color:#333 }
        input:focus { outline:none }
      `}</style>

      {/* ── HEADER ── */}
      <div style={{ borderBottom:"1px solid rgba(255,255,255,0.05)",
        background:"rgba(7,9,15,0.96)", backdropFilter:"blur(20px)",
        position:"sticky", top:0, zIndex:200 }}>

        {/* Row 1: Logo + Tabs */}
        <div style={{ maxWidth:1440, margin:"0 auto", display:"flex", alignItems:"center",
          height:48, gap:0, padding:"0 12px" }}>

          {/* Logo — icon only to save space on mobile */}
          <div style={{ display:"flex", alignItems:"center", gap:5,
            flexShrink:0, marginRight:6, minWidth:0 }}>
            <div style={{ width:20, height:20, borderRadius:6, flexShrink:0,
              background:`linear-gradient(135deg,${ac},${ac}99)`,
              display:"flex", alignItems:"center", justifyContent:"center",
              fontSize:10, color:"#000", boxShadow:`0 0 8px ${ac}44` }}>⚡</div>
            <span style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:11,
              color:"#f0f0f0", whiteSpace:"nowrap", overflow:"hidden",
              maxWidth:80, textOverflow:"ellipsis" }}>
              Trend<span style={{ color:ac }}>AI</span>
            </span>
          </div>

          {/* Tabs — scrollable, left-aligned, no centering that causes overlap */}
          <div style={{ display:"flex", gap:0, overflowX:"auto", flex:1,
            alignItems:"center", scrollbarWidth:"none" }}>
            {TABS_ANALYTICS.map(t => (
              <button key={t.id}
                onClick={() => t.locked ? setShowTierModal(true) : setActiveTab(t.id)}
                style={{ background:"none", border:"none",
                  borderBottom:`2px solid ${activeTab===t.id&&!t.locked ? ac : "transparent"}`,
                  color:t.locked?"#2a2d3a":activeTab===t.id?ac:"#555",
                  padding:"6px 8px", fontSize:10, fontWeight:700, cursor:"pointer",
                  whiteSpace:"nowrap", marginBottom:-1, transition:"all 0.2s", flexShrink:0 }}>
                {t.label}{t.locked?" 🔒":""}
              </button>
            ))}
            <div style={{ width:1, height:18, background:"rgba(255,255,255,0.07)",
              margin:"0 3px", flexShrink:0 }}/>
            <div style={{ fontSize:7, color:"#2a2d3a", fontWeight:700,
              letterSpacing:"0.06em", whiteSpace:"nowrap", flexShrink:0,
              padding:"0 2px" }}>TOOLS</div>
            <div style={{ width:1, height:18, background:"rgba(255,255,255,0.07)",
              margin:"0 3px", flexShrink:0 }}/>
            {TABS_TOOLS.map(t => (
              <button key={t.id}
                onClick={() => t.locked ? setShowTierModal(true) : setActiveTab(t.id)}
                style={{ background:"none", border:"none",
                  borderBottom:`2px solid ${activeTab===t.id&&!t.locked ? ac : "transparent"}`,
                  color:t.locked?"#2a2d3a":activeTab===t.id?ac:"#555",
                  padding:"6px 8px", fontSize:10, fontWeight:700, cursor:"pointer",
                  whiteSpace:"nowrap", marginBottom:-1, transition:"all 0.2s", flexShrink:0 }}>
                {t.label}{t.locked?" 🔒":""}
              </button>
            ))}
          </div>

          {/* User profile button — avatar with sign-out menu */}
          <div style={{ flexShrink:0, marginLeft:6, display:"flex", alignItems:"center" }}>
            <UserButton
              appearance={{
                elements: {
                  avatarBox: { width: "28px", height: "28px" },
                  userButtonPopoverCard: { background: "#0c0f1a", border: "1px solid rgba(255,255,255,0.1)" },
                  userButtonPopoverActionButton: { color: "#e0e0e0" },
                  userButtonPopoverActionButtonText: { color: "#e0e0e0" },
                  userButtonPopoverActionButtonIcon: { color: "#888" },
                  userButtonPopoverFooter: { display: "none" },
                },
              }}
              afterSignOutUrl="/"
            />
          </div>
        </div>

        {/* Row 2: Tier switcher — full-width strip on its own line */}
        <div style={{ borderTop:"1px solid rgba(255,255,255,0.04)",
          background:"rgba(0,0,0,0.3)", padding:"7px 20px" }}>
          <div style={{ maxWidth:1440, margin:"0 auto", display:"flex",
            alignItems:"center", gap:8 }}>
            <span style={{ fontSize:9, color:"#333", fontWeight:700,
              letterSpacing:"0.1em", whiteSpace:"nowrap", flexShrink:0 }}>PLAN</span>
            <div style={{ width:1, height:14, background:"rgba(255,255,255,0.07)" }}/>
            <div style={{ display:"flex", gap:6, flex:1 }}>
              {Object.entries(TIERS).map(([id, t]) => (
                <button key={id} onClick={() => {
                  // Clicking your CURRENT tier does nothing
                  if (id === tier) return;
                  // Downgrading: open Stripe customer portal to manage/cancel
                  if (id === "free" && tier !== "free") {
                    openPortal().catch(err => alert("Portal error: " + err.message));
                    return;
                  }
                  // Free tier is free — no Stripe needed
                  if (id === "free") { setTier("free"); return; }
                  // Paid tier — redirect to Stripe Checkout
                  startCheckout(id).catch(err => alert("Checkout error: " + err.message));
                }}
                  style={{
                    background: tier===id
                      ? `linear-gradient(135deg,${t.color}28,${t.color}14)`
                      : "rgba(255,255,255,0.03)",
                    border:`1px solid ${tier===id ? t.color+"66" : "rgba(255,255,255,0.07)"}`,
                    color: tier===id ? t.color : "#3a3d4a",
                    borderRadius:8,
                    padding:"5px 18px",
                    fontSize:11, fontWeight:800,
                    cursor:"pointer", transition:"all 0.2s",
                    display:"flex", alignItems:"center", gap:6,
                    boxShadow: tier===id ? `0 0 10px ${t.color}22` : "none",
                  }}>
                  {tier===id && (
                    <span style={{ width:5, height:5, borderRadius:"50%",
                      background:t.color, display:"inline-block",
                      boxShadow:`0 0 6px ${t.color}` }}/>
                  )}
                  {t.name}
                  <span style={{ fontSize:9, opacity: tier===id ? 0.8 : 0.35,
                    fontWeight:600 }}>{t.price}</span>
                </button>
              ))}
            </div>
            {tier !== "free" && (
              <div style={{ fontSize:9, color:"#555", flexShrink:0 }}>
                {tier==="growth" ? "20 trending · AI search · bundles" : "Unlimited · full AI · API access"}
              </div>
            )}
          </div>
        </div>

      </div>

      {/* ── TIER MODAL (Plans + Premium Features separated) ── */}
      {showTierModal && (
        <div style={{ position:"fixed", inset:0, zIndex:1000, background:"rgba(0,0,0,0.88)",
          backdropFilter:"blur(16px)", display:"flex", alignItems:"center",
          justifyContent:"center", padding:20 }}
          onClick={e => e.target===e.currentTarget && setShowTierModal(false)}>
          <div style={{ background:"linear-gradient(135deg,#0c0f1a,#131826)",
            border:"1px solid rgba(255,255,255,0.1)", borderRadius:24, padding:32,
            maxWidth:860, width:"100%", maxHeight:"90vh", overflow:"auto",
            boxShadow:"0 32px 80px rgba(0,0,0,0.6)" }}>

            {/* Section 1: Plans */}
            <div style={{ textAlign:"center", marginBottom:22 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:22, color:"#f0f0f0" }}>
                Choose Your <span style={{ color:"#00d4aa" }}>Plan</span>
              </div>
              <div style={{ fontSize:11, color:"#444", marginTop:4 }}>
                All plans include Amazon Lookup with risk &amp; package scores
              </div>
            </div>

            <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:28 }}>
              {Object.entries(TIERS).map(([id, t]) => (
                <div key={id}
                  onClick={() => {
                    if (id === "free") { setTier("free"); setShowTierModal(false); return; }
                    // Paid tiers → redirect to Stripe Checkout
                    startCheckout(id).catch(err => alert("Checkout error: " + err.message));
                  }}
                  style={{ background:tier===id?`${t.color}12`:"rgba(255,255,255,0.02)",
                    border:`2px solid ${tier===id?t.color+"66":"rgba(255,255,255,0.07)"}`,
                    borderRadius:16, padding:20, cursor:"pointer", transition:"all 0.2s",
                    position:"relative" }}>
                  {tier===id && (
                    <div style={{ position:"absolute", top:-10, right:12,
                      background:`linear-gradient(135deg,${t.color},${t.color}99)`,
                      color:"#000", fontSize:9, fontWeight:900, padding:"3px 9px", borderRadius:20 }}>
                      {t.badge}
                    </div>
                  )}
                  <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:16,
                    color:t.color, marginBottom:4 }}>{t.name}</div>
                  <div style={{ fontSize:22, fontWeight:900, color:"#f0f0f0", marginBottom:14 }}>{t.price}</div>
                  {TIER_FEATURES[id].map(f => (
                    <div key={f} style={{ fontSize:11, color:"#666", display:"flex", gap:6, marginBottom:5, lineHeight:1.4 }}>
                      <span style={{ color:t.color, fontSize:9, flexShrink:0, marginTop:2 }}>✓</span>{f}
                    </div>
                  ))}
                </div>
              ))}
            </div>

            {/* Separator */}
            <div style={{ display:"flex", alignItems:"center", gap:14, marginBottom:20 }}>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }}/>
              <div style={{ fontSize:9, color:"#333", fontWeight:800, letterSpacing:"0.1em", whiteSpace:"nowrap" }}>
                PREMIUM CAPABILITIES — GROWTH &amp; PRO
              </div>
              <div style={{ flex:1, height:1, background:"rgba(255,255,255,0.07)" }}/>
            </div>

            {/* Section 2: Premium Features — Bundles & AI Search as separate cards */}
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14, marginBottom:20 }}>
              {/* Bundle Deal Builder */}
              <div style={{ background:"linear-gradient(135deg,rgba(245,158,11,0.08),rgba(245,158,11,0.03))",
                border:"1px solid rgba(245,158,11,0.25)", borderRadius:14, padding:20 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>📦</div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:900, color:"#f59e0b", marginBottom:6 }}>
                  Bundle Deal Builder
                </div>
                <div style={{ fontSize:11, color:"#666", lineHeight:1.7, marginBottom:12 }}>
                  AI-curated multi-product bundles with uplift projections, bundle pricing strategy, and
                  deep analysis on every package deal. Turn individual products into premium bundles
                  that command higher margins.
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#f59e0b",
                    background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)",
                    padding:"3px 9px", borderRadius:20 }}>Growth: 3 bundles/day</span>
                  <span style={{ fontSize:10, fontWeight:700, color:"#f59e0b",
                    background:"rgba(245,158,11,0.12)", border:"1px solid rgba(245,158,11,0.25)",
                    padding:"3px 9px", borderRadius:20 }}>Pro: Unlimited</span>
                </div>
              </div>

              {/* AI Product Search */}
              <div style={{ background:"linear-gradient(135deg,rgba(0,212,170,0.08),rgba(0,212,170,0.03))",
                border:"1px solid rgba(0,212,170,0.25)", borderRadius:14, padding:20 }}>
                <div style={{ fontSize:28, marginBottom:8 }}>🤖</div>
                <div style={{ fontFamily:"Syne,sans-serif", fontSize:15, fontWeight:900, color:"#00d4aa", marginBottom:6 }}>
                  AI Product Search
                </div>
                <div style={{ fontSize:11, color:"#666", lineHeight:1.7, marginBottom:12 }}>
                  Search any niche across all platforms. AI scans, scores, and surfaces emerging
                  opportunities with full market context. Discover untapped products before
                  they hit mainstream trend lists.
                </div>
                <div style={{ display:"flex", gap:6, flexWrap:"wrap" }}>
                  <span style={{ fontSize:10, fontWeight:700, color:"#00d4aa",
                    background:"rgba(0,212,170,0.12)", border:"1px solid rgba(0,212,170,0.25)",
                    padding:"3px 9px", borderRadius:20 }}>Growth: Full access</span>
                  <span style={{ fontSize:10, fontWeight:700, color:"#00d4aa",
                    background:"rgba(0,212,170,0.12)", border:"1px solid rgba(0,212,170,0.25)",
                    padding:"3px 9px", borderRadius:20 }}>Pro: + Deep analysis</span>
                </div>
              </div>
            </div>

            <button onClick={() => setShowTierModal(false)}
              style={{ display:"block", margin:"0 auto",
                background:"rgba(255,255,255,0.06)",
                border:"1px solid rgba(255,255,255,0.1)", color:"#666",
                borderRadius:10, padding:"10px 28px", fontSize:12, fontWeight:700, cursor:"pointer" }}>
              Close
            </button>
          </div>
        </div>
      )}

      {/* ── AI PRODUCT MODAL ── */}
      {analyzingProduct && (
        <AIModal
          product={analyzingProduct}
          type={analyzeType}
          onClose={() => { setAnalyzingProduct(null); setAnalyzeType("insight"); }}/>
      )}

      {/* ── PACKAGE ANALYSIS MODAL ── */}
      {pkgAnalyzing && (
        <PackageAnalysisModal
          pkg={pkgAnalyzing}
          onClose={() => setPkgAnalyzing(null)}/>
      )}

      {/* ── RISK/PACKAGE DEEP ANALYSIS MODAL (Amazon Lookup) ── */}
      {lookupAnalysisProduct && lookupAnalysisScores && (
        <RiskPackageModal
          product={lookupAnalysisProduct}
          scores={lookupAnalysisScores}
          onClose={() => { setLookupAnalysisProduct(null); setLookupAnalysisScores(null); }}/>
      )}

      {/* ── MAIN CONTENT ── */}
      <div style={{ maxWidth:1440, margin:"0 auto", padding:"24px 16px", overflowX:"hidden" }}>

        {/* Stats bar */}
        <div style={{ display:"flex", gap:16, marginBottom:24, overflowX:"auto",
          background:"rgba(255,255,255,0.02)", border:"1px solid rgba(255,255,255,0.05)",
          borderRadius:12, padding:"12px 18px" }}>
          {[
            { l:"Products Tracked", v:"2.4M+",               i:"📦" },
            { l:"Platforms",        v:activePlatforms.length, i:"🔗" },
            { l:"Daily Data Points",v:"18.7M",                i:"📊" },
            { l:"Surge Detection",  v:"6.2hrs early",         i:"⚡" },
            { l:"Sale Items",       v:SALE_PRODUCTS.length,   i:"🏷️" },
            { l:"Bundle Deals",     v:PACKAGE_SEEDS.length,   i:"📦" },
          ].map((s, i) => (
            <div key={s.l} style={{ flexShrink:0, display:"flex", alignItems:"center", gap:8 }}>
              <span style={{ fontSize:16 }}>{s.i}</span>
              <div>
                <div style={{ fontWeight:800, fontSize:13, color:"#f0f0f0" }}>{s.v}</div>
                <div style={{ fontSize:9, color:"#333" }}>{s.l}</div>
              </div>
              {i < 5 && <div style={{ width:1, height:24, background:"rgba(255,255,255,0.05)", marginLeft:8 }}/>}
            </div>
          ))}
        </div>

        {/* Filters */}
        <div style={{ display:"flex", gap:6, marginBottom:20, flexWrap:"wrap", alignItems:"center" }}>
          <input value={searchQ} onChange={e => setSearchQ(e.target.value)}
            placeholder="Filter by name..."
            style={{ background:"rgba(255,255,255,0.04)",
              border:"1px solid rgba(255,255,255,0.09)", borderRadius:9,
              padding:"7px 13px", color:"#e0e0e0", fontSize:12, width:160, fontFamily:"inherit" }}/>
          <div style={{ width:1, height:18, background:"rgba(255,255,255,0.06)" }}/>
          {CATEGORIES.map(c => (
            <button key={c} onClick={() => setSelCat(c)}
              style={{ background:selCat===c?ac+"22":"rgba(255,255,255,0.03)",
                border:`1px solid ${selCat===c?ac+"55":"rgba(255,255,255,0.07)"}`,
                color:selCat===c?ac:"#555", borderRadius:7, padding:"5px 11px",
                fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
              {c}
            </button>
          ))}
          <div style={{ width:1, height:18, background:"rgba(255,255,255,0.06)" }}/>
          <button onClick={() => setSelPlat("All")}
            style={{ background:selPlat==="All"?ac+"22":"rgba(255,255,255,0.03)",
              border:`1px solid ${selPlat==="All"?ac+"55":"rgba(255,255,255,0.07)"}`,
              color:selPlat==="All"?ac:"#555", borderRadius:7, padding:"5px 11px",
              fontSize:11, fontWeight:600, cursor:"pointer" }}>
            All
          </button>
          {activePlatforms.map(p => (
            <button key={p.id} onClick={() => setSelPlat(p.name)}
              style={{ background:selPlat===p.name?p.color+"22":"rgba(255,255,255,0.03)",
                border:`1px solid ${selPlat===p.name?p.color+"55":"rgba(255,255,255,0.07)"}`,
                color:selPlat===p.name?p.color:"#555", borderRadius:7, padding:"5px 11px",
                fontSize:11, fontWeight:600, cursor:"pointer", transition:"all 0.15s" }}>
              {p.name}
            </button>
          ))}
        </div>

        {/* ── HOT TAB ── */}
        {activeTab === "hot" && (
          <div>
            <div style={{ display:"flex", justifyContent:"space-between",
              alignItems:"center", marginBottom:18 }}>
              <div>
                <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                  🔥 <span style={{ color:ac }}>Hot Items</span>
                </div>
                <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
                  AI-researched trends · 24h, 7d & 30d · no overlaps
                </div>
              </div>
            </div>
            {tier === "free" && (
              <div style={{ marginBottom:14, padding:"10px 14px",
                background:"rgba(148,163,184,0.07)",
                border:"1px solid rgba(148,163,184,0.18)", borderRadius:9,
                fontSize:12, color:"#666",
                display:"flex", alignItems:"center", justifyContent:"space-between", gap:10 }}>
                <span>Free: 5 curated + 10 trending per tab.{" "}
                  <strong style={{ color:"#94a3b8" }}>Growth ($10/mo)</strong>: 20 curated + 50 trending per tab.{" "}
                  <strong style={{ color:"#fbbf24" }}>Pro ($30/mo)</strong>: unlocks Surge, Bundles & API access.
                </span>
                <button onClick={() => setShowTierModal(true)}
                  style={{ background:"rgba(0,212,170,0.15)",
                    border:"1px solid rgba(0,212,170,0.3)", color:"#00d4aa",
                    borderRadius:7, padding:"4px 12px", fontSize:11, fontWeight:700,
                    cursor:"pointer", whiteSpace:"nowrap" }}>
                  Upgrade →
                </button>
              </div>
            )}
            <InlineAmazonLookup
              tier={tier}
              platforms={platforms}
              accentColor={ac}
              onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}
            />

            {/* Top N — curated static list (original feature, restored) */}
            <div style={{ marginTop:28 }}>
              <div style={{ display:"flex", justifyContent:"space-between",
                alignItems:"baseline", flexWrap:"wrap", gap:6, marginBottom:12 }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900,
                  fontSize:16, color:"#f0f0f0" }}>
                  ⭐ Top {tier==="free"?5 : tier==="growth"?20 : 20}{" "}
                  <span style={{ color:ac }}>Curated Picks</span>
                </div>
                <div style={{ fontSize:10, color:"#444", fontStyle:"italic" }}>
                  Hand-selected by our team · no AI
                </div>
              </div>
              <div style={{ display:"grid",
                gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))", gap:14 }}>
                {visibleHot.map((p, i) => (
                  <div key={p.id} style={{ animation:`slideIn 0.4s ease ${i*0.04}s both` }}>
                    <ProductCard product={p} rank={i+1} accentColor={ac} tier={tier}
                      platforms={platforms}
                      onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}/>
                  </div>
                ))}
              </div>
            </div>

            <TrendingProductsSection
              tier={tier}
              accentColor={ac}
              platforms={platforms}
              onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}
            />
          </div>
        )}

        {/* ── SURGE TAB ── */}
        {activeTab === "surge" && (
          <div>
            <div style={{ marginBottom:18 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                ⚡ Surge <span style={{ color:"#a78bfa" }}>Detector</span>
              </div>
              <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
                Early velocity signals before they go mainstream
              </div>
            </div>
            <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))", gap:14 }}>
              {applyFilters(
                HOT_PRODUCTS.filter(p => p.surge >= 70).sort((a, b) => b.surge - a.surge)
              ).map((p, i) => (
                <div key={p.id} style={{ animation:`slideIn 0.4s ease ${i*0.04}s both` }}>
                  <ProductCard product={p} accentColor="#a78bfa" tier={tier} platforms={platforms}
                    onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}/>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* ── AMAZON LOOKUP TAB (ALL TIERS) ── */}
        {activeTab === "lookup" && (
          <AmazonLookupTab
            tier={tier}
            platforms={platforms}
            onDeepAnalysis={(product, scores) => {
              setLookupAnalysisProduct(product);
              setLookupAnalysisScores(scores);
            }}
          />
        )}

        {/* ── BROWSE TAB ── */}
        {activeTab === "browse" && (
          <TierGate tier={tier} required="growth">
            <div>
              <div style={{ marginBottom:18 }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                  🛒 Browse <span style={{ color:ac }}>All Products</span>
                </div>
                <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
                  {visibleBrowse.length} products — scored and rated
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(300px,1fr))", gap:12 }}>
                {visibleBrowse.map((p, i) => (
                  <div key={p.id} style={{ animation:`slideIn 0.35s ease ${i*0.03}s both` }}>
                    <ProductCard product={p} accentColor={ac} tier={tier} compact platforms={platforms}
                      onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}/>
                  </div>
                ))}
              </div>
              <InlineAmazonLookup
                tier={tier}
                platforms={platforms}
                accentColor={ac}
                onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}
              />
            </div>
          </TierGate>
        )}

        {/* ── SALE TAB ── */}
        {activeTab === "sale" && (
          <TierGate tier={tier} required="growth">
            <div>
              <div style={{ marginBottom:18 }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                  🏷️ Items <span style={{ color:"#ff2d55" }}>On Sale</span>
                </div>
                <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
                  Sale items with surge + potential + AI bundle suggestions
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))",
                gap:14, marginBottom:32 }}>
                {visibleSale.map((p, i) => (
                  <div key={p.id} style={{ animation:`slideIn 0.4s ease ${i*0.05}s both` }}>
                    <ProductCard product={p} accentColor="#ff2d55" tier={tier} platforms={platforms}
                      onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}/>
                  </div>
                ))}
              </div>
              <div style={{ borderTop:"1px solid rgba(255,255,255,0.06)", paddingTop:24 }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:18,
                  color:"#f0f0f0", marginBottom:16 }}>
                  💡 Recommended <span style={{ color:"#f59e0b" }}>Bundle Pairings</span>
                </div>
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,340px),1fr))", gap:14 }}>
                  {PACKAGE_SEEDS.slice(0, tier==="growth" ? 3 : 5).map((pkg, i) => (
                    <div key={pkg.name} style={{ animation:`slideIn 0.4s ease ${i*0.06}s both` }}>
                      <PackageCard pkg={pkg} tier={tier} onAnalyze={setPkgAnalyzing}/>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </TierGate>
        )}

        {/* ── BUNDLES TAB ── */}
        {activeTab === "bundles" && (
          <TierGate tier={tier} required="growth">
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                    📦 Bundle <span style={{ color:"#f59e0b" }}>Deal Builder</span>
                  </div>
                  <span style={{ fontSize:10, fontWeight:700, padding:"3px 9px", borderRadius:20,
                    background:"rgba(245,158,11,0.12)", color:"#f59e0b",
                    border:"1px solid rgba(245,158,11,0.25)" }}>
                    {tier === "growth" ? "3/day" : "UNLIMITED"}
                  </span>
                </div>
                <div style={{ fontSize:11, color:"#444" }}>
                  AI-curated multi-product bundles — turn average products into premium packages
                </div>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,380px),1fr))", gap:16 }}>
                {PACKAGE_SEEDS.map((pkg, i) => (
                  <div key={pkg.name} style={{ animation:`slideIn 0.4s ease ${i*0.07}s both` }}>
                    <PackageCard pkg={pkg} tier={tier} onAnalyze={setPkgAnalyzing}/>
                  </div>
                ))}
              </div>
            </div>
          </TierGate>
        )}

        {/* ── AI SEARCH TAB ── */}
        {activeTab === "search" && (
          <TierGate tier={tier} required="growth">
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ display:"flex", alignItems:"center", gap:10, marginBottom:4 }}>
                  <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                    🤖 AI <span style={{ color:ac }}>Product Search</span>
                  </div>
                </div>
                <div style={{ fontSize:11, color:"#444" }}>
                  Search any niche — AI scans all platforms and scores results
                </div>
              </div>

              <div style={{ display:"flex", gap:10, marginBottom:14 }}>
                <input value={aiSearchQ} onChange={e => setAiSearchQ(e.target.value)}
                  onKeyDown={e => e.key==="Enter" && handleAiSearch()}
                  placeholder="Try: 'summer beauty tools', 'pet accessories', 'home office gadgets'..."
                  style={{ flex:1, background:"rgba(255,255,255,0.04)",
                    border:`1px solid ${ac}44`, borderRadius:11,
                    padding:"11px 16px", color:"#e0e0e0", fontSize:14, fontFamily:"inherit" }}/>
                <button onClick={handleAiSearch} disabled={isSearching}
                  style={{ background:`linear-gradient(135deg,${ac},${ac}bb)`, border:"none",
                    color:"#000", borderRadius:11, padding:"11px 22px", fontSize:13, fontWeight:800,
                    cursor:isSearching?"wait":"pointer", opacity:isSearching?0.7:1, whiteSpace:"nowrap" }}>
                  {isSearching ? "Scanning..." : "AI Search"}
                </button>
              </div>

              {searchSummary && (
                <div style={{ marginBottom:18, padding:"11px 16px", background:`${ac}0d`,
                  border:`1px solid ${ac}22`, borderRadius:9, fontSize:12, color:"#aaa" }}>
                  <span style={{ color:ac, fontWeight:700 }}>AI Insight: </span>
                  {searchSummary}
                </div>
              )}

              {isSearching && (
                <div style={{ textAlign:"center", padding:"40px 0" }}>
                  <div style={{ width:48, height:48, borderRadius:"50%",
                    border:`3px solid ${ac}22`, borderTop:`3px solid ${ac}`,
                    animation:"spin 0.8s linear infinite", margin:"0 auto 16px" }}/>
                  <div style={{ color:"#555", fontSize:13 }}>Scanning platforms...</div>
                </div>
              )}

              {searchResults && searchResults.length > 0 && (
                <div style={{ display:"grid", gridTemplateColumns:"repeat(auto-fill,minmax(min(100%,320px),1fr))", gap:14 }}>
                  {searchResults.map((p, i) => (
                    <div key={p.id} style={{ animation:`slideIn 0.4s ease ${i*0.05}s both` }}>
                      <ProductCard product={p} accentColor={ac} tier={tier} platforms={platforms}
                        onAnalyze={(prod, t) => { setAnalyzingProduct(prod); setAnalyzeType(t); }}/>
                    </div>
                  ))}
                </div>
              )}

              {searchResults && searchResults.length === 0 && !isSearching && (
                <div style={{ textAlign:"center", padding:"32px 0", color:"#444", fontSize:14 }}>
                  No results found. Try a different search term.
                </div>
              )}
            </div>
          </TierGate>
        )}

        {/* ── SITES TAB ── */}
        {activeTab === "sites" && (
          <div>
            <div style={{ marginBottom:20 }}>
              <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                ⚙️ Platform <span style={{ color:ac }}>Manager</span>
              </div>
              <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
                Enable, disable, or add custom sites to track
              </div>
            </div>
            <SiteManager platforms={platforms} setPlatforms={setPlatforms} tier={tier}/>
          </div>
        )}

        {/* ── LIVE USERS TAB ── */}
        {activeTab === "users" && (
          <TierGate tier={tier} required="pro">
            <div>
              <div style={{ marginBottom:20 }}>
                <div style={{ fontFamily:"Syne,sans-serif", fontWeight:900, fontSize:20, color:"#f0f0f0" }}>
                  👥 Live <span style={{ color:"#00d4aa" }}>User Tracker</span>
                </div>
                <div style={{ fontSize:11, color:"#444", marginTop:3 }}>
                  Real-time platform activity and engagement metrics
                </div>
              </div>
              <LiveTracker/>
            </div>
          </TierGate>
        )}

      </div>
    </div>
  );
}
