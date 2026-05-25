import { requirePermission } from "../lib/auth.js";
import { readDb, updateDb } from "../lib/db.js";
import { decryptValue, encryptValue } from "../lib/security.js";
import { readJson, requireFields, sendJson } from "../lib/router.js";

function publicSettings(settings) {
  return {
    businessName: settings.businessName,
    phoneNumberId: settings.phoneNumberId,
    businessPhone: settings.businessPhone,
    webhookUrl: settings.webhookUrl,
    sendMode: settings.sendMode,
    autoReplyEnabled: settings.autoReplyEnabled,
    verifyTokenSet: Boolean(decryptValue(settings.encryptedVerifyToken)),
    accessTokenSet: Boolean(decryptValue(settings.encryptedAccessToken)),
    appSecretSet: Boolean(decryptValue(settings.encryptedAppSecret)),
    updatedAt: settings.updatedAt
  };
}

export function registerSettingRoutes(router) {
  router.add("GET", "/api/settings/whatsapp", async ({ req, res }) => {
    await requirePermission(req, "settings:manage");
    const db = await readDb();
    sendJson(res, 200, { settings: publicSettings(db.settings) });
  });

  router.add("PUT", "/api/settings/whatsapp", async ({ req, res }) => {
    await requirePermission(req, "settings:manage");
    const { body } = await readJson(req);
    requireFields(body, ["businessName", "businessPhone", "phoneNumberId", "webhookUrl", "sendMode"]);
    const settings = await updateDb((data) => {
      data.settings = {
        ...data.settings,
        businessName: String(body.businessName).trim(),
        businessPhone: String(body.businessPhone).trim(),
        phoneNumberId: String(body.phoneNumberId).trim(),
        webhookUrl: String(body.webhookUrl).trim(),
        sendMode: body.sendMode === "cloud" ? "cloud" : "mock",
        autoReplyEnabled: Boolean(body.autoReplyEnabled),
        encryptedVerifyToken: body.verifyToken
          ? encryptValue(body.verifyToken)
          : data.settings.encryptedVerifyToken,
        encryptedAccessToken: body.accessToken
          ? encryptValue(body.accessToken)
          : data.settings.encryptedAccessToken,
        encryptedAppSecret: body.appSecret
          ? encryptValue(body.appSecret)
          : data.settings.encryptedAppSecret,
        updatedAt: new Date().toISOString()
      };
      return publicSettings(data.settings);
    });
    sendJson(res, 200, { settings });
  });
}
