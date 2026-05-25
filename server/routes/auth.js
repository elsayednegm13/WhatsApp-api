import { updateDb } from "../lib/db.js";
import { authenticate, getBearerToken } from "../lib/auth.js";
import { publicUser, readDb } from "../lib/db.js";
import { readJson, requireFields, sendJson, httpError } from "../lib/router.js";
import { signToken, verifyPassword, verifyToken } from "../lib/security.js";

export function registerAuthRoutes(router) {
  router.add("POST", "/api/auth/login", async ({ req, res }) => {
    const { body } = await readJson(req);
    requireFields(body, ["email", "password"]);
    const db = await readDb();
    const user = db.users.find((item) => item.email.toLowerCase() === String(body.email).toLowerCase());
    if (!user || user.status !== "active" || !verifyPassword(body.password, user)) {
      throw httpError(401, "بيانات الدخول غير صحيحة.");
    }
    const token = signToken({ sub: user.id, role: user.role, email: user.email });
    const safeUser = await updateDb((data) => {
      const index = data.users.findIndex((item) => item.id === user.id);
      data.users[index].lastLoginAt = new Date().toISOString();
      data.users[index].updatedAt = new Date().toISOString();
      return publicUser(data.users[index]);
    });
    sendJson(res, 200, { token, user: safeUser });
  });

  router.add("GET", "/api/auth/me", async ({ req, res }) => {
    const auth = await authenticate(req);
    sendJson(res, 200, { user: auth.publicUser });
  });

  router.add("POST", "/api/auth/logout", async ({ req, res }) => {
    const token = getBearerToken(req);
    if (token) {
      try {
        const payload = verifyToken(token);
        await updateDb((data) => {
          if (!data.revokedTokenIds.includes(payload.jti)) data.revokedTokenIds.push(payload.jti);
        });
      } catch {
        // Logging out should be idempotent from the client perspective.
      }
    }
    sendJson(res, 200, { ok: true });
  });

  router.add("GET", "/api/auth/logout", async ({ res }) => {
    sendJson(res, 200, { ok: true });
  });

  router.add("POST", "/api/logout", async ({ req, res }) => {
    const token = getBearerToken(req);
    if (token) {
      try {
        const payload = verifyToken(token);
        await updateDb((data) => {
          if (!data.revokedTokenIds.includes(payload.jti)) data.revokedTokenIds.push(payload.jti);
        });
      } catch {
        // Keep compatibility logout idempotent.
      }
    }
    sendJson(res, 200, { ok: true });
  });

  router.add("GET", "/api/logout", async ({ res }) => {
    sendJson(res, 200, { ok: true });
  });
}
