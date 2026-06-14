"use client";

import { useEffect, useState } from "react";
import QRCode from "qrcode";
import { useApp, type CompletedOrder } from "@/lib/store";
import { useSettings } from "@/lib/settings-context";
import { TopBar } from "@/components/TopBar";
import { Button } from "@/components/ui/button";
import { Logo } from "@/components/Logo";
import { PAYMENT_METHODS, ORDER_TYPES } from "@/lib/data";
import { Printer, Plus } from "lucide-react";
import { getZatcaForInvoice } from "@/lib/zatca.functions";
import { useApiAction } from "@/lib/api-client";

export function InvoiceScreen({ order: orderProp }: { order?: CompletedOrder } = {}) {
  const { lastOrder, t, lang, setScreen } = useApp();
  const { settings } = useSettings();
  const order = orderProp || lastOrder;
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [zatcaStatus, setZatcaStatus] = useState<string | null>(null);
  const loadZatcaInvoice = useApiAction(getZatcaForInvoice);
  useEffect(() => {
    if (!order?.invoiceId) return;
    let cancelled = false;
    loadZatcaInvoice({ data: { invoice_id: order.invoiceId } })
      .then(async (z) => {
        if (cancelled || !z?.qr_payload) return;
        setZatcaStatus(z.status ?? null);
        const url = await QRCode.toDataURL(z.qr_payload, { errorCorrectionLevel: "M", margin: 1, width: 160 });
        if (!cancelled) setQrDataUrl(url);
      })
      .catch(() => { /* QR optional */ });
    return () => { cancelled = true; };
  }, [loadZatcaInvoice, order?.invoiceId]);
  if (!order) {
    return (
      <div className="min-h-screen bg-background">
        <TopBar />
        <div className="p-12 text-center text-sm text-muted-foreground">No invoice.</div>
      </div>
    );
  }
  const orderTypeObj = ORDER_TYPES.find(o => o.id === order.orderType)!;
  const paymentObj = PAYMENT_METHODS.find(p => p.id === order.payment);
  const vatRate = settings.vat_rate ?? 0.15;
  const vatPortion = order.total - order.total / (1 + vatRate);
  const net = order.total - vatPortion;
  const date = new Date(order.time);
  const brand = lang === "ar" ? settings.brand_name_ar : settings.brand_name_en;
  const branch = lang === "ar" ? settings.branch_ar : settings.branch_en;
  const legal = lang === "ar" ? settings.legal_name_ar : settings.legal_name_en;
  const footer = lang === "ar" ? settings.footer_note_ar : settings.footer_note_en;

  return (
    <div className="min-h-screen bg-background">
      <TopBar title={t.invoice} />
      <div className="mx-auto max-w-3xl px-4 py-6">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 no-print">
          <div className="flex items-center gap-2 rounded-full bg-success/15 px-4 py-1.5 text-success">
            <span className="h-2 w-2 rounded-full bg-success" />
            <span className="text-sm font-semibold">{t.completed} • {order.invoice}</span>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => window.print()} className="gap-1.5"><Printer className="h-4 w-4" />{t.print}</Button>
            <Button onClick={() => setScreen("pos")} className="gap-1.5"><Plus className="h-4 w-4" />{t.newOrder}</Button>
          </div>
        </div>

        <div className="print-area receipt mx-auto w-[320px] rounded-lg p-5 shadow-md" dir="rtl">
          <div className="flex flex-col items-center text-center">
            <Logo className="h-12 w-auto" monochrome />
            <div className="mt-2 text-[11px] font-semibold">{brand}</div>
            {legal && <div className="text-[9px] opacity-70">{legal}</div>}
            {branch && <div className="text-[10px] opacity-80">{branch}</div>}
            {settings.vat_number && <div className="text-[10px] opacity-80">VAT #: {settings.vat_number}</div>}
            {settings.commercial_registration && <div className="text-[10px] opacity-80">CR: {settings.commercial_registration}</div>}
          </div>
          <div className="my-3 border-t border-dashed border-neutral-400" />
          <div className="space-y-0.5 text-[11px]">
            <Row k={lang === "ar" ? "رقم الطلب" : "Order #"} v={order.number} />
            <Row k={lang === "ar" ? "رقم الفاتورة" : "Invoice #"} v={order.invoice} />
            <Row k={lang === "ar" ? "التاريخ" : "Date"} v={date.toLocaleString(lang === "ar" ? "ar-SA-u-ca-gregory" : "en-GB")} />
            <Row k={lang === "ar" ? "الكاشير" : "Cashier"} v={order.cashier} />
            <Row k={lang === "ar" ? "نوع الطلب" : "Order type"} v={lang === "ar" ? orderTypeObj.ar : orderTypeObj.en} />
            {order.customerPhone && <Row k={lang === "ar" ? "جوال العميل" : "Customer phone"} v={order.customerPhone} />}
          </div>
          <div className="my-3 border-t border-dashed border-neutral-400" />
          <table className="w-full text-[11px]">
            <thead>
              <tr className="border-b border-dashed border-neutral-400">
                <th className="py-1 text-end">{lang === "ar" ? "الصنف" : "Item"}</th>
                <th className="text-center">{lang === "ar" ? "الكمية" : "Qty"}</th>
                <th className="text-start">{lang === "ar" ? "الإجمالي" : "Total"}</th>
              </tr>
            </thead>
            <tbody>
              {order.items.map(it => {
                const addonsP = it.addons.reduce((s, a) => s + (a.price || 0), 0);
                const line = (it.product.price + addonsP) * it.qty;
                return (
                  <tr key={it.uid} className="align-top">
                    <td className="py-1 text-end">
                      {lang === "ar" ? it.product.ar : it.product.en}
                      <div className="text-[9px] opacity-70">
                        {it.spice ? `(${lang === "ar" ? it.spice.ar : it.spice.en}) ` : ""}
                        {it.removals.map(r => lang === "ar" ? r.ar : r.en).join("، ")}
                        {it.addons.length ? ` + ${it.addons.map(a => lang === "ar" ? a.ar : a.en).join("، ")}` : ""}
                      </div>
                    </td>
                    <td className="text-center">{it.qty}</td>
                    <td className="text-start tabular-nums">{line.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
          <div className="my-3 border-t border-dashed border-neutral-400" />
          <div className="space-y-0.5 text-[11px]">
            <Row k={lang === "ar" ? "المجموع الفرعي" : "Subtotal"} v={`${order.subtotal.toFixed(2)} ر.س`} />
            {order.discount > 0 && <Row k={lang === "ar" ? "الخصم" : "Discount"} v={`- ${order.discount.toFixed(2)} ر.س`} />}
            <Row k={lang === "ar" ? "صافي قبل الضريبة" : "Net before VAT"} v={`${net.toFixed(2)} ر.س`} />
            <Row k={lang === "ar" ? `ضريبة القيمة المضافة ${(vatRate * 100).toFixed(0)}%` : `VAT ${(vatRate * 100).toFixed(0)}%`} v={`${vatPortion.toFixed(2)} ر.س`} />
            <div className="mt-1 flex justify-between border-t border-neutral-700 pt-1 text-[13px] font-bold">
              <span>{lang === "ar" ? "الإجمالي" : "Total"}</span>
              <span className="tabular-nums">{order.total.toFixed(2)} ر.س</span>
            </div>
            <Row k={lang === "ar" ? "طريقة الدفع" : "Payment"} v={lang === "ar" ? (paymentObj?.ar || "") : (paymentObj?.en || "")} />
          </div>

          <div className="my-3 flex flex-col items-center gap-1">
            {qrDataUrl ? (
              <>
                <img src={qrDataUrl} alt="ZATCA QR" className="h-24 w-24" />
                <div className="text-[9px] opacity-70">
                  {zatcaStatus === "synced"
                    ? (lang === "ar" ? "تم الإرسال إلى ZATCA" : "Sent to ZATCA")
                    : (lang === "ar" ? "TLV QR — وضع المحاكاة" : "TLV QR — simulation mode")}
                </div>
              </>
            ) : (
              <>
                <div className="grid h-20 w-20 place-items-center rounded border border-neutral-400 text-[8px] text-neutral-500">
                  QR
                </div>
                <div className="text-[9px] opacity-70">{lang === "ar" ? "بانتظار توليد QR" : "QR pending"}</div>
              </>
            )}
          </div>
          {footer && <div className="text-center text-[10px] font-semibold">{footer}</div>}
          <div className="mt-1 text-center text-[8px] italic opacity-60">{t.demo}</div>
        </div>
      </div>
    </div>
  );
}

function Row({ k, v }: { k: string; v: string }) {
  return <div className="flex justify-between"><span className="opacity-80">{k}</span><span className="tabular-nums">{v}</span></div>;
}
