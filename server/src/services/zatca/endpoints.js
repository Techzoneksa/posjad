const ROOTS = {
  simulation: "https://gw-fatoora.zatca.gov.sa/e-invoicing/simulation",
  production: "https://gw-fatoora.zatca.gov.sa/e-invoicing/core",
  sandbox: "https://gw-fatoora.zatca.gov.sa/e-invoicing/developer-portal",
};

export function zatcaEndpoints(settings = {}) {
  const env = settings.environment ?? "simulation";
  const root = settings.base_url || ROOTS[env] || ROOTS.simulation;
  return {
    complianceCsid: `${root}/compliance`,
    productionCsids: `${root}/production/csids`,
    complianceInvoices: `${root}/compliance/invoices`,
    reportingSingle: `${root}/invoices/reporting/single`,
    clearanceSingle: `${root}/invoices/clearance/single`,
  };
}

export function chooseEndpoint({ settings, invoiceType }) {
  const endpoints = zatcaEndpoints(settings);
  return invoiceType?.mode === "clearance" ? endpoints.clearanceSingle : endpoints.reportingSingle;
}
