import { existsSync } from "node:fs";

const requiredFiles = [
  "frontend/index.html",
  "frontend/styles.css",
  "frontend/js/app.js",
  "frontend/js/apiClient.js",
  "public/index.html",
  "public/styles.css",
  "public/js/app.js",
  "public/js/apiClient.js",
  "api/[...path].js",
  "server/app.js",
  "vercel.json"
];

const missing = requiredFiles.filter((file) => !existsSync(file));

if (missing.length > 0) {
  console.error(`Missing deploy files: ${missing.join(", ")}`);
  process.exit(1);
}

console.log("Deploy check passed.");
