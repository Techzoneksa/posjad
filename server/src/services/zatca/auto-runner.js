import { env } from "../../config/env.js";
import { supabaseAdmin } from "../../lib/supabase.js";
import { runQueueOnce } from "./integration.js";

let timer = null;
let running = false;
let lastRun = null;
let lastError = null;

export function getAutoRunnerState() {
  return {
    enabled: Boolean(timer),
    running,
    intervalMs: env.zatcaAutoRunnerIntervalMs,
    lastRun,
    lastError,
  };
}

export function startZatcaAutoRunner() {
  if (timer) return getAutoRunnerState();

  timer = setInterval(async () => {
    if (running) return;
    running = true;
    lastError = null;
    try {
      lastRun = await runQueueOnce({ supabaseAdmin, limit: env.zatcaAutoRunnerBatchSize });
    } catch (error) {
      lastError = { message: error.message, at: new Date().toISOString() };
    } finally {
      running = false;
    }
  }, env.zatcaAutoRunnerIntervalMs);

  timer.unref?.();
  return getAutoRunnerState();
}

export function stopZatcaAutoRunner() {
  if (timer) clearInterval(timer);
  timer = null;
  return getAutoRunnerState();
}
