import compression from "compression";
import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";

import { env } from "./config/env.js";
import { errorHandler, notFoundHandler } from "./middleware/error.js";
import { publicRouter } from "./routes/public.js";
import { rpcRouter } from "./routes/rpc.js";
import { startZatcaAutoRunner } from "./services/zatca/auto-runner.js";

function captureRawBody(req, _res, buf) {
  if (buf?.length) req.rawBody = Buffer.from(buf);
}

export function createApp() {
  const app = express();

  app.disable("x-powered-by");
  app.set("trust proxy", 1);

  app.use(helmet());
  app.use(compression());
  app.use(
    cors({
      origin: env.corsOrigin,
      credentials: true,
      methods: ["GET", "POST", "PUT", "PATCH", "DELETE", "OPTIONS"],
      allowedHeaders: ["Authorization", "Content-Type", "X-JAAD-Signature", "X-Signature"],
    }),
  );
  app.use(express.json({ limit: env.bodyLimit, verify: captureRawBody }));
  app.use(express.urlencoded({ extended: true, limit: env.bodyLimit }));
  app.use(morgan(env.nodeEnv === "production" ? "combined" : "dev"));

  app.get("/health", (_req, res) => {
    res.json({ ok: true, service: "jaad-cloud-api", node: process.version });
  });

  app.use("/api/public", publicRouter);
  app.use("/api/rpc", rpcRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  if (env.zatcaAutoRunnerEnabled) {
    startZatcaAutoRunner();
  }

  return app;
}
