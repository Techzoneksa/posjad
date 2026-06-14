"use client";

import { createContext, useContext, useState, type ReactNode } from "react";
import {
  READINESS_SECTIONS, ACTIVITY_LOGS, AUDIT_LOGS, NOTIFICATIONS,
  DEFAULT_PERMISSIONS, QA_SECTIONS, RESTORE_POINTS,
  type ReadinessSection, type ReadinessStatus,
  type ActivityLog, type AuditLog, type Notification, type NotifStatus,
  type PermMatrix, type PermRoleId, type PermAction,
  type QASection, type RestorePoint,
} from "./phase6Data";

type BackupCfg = {
  enabled: boolean;
  frequency: "daily" | "weekly" | "monthly";
  time: string;
  includeAttachments: boolean;
  includeLogs: boolean;
  retentionDays: number;
  notifyOwner: boolean;
};

type Phase6Ctx = {
  readiness: ReadinessSection[];
  setReadinessStatus: (sectionId: string, itemId: string, status: ReadinessStatus) => void;
  activity: ActivityLog[];
  audit: AuditLog[];
  notifications: Notification[];
  setNotifStatus: (id: string, status: NotifStatus) => void;
  perms: PermMatrix;
  togglePerm: (role: PermRoleId, mod: string, action: PermAction) => void;
  resetPerms: () => void;
  qa: QASection[];
  toggleQA: (sectionId: string, itemId: string) => void;
  setQANote: (sectionId: string, itemId: string, note: string) => void;
  backup: BackupCfg;
  setBackup: (b: Partial<BackupCfg>) => void;
  restorePoints: RestorePoint[];
  runBackup: () => void;
};

const Ctx = createContext<Phase6Ctx | null>(null);
export const usePhase6 = () => {
  const v = useContext(Ctx);
  if (!v) throw new Error("Phase6Provider missing");
  return v;
};

export function Phase6Provider({ children }: { children: ReactNode }) {
  const [readiness, setReadiness] = useState<ReadinessSection[]>(READINESS_SECTIONS);
  const [notifications, setNotifs] = useState<Notification[]>(NOTIFICATIONS);
  const [perms, setPerms] = useState<PermMatrix>(DEFAULT_PERMISSIONS);
  const [qa, setQA] = useState<QASection[]>(QA_SECTIONS);
  const [backup, setB] = useState<BackupCfg>({
    enabled: false, frequency: "daily", time: "03:00",
    includeAttachments: true, includeLogs: true, retentionDays: 30, notifyOwner: true,
  });
  const [restorePoints, setRP] = useState<RestorePoint[]>(RESTORE_POINTS);

  return (
    <Ctx.Provider value={{
      readiness,
      setReadinessStatus: (sid, iid, s) =>
        setReadiness((prev) => prev.map((sec) => sec.id !== sid ? sec : {
          ...sec, items: sec.items.map((it) => it.id === iid ? { ...it, status: s } : it),
        })),
      activity: ACTIVITY_LOGS,
      audit: AUDIT_LOGS,
      notifications,
      setNotifStatus: (id, status) =>
        setNotifs((p) => p.map((n) => n.id === id ? { ...n, status } : n)),
      perms,
      togglePerm: (role, mod, action) =>
        setPerms((p) => {
          const rolePerms = p[role] ?? DEFAULT_PERMISSIONS[role];
          const modPerms = rolePerms?.[mod] ?? DEFAULT_PERMISSIONS[role]?.[mod];
          if (!rolePerms || !modPerms) return p;
          return { ...p, [role]: { ...rolePerms, [mod]: { ...modPerms, [action]: !modPerms[action] } } };
        }),
      resetPerms: () => setPerms(DEFAULT_PERMISSIONS),
      qa,
      toggleQA: (sid, iid) =>
        setQA((prev) => prev.map((s) => s.id !== sid ? s : { ...s, items: s.items.map((it) => it.id === iid ? { ...it, done: !it.done } : it) })),
      setQANote: (sid, iid, note) =>
        setQA((prev) => prev.map((s) => s.id !== sid ? s : { ...s, items: s.items.map((it) => it.id === iid ? { ...it, notes: note } : it) })),
      backup,
      setBackup: (b) => setB((p) => ({ ...p, ...b })),
      restorePoints,
      runBackup: () => {
        const now = new Date();
        const id = "BK-" + now.toISOString().slice(0, 10) + "-M";
        setRP((p) => [{
          id, date: now.toISOString().slice(0, 16).replace("T", " "),
          size: "42.4 MB", status: "success", type: "manual",
        }, ...p]);
      },
    }}>{children}</Ctx.Provider>
  );
}
