"use client";

import { Activity, LayoutDashboard, Settings, Store } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

const navigation = [
	{ name: "Dashboard", href: "/", icon: LayoutDashboard },
	{ name: "Tenants", href: "/tenants", icon: Store },
	{ name: "Analytics", href: "/analytics", icon: Activity, disabled: true },
	{ name: "Settings", href: "/settings", icon: Settings, disabled: true },
];

export function Sidebar() {
	const pathname = usePathname();

	return (
		<aside className="fixed inset-y-0 left-0 z-50 w-64 border-r border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-950">
			<div className="flex h-16 items-center gap-2 border-b border-zinc-200 px-6 dark:border-zinc-800">
				<div className="flex h-8 w-8 items-center justify-center rounded-lg bg-zinc-900 text-white dark:bg-white dark:text-zinc-900">
					<Store className="h-4 w-4" />
				</div>
				<span className="text-lg font-semibold">PrepareOS</span>
			</div>

			<nav className="space-y-1 p-4">
				{navigation.map((item) => {
					const isActive =
						pathname === item.href ||
						(item.href !== "/" && pathname.startsWith(item.href));
					return (
						<Link
							key={item.name}
							href={item.href}
							className={cn(
								item.disabled ? "opacity-50 cursor-not-allowed" : "",
								"flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors",
								isActive
									? "bg-zinc-100 text-zinc-900 dark:bg-zinc-800 dark:text-zinc-50"
									: "text-zinc-600 hover:bg-zinc-50 hover:text-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800 dark:hover:text-zinc-50",
							)}
						>
							<item.icon className="h-4 w-4" />
							{item.name}
						</Link>
					);
				})}
			</nav>
		</aside>
	);
}
