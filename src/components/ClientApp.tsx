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

function ScreenRouter({ initialScreen }: { initialScreen?: Screen }) {
  const { screen, setScreen, user } = useApp();

  useEffect(() => {
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
  }, [initialScreen, setScreen, user]);

  if (screen === "reset_password") return <ResetPasswordScreen />;

  if (!user) {
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

  return <AuthenticatedRouter />;
}

export default function ClientApp({ initialScreen }: { initialScreen?: Screen }) {
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
  const app = useMemo(() => <ScreenRouter initialScreen={initialScreen} />, [initialScreen]);

  return (
    <QueryClientProvider client={queryClient}>
      <AppProvider>
        <Suspense fallback={<LoadingScreen />}>{app}</Suspense>
        <Toaster position="top-center" />
      </AppProvider>
    </QueryClientProvider>
  );
}
