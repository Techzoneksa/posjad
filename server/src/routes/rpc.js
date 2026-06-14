import { Router } from "express";

import { actionRegistry } from "../controllers/actions/registry.js";
import { httpError } from "../lib/http-error.js";
import { requireSupabaseAuth } from "../middleware/auth.js";

export const rpcRouter = Router();

async function runAction(req, res, next) {
  try {
    const action = req.params.action;
    const entry = actionRegistry[action];
    if (!entry) throw httpError(404, `Unknown RPC action: ${action}`);

    const input = req.method === "GET" ? req.query : req.body ?? {};
    const result = await entry.handler(input, req);
    res.json(result ?? null);
  } catch (error) {
    next(error);
  }
}

function maybeAuthenticate(req, res, next) {
  const entry = actionRegistry[req.params.action];
  if (!entry) return next();
  if (entry.auth === false) return next();
  return requireSupabaseAuth(req, res, next);
}

rpcRouter.get("/:action", maybeAuthenticate, runAction);
rpcRouter.post("/:action", maybeAuthenticate, runAction);
