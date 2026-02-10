function getPaymentBadgeVariant(
  status: string,
): "paid" | "pending" | "partiallyPaid" | "refunded" | "outline" {
  switch (status) {
    case "paid":
      return "paid";
    case "pending":
      return "pending";
    case "partially_paid":
      return "partiallyPaid";
    case "refunded":
      return "refunded";
    default:
      return "outline";
  }
}

function getPreparationBadgeVariant(
  status: string,
): "pending" | "preparation" | "ready" | "pickedUp" | "outline" {
  switch (status) {
    case "ready":
      return "ready";
    case "picked_up":
      return "pickedUp";
    case "in_preparation":
      return "preparation";
    case "pending":
      return "pending";
    default:
      return "outline";
  }
}

export { getPaymentBadgeVariant, getPreparationBadgeVariant };
