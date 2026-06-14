// Step 2 — prepareDevice() only. No ZATCA call. No OTP.
import { prepareDevice } from "../src/lib/zatca-onboarding.server";

async function main() {
  const result = await prepareDevice();
  console.log(JSON.stringify(result));
}
main().catch((e) => { console.error("ERR:", e?.message ?? e); process.exit(1); });
