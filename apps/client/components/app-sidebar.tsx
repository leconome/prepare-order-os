"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChefHat,
  FolderTree,
  LayoutDashboard,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
  UserRound,
  UserStar,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarRail,
} from "@/components/ui/sidebar";
import { fetchTenantSettings } from "@/lib/api";
import { useAuth } from "@/lib/auth";

const ROLE_LABELS: Record<string, string> = {
  admin: "Admin",
  owner: "Propriétaire",
  staff: "Employé",
};

const ROLE_COLORS: Record<string, string> = {
  admin: "bg-rose-500/10 text-rose-600 dark:text-rose-400",
  owner: "bg-amber-500/10 text-amber-600 dark:text-amber-400",
  staff: "bg-blue-500/10 text-blue-600 dark:text-blue-400",
};

const navigation = [
  {
    title: "Dashboard",
    url: "/",
    icon: LayoutDashboard,
  },
  {
    title: "Préparation",
    url: "/preparation",
    icon: ChefHat,
  },
  {
    title: "Commandes",
    url: "/orders",
    icon: ShoppingCart,
  },
  {
    title: "Clients",
    url: "/clients",
    icon: UserRound,
  },
  {
    title: "Statistiques",
    url: "/stats",
    icon: BarChart3,
  },
];

const catalogueNavigation = [
  {
    title: "Produits",
    url: "/products",
    icon: Package,
  },
  {
    title: "Catégories",
    url: "/categories",
    icon: FolderTree,
  },
  {
    title: "Menus",
    url: "/menus",
    icon: Menu,
  },
];

const managementNavigation = [
  {
    title: "Équipe",
    url: "/staff",
    icon: UserStar,
    roles: ["admin", "owner"],
  },
];

const secondaryNavigation = [
  {
    title: "Paramètres",
    url: "/settings",
    icon: Settings,
  },
];

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const pathname = usePathname();
  const router = useRouter();
  const { user, logout } = useAuth();

  const { data: tenant } = useQuery({
    queryKey: ["tenant-settings"],
    queryFn: fetchTenantSettings,
  });

  const shopName = tenant?.name ?? "PrepareOS";

  const handleLogout = async () => {
    await logout();
    router.push("/login");
  };

  return (
    <Sidebar collapsible="icon" {...props}>
      {/* Gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-b from-blue-600/5 via-indigo-500/5 to-violet-500/5 dark:from-blue-500/10 dark:via-indigo-500/10 dark:to-violet-600/10 pointer-events-none" />
      <div className="absolute inset-0 bg-gradient-to-br from-sky-400/5 to-transparent dark:from-sky-400/10 pointer-events-none" />

      <SidebarHeader className="border-b border-sidebar-border/50 relative">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-gradient-to-br from-blue-500 to-indigo-600 text-white shadow-md">
            <Store className="h-4 w-4" />
          </div>
          <div className="flex flex-col">
            <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden">
              PrepareOS
            </span>
            <p className="text-xs">{shopName}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="relative">
        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70">
            Navigation
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {navigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.url ||
                      (item.url !== "/" && pathname.startsWith(item.url))
                    }
                    tooltip={item.title}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-500/10 data-[active=true]:to-indigo-500/10 data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-300"
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        <SidebarGroup>
          <SidebarGroupLabel className="text-muted-foreground/70">
            Catalogue
          </SidebarGroupLabel>
          <SidebarGroupContent>
            <SidebarMenu>
              {catalogueNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={
                      pathname === item.url || pathname.startsWith(item.url)
                    }
                    tooltip={item.title}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-500/10 data-[active=true]:to-indigo-500/10 data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-300"
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>

        {/* Management section - only for admin/owner */}
        {user?.role && ["admin", "owner"].includes(user.role) && (
          <SidebarGroup>
            <SidebarGroupLabel className="text-muted-foreground/70">
              Gestion
            </SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {managementNavigation
                  .filter(
                    (item) => user?.role && item.roles.includes(user.role),
                  )
                  .map((item) => (
                    <SidebarMenuItem key={item.title}>
                      <SidebarMenuButton
                        asChild
                        isActive={
                          pathname === item.url || pathname.startsWith(item.url)
                        }
                        tooltip={item.title}
                        className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-500/10 data-[active=true]:to-indigo-500/10 data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-300"
                      >
                        <Link href={item.url}>
                          <item.icon />
                          <span>{item.title}</span>
                        </Link>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        )}

        <SidebarGroup className="mt-auto">
          <SidebarGroupContent>
            <SidebarMenu>
              {secondaryNavigation.map((item) => (
                <SidebarMenuItem key={item.title}>
                  <SidebarMenuButton
                    asChild
                    isActive={pathname === item.url}
                    tooltip={item.title}
                    className="data-[active=true]:bg-gradient-to-r data-[active=true]:from-blue-500/10 data-[active=true]:to-indigo-500/10 data-[active=true]:text-blue-700 dark:data-[active=true]:text-blue-300"
                  >
                    <Link href={item.url}>
                      <item.icon />
                      <span>{item.title}</span>
                    </Link>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroupContent>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter className="border-t border-sidebar-border/50 relative">
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              tooltip={user?.email ?? "User"}
              className="h-auto py-2"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-sm text-white shrink-0">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex flex-col items-start gap-0.5 overflow-hidden">
                <span className="truncate text-sm font-medium">
                  {user?.name ?? user?.email ?? "User"}
                </span>
                {user?.role && (
                  <Badge
                    variant="secondary"
                    className={`text-[10px] px-1.5 py-0 h-4 ${ROLE_COLORS[user.role] || ""}`}
                  >
                    {ROLE_LABELS[user.role] || user.role}
                  </Badge>
                )}
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
          <SidebarMenuItem>
            <SidebarMenuButton
              onClick={handleLogout}
              tooltip="Déconnexion"
              className="hover:text-rose-600 dark:hover:text-rose-400"
            >
              <LogOut />
              <span>Déconnexion</span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarFooter>
      <SidebarRail />
    </Sidebar>
  );
}
