import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { Slot } from "radix-ui";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center justify-center rounded-full border border-transparent px-2.5 py-0.5 text-xs font-medium w-fit whitespace-nowrap shrink-0 [&>svg]:size-3 gap-1 [&>svg]:pointer-events-none focus-visible:border-ring focus-visible:ring-ring/50 focus-visible:ring-[3px] aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 aria-invalid:border-destructive transition-[color,box-shadow] overflow-hidden",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a&]:hover:bg-primary/90",
        secondary:
          "bg-secondary text-secondary-foreground [a&]:hover:bg-secondary/90",
        destructive:
          "bg-destructive text-white [a&]:hover:bg-destructive/90 focus-visible:ring-destructive/20 dark:focus-visible:ring-destructive/40 dark:bg-destructive/60",
        outline:
          "border-border text-foreground [a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        ghost: "[a&]:hover:bg-accent [a&]:hover:text-accent-foreground",
        link: "text-primary underline-offset-4 [a&]:hover:underline",
        // Status colors - Blue theme variants
        info: "bg-sky-100 text-sky-700 dark:bg-sky-900/50 dark:text-sky-300",
        success:
          "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
        warning:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
        error:
          "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
        // Payment statuses
        pending:
          "bg-slate-100 text-slate-600 dark:bg-slate-800/50 dark:text-slate-300",
        paid: "bg-emerald-100 text-emerald-700 dark:bg-emerald-900/50 dark:text-emerald-300",
        partiallyPaid:
          "bg-amber-100 text-amber-700 dark:bg-amber-900/50 dark:text-amber-300",
        refunded:
          "bg-rose-100 text-rose-700 dark:bg-rose-900/50 dark:text-rose-300",
        // Preparation statuses
        preparation:
          "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300",
        ready:
          "bg-indigo-100 text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300",
        pickedUp:
          "bg-violet-100 text-violet-700 dark:bg-violet-900/50 dark:text-violet-300",
        // Entity status
        active:
          "bg-teal-100 text-teal-700 dark:bg-teal-900/50 dark:text-teal-300",
        inactive:
          "bg-gray-100 text-gray-500 dark:bg-gray-800/50 dark:text-gray-400",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

function Badge({
  className,
  variant = "default",
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span";

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant }), className)}
      {...props}
    />
  );
}

export { Badge, badgeVariants };
