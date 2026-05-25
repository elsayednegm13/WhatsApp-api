import { createServer } from "node:http";
import { fileURLToPath } from "node:url";
import { serveStatic } from "./lib/router.js";
import { handleApiRequest } from "./app.js";

const port = Number(process.env.PORT || 4317);
const frontendRoot = fileURLToPath(new URL("../frontend", import.meta.url));

createServer(async (req, res) => {
  if (req.url.startsWith("/api/")) {
    await handleApiRequest(req, res);
    return;
  }
  await serveStatic(req, res, frontendRoot);
}).listen(port, () => {
  console.log(`WhatsApp API admin app: http://localhost:${port}`);
});
