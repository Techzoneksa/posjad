"use client";

import { useApp } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Moon, Sun, Globe, LogOut, ChevronDown } from "lucide-react";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { COMPANY } from "@/lib/data";

export function TopBar({ title, right }: { title?: string; right?: React.ReactNode }) {
  const { lang, setLang, theme, setTheme, t, user, signOut, shift } = useApp();
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center justify-between gap-3 border-b bg-card/80 px-4 backdrop-blur md:px-6">
      <div className="flex items-center gap-3">
        <Logo className="h-9 w-auto" />
        <div className="hidden flex-col leading-tight sm:flex">
          <span className="text-sm font-semibold">{lang === "ar" ? COMPANY.brandAr : COMPANY.brandEn}</span>
          <span className="text-xs text-muted-foreground">{lang === "ar" ? COMPANY.branchAr : COMPANY.branchEn}</span>
        </div>
        {title ? <span className="hidden border-s ps-3 text-sm font-medium text-muted-foreground md:inline">{title}</span> : null}
      </div>
      <div className="flex items-center gap-2">
        {right}
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" size="sm" className="gap-1">
              <Globe className="h-4 w-4" />
              <span className="text-xs font-medium">{lang === "ar" ? "AR" : "EN"}</span>
              <ChevronDown className="h-3 w-3 opacity-60" />
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => setLang("ar")}>العربية</DropdownMenuItem>
            <DropdownMenuItem onClick={() => setLang("en")}>English</DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
        {user && (
          <div className="hidden items-center gap-2 rounded-full bg-secondary px-3 py-1.5 md:flex">
            <div className="h-2 w-2 rounded-full bg-success" />
            <span className="text-xs font-medium">{user.name}</span>
            {shift.open && <span className="text-[10px] text-muted-foreground">• {t.shifts}</span>}
          </div>
        )}
        {user && (
          <Button variant="ghost" size="icon" onClick={signOut} aria-label="signout"><LogOut className="h-4 w-4" /></Button>
        )}
      </div>
    </header>
  );
}
