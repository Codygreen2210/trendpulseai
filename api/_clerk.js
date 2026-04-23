// api/_clerk.js — shared auth helper (underscore = not a public route in Vercel)
import { createClerkClient } from "@clerk/backend";

const clerk = createClerkClient({ secretKey: process.env.CLERK_SECRET_KEY });

export async function verifyClerkToken(req) {
  try {
    const token = req.headers.authorization?.replace("Bearer ", "");
    if (!token) return { error: "No token" };

    const { sub: userId } = await clerk.verifyToken(token);
    const user = await clerk.users.getUser(userId);
    const tier = user.publicMetadata?.tier || "free";

    return { userId, tier, user };
  } catch {
    return { error: "Invalid token" };
  }
}

export { clerk };
