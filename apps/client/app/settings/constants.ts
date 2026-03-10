export const FILTER_DAYS_OPTIONS = [
  { value: "0", label: "Aujourd'hui uniquement" },
  { value: "1", label: "Aujourd'hui ± 1 jour" },
  { value: "2", label: "Aujourd'hui ± 2 jours" },
  { value: "3", label: "Aujourd'hui ± 3 jours" },
  { value: "7", label: "Aujourd'hui ± 7 jours" },
  { value: "14", label: "Aujourd'hui ± 14 jours" },
  { value: "30", label: "Aujourd'hui ± 30 jours" },
];

export const SMS_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  sent: "Envoye",
  delivered: "Delivre",
  failed: "Echoue",
};

export const SMS_STATUS_VARIANT: Record<
  string,
  "default" | "secondary" | "destructive" | "outline"
> = {
  pending: "secondary",
  sent: "outline",
  delivered: "default",
  failed: "destructive",
};

export const TX_TYPE_LABELS: Record<string, string> = {
  grant: "Attribution",
  spend: "Envoi SMS",
  revoke: "Revocation",
};
