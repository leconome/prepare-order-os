import { z } from "zod";

export const UNITS = ["piece", "kg"] as const;

export const unitSchema = z.enum(UNITS);
export type Unit = z.infer<typeof unitSchema>;

export interface UnitConfig {
  label: string;
  suffix: string;
  priceSuffix: string;
  precision: number;
  step: number;
  defaultQty: number;
  integerStock: boolean;
}

export const UNIT_CONFIG: Record<Unit, UnitConfig> = {
  piece: {
    label: "Pièce (à l'unité)",
    suffix: "",
    priceSuffix: "/u",
    precision: 0,
    step: 1,
    defaultQty: 1,
    integerStock: true,
  },
  kg: {
    label: "Kilogramme (au poids)",
    suffix: "kg",
    priceSuffix: "/kg",
    precision: 3,
    step: 0.1,
    defaultQty: 0.5,
    integerStock: false,
  },
};

/** Parse any quantity (string from DB or number) into a number */
export function parseQty(raw: string | number): number {
  const n = typeof raw === "string" ? Number.parseFloat(raw) : raw;
  return Number.isNaN(n) ? 0 : n;
}

/** Round a quantity for the given unit */
export function roundQty(value: number, unit: Unit = "piece"): number {
  const { precision } = UNIT_CONFIG[unit];
  if (precision === 0) return Math.round(value);
  const factor = 10 ** precision;
  return Math.round(value * factor) / factor;
}

/** Compute line total: quantity * unitPrice */
export function lineTotal(
  qty: string | number,
  unitPrice: string | number,
): number {
  return parseQty(qty) * parseQty(unitPrice);
}

/** Format quantity with unit suffix for display: "3x" or "1.5 kg" */
export function formatQtyLabel(
  raw: string | number,
  unit: Unit = "piece",
): string {
  const qty = parseQty(raw);
  const config = UNIT_CONFIG[unit];
  if (config.suffix) {
    const formatted =
      config.precision === 0
        ? String(Math.round(qty))
        : qty.toFixed(config.precision).replace(/\.?0+$/, "");
    return `${formatted} ${config.suffix}`;
  }
  return `${Math.round(qty)}x`;
}

/** Human-friendly weight label: "500 g", "1,2 kg", "3x" */
export function formatWeightLabel(
  raw: string | number,
  unit: Unit = "piece",
): string {
  const qty = parseQty(raw);
  if (unit === "kg") {
    if (qty < 1) {
      const grams = Math.round(qty * 1000);
      return `${grams} g`;
    }
    const formatted = qty.toFixed(3).replace(/\.?0+$/, "").replace(".", ",");
    return `${formatted} kg`;
  }
  return `${Math.round(qty)}x`;
}

/** Get the stock deduction amount (integer for pieces, raw for kg) */
export function stockDeduction(
  qty: string | number,
  unit: Unit = "piece",
): number {
  const n = parseQty(qty);
  return UNIT_CONFIG[unit].integerStock ? Math.round(n) : n;
}
