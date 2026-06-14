import fs from "node:fs";
import path from "node:path";

const appDir = process.env.APP_DIR || "/var/www/posjad";

function readEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return {};

  const env = {};
  const lines = fs.readFileSync(filePath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    env[key] = value;
  }
  return env;
}

const frontendEnv = readEnvFile(path.join(appDir, ".env.production"));
const backendEnv = readEnvFile(path.join(appDir, "server", ".env"));

export default {
  apps: [
    {
      name: "jaad-cloud-frontend",
      cwd: appDir,
      script: ".next/standalone/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        ...frontendEnv,
        NODE_ENV: "production",
        NEXT_TELEMETRY_DISABLED: "1",
        HOSTNAME: frontendEnv.HOSTNAME || "0.0.0.0",
        PORT: frontendEnv.FRONTEND_PORT || "3000",
      },
    },
    {
      name: "jaad-cloud-api",
      cwd: appDir,
      script: "server/server.js",
      interpreter: "node",
      exec_mode: "fork",
      instances: 1,
      autorestart: true,
      max_memory_restart: "768M",
      env: {
        ...backendEnv,
        NODE_ENV: "production",
        PORT: backendEnv.API_PORT || backendEnv.PORT || "8080",
        ZATCA_SIGNING_SERVICE_URL:
          backendEnv.ZATCA_SIGNING_SERVICE_URL || "http://127.0.0.1:8081",
      },
    },
  ],
};
