"use client";

import { LogOut, Shield, ShieldCheck, Store } from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

import { AdminGuard } from "@/components/admin-guard";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/lib/auth";

const NAV_ITEMS = [
  { href: "/admin", label: "Tenants", icon: Store },
  { href: "/admin/users", label: "Administrateurs", icon: ShieldCheck },
];

function AdminTopBar() {
  const router = useRouter();
  const pathname = usePathname();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    router.push("/admin/login");
  };

  return (
    <header className="flex h-16 shrink-0 items-center justify-between border-b px-6">
      <div className="flex items-center gap-6">
        <div className="flex items-center gap-3">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-linear-to-br from-rose-500 to-pink-600 text-white shadow-md">
            <Link href="/admin">
              <Shield className="h-4 w-4" />
            </Link>
          </div>
        </div>
        <nav className="flex items-center gap-1">
          {NAV_ITEMS.map((item) => {
            const isActive =
              item.href === "/admin"
                ? pathname === "/admin" || pathname.startsWith("/admin/tenants")
                : pathname.startsWith(item.href);
            return (
              <Link key={item.href} href={item.href}>
                <Button
                  variant={isActive ? "secondary" : "ghost"}
                  size="sm"
                  className="gap-2"
                >
                  <item.icon className="h-4 w-4" />
                  {item.label}
                </Button>
              </Link>
            );
          })}
        </nav>
      </div>
      <div className="flex items-center gap-4">
        <span className="text-sm text-muted-foreground">
          {user?.name ?? user?.email}
        </span>
        <Button variant="ghost" size="sm" onClick={handleLogout}>
          <LogOut className="h-4 w-4 mr-2" />
          Deconnexion
        </Button>
      </div>
    </header>
  );
}

export default function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <AdminGuard>
      <div className="min-h-screen flex flex-col">
        <AdminTopBar />
        <main className="flex-1 p-6">{children}</main>
      </div>
    </AdminGuard>
  );
}
