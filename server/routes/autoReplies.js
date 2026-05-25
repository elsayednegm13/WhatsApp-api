import { randomUUID } from "node:crypto";
import { requirePermission } from "../lib/auth.js";
import { readDb, updateDb } from "../lib/db.js";
import { readJson, requireFields, sendJson, httpError } from "../lib/router.js";

const matchTypes = new Set(["contains", "exact", "startsWith", "regex"]);

function normalizePayload(body) {
  requireFields(body, ["name", "keyword", "matchType", "replyText", "priority"]);
  if (!matchTypes.has(body.matchType)) throw httpError(422, "Invalid match type.");
  return {
    name: String(body.name).trim(),
    keyword: String(body.keyword).trim(),
    matchType: body.matchType,
    replyText: String(body.replyText).trim(),
    priority: Number(body.priority),
    enabled: Boolean(body.enabled),
    caseSensitive: Boolean(body.caseSensitive)
  };
}

export function registerAutoReplyRoutes(router) {
  router.add("GET", "/api/auto-replies", async ({ req, res }) => {
    await requirePermission(req, "rules:manage");
    const db = await readDb();
    sendJson(res, 200, {
      autoReplies: db.autoReplies.slice().sort((a, b) => Number(a.priority) - Number(b.priority))
    });
  });

  router.add("POST", "/api/auto-replies", async ({ req, res }) => {
    await requirePermission(req, "rules:manage");
    const { body } = await readJson(req);
    const payload = normalizePayload(body);
    const autoReply = {
      id: randomUUID(),
      ...payload,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    await updateDb((data) => {
      data.autoReplies.push(autoReply);
    });
    sendJson(res, 201, { autoReply });
  });

  router.add("PATCH", "/api/auto-replies/:id", async ({ req, res, params }) => {
    await requirePermission(req, "rules:manage");
    const { body } = await readJson(req);
    const payload = normalizePayload(body);
    const autoReply = await updateDb((data) => {
      const index = data.autoReplies.findIndex((rule) => rule.id === params.id);
      if (index === -1) throw httpError(404, "Auto reply rule was not found.");
      data.autoReplies[index] = {
        ...data.autoReplies[index],
        ...payload,
        updatedAt: new Date().toISOString()
      };
      return data.autoReplies[index];
    });
    sendJson(res, 200, { autoReply });
  });

  router.add("DELETE", "/api/auto-replies/:id", async ({ req, res, params }) => {
    await requirePermission(req, "rules:manage");
    await updateDb((data) => {
      data.autoReplies = data.autoReplies.filter((rule) => rule.id !== params.id);
    });
    sendJson(res, 200, { ok: true });
  });
}
