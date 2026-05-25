import { publicUser, readDb } from "./db.js";
import { hasPermission } from "./permissions.js";
import { verifyToken } from "./security.js";
import { httpError } from "./router.js";

export function getBearerToken(req) {
  const header = req.headers.authorization || "";
  if (!header.startsWith("Bearer ")) return "";
  return header.slice("Bearer ".length);
}

export async function authenticate(req) {
  const token = getBearerToken(req);
  if (!token) throw httpError(401, "Authentication is required.");
  const payload = verifyToken(token);
  const db = await readDb();
  if (db.revokedTokenIds.includes(payload.jti)) throw httpError(401, "Token has been revoked.");
  const user = db.users.find((item) => item.id === payload.sub && item.status === "active");
  if (!user) throw httpError(401, "User is not active.");
  return { user, publicUser: publicUser(user), tokenPayload: payload };
}

export async function requirePermission(req, permission) {
  const auth = await authenticate(req);
  if (!hasPermission(auth.user, permission)) throw httpError(403, "You do not have permission for this action.");
  return auth;
}
