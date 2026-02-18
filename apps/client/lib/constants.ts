const PAYMENT_LABELS: Record<string, string> = {
  pending: "Impayé",
  paid: "Payé",
  partially_paid: "Partiel",
  refunded: "Remboursé",
};

const PREPARATION_STATUS_LABELS: Record<string, string> = {
  pending: "En attente",
  in_preparation: "En préparation",
  ready: "Prêt",
  picked_up: "Récupéré",
};

export { PAYMENT_LABELS, PREPARATION_STATUS_LABELS };
