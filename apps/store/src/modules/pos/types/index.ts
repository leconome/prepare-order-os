/**
 * Payment status for POS orders
 */
export enum PaymentStatus {
  PENDING = "pending",
  PAID = "paid",
  PARTIALLY_PAID = "partially_paid",
  REFUNDED = "refunded",
}

/**
 * Preparation status for POS orders
 */
export enum PreparationStatus {
  PENDING = "pending", // En attente
  IN_PREPARATION = "in_preparation", // En préparation
  READY = "ready", // Prêt
  PICKED_UP = "picked_up", // Récupéré
}

/**
 * Employee roles for POS
 */
export enum EmployeeRole {
  CASHIER = "cashier",
  MANAGER = "manager",
  KITCHEN = "kitchen",
}
