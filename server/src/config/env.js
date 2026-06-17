function pick(...names) {
  for (const name of names) {
    const value = process.env[name];
    if (value && value.trim()) return value.trim();
  }
  return "";
}

function required(name, ...aliases) {
  const value = pick(name, ...aliases);
  if (!value) throw new Error(`Missing required environment variable: ${[name, ...aliases].join(" or ")}`);
  return value;
}

export const env = {
  nodeEnv: process.env.NODE_ENV ?? "development",
  port: Number(process.env.PORT ?? 8080),
  corsOrigin: process.env.CORS_ORIGIN?.split(",").map((s) => s.trim()).filter(Boolean) ?? true,
  bodyLimit: process.env.API_BODY_LIMIT ?? "2mb",
  supabaseUrl: required("SUPABASE_URL", "NEXT_PUBLIC_SUPABASE_URL"),
  supabaseAnonKey: required("SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_ANON_KEY", "NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY"),
  supabaseServiceRoleKey: required("SUPABASE_SERVICE_ROLE_KEY"),
  publicWebhookSecret: pick("PUBLIC_WEBHOOK_HMAC_SECRET", "WEBHOOK_HMAC_SECRET"),
  zatcaSigningServiceUrl: pick("ZATCA_SIGNING_SERVICE_URL").replace(/\/+$/, ""),
  zatcaSigningServiceSecret: pick("ZATCA_SIGNING_SERVICE_SECRET", "SIGNING_SERVICE_SECRET"),
  zatcaAutoRunnerEnabled: pick("ZATCA_AUTO_RUNNER_ENABLED") === "true",
  zatcaAutoRunnerIntervalMs: Number(pick("ZATCA_AUTO_RUNNER_INTERVAL_MS") || 60_000),
  zatcaAutoRunnerBatchSize: Number(pick("ZATCA_AUTO_RUNNER_BATCH_SIZE") || 10),
};
