"use client";

import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

// 10 premade colors
const PRESET_COLORS = [
  { name: "Rouge", value: "#EF4444" },
  { name: "Orange", value: "#F97316" },
  { name: "Jaune", value: "#EAB308" },
  { name: "Vert", value: "#22C55E" },
  { name: "Turquoise", value: "#14B8A6" },
  { name: "Bleu", value: "#3B82F6" },
  { name: "Indigo", value: "#6366F1" },
  { name: "Violet", value: "#8B5CF6" },
  { name: "Rose", value: "#EC4899" },
  { name: "Gris", value: "#6B7280" },
];

interface ColorPickerProps {
  value?: string | null;
  onChange: (color: string | null) => void;
  className?: string;
}

export function ColorPicker({ value, onChange, className }: ColorPickerProps) {
  const isCustomColor = value && !PRESET_COLORS.some((c) => c.value === value);

  return (
    <div className={cn("space-y-3", className)}>
      {/* Preset colors */}
      <div className="flex flex-wrap gap-2">
        {PRESET_COLORS.map((color) => (
          <button
            key={color.value}
            type="button"
            onClick={() => onChange(value === color.value ? null : color.value)}
            className={cn(
              "relative h-8 w-8 rounded-full border-2 transition-all hover:scale-110",
              value === color.value
                ? "border-foreground ring-2 ring-offset-2 ring-foreground/20"
                : "border-transparent",
            )}
            style={{ backgroundColor: color.value }}
            title={color.name}
          >
            {value === color.value && (
              <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
            )}
          </button>
        ))}
      </div>

      {/* Custom color picker */}
      <div className="flex items-center gap-3">
        <label className="flex items-center gap-2 cursor-pointer">
          <div
            className={cn(
              "relative h-8 w-8 rounded-full border-2 overflow-hidden transition-all",
              isCustomColor
                ? "border-foreground ring-2 ring-offset-2 ring-foreground/20"
                : "border-dashed border-muted-foreground/50",
            )}
            style={{ backgroundColor: isCustomColor ? value : undefined }}
          >
            <input
              type="color"
              value={value || "#000000"}
              onChange={(e) => onChange(e.target.value)}
              className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
            />
            {isCustomColor && (
              <Check className="absolute inset-0 m-auto h-4 w-4 text-white drop-shadow-md" />
            )}
          </div>
          <span className="text-sm text-muted-foreground">
            {isCustomColor ? value : "Couleur personnalisée"}
          </span>
        </label>

        {value && (
          <button
            type="button"
            onClick={() => onChange(null)}
            className="text-xs text-muted-foreground hover:text-foreground underline"
          >
            Effacer
          </button>
        )}
      </div>
    </div>
  );
}

export function ColorBadge({
  color,
  className,
}: {
  color?: string | null;
  className?: string;
}) {
  if (!color) return null;

  return (
    <span
      className={cn("inline-block h-4 w-4 rounded-full border", className)}
      style={{ backgroundColor: color }}
    />
  );
}
