"use client";

import { Suspense, useEffect, useMemo, useState } from "react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";

import AuthenticatedRouter from "@/components/AuthenticatedRouter";
import {
  AccessDeniedScreen,
  DashboardLoginScreen,
  LoginSelectorScreen,
  POSLoginScreen,
  ResetPasswordScreen,
} from "@/components/screens/AuthScreens";
import { Toaster } from "@/components/ui/sonner";
import { AppProvider, ADMIN_SCREENS, POS_SCREENS, useApp, type Screen } from "@/lib/store";

export type AppMode = "root" | "pos" | "admin";

const AUTH_SCREENS: Screen[] = [
  "login_selector",
  "pos_login",
  "dashboard_login",
  "access_denied",
  "reset_password",
  "login",
];

function LoadingScreen() {
  return <main className="min-h-screen bg-background text-foreground" aria-live="polite" />;
}

function unauthenticatedScreenFor(screen: Screen): Screen {
  if (AUTH_SCREENS.includes(screen)) return screen;
  if (ADMIN_SCREENS.includes(screen)) return "dashboard_login";
  if (POS_SCREENS.includes(screen)) return "pos_login";
  return "login_selector";
}

function ScreenRouter({ initialScreen, mode }: { initialScreen?: Screen; mode: AppMode }) {
  const { screen, setScreen, user } = useApp();

  useEffect(() => {
    if (mode === "pos") {
      if (!user) {
        setScreen("pos_login");
        return;
      }
      if (user.role !== "cashier") {
        setScreen("access_denied");
        return;
      }
      if (initialScreen && POS_SCREENS.includes(initialScreen)) setScreen(initialScreen);
      return;
    }

    if (mode === "admin") {
      if (!user) {
        setScreen("dashboard_login");
        return;
      }
      if (user.role === "cashier") {
        setScreen("access_denied");
        return;
      }
      if (initialScreen && ADMIN_SCREENS.includes(initialScreen)) setScreen(initialScreen);
      return;
    }

    if (!initialScreen) return;
    if (initialScreen === "reset_password") {
      setScreen("reset_password");
      return;
    }
    if (!user) {
      setScreen(unauthenticatedScreenFor(initialScreen));
      return;
    }
    if (!AUTH_SCREENS.includes(initialScreen)) setScreen(initialScreen);
  }, [initialScreen, mode, setScreen, user]);

  if (screen === "reset_password") return <ResetPasswordScreen />;

  if (!user) {
    if (mode === "pos") return <POSLoginScreen />;
    if (mode === "admin") return <DashboardLoginScreen />;

    switch (screen) {
      case "pos_login":
        return <POSLoginScreen />;
      case "dashboard_login":
        return <DashboardLoginScreen />;
      case "access_denied":
        return <AccessDeniedScreen />;
      case "login_selector":
      case "login":
      default:
        return <LoginSelectorScreen />;
    }
  }

  if (mode === "pos" && user.role !== "cashier") return <AccessDeniedScreen />;
  if (mode === "admin" && user.role === "cashier") return <AccessDeniedScreen />;

  return <AuthenticatedRouter mode={mode} />;
}

export default function ClientApp({
  initialScreen,
  mode = "root",
}: {
  initialScreen?: Screen;
  mode?: AppMode;
}) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            refetchOnWindowFocus: false,
            retry: 1,
          },
          mutations: {
            retry: 0,
          },
        },
      }),
  );
  const app = useMemo(
    () => <ScreenRouter initialScreen={initialScreen} mode={mode} />,
    [initialScreen, mode],
  );

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Suspense fallback={<LoadingScreen />}>{app}</Suspense>
        <Toaster position="top-center" />
      </AppProvider>
    </QueryClientProvider>
  );
}
