// api/clerk.js — shared auth helper
// Renamed from _clerk.js because Vercel's serverless runtime sometimes
// excludes underscore-prefixed files from the deployed bundle.

import { createClerkClient, verifyToken } from "@clerk/backend";

// Lazy-initialized Clerk client — avoids crashing on module load if env is missing
let _clerkInstance = null;
function getClerk() {
  if (_clerkInstance) return _clerkInstance;
  if (!process.env.CLERK_SECRET_KEY) {
    throw new Error("CLERK_SECRET_KEY is not set on the server");
  }
  _clerkInstance = createClerkClient({
    secretKey: process.env.CLERK_SECRET_KEY,
  });
  return _clerkInstance;
}

export async function verifyClerkToken(req) {
  try {
    const headers = req.headers || {};
    const auth = headers.authorization || headers.Authorization || "";
    const token = String(auth).replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      return { error: "No authorization token sent" };
    }

    // Verify the JWT using Clerk's public keys (fetches JWKS automatically)
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const userId = payload.sub;
    if (!userId) return { error: "Token missing user ID" };

    const clerk = getClerk();
    const user = await clerk.users.getUser(userId);
    const tier = user.publicMetadata?.tier || "free";

    return { userId, tier, user };
  } catch (err) {
    console.error("Clerk verify error:", err.message);
    return { error: "Invalid token: " + err.message };
  }
}

// Export a lazy-getter so consumers can grab the full client if needed
export function clerk() {
  return getClerk();
}
