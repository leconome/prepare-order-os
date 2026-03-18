"use client";

import type { OrderWithItems, Tenant } from "@prepareos/data";
import {
  Document,
  Page,
  pdf,
  StyleSheet,
  Text,
  View,
} from "@react-pdf/renderer";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Download, Loader2 } from "lucide-react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";
import { fetchOrder, fetchTenantSettings, formatCurrency } from "@/lib/api";

// ─── Helpers ────────────────────────────────────────────────

const PAYMENT_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Payé",
  partially_paid: "Partiellement payé",
  refunded: "Remboursé",
};

const SOURCE_LABELS: Record<string, string> = {
  comptoir: "Comptoir",
  telephone: "Téléphone",
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

// ─── PDF Styles ─────────────────────────────────────────────

const s = StyleSheet.create({
  page: {
    padding: 40,
    fontSize: 10,
    fontFamily: "Helvetica",
    color: "#111827",
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    borderBottomWidth: 1,
    borderBottomColor: "#e5e7eb",
    paddingBottom: 12,
    marginBottom: 20,
  },
  tenantName: { fontSize: 16, fontFamily: "Helvetica-Bold" },
  posName: { fontSize: 8, color: "#6b7280", marginTop: 2 },
  titleBlock: { textAlign: "right" },
  title: { fontSize: 14, fontFamily: "Helvetica-Bold" },
  ticketNumber: {
    fontSize: 12,
    fontFamily: "Helvetica-Bold",
    marginTop: 2,
  },
  infoGrid: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 20,
  },
  infoCol: { width: "48%" },
  sectionLabel: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    color: "#6b7280",
    textTransform: "uppercase",
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  clientName: { fontFamily: "Helvetica-Bold", marginBottom: 2 },
  clientDetail: { color: "#4b5563", marginBottom: 1 },
  infoRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginBottom: 2,
  },
  infoLabel: { color: "#6b7280", marginRight: 4 },
  infoValue: { fontFamily: "Helvetica-Bold" },
  noteBox: {
    backgroundColor: "#f9fafb",
    borderWidth: 1,
    borderColor: "#e5e7eb",
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  noteBoxAmber: {
    backgroundColor: "#fffbeb",
    borderWidth: 1,
    borderColor: "#fde68a",
    borderRadius: 3,
    padding: 8,
    marginBottom: 6,
  },
  noteLabel: { fontFamily: "Helvetica-Bold" },
  // Table
  tableHeader: {
    flexDirection: "row",
    borderBottomWidth: 2,
    borderBottomColor: "#111827",
    paddingBottom: 4,
    marginBottom: 4,
  },
  tableHeaderCell: {
    fontSize: 8,
    fontFamily: "Helvetica-Bold",
    textTransform: "uppercase",
    letterSpacing: 0.5,
  },
  tableRow: {
    flexDirection: "row",
    borderBottomWidth: 0.5,
    borderBottomColor: "#f3f4f6",
    paddingVertical: 4,
  },
  colArticle: { flex: 1 },
  colQty: { width: 50, textAlign: "center" },
  colPrice: { width: 65, textAlign: "right" },
  colTotal: { width: 65, textAlign: "right" },
  menuItem: { fontSize: 8, color: "#6b7280", marginLeft: 8, marginTop: 1 },
  itemNotes: { fontSize: 8, color: "#6b7280", marginTop: 1 },
  menuLabel: { fontFamily: "Helvetica-Bold" },
  // Totals
  totalsBlock: { alignItems: "flex-end", marginTop: 12 },
  totalsInner: { width: 180 },
  totalRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 2,
  },
  totalDivider: {
    borderTopWidth: 2,
    borderTopColor: "#111827",
    paddingTop: 4,
  },
  totalBold: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  totalGreen: { color: "#15803d" },
  totalAmber: { color: "#b45309", fontFamily: "Helvetica-Bold" },
  totalMuted: { color: "#6b7280" },
  // Footer
  footer: {
    marginTop: 30,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: "#e5e7eb",
    textAlign: "center",
    fontSize: 8,
    color: "#9ca3af",
  },
});

// ─── PDF Document ───────────────────────────────────────────

