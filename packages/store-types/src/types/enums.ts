export const PaymentStatusEnum = {
  PENDING: "pending",
  PAID: "paid",
  PARTIALLY_PAID: "partially_paid",
  REFUNDED: "refunded",
} as const;

export type PaymentStatusValue =
  (typeof PaymentStatusEnum)[keyof typeof PaymentStatusEnum];

export const PreparationStatusEnum = {
  PENDING: "pending",
  IN_PREPARATION: "in_preparation",
  READY: "ready",
  PICKED_UP: "picked_up",
} as const;

export type PreparationStatusValue =
  (typeof PreparationStatusEnum)[keyof typeof PreparationStatusEnum];

export const EmployeeRoleEnum = {
  CASHIER: "cashier",
  MANAGER: "manager",
  KITCHEN: "kitchen",
} as const;

export type EmployeeRoleValue =
  (typeof EmployeeRoleEnum)[keyof typeof EmployeeRoleEnum];

export const UserRoleEnum = {
  ADMIN: "admin",
  MANAGER: "manager",
  CASHIER: "cashier",
  KITCHEN: "kitchen",
} as const;

export type UserRoleValue = (typeof UserRoleEnum)[keyof typeof UserRoleEnum];
