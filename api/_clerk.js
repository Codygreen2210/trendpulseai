// api/_clerk.js — shared auth helper (underscore = not a public route in Vercel)
import { createClerkClient, verifyToken } from "@clerk/backend";

const clerk = createClerkClient({
  secretKey: process.env.CLERK_SECRET_KEY,
  publishableKey: process.env.VITE_CLERK_PUBLISHABLE_KEY,
});

export async function verifyClerkToken(req) {
  try {
    // Pull token from Authorization header
    const auth = req.headers.authorization || req.headers.Authorization || "";
    const token = auth.replace(/^Bearer\s+/i, "").trim();

    if (!token) {
      console.error("Clerk verify: no token in Authorization header");
      return { error: "No authorization token sent" };
    }

    // Verify the JWT using Clerk's public keys (JWKS).
    // The `secretKey` is sufficient — Clerk's library fetches the JWKS automatically.
    const payload = await verifyToken(token, {
      secretKey: process.env.CLERK_SECRET_KEY,
    });

    const userId = payload.sub;
    if (!userId) return { error: "Token missing user ID" };

    const user = await clerk.users.getUser(userId);
    const tier = user.publicMetadata?.tier || "free";

    return { userId, tier, user };
  } catch (err) {
    console.error("Clerk verify error:", err.message);
    return { error: "Invalid token: " + err.message };
  }
}

export { clerk };
