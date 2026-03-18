import { Parser } from "@json2csv/plainjs";
import type { OrderWithItems } from "@prepareos/data";
import ExcelJS from "exceljs";

interface ExportRow {
  ticket: string;
  client: string;
  telephone: string;
  email: string;
  statut_paiement: string;
  statut_preparation: string;
  source: string;
  date_retrait: string;
  horaire_retrait: string;
  cree_par: string;
  assigne_a: string;
  point_de_vente: string;
  sous_total: string;
  remise: string;
  taxes: string;
  total: string;
  montant_paye: string;
  nb_articles: number;
  articles: string;
  note_client: string;
  note_interne: string;
  date_creation: string;
}

const PAYMENT_LABELS: Record<string, string> = {
  pending: "En attente",
  paid: "Paye",
  partially_paid: "Partiellement paye",
  refunded: "Rembourse",
};

const PREPARATION_LABELS: Record<string, string> = {
  pending: "En attente",
  in_preparation: "En preparation",
  ready: "Pret",
  picked_up: "Recupere",
};

const SOURCE_LABELS: Record<string, string> = {
  comptoir: "Comptoir",
  telephone: "Telephone",
  site_web: "Site web",
};

function fmtDate(d: string | Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(d));
}

function fmtPickupDate(d: string | Date | null): string {
  if (!d) return "";
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  }).format(new Date(d));
}

export function flattenOrders(orders: OrderWithItems[]): ExportRow[] {
  return orders.map((o) => ({
    ticket: o.ticketNumber,
    client: o.client?.name ?? "",
    telephone: o.client?.phone ?? "",
    email: o.client?.email ?? "",
    statut_paiement: PAYMENT_LABELS[o.paymentStatus] ?? o.paymentStatus,
    statut_preparation:
      PREPARATION_LABELS[o.preparationStatus] ?? o.preparationStatus,
    source: SOURCE_LABELS[o.source] ?? o.source,
    date_retrait: fmtPickupDate(o.pickupDate),
    horaire_retrait: [o.pickupTimeStart, o.pickupTimeEnd]
      .filter(Boolean)
      .join("–"),
    cree_par: o.createdBy?.name ?? "",
    assigne_a: o.assignedTo?.name ?? "",
    point_de_vente: o.pointOfSale?.name ?? "",
    sous_total: o.subtotal,
    remise: o.discountAmount,
    taxes: o.taxTotal,
    total: o.total,
    montant_paye: o.paidAmount,
    nb_articles: o.items?.length ?? 0,
    articles: (o.items ?? [])
      .map((i) => {
        const displayName = i.variantName
          ? `${i.productName} — ${i.variantName}`
          : i.productName;
        return `${Number(i.quantity)}x ${displayName}`;
      })
      .join("; "),
    note_client: o.clientNote ?? "",
    note_interne: o.internalNote ?? "",
    date_creation: fmtDate(o.createdAt),
  }));
}

const COLUMNS = [
  { key: "ticket", header: "N° Ticket" },
  { key: "client", header: "Client" },
  { key: "telephone", header: "Telephone" },
  { key: "email", header: "Email" },
  { key: "statut_paiement", header: "Paiement" },
  { key: "statut_preparation", header: "Preparation" },
  { key: "source", header: "Source" },
  { key: "date_retrait", header: "Date retrait" },
  { key: "horaire_retrait", header: "Horaire retrait" },
  { key: "cree_par", header: "Cree par" },
  { key: "assigne_a", header: "Assigne a" },
  { key: "point_de_vente", header: "Point de vente" },
  { key: "sous_total", header: "Sous-total" },
  { key: "remise", header: "Remise" },
  { key: "taxes", header: "Taxes" },
  { key: "total", header: "Total" },
  { key: "montant_paye", header: "Montant paye" },
  { key: "nb_articles", header: "Nb articles" },
  { key: "articles", header: "Articles" },
  { key: "note_client", header: "Note client" },
  { key: "note_interne", header: "Note interne" },
  { key: "date_creation", header: "Date creation" },
];

export function generateCsv(rows: ExportRow[]): string {
  const parser = new Parser({
    fields: COLUMNS.map((c) => ({ label: c.header, value: c.key })),
    delimiter: ";",
  });
  return parser.parse(rows);
}

export async function generateXlsx(rows: ExportRow[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  const sheet = workbook.addWorksheet("Commandes");

  sheet.columns = COLUMNS.map((c) => ({
    header: c.header,
    key: c.key,
    width: 18,
  }));

  for (const row of rows) {
    sheet.addRow(row);
  }

  sheet.getRow(1).font = { bold: true };

  return Buffer.from(await workbook.xlsx.writeBuffer());
}
