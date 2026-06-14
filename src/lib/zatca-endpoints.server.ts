// ZATCA endpoint mapping (server-only).
//
// Source of truth for ZATCA API base URLs + path mapping. We do NOT rely
// on a stored sandbox_base_url for compliance/reporting/clearance paths,
// because operators have historically mis-set that field to the
// `/developer-portal` value (which is a docs portal, NOT an API).
//
// Reference (Fatoora):
//   Simulation:
//     - Compliance CSID:        /e-invoicing/simulation/compliance
//     - Compliance invoices:    /e-invoicing/simulation/compliance/invoices
//     - Production CSID:        /e-invoicing/simulation/production/csids
//     - Reporting (single):     /e-invoicing/simulation/invoices/reporting/single
//     - Clearance (single):     /e-invoicing/simulation/invoices/clearance/single
//   Core / Production:
//     - Compliance CSID:        /e-invoicing/core/compliance
//     - Reporting (single):     /e-invoicing/core/invoices/reporting/single
//     - Clearance (single):     /e-invoicing/core/invoices/clearance/single

export type ZatcaEnv = "simulation" | "production";

const HOST = "https://gw-fatoora.zatca.gov.sa";

function root(env: ZatcaEnv): string {
  return env === "production" ? `${HOST}/e-invoicing/core` : `${HOST}/e-invoicing/simulation`;
}

export function zatcaEndpoints(env: ZatcaEnv) {
  const r = root(env);
  return {
    base: r,
    complianceCsid: `${r}/compliance`,
    complianceInvoices: `${r}/compliance/invoices`,
    productionCsids: env === "simulation" ? `${r}/production/csids` : `${HOST}/e-invoicing/core/production/csids`,
    reportingSingle: `${r}/invoices/reporting/single`,
    clearanceSingle: `${r}/invoices/clearance/single`,
  };
}
