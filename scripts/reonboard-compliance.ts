import { prepareDevice, requestComplianceCsid } from "../src/lib/zatca-onboarding.server";

async function main() {
  const otp = process.argv[2];
  if (!otp) throw new Error("OTP required as arg");
  console.log("Running prepareDevice...");
  const prep = await prepareDevice();
  console.log("prepareDevice:", JSON.stringify(prep));
  console.log("Running requestComplianceCsid...");
  const csid = await requestComplianceCsid(otp);
  console.log("requestComplianceCsid:", JSON.stringify({
    ok: csid.ok, status: csid.status, requestId: csid.requestId ?? null, error: csid.error ?? null
  }));
  if (!csid.ok) process.exit(1);
}

main().catch((e) => { console.error(e); process.exit(1); });
