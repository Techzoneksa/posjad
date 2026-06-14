// Step 3 — requestComplianceCsid(OTP) only. Real ZATCA Production call.
import { requestComplianceCsid } from "../src/lib/zatca-onboarding.server";

async function main() {
  const otp = process.argv[2];
  if (!otp) throw new Error("OTP required");
  const r = await requestComplianceCsid(otp);
  console.log(JSON.stringify({ ok: r.ok, status: r.status, requestId: r.requestId ?? null, error: r.error ?? null }));
  if (!r.ok) process.exit(1);
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
