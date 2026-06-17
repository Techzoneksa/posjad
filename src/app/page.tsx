import Link from "next/link";

export default function HomePage() {
  return (
    <main className="relative min-h-screen overflow-hidden bg-background text-foreground">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -start-32 bottom-0 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>

      <section className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-8 text-center sm:px-6">
        <div className="mb-8 flex flex-col items-center">
          <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary text-2xl font-bold text-primary-foreground">
            JC
          </div>
          <h1 className="mt-4 text-2xl font-bold tracking-tight">JAAD CLOUD</h1>
          <p className="text-sm text-muted-foreground">نظام نقاط البيع والمحاسبة السحابي</p>
        </div>

        <div className="grid w-full max-w-3xl gap-4 text-start sm:grid-cols-2">
          <Link
            href="/pos/login"
            className="card-soft group flex min-h-44 flex-col justify-between gap-4 p-6 transition hover:border-primary hover:shadow-lg"
          >
            <div>
              <div className="text-lg font-bold">دخول الكاشير POS</div>
              <p className="mt-2 text-sm text-muted-foreground">مسار مستقل للبيع باستخدام اسم المستخدم و PIN فقط.</p>
            </div>
            <span className="text-xs font-medium text-primary group-hover:underline">متابعة {"->"}</span>
          </Link>

          <Link
            href="/admin/login"
            className="card-soft group flex min-h-44 flex-col justify-between gap-4 p-6 transition hover:border-primary hover:shadow-lg"
          >
            <div>
              <div className="text-lg font-bold">لوحة الإدارة Dashboard</div>
              <p className="mt-2 text-sm text-muted-foreground">مسار الإدارة باستخدام البريد الإلكتروني وكلمة المرور.</p>
            </div>
            <span className="text-xs font-medium text-primary group-hover:underline">متابعة {"->"}</span>
          </Link>
        </div>

        <p className="mt-8 text-[11px] text-muted-foreground">JAAD © 2026</p>
      </section>
    </main>
  );
}
