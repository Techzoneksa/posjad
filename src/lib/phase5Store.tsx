"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  INITIAL_TAX_PROFILE, INITIAL_POS_DEVICE, INITIAL_INVOICE_TEMPLATE,
  INITIAL_SYNC_QUEUE, INITIAL_FAILED, INITIAL_OFFLINE, INITIAL_CHECKLIST,
  type CompanyTaxProfile, type PosDevice, type InvoiceTemplate,
  type SyncRow, type FailedInvoice, type OfflineSettings, type ChecklistGroup,
} from "./phase5Data";

type Ctx = {
  tax: CompanyTaxProfile; setTax: (v: CompanyTaxProfile) => void;
  device: PosDevice; setDevice: (v: PosDevice) => void;
  template: InvoiceTemplate; setTemplate: (v: InvoiceTemplate) => void;
  syncQueue: SyncRow[]; retrySync: (id: string) => void; markReview: (id: string) => void;
  failed: FailedInvoice[]; addNote: (id: string, text: string, by: string) => void;
  resolveFailed: (id: string) => void;
  offline: OfflineSettings; setOffline: (v: OfflineSettings) => void;
  checklist: ChecklistGroup[];
};

const Phase5Ctx = createContext<Ctx | null>(null);

export function Phase5Provider({ children }: { children: ReactNode }) {
  const [tax, setTax] = useState<CompanyTaxProfile>(INITIAL_TAX_PROFILE);
  const [device, setDevice] = useState<PosDevice>(INITIAL_POS_DEVICE);
  const [template, setTemplate] = useState<InvoiceTemplate>(INITIAL_INVOICE_TEMPLATE);
  const [syncQueue, setSyncQueue] = useState<SyncRow[]>(INITIAL_SYNC_QUEUE);
  const [failed, setFailed] = useState<FailedInvoice[]>(INITIAL_FAILED);
  const [offline, setOffline] = useState<OfflineSettings>(INITIAL_OFFLINE);
  const [checklist] = useState<ChecklistGroup[]>(INITIAL_CHECKLIST);

  const now = () => new Date().toISOString().slice(0, 16).replace("T", " ");

  const retrySync = (id: string) => setSyncQueue((q) =>
    q.map((r) => r.id === id
      ? { ...r, retryCount: r.retryCount + 1, lastAttempt: now(),
          status: r.status === "failed" ? "pending_sync" : r.status }
      : r));

  const markReview = (id: string) => setSyncQueue((q) =>
    q.map((r) => r.id === id ? { ...r, status: "failed" } : r));

  const addNote = (id: string, text: string, by: string) => setFailed((f) =>
    f.map((x) => x.id === id ? { ...x, notes: [...x.notes, { at: now(), by, text }] } : x));

  const resolveFailed = (id: string) => setFailed((f) =>
    f.map((x) => x.id === id ? { ...x, status: "resolved" } : x));

  return (
    <Phase5Ctx.Provider value={{
      tax, setTax, device, setDevice, template, setTemplate,
      syncQueue, retrySync, markReview, failed, addNote, resolveFailed,
      offline, setOffline, checklist,
    }}>{children}</Phase5Ctx.Provider>
  );
}

export function usePhase5() {
  const v = useContext(Phase5Ctx);
  if (!v) throw new Error("usePhase5 must be used inside <Phase5Provider>");
  return v;
}
