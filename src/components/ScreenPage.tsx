import type { ReactNode } from "react";

import ClientApp from "@/components/ClientApp";
import type { Screen } from "@/lib/store";
import { cn } from "@/lib/utils";

type ScreenPageProps = {
  screen?: Screen;
  children?: ReactNode;
  title?: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export function ScreenPage({
  screen,
  children,
  title,
  description,
  actions,
  className,
}: ScreenPageProps) {
  if (screen) return <ClientApp initialScreen={screen} />;

  return (
    <main className={cn("min-h-screen bg-background text-foreground", className)}>
      {(title || description || actions) && (
        <header className="mx-auto flex w-full max-w-7xl items-start justify-between gap-4 px-4 py-6">
          <div className="min-w-0">
            {title && <h1 className="text-2xl font-bold tracking-tight">{title}</h1>}
            {description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
          </div>
          {actions && <div className="shrink-0">{actions}</div>}
        </header>
      )}
      {children}
    </main>
  );
}

export default ScreenPage;
