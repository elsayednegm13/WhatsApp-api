import { ensureDb } from "./lib/db.js";
import { Router, sendError, sendJson } from "./lib/router.js";
import { registerAuthRoutes } from "./routes/auth.js";
import { registerAutoReplyRoutes } from "./routes/autoReplies.js";
import { registerMessageRoutes } from "./routes/messages.js";
import { registerSettingRoutes } from "./routes/settings.js";
import { registerUserRoutes } from "./routes/users.js";
import { registerWebhookRoutes } from "./routes/webhooks.js";

const router = new Router();
let routesRegistered = false;

function registerRoutesOnce() {
  if (routesRegistered) return;
  registerAuthRoutes(router);
  registerMessageRoutes(router);
  registerAutoReplyRoutes(router);
  registerUserRoutes(router);
  registerSettingRoutes(router);
  registerWebhookRoutes(router);
  routesRegistered = true;
}

export async function handleApiRequest(req, res) {
  try {
    registerRoutesOnce();
    await ensureDb();
    const handled = await router.handle(req, res);
    if (!handled) sendJson(res, 404, { error: { message: "API route was not found.", status: 404 } });
  } catch (error) {
    sendError(res, error);
  }
}
