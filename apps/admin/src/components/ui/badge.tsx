import type { HTMLAttributes } from "react";
import { cn } from "@/lib/utils";

export interface BadgeProps extends HTMLAttributes<HTMLDivElement> {
	variant?:
		| "default"
		| "secondary"
		| "destructive"
		| "success"
		| "warning"
		| "outline";
}

function Badge({ className, variant = "default", ...props }: BadgeProps) {
	const variants = {
		default: "bg-zinc-900 text-zinc-50 dark:bg-zinc-50 dark:text-zinc-900",
		secondary: "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50",
		destructive: "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-100",
		success:
			"bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-100",
		warning:
			"bg-yellow-100 text-yellow-700 dark:bg-yellow-900 dark:text-yellow-100",
		outline:
			"border border-zinc-200 text-zinc-900 dark:border-zinc-800 dark:text-zinc-50",
	};

	return (
		<div
			className={cn(
				"inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold transition-colors",
				variants[variant],
				className,
			)}
			{...props}
		/>
	);
}

export { Badge };
