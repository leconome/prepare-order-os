type PreparationStatus = "pending" | "in_preparation" | "ready" | "picked_up";

const TABS = [
  {
    key: "to_prepare",
    label: "À préparer",
    statuses: ["pending", "in_preparation"] as PreparationStatus[],
  },
  {
    key: "ready",
    label: "Prêt",
    statuses: ["ready"] as PreparationStatus[],
  },
  {
    key: "picked_up",
    label: "Récupéré",
    statuses: ["picked_up"] as PreparationStatus[],
  },
];

const PAYMENT_BADGE: Record<
  string,
  {
    label: string;
    variant: "default" | "secondary" | "destructive" | "outline";
  }
> = {
  pending: { label: "Impayé", variant: "destructive" },
  paid: { label: "Payé", variant: "default" },
  partially_paid: { label: "Partiel", variant: "secondary" },
  refunded: { label: "Remboursé", variant: "outline" },
};

const STATUS_BADGE: Record<
  PreparationStatus,
  { label: string; className: string }
> = {
  pending: { label: "En attente", className: "bg-amber-100 text-amber-800" },
  in_preparation: { label: "En cours", className: "bg-blue-100 text-blue-800" },
  ready: { label: "Prêt", className: "bg-green-100 text-green-800" },
  picked_up: { label: "Récupéré", className: "bg-gray-100 text-gray-800" },
};

export { TABS, PAYMENT_BADGE, STATUS_BADGE, type PreparationStatus };
