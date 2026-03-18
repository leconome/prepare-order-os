"use client";

import { useQuery } from "@tanstack/react-query";
import { useParams } from "next/navigation";
import { useEffect } from "react";
import { fetchOrder, fetchTenantSettings, formatCurrency } from "@/lib/api";

const PAYMENT_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Paye",
  partially_paid: "Partiellement paye",
  refunded: "Rembourse",
};

const SOURCE_LABELS: Record<string, string> = {
  comptoir: "Comptoir",
  telephone: "Telephone",
  site_web: "Site web",
};

function fmtDate(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(new Date(d));
}

function fmtDateTime(d: string | Date | null | undefined): string {
  if (!d) return "—";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

export default function OrderPrintPage() {
  const params = useParams();
  const orderId = params.id as string;

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  // Auto-trigger print once data is loaded
  useEffect(() => {
    if (order && tenant) {
      const timeout = setTimeout(() => window.print(), 300);
      return () => clearTimeout(timeout);
    }
  }, [order, tenant]);

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <p className="text-muted-foreground">Chargement...</p>
      </div>
    );
  }

  const items = order.items ?? [];
  const pickupTime = [order.pickupTimeStart, order.pickupTimeEnd]
    .filter(Boolean)
    .join(" – ");
  const hasDiscount =
    order.discountAmount && Number.parseFloat(order.discountAmount) > 0;

  return (
    <>
      {/* Print-specific styles */}
      <style>{`
        @media print {
          @page {
            size: A4;
            margin: 15mm;
          }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
        }
        @media screen {
          body { background: #f1f5f9; }
        }
      `}</style>

      <div className="max-w-[210mm] mx-auto bg-white p-8 print:p-0 print:shadow-none shadow-lg my-8 print:my-0 font-sans text-sm text-gray-900">
        {/* Header */}
        <div className="flex justify-between items-start border-b border-gray-200 pb-4 mb-6">
          <div>
            <h1 className="text-xl font-bold text-gray-900">
              {tenant?.name ?? "PrepareOS"}
            </h1>
            {order.pointOfSale && (
              <p className="text-gray-500 text-xs mt-0.5">
                {order.pointOfSale.name}
              </p>
            )}
          </div>
          <div className="text-right">
            <h2 className="text-lg font-bold">BON DE COMMANDE</h2>
            <p className="font-mono text-base font-semibold mt-0.5">
              #{order.ticketNumber}
            </p>
          </div>
        </div>

        {/* Info grid */}
        <div className="grid grid-cols-2 gap-6 mb-6">
          {/* Left: Client */}
          <div>
            <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">
              Client
            </h3>
            {order.client ? (
              <div>
                <p className="font-medium">{order.client.name}</p>
                {order.client.phone && (
                  <p className="text-gray-600">{order.client.phone}</p>
                )}
                {order.client.email && (
                  <p className="text-gray-600">{order.client.email}</p>
                )}
              </div>
            ) : (
              <p className="text-gray-400">—</p>
            )}
          </div>

          {/* Right: Order details */}
          <div className="text-right">
            <div className="space-y-0.5">
              <InfoRow label="Date" value={fmtDateTime(order.createdAt)} />
              <InfoRow label="Retrait" value={fmtDate(order.pickupDate)} />
              {pickupTime && <InfoRow label="Horaire" value={pickupTime} />}
              <InfoRow
                label="Source"
                value={SOURCE_LABELS[order.source] ?? order.source}
              />
              <InfoRow
                label="Paiement"
                value={
                  PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus
                }
              />
              {order.createdBy?.name && (
                <InfoRow label="Cree par" value={order.createdBy.name} />
              )}
            </div>
          </div>
        </div>

        {/* Notes */}
        {(order.clientNote || order.internalNote) && (
          <div className="mb-6 space-y-1">
            {order.clientNote && (
              <div className="bg-gray-50 border border-gray-200 rounded px-3 py-2 text-sm">
                <span className="font-medium">Note client : </span>
                {order.clientNote}
              </div>
            )}
            {order.internalNote && (
              <div className="bg-amber-50 border border-amber-200 rounded px-3 py-2 text-sm">
                <span className="font-medium">Note interne : </span>
                {order.internalNote}
              </div>
            )}
          </div>
        )}

        {/* Items table */}
        <table className="w-full mb-6">
          <thead>
            <tr className="border-b-2 border-gray-900">
              <th className="text-left py-2 text-xs font-semibold uppercase tracking-wide">
                Article
              </th>
              <th className="text-center py-2 text-xs font-semibold uppercase tracking-wide w-20">
                Qte
              </th>
              <th className="text-right py-2 text-xs font-semibold uppercase tracking-wide w-24">
                P.U.
              </th>
              <th className="text-right py-2 text-xs font-semibold uppercase tracking-wide w-24">
                Total
              </th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-b border-gray-100">
                <td className="py-2">
                  <span className={item.isMenu ? "font-medium" : ""}>
                    {item.productName}
                  </span>
                  {item.notes && (
                    <p className="text-xs text-gray-500 mt-0.5">
                      {item.notes}
                    </p>
                  )}
                  {item.isMenu &&
                    item.menuItems &&
                    item.menuItems.length > 0 && (
                      <div className="ml-3 mt-0.5">
                        {item.menuItems.map((mi) => (
                          <p
                            key={mi.id}
                            className="text-xs text-gray-500 leading-relaxed"
                          >
                            · {mi.quantity}x {mi.productName}
                          </p>
                        ))}
                      </div>
                    )}
                </td>
                <td className="py-2 text-center font-mono">
                  {Number(item.quantity)}
                </td>
                <td className="py-2 text-right font-mono">
                  {formatCurrency(item.unitPrice)}
                </td>
                <td className="py-2 text-right font-mono">
                  {formatCurrency(item.totalPrice)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* Totals */}
        <div className="flex justify-end">
          <div className="w-64 space-y-1">
            <TotalRow label="Sous-total" value={formatCurrency(order.subtotal)} />
            {hasDiscount && (
              <TotalRow
                label={`Remise${order.discountType === "percentage" ? ` (${order.discountValue}%)` : ""}`}
                value={`-${formatCurrency(order.discountAmount)}`}
                className="text-green-700"
              />
            )}
            {Number.parseFloat(order.taxTotal) > 0 && (
              <TotalRow label="Taxes" value={formatCurrency(order.taxTotal)} />
            )}
            <div className="border-t-2 border-gray-900 pt-1">
              <TotalRow
                label="Total"
                value={formatCurrency(order.total)}
                className="font-bold text-base"
              />
            </div>
            {Number.parseFloat(order.paidAmount) > 0 && (
              <TotalRow
                label="Paye"
                value={formatCurrency(order.paidAmount)}
                className="text-gray-500"
              />
            )}
            {order.paymentStatus === "partially_paid" && (
              <TotalRow
                label="Reste"
                value={formatCurrency(
                  String(
                    Math.max(
                      0,
                      Number.parseFloat(order.total) -
                        Number.parseFloat(order.paidAmount || "0"),
                    ),
                  ),
                )}
                className="text-amber-700 font-medium"
              />
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="mt-10 pt-4 border-t border-gray-200 text-center text-xs text-gray-400">
          {tenant?.name ?? "PrepareOS"} — Bon de commande #
          {order.ticketNumber} — {fmtDateTime(order.createdAt)}
        </div>
      </div>
    </>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <p className="text-sm">
      <span className="text-gray-500">{label} : </span>
      <span className="font-medium">{value}</span>
    </p>
  );
}

function TotalRow({
  label,
  value,
  className = "",
}: {
  label: string;
  value: string;
  className?: string;
}) {
  return (
    <div className={`flex justify-between text-sm ${className}`}>
      <span>{label}</span>
      <span className="font-mono">{value}</span>
    </div>
  );
}
