"use client";

import { useEffect, useState } from "react";
import { useApp } from "@/lib/store";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Moon, Sun, Globe, Monitor, ShieldCheck, ArrowLeft, ShieldAlert, Eye, EyeOff, Loader2, MailCheck } from "lucide-react";
import { COMPANY } from "@/lib/data";
import { COMPANY_LEGAL } from "@/lib/phase2Data";
import { signInCashier, signInAdmin } from "@/lib/authConfig";
import { bootstrapOwner, bootstrapStatus } from "@/lib/bootstrap.functions";
import { supabase } from "@/integrations/supabase/client";
import { useApiAction } from "@/lib/api-client";

/* ─────────── Password toggle input ─────────── */
function PasswordInput({ value, onChange, inputMode, className, id }: {
  value: string;
  onChange: (v: string) => void;
  inputMode?: "numeric" | undefined;
  className?: string;
  id?: string;
}) {
  const [show, setShow] = useState(false);
  return (
    <div className="relative">
      <Input
        id={id}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        type={show ? "text" : "password"}
        inputMode={inputMode}
        autoComplete="new-password"
        className={`${className || ""} pe-10`}
      />
      <button
        type="button"
        tabIndex={-1}
        onClick={() => setShow((s) => !s)}
        className="absolute end-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
        aria-label={show ? "Hide" : "Show"}
      >
        {show ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
      </button>
    </div>
  );
}

/* ─────────── Shared chrome ─────────── */
function AuthChrome({ children }: { children: React.ReactNode }) {
  const { lang, setLang, theme, setTheme } = useApp();
  return (
    <div className="relative min-h-screen overflow-hidden bg-background">
      <div className="pointer-events-none absolute inset-0 opacity-60">
        <div className="absolute -end-32 -top-32 h-96 w-96 rounded-full bg-primary/10 blur-3xl" />
        <div className="absolute -start-32 bottom-0 h-96 w-96 rounded-full bg-accent/30 blur-3xl" />
      </div>
      <div className="absolute end-4 top-4 z-10 flex gap-2">
        <Button variant="ghost" size="icon" onClick={() => setTheme(theme === "dark" ? "light" : "dark")} aria-label="theme">
          {theme === "dark" ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
        </Button>
        <Button variant="ghost" size="sm" className="gap-1" onClick={() => setLang(lang === "ar" ? "en" : "ar")}>
          <Globe className="h-4 w-4" />
          {lang === "ar" ? "EN" : "AR"}
        </Button>
      </div>
      <div className="relative mx-auto flex min-h-screen w-full max-w-5xl flex-col items-center justify-center px-4 py-8 sm:px-6">
        {children}
      </div>
    </div>
  );
}

/* ─────────── A) Selector ─────────── */
export function LoginSelectorScreen() {
  const { lang, setScreen } = useApp();
  const ar = lang === "ar";
  return (
    <AuthChrome>
      <div className="mb-8 flex flex-col items-center text-center">
        <Logo className="h-14 w-auto" />
        <h1 className="mt-4 text-2xl font-bold tracking-tight">{ar ? COMPANY.brandAr : COMPANY.brandEn}</h1>
        <p className="text-xs text-muted-foreground">{ar ? COMPANY_LEGAL.legalAr : COMPANY_LEGAL.legalEn}</p>
        <p className="text-xs text-muted-foreground">{ar ? COMPANY.branchAr : COMPANY.branchEn}</p>
      </div>
      <div className="grid w-full max-w-3xl gap-4 sm:grid-cols-2">
        <button
          onClick={() => setScreen("pos_login")}
          className="card-soft group flex flex-col items-start gap-3 p-6 text-start transition hover:border-primary hover:shadow-lg"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-primary/15 text-primary">
            <Monitor className="h-6 w-6" />
          </div>
          <div className="text-lg font-bold">{ar ? "دخول الكاشير POS" : "POS Login"}</div>
          <p className="text-sm text-muted-foreground">
            {ar ? "نظام نقاط البيع — للكاشير في الفرع" : "Point of sale — for branch cashiers"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
            {ar ? "متابعة" : "Continue"} →
          </span>
        </button>
        <button
          onClick={() => setScreen("dashboard_login")}
          className="card-soft group flex flex-col items-start gap-3 p-6 text-start transition hover:border-primary hover:shadow-lg"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-secondary text-foreground">
            <ShieldCheck className="h-6 w-6" />
          </div>
          <div className="text-lg font-bold">{ar ? "دخول الإدارة Dashboard" : "Dashboard Login"}</div>
          <p className="text-sm text-muted-foreground">
            {ar ? "لوحة تحكم الأونر والمدير المالي ومدير المطعم" : "Owner, finance and restaurant manager portal"}
          </p>
          <span className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-primary group-hover:underline">
            {ar ? "متابعة" : "Continue"} →
          </span>
        </button>
      </div>
      <p className="mt-8 text-center text-[11px] text-muted-foreground">JAAD © 2026</p>
    </AuthChrome>
  );
}

/* ─────────── B) POS Login ─────────── */
export function POSLoginScreen() {
  const { signIn, lang, setScreen } = useApp();
  const ar = lang === "ar";
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const acc = await signInCashier(u.trim(), p);
      signIn(acc.fullName || acc.username, "cashier");
    } catch (ex: any) {
      setErr(ar ? "بيانات الدخول غير صحيحة" : "Invalid login credentials");
      if (ex?.message === "Account disabled") {
        setErr(ar ? "تم تعطيل هذا الحساب" : "Account disabled");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthChrome>
      <div className="w-full max-w-md">
        <button onClick={() => setScreen("login_selector")} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {ar ? "رجوع" : "Back"}
        </button>
        <div className="card-soft p-7 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo className="h-14 w-auto" />
            <h1 className="mt-4 text-xl font-bold tracking-tight">{ar ? "دخول الكاشير" : "Cashier Login"}</h1>
            <p className="text-xs text-muted-foreground">
              {ar ? `نظام نقاط البيع — ${COMPANY.brandAr}` : `POS — ${COMPANY.brandEn}`}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "اسم المستخدم" : "Username"}</label>
              <Input value={u} onChange={e => setU(e.target.value)} autoFocus autoComplete="off" className="h-12 text-base" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "PIN" : "PIN"}</label>
              <PasswordInput
                value={p}
                onChange={setP}
                inputMode="numeric"
                className="h-12 text-base tracking-widest"
              />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" disabled={busy} className="h-14 w-full text-base font-bold">
              {busy ? <Loader2 className="h-5 w-5 animate-spin" /> : (ar ? "دخول" : "Sign in")}
            </Button>
          </form>
        </div>
      </div>
    </AuthChrome>
  );
}

/* ─────────── C) Dashboard Login ─────────── */
export function DashboardLoginScreen() {
  const { signIn, lang, setScreen } = useApp();
  const ar = lang === "ar";
  const [u, setU] = useState("");
  const [p, setP] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const [needsBootstrap, setNeedsBootstrap] = useState<boolean | null>(null);
  const [mode, setMode] = useState<"signin" | "forgot">("signin");
  const [resetEmail, setResetEmail] = useState("");
  const [resetBusy, setResetBusy] = useState(false);
  const [resetMsg, setResetMsg] = useState("");
  const [resetErr, setResetErr] = useState("");
  const getBootstrapStatus = useApiAction(bootstrapStatus);

  useEffect(() => {
    void getBootstrapStatus({ data: undefined as any })
      .then((s) => setNeedsBootstrap(!s.hasUsers))
      .catch(() => setNeedsBootstrap(false));
  }, [getBootstrapStatus]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      const acc = await signInAdmin(u.trim(), p);
      signIn(acc.fullName || acc.username, acc.role);
    } catch (ex: any) {
      setErr(ar ? "بيانات الدخول غير صحيحة" : "Invalid login credentials");
      if (ex?.message === "Account disabled") {
        setErr(ar ? "تم تعطيل هذا الحساب" : "Account disabled");
      }
    } finally {
      setBusy(false);
    }
  };

  const submitReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (resetBusy) return;
    setResetBusy(true);
    setResetMsg("");
    setResetErr("");
    const email = resetEmail.trim();
    if (!email) {
      setResetErr(ar ? "أدخل البريد الإلكتروني" : "Enter your email");
      setResetBusy(false);
      return;
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${window.location.origin}/reset-password`,
    });
    setResetBusy(false);
    if (error) {
      setResetErr(error.message);
      return;
    }
    setResetMsg(
      ar
        ? "تم إرسال رابط إعادة التعيين إلى بريدك الإلكتروني. تحقق من البريد الوارد و الـ Spam."
        : "Reset link sent. Check your inbox (and spam folder).",
    );
  };

  if (needsBootstrap) return <BootstrapOwnerScreen onDone={() => setNeedsBootstrap(false)} />;

  return (
    <AuthChrome>
      <div className="w-full max-w-md">
        <button
          onClick={() => (mode === "forgot" ? setMode("signin") : setScreen("login_selector"))}
          className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {ar ? "رجوع" : "Back"}
        </button>
        <div className="card-soft p-7 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo className="h-14 w-auto" />
            <h1 className="mt-4 text-xl font-bold tracking-tight">
              {mode === "forgot"
                ? (ar ? "نسيت كلمة المرور" : "Forgot password")
                : (ar ? "دخول لوحة الإدارة" : "Dashboard Login")}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ar ? `JAAD CLOUD` : `${COMPANY.brandEn} control panel`}
            </p>
            <p className="mt-2 text-[11px] font-medium">{ar ? COMPANY_LEGAL.legalAr : COMPANY_LEGAL.legalEn}</p>
          </div>

          {mode === "signin" ? (
            <form onSubmit={submit} className="space-y-4" autoComplete="off">
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{ar ? "البريد الإلكتروني" : "Email"}</label>
                <Input value={u} onChange={e => setU(e.target.value)} type="email" autoFocus autoComplete="off" className="h-11" />
              </div>
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <label className="text-xs font-medium">{ar ? "كلمة المرور" : "Password"}</label>
                  <button
                    type="button"
                    onClick={() => { setResetEmail(u); setMode("forgot"); }}
                    className="text-[11px] font-medium text-primary hover:underline"
                  >
                    {ar ? "نسيت كلمة المرور؟" : "Forgot password?"}
                  </button>
                </div>
                <PasswordInput value={p} onChange={setP} className="h-11" />
              </div>
              {err && <p className="text-xs text-destructive">{err}</p>}
              <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
                {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (ar ? "دخول" : "Sign in")}
              </Button>
            </form>
          ) : (
            <form onSubmit={submitReset} className="space-y-4" autoComplete="off">
              <p className="text-xs text-muted-foreground">
                {ar
                  ? "أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور."
                  : "Enter your email and we'll send you a link to reset your password."}
              </p>
              <div className="space-y-1.5">
                <label className="text-xs font-medium">{ar ? "البريد الإلكتروني" : "Email"}</label>
                <Input
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  type="email"
                  autoFocus
                  autoComplete="email"
                  className="h-11"
                />
              </div>
              {resetErr && <p className="text-xs text-destructive">{resetErr}</p>}
              {resetMsg && (
                <p className="flex items-start gap-2 rounded-md bg-primary/10 p-3 text-xs text-foreground">
                  <MailCheck className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
                  <span>{resetMsg}</span>
                </p>
              )}
              <Button type="submit" disabled={resetBusy} className="h-12 w-full text-base font-semibold">
                {resetBusy ? <Loader2 className="h-4 w-4 animate-spin" /> : (ar ? "إرسال رابط الإعادة" : "Send reset link")}
              </Button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="block w-full text-center text-xs text-muted-foreground hover:text-foreground"
              >
                {ar ? "العودة لتسجيل الدخول" : "Back to sign in"}
              </button>
            </form>
          )}
        </div>
      </div>
    </AuthChrome>
  );
}

/* ─────────── C.bis) First-run owner bootstrap ─────────── */
function BootstrapOwnerScreen({ onDone }: { onDone: () => void }) {
  const { lang } = useApp();
  const ar = lang === "ar";
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [err, setErr] = useState("");
  const [busy, setBusy] = useState(false);
  const createOwner = useApiAction(bootstrapOwner);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setErr("");
    try {
      await createOwner({ data: { fullName, username, email, password } });
      onDone();
    } catch (ex: any) {
      setErr(ex?.message || (ar ? "تعذر إنشاء الحساب" : "Failed to create account"));
    } finally {
      setBusy(false);
    }
  };

  return (
    <AuthChrome>
      <div className="w-full max-w-md">
        <div className="card-soft p-7 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo className="h-14 w-auto" />
            <h1 className="mt-4 text-xl font-bold tracking-tight">
              {ar ? "إنشاء حساب الأونر" : "Create Owner Account"}
            </h1>
            <p className="text-xs text-muted-foreground">
              {ar
                ? "لم يتم العثور على أي مستخدم. أنشئ حساب الأونر للبدء."
                : "No users yet. Create the owner account to get started."}
            </p>
          </div>
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "الاسم الكامل" : "Full name"}</label>
              <Input value={fullName} onChange={e => setFullName(e.target.value)} autoFocus required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "اسم المستخدم" : "Username"}</label>
              <Input value={username} onChange={e => setUsername(e.target.value)} required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "البريد الإلكتروني" : "Email"}</label>
              <Input value={email} onChange={e => setEmail(e.target.value)} type="email" required className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "كلمة المرور (8+ أحرف)" : "Password (8+ chars)"}</label>
              <PasswordInput value={password} onChange={setPassword} className="h-11" />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (ar ? "إنشاء الحساب" : "Create account")}
            </Button>
          </form>
        </div>
      </div>
    </AuthChrome>
  );
}

/* ─────────── C.ter) Reset password ─────────── */
export function ResetPasswordScreen() {
  const { lang, setScreen } = useApp();
  const ar = lang === "ar";
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const [done, setDone] = useState(false);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (busy) return;
    setErr("");
    setDone(false);
    if (password.length < 8) {
      setErr(ar ? "كلمة المرور يجب أن تكون 8 أحرف على الأقل" : "Password must be at least 8 characters");
      return;
    }
    if (password !== confirm) {
      setErr(ar ? "كلمتا المرور غير متطابقتين" : "Passwords do not match");
      return;
    }
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) {
      setErr(error.message);
      return;
    }
    setDone(true);
  };

  return (
    <AuthChrome>
      <div className="w-full max-w-md">
        <button onClick={() => setScreen("dashboard_login")} className="mb-3 inline-flex items-center gap-1 text-xs text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-3.5 w-3.5 rtl:rotate-180" />
          {ar ? "رجوع" : "Back"}
        </button>
        <div className="card-soft p-7 sm:p-8">
          <div className="mb-6 flex flex-col items-center text-center">
            <Logo className="h-14 w-auto" />
            <h1 className="mt-4 text-xl font-bold tracking-tight">
              {ar ? "إعادة تعيين كلمة المرور" : "Reset password"}
            </h1>
            <p className="text-xs text-muted-foreground">JAAD CLOUD</p>
          </div>
          <form onSubmit={submit} className="space-y-4" autoComplete="off">
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "كلمة المرور الجديدة" : "New password"}</label>
              <PasswordInput value={password} onChange={setPassword} className="h-11" />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium">{ar ? "تأكيد كلمة المرور" : "Confirm password"}</label>
              <PasswordInput value={confirm} onChange={setConfirm} className="h-11" />
            </div>
            {err && <p className="text-xs text-destructive">{err}</p>}
            {done && (
              <p className="rounded-md bg-primary/10 p-3 text-xs text-foreground">
                {ar ? "تم تحديث كلمة المرور. يمكنك تسجيل الدخول الآن." : "Password updated. You can sign in now."}
              </p>
            )}
            <Button type="submit" disabled={busy} className="h-12 w-full text-base font-semibold">
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : (ar ? "حفظ كلمة المرور" : "Save password")}
            </Button>
          </form>
        </div>
      </div>
    </AuthChrome>
  );
}

/* ─────────── D) Access Denied ─────────── */
export function AccessDeniedScreen() {
  const { lang, user, setScreen, shift, signOut } = useApp();
  const ar = lang === "ar";
  const backToPOS = () => setScreen(shift.open ? "pos" : "open_shift");
  return (
    <AuthChrome>
      <div className="card-soft w-full max-w-md p-8 text-center">
        <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-full bg-destructive/10 text-destructive">
          <ShieldAlert className="h-7 w-7" />
        </div>
        <h1 className="text-xl font-bold">{ar ? "غير مصرح لك بالدخول" : "Access denied"}</h1>
        <p className="mt-2 text-sm text-muted-foreground">
          {ar
            ? "هذه الصفحة مخصصة للإدارة فقط. حسابك كـ كاشير لا يملك صلاحية الوصول إليها."
            : "This page is restricted to admin users. Your cashier account does not have access."}
        </p>
        <div className="mt-6 flex flex-col gap-2">
          {user?.role === "cashier" && (
            <Button onClick={backToPOS} className="h-11 w-full font-semibold">
              {ar ? "العودة إلى شاشة الكاشير" : "Back to POS"}
            </Button>
          )}
          <Button variant="outline" onClick={signOut} className="h-11 w-full">
            {ar ? "تسجيل الخروج" : "Sign out"}
          </Button>
        </div>
      </div>
    </AuthChrome>
  );
}
