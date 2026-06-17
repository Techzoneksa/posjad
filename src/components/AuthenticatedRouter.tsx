"use client";

import { lazy, Suspense, type ComponentType } from "react";
import { useApp, ADMIN_SCREENS, POS_SCREENS } from "@/lib/store";
import { AccessDeniedScreen, LoginSelectorScreen } from "@/components/screens/AuthScreens";
import { OpenShiftScreen } from "@/components/screens/OpenShiftScreen";
import { POSScreen } from "@/components/screens/POSScreen";
import { InvoiceScreen } from "@/components/screens/InvoiceScreen";
import { HeldOrdersScreen } from "@/components/screens/HeldOrdersScreen";
import { RecentOrdersScreen } from "@/components/screens/RecentOrdersScreen";
import { RefundScreen } from "@/components/screens/RefundScreen";
import { CloseShiftScreen } from "@/components/screens/CloseShiftScreen";
import AppDataProviders from "@/components/AppDataProviders";
import type { AppMode } from "@/components/ClientApp";

function lazyNamed(loader: () => Promise<Record<string, unknown>>, name: string) {
  return lazy(async () => ({ default: (await loader())[name] as ComponentType<any> }));
}

function ScreenLoading() {
  return <div className="min-h-screen bg-background" aria-live="polite" />;
}

const DashboardScreen = lazyNamed(() => import("@/components/screens/ManagerScreens"), "DashboardScreen");
const ManagerProducts = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerProducts");
const ManagerCategories = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerCategories");
const ManagerAddons = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerAddons");
const ManagerUsers = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerUsers");
const ManagerCashiers = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerCashiers");
const ManagerShifts = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerShifts");
const ManagerOrders = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerOrders");
const ManagerCustomers = lazyNamed(() => import("@/components/screens/ManagerScreens"), "ManagerCustomers");
const SettingsScreen = lazyNamed(() => import("@/components/screens/ManagerScreens"), "SettingsScreen");
const ReportsHub = lazy(() => import("@/components/screens/ReportsScreen"));
const ManagerSuppliers = lazyNamed(() => import("@/components/screens/Phase3Screens"), "ManagerSuppliers");
const ManagerPurchases = lazyNamed(() => import("@/components/screens/Phase3Screens"), "ManagerPurchases");
const ManagerInventory = lazyNamed(() => import("@/components/screens/Phase3Screens"), "ManagerInventory");
const ManagerRecipes = lazyNamed(() => import("@/components/screens/Phase3Screens"), "ManagerRecipes");
const ManagerAdjustments = lazyNamed(() => import("@/components/screens/Phase3Screens"), "ManagerAdjustments");
const ManagerWaste = lazyNamed(() => import("@/components/screens/Phase3Screens"), "ManagerWaste");
const ManagerExpenses = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerExpenses");
const ManagerBanks = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerBanks");
const ManagerChart = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerChart");
const ManagerJournal = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerJournal");
const ManagerSupplierPayments = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerSupplierPayments");
const ManagerEmployees = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerEmployees");
const ManagerPayroll = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerPayroll");
const ManagerFinReports = lazyNamed(() => import("@/components/screens/Phase4Screens"), "ManagerFinReports");
const ManagerZatcaHub = lazyNamed(() => import("@/components/screens/SprintFScreens"), "ManagerZatcaHub");
const ManagerActivity = lazyNamed(() => import("@/components/screens/SprintEScreens"), "ManagerActivity");
const ManagerAudit = lazyNamed(() => import("@/components/screens/SprintEScreens"), "ManagerAudit");
const ManagerReadiness = lazyNamed(() => import("@/components/screens/SprintEScreens"), "ManagerReadiness");
const ManagerExport = lazyNamed(() => import("@/components/screens/SprintEScreens"), "ManagerExport");
const ManagerBackup = lazyNamed(() => import("@/components/screens/SprintEScreens"), "ManagerBackup");
const ManagerNotifications = lazyNamed(() => import("@/components/screens/Phase6Screens"), "ManagerNotifications");
const ManagerImport = lazyNamed(() => import("@/components/screens/Phase6Screens"), "ManagerImport");
const ManagerPermissions = lazyNamed(() => import("@/components/screens/Phase6Screens"), "ManagerPermissions");
const ManagerQA = lazyNamed(() => import("@/components/screens/Phase6Screens"), "ManagerQA");
const ManagerBackend = lazyNamed(() => import("@/components/screens/Phase6Screens"), "ManagerBackend");

function AuthenticatedScreens({ mode }: { mode: AppMode }) {
  const { screen, user } = useApp();

  if (mode === "pos" && !POS_SCREENS.includes(screen)) return <AccessDeniedScreen />;
  if (mode === "admin" && !ADMIN_SCREENS.includes(screen)) return <AccessDeniedScreen />;
  if (user?.role === "cashier" && ADMIN_SCREENS.includes(screen)) return <AccessDeniedScreen />;

  switch (screen) {
    case "open_shift": return <OpenShiftScreen />;
    case "pos": return <POSScreen />;
    case "invoice": return <InvoiceScreen />;
    case "held": return <HeldOrdersScreen />;
    case "orders": return <RecentOrdersScreen />;
    case "refund": return <RefundScreen />;
    case "close_shift": return <CloseShiftScreen />;
    case "dashboard": return <DashboardScreen />;
    case "m_products": return <ManagerProducts />;
    case "m_categories": return <ManagerCategories />;
    case "m_addons": return <ManagerAddons />;
    case "m_users": return <ManagerUsers />;
    case "m_cashiers": return <ManagerCashiers />;
    case "m_shifts": return <ManagerShifts />;
    case "m_orders": return <ManagerOrders />;
    case "m_customers": return <ManagerCustomers />;
    case "m_reports": return <ReportsHub />;
    case "settings": return <SettingsScreen />;
    case "m_suppliers": return <ManagerSuppliers />;
    case "m_purchases": return <ManagerPurchases />;
    case "m_inventory": return <ManagerInventory />;
    case "m_recipes": return <ManagerRecipes />;
    case "m_adjustments": return <ManagerAdjustments />;
    case "m_waste": return <ManagerWaste />;
    case "m_expenses": return <ManagerExpenses />;
    case "m_banks": return <ManagerBanks />;
    case "m_chart": return <ManagerChart />;
    case "m_journal": return <ManagerJournal />;
    case "m_supplier_payments": return <ManagerSupplierPayments />;
    case "m_employees": return <ManagerEmployees />;
    case "m_payroll": return <ManagerPayroll />;
    case "m_finreports": return <ManagerFinReports />;
    case "m_zatca": return <ManagerZatcaHub />;
    case "m_readiness": return <ManagerReadiness />;
    case "m_activity": return <ManagerActivity />;
    case "m_audit": return <ManagerAudit />;
    case "m_notifications": return <ManagerNotifications />;
    case "m_import": return <ManagerImport />;
    case "m_export": return <ManagerExport />;
    case "m_backup": return <ManagerBackup />;
    case "m_permissions": return <ManagerPermissions />;
    case "m_qa": return <ManagerQA />;
    case "m_backend": return <ManagerBackend />;
    default: return <LoginSelectorScreen />;
  }
}

export default function AuthenticatedRouter({ mode = "root" }: { mode?: AppMode }) {
  return (
    <AppDataProviders mode={mode}>
      <Suspense fallback={<ScreenLoading />}>
        <AuthenticatedScreens mode={mode} />
      </Suspense>
    </AppDataProviders>
  );
}