function OrderPdf({
  order,
  tenant,
}: {
  order: OrderWithItems;
  tenant?: Tenant | null;
}) {
  const items = order.items ?? [];
  const pickupTime = [order.pickupTimeStart, order.pickupTimeEnd]
    .filter(Boolean)
    .join(" – ");
  const hasDiscount =
    order.discountAmount && Number.parseFloat(order.discountAmount) > 0;

  return (
    <Document>
      <Page size="A4" style={s.page}>
        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.tenantName}>{tenant?.name ?? "PrepareOS"}</Text>
            {order.pointOfSale && (
              <Text style={s.posName}>{order.pointOfSale.name}</Text>
            )}
          </View>
          <View style={s.titleBlock}>
            <Text style={s.title}>BON DE COMMANDE</Text>
            <Text style={s.ticketNumber}>#{order.ticketNumber}</Text>
          </View>
        </View>

        {/* Info grid */}
        <View style={s.infoGrid}>
          <View style={s.infoCol}>
            <Text style={s.sectionLabel}>Client</Text>
            {order.client ? (
              <View>
                <Text style={s.clientName}>{order.client.name}</Text>
                {order.client.phone && (
                  <Text style={s.clientDetail}>{order.client.phone}</Text>
                )}
                {order.client.email && (
                  <Text style={s.clientDetail}>{order.client.email}</Text>
                )}
              </View>
            ) : (
              <Text style={s.clientDetail}>—</Text>
            )}
          </View>
          <View style={s.infoCol}>
            <InfoRow label="Date" value={fmtDateTime(order.createdAt)} />
            <InfoRow label="Retrait" value={fmtDate(order.pickupDate)} />
            {pickupTime && <InfoRow label="Horaire" value={pickupTime} />}
            <InfoRow
              label="Source"
              value={SOURCE_LABELS[order.source] ?? order.source}
            />
            <InfoRow
              label="Paiement"
              value={PAYMENT_LABELS[order.paymentStatus] ?? order.paymentStatus}
            />
            {order.createdBy?.name && (
              <InfoRow label="Créé par" value={order.createdBy.name} />
            )}
          </View>
        </View>

        {/* Notes */}
        {order.clientNote && (
          <View style={s.noteBox}>
            <Text>
              <Text style={s.noteLabel}>Note client : </Text>
              {order.clientNote}
            </Text>
          </View>
        )}
        {order.internalNote && (
          <View style={s.noteBoxAmber}>
            <Text>
              <Text style={s.noteLabel}>Note interne : </Text>
              {order.internalNote}
            </Text>
          </View>
        )}

        {/* Items table */}
        <View style={s.tableHeader}>
          <Text style={[s.tableHeaderCell, s.colArticle]}>Article</Text>
          <Text style={[s.tableHeaderCell, s.colQty]}>Qté</Text>
          <Text style={[s.tableHeaderCell, s.colPrice]}>P.U.</Text>
          <Text style={[s.tableHeaderCell, s.colTotal]}>Total</Text>
        </View>
        {items.map((item) => (
          <View key={item.id} style={s.tableRow}>
            <View style={s.colArticle}>
              <Text style={item.isMenu ? s.menuLabel : undefined}>
                {item.productName}
              </Text>
              {item.notes && <Text style={s.itemNotes}>{item.notes}</Text>}
              {item.isMenu &&
                item.menuItems?.map((mi) => (
                  <Text key={mi.id} style={s.menuItem}>
                    · {mi.quantity}x {mi.productName}
                  </Text>
                ))}
            </View>
            <Text style={s.colQty}>{Number(item.quantity)}</Text>
            <Text style={s.colPrice}>{formatCurrency(item.unitPrice)}</Text>
            <Text style={s.colTotal}>{formatCurrency(item.totalPrice)}</Text>
          </View>
        ))}

        {/* Totals */}
        <View style={s.totalsBlock}>
          <View style={s.totalsInner}>
            <View style={s.totalRow}>
              <Text>Sous-total</Text>
              <Text>{formatCurrency(order.subtotal)}</Text>
            </View>
            {hasDiscount && (
              <View style={s.totalRow}>
                <Text style={s.totalGreen}>
                  Remise
                  {order.discountType === "percentage"
                    ? ` (${order.discountValue}%)`
                    : ""}
                </Text>
                <Text style={s.totalGreen}>
                  -{formatCurrency(order.discountAmount)}
                </Text>
              </View>
            )}
            {Number.parseFloat(order.taxTotal) > 0 && (
              <View style={s.totalRow}>
                <Text>Taxes</Text>
                <Text>{formatCurrency(order.taxTotal)}</Text>
              </View>
            )}
            <View style={[s.totalRow, s.totalDivider]}>
              <Text style={s.totalBold}>Total</Text>
              <Text style={s.totalBold}>{formatCurrency(order.total)}</Text>
            </View>
            {Number.parseFloat(order.paidAmount) > 0 && (
              <View style={s.totalRow}>
                <Text style={s.totalMuted}>Payé</Text>
                <Text style={s.totalMuted}>
                  {formatCurrency(order.paidAmount)}
                </Text>
              </View>
            )}
            {order.paymentStatus === "partially_paid" && (
              <View style={s.totalRow}>
                <Text style={s.totalAmber}>Reste</Text>
                <Text style={s.totalAmber}>
                  {formatCurrency(
                    String(
                      Math.max(
                        0,
                        Number.parseFloat(order.total) -
                          Number.parseFloat(order.paidAmount || "0"),
                      ),
                    ),
                  )}
                </Text>
              </View>
            )}
          </View>
        </View>

        {/* Footer */}
        <Text style={s.footer}>
          {tenant?.name ?? "PrepareOS"} — Bon de commande #{order.ticketNumber}{" "}
          — {fmtDateTime(order.createdAt)}
        </Text>
      </Page>
    </Document>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <View style={s.infoRow}>
      <Text style={s.infoLabel}>{label} :</Text>
      <Text style={s.infoValue}>{value}</Text>
    </View>
  );
}

