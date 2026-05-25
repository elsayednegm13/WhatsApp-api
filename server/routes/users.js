import { randomUUID } from "node:crypto";
import { requirePermission } from "../lib/auth.js";
import { publicUser, readDb, updateDb } from "../lib/db.js";
import { rolePermissions } from "../lib/permissions.js";
import { hashPassword } from "../lib/security.js";
import { readJson, requireFields, sendJson, httpError } from "../lib/router.js";

function normalizeUserPayload(body, isNew) {
  requireFields(body, isNew ? ["name", "email", "password", "role", "status"] : ["name", "email", "role", "status"]);
  if (!rolePermissions[body.role]) throw httpError(422, "Invalid role.");
  if (!["active", "suspended"].includes(body.status)) throw httpError(422, "Invalid user status.");
  return {
    name: String(body.name).trim(),
    email: String(body.email).trim().toLowerCase(),
    role: body.role,
    status: body.status,
    password: body.password
  };
}

export function registerUserRoutes(router) {
  router.add("GET", "/api/users", async ({ req, res }) => {
    await requirePermission(req, "users:read");
    const db = await readDb();
    sendJson(res, 200, { users: db.users.map(publicUser) });
  });

  router.add("POST", "/api/users", async ({ req, res }) => {
    await requirePermission(req, "users:manage");
    const { body } = await readJson(req);
    const payload = normalizeUserPayload(body, true);
    const user = await updateDb((data) => {
      if (data.users.some((item) => item.email === payload.email)) {
        throw httpError(409, "Email is already used.");
      }
      const passwordData = hashPassword(payload.password);
      const created = {
        id: randomUUID(),
        name: payload.name,
        email: payload.email,
        ...passwordData,
        role: payload.role,
        status: payload.status,
        lastLoginAt: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      data.users.push(created);
      return publicUser(created);
    });
    sendJson(res, 201, { user });
  });

  router.add("PATCH", "/api/users/:id", async ({ req, res, params }) => {
    await requirePermission(req, "users:manage");
    const { body } = await readJson(req);
    const payload = normalizeUserPayload(body, false);
    const user = await updateDb((data) => {
      const index = data.users.findIndex((item) => item.id === params.id);
      if (index === -1) throw httpError(404, "User was not found.");
      if (data.users.some((item) => item.email === payload.email && item.id !== params.id)) {
        throw httpError(409, "Email is already used.");
      }
      const passwordData = payload.password ? hashPassword(payload.password) : {};
      data.users[index] = {
        ...data.users[index],
        name: payload.name,
        email: payload.email,
        role: payload.role,
        status: payload.status,
        ...passwordData,
        updatedAt: new Date().toISOString()
      };
      return publicUser(data.users[index]);
    });
    sendJson(res, 200, { user });
  });

  router.add("DELETE", "/api/users/:id", async ({ req, res, params }) => {
    const auth = await requirePermission(req, "users:manage");
    if (auth.user.id === params.id) throw httpError(422, "You cannot delete your own account.");
    await updateDb((data) => {
      data.users = data.users.filter((user) => user.id !== params.id);
    });
    sendJson(res, 200, { ok: true });
  });
}
