import { cpSync, mkdirSync, rmSync, readFileSync, writeFileSync } from "node:fs";
import { dirname } from "node:path";

const outputDir = "public";
const version = `${Date.now()}_deploy`;

rmSync(outputDir, { recursive: true, force: true });
mkdirSync(dirname(`${outputDir}/index.html`), { recursive: true });
cpSync("frontend", outputDir, { recursive: true });

const indexPath = `${outputDir}/index.html`;
let index = readFileSync(indexPath, "utf8");
index = index.replace(/styles\.css\?v=[^"]+/g, `styles.css?v=${version}`);
index = index.replace(/app\.js\?v=[^"]+/g, `app.js?v=${version}`);
writeFileSync(indexPath, index);

const appPath = `${outputDir}/js/app.js`;
let app = readFileSync(appPath, "utf8");
app = app.replace(/apiClient\.js\?v=[^"']+/g, `apiClient.js?v=${version}`);
app = app.replace(/permissions\.js\?v=[^"']+/g, `permissions.js?v=${version}`);
writeFileSync(appPath, app);

await import("./verify-deploy.js");
