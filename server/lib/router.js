import { readFile } from "node:fs/promises";
import { extname, join, normalize } from "node:path";

const mimeTypes = {
  ".html": "text/html; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".json": "application/json; charset=utf-8",
  ".svg": "image/svg+xml"
};

export class Router {
  constructor() {
    this.routes = [];
  }

  add(method, pattern, handler) {
    const keys = [];
    const regex = new RegExp(
      `^${pattern
        .replaceAll("/", "\\/")
        .replace(/:([A-Za-z0-9_]+)/g, (_, key) => {
          keys.push(key);
          return "([^\\/]+)";
        })}$`
    );
    this.routes.push({ method, pattern, regex, keys, handler });
  }

  async handle(req, res, context = {}) {
    const url = new URL(req.url, `http://${req.headers.host}`);
    const route = this.routes.find((item) => item.method === req.method && item.regex.test(url.pathname));
    if (!route) return false;
    const match = url.pathname.match(route.regex);
    const params = Object.fromEntries(route.keys.map((key, index) => [key, decodeURIComponent(match[index + 1])]));
    await route.handler({ ...context, req, res, url, params });
    return true;
  }
}

export async function readJson(req) {
  if (req.body !== undefined) {
    if (Buffer.isBuffer(req.body)) {
      const rawBody = req.body;
      return { body: JSON.parse(rawBody.toString("utf8") || "{}"), rawBody };
    }
    if (typeof req.body === "string") {
      const rawBody = Buffer.from(req.body, "utf8");
      return { body: JSON.parse(req.body || "{}"), rawBody };
    }
    const rawBody = Buffer.from(JSON.stringify(req.body || {}), "utf8");
    return { body: req.body || {}, rawBody };
  }

  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const rawBody = Buffer.concat(chunks);
  if (rawBody.length === 0) return { body: {}, rawBody };
  try {
    return { body: JSON.parse(rawBody.toString("utf8")), rawBody };
  } catch {
    const error = new Error("Invalid JSON body");
    error.status = 400;
    throw error;
  }
}

export function sendJson(res, status, payload) {
  res.writeHead(status, {
    "Content-Type": "application/json; charset=utf-8",
    "Cache-Control": "no-store, no-cache, must-revalidate, proxy-revalidate, max-age=0",
    "CDN-Cache-Control": "no-store",
    "Vercel-CDN-Cache-Control": "no-store",
    "Pragma": "no-cache",
    "Expires": "0",
    "Surrogate-Control": "no-store"
  });
  res.end(JSON.stringify(payload));
}

export function sendError(res, error) {
  const status = error.status || 500;
  sendJson(res, status, {
    error: {
      message: status === 500 ? "Internal server error" : error.message,
      status
    }
  });
}

export function requireFields(body, fields) {
  const missing = fields.filter((field) => body[field] === undefined || body[field] === "");
  if (missing.length > 0) {
    const error = new Error(`Missing required fields: ${missing.join(", ")}`);
    error.status = 422;
    throw error;
  }
}

export async function serveStatic(req, res, root) {
  const url = new URL(req.url, `http://${req.headers.host}`);
  const pathname = url.pathname === "/" ? "/index.html" : url.pathname;
  const filePath = normalize(join(root, pathname));

  if (!filePath.startsWith(root)) {
    res.writeHead(403);
    res.end("Forbidden");
    return;
  }

  try {
    const body = await readFile(filePath);
    res.writeHead(200, {
      "Content-Type": mimeTypes[extname(filePath)] || "application/octet-stream"
    });
    res.end(body);
  } catch {
    const body = await readFile(join(root, "index.html"));
    res.writeHead(200, { "Content-Type": mimeTypes[".html"] });
    res.end(body);
  }
}

export function httpError(status, message) {
  const error = new Error(message);
  error.status = status;
  return error;
}