// ─── Page Component ─────────────────────────────────────────

export default function OrderPrintPage() {
  const params = useParams();
  const orderId = params.id as string;
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const pdfUrlRef = useRef<string | null>(null);

  const { data: order, isLoading } = useQuery({
    queryKey: ["order", orderId],
    queryFn: () => fetchOrder(orderId),
  });

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  useEffect(() => {
    if (!order || !tenant) return;

    let cancelled = false;
    const generate = async () => {
      const blob = await pdf(
        <OrderPdf order={order} tenant={tenant} />,
      ).toBlob();
      if (cancelled) return;
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
      const url = URL.createObjectURL(blob);
      pdfUrlRef.current = url;
      setPdfUrl(url);
    };
    generate();

    return () => {
      cancelled = true;
      if (pdfUrlRef.current) URL.revokeObjectURL(pdfUrlRef.current);
    };
  }, [order, tenant]);

  const handleDownload = () => {
    if (!pdfUrl || !order) return;
    const a = document.createElement("a");
    a.href = pdfUrl;
    a.download = `bon-commande-${order.ticketNumber}.pdf`;
    a.click();
  };

  if (isLoading || !order) {
    return (
      <div className="flex items-center justify-center h-screen">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-screen bg-background">
      {/* Toolbar */}
      <div className="flex items-center justify-between border-b px-4 py-2">
        <div className="flex items-center gap-2">
          <Button variant="ghost" size="sm" asChild>
            <Link href={`/orders/${orderId}`}>
              <ArrowLeft className="mr-2 h-4 w-4" />
              Retour
            </Link>
          </Button>
          <span className="text-sm text-muted-foreground">
            Bon de commande #{order.ticketNumber}
          </span>
        </div>
        <Button
          variant="outline"
          size="sm"
          onClick={handleDownload}
          disabled={!pdfUrl}
        >
          <Download className="mr-2 h-4 w-4" />
          Télécharger
        </Button>
      </div>

      {/* PDF Viewer */}
      <div className="flex-1 bg-muted">
        {pdfUrl ? (
          <iframe
            src={pdfUrl}
            className="w-full h-full border-0"
            title="Bon de commande"
          />
        ) : (
          <div className="flex items-center justify-center h-full">
            <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
          </div>
        )}
      </div>
    </div>
  );
}
