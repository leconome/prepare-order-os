"use client";

import { useQuery } from "@tanstack/react-query";
import {
  BarChart3,
  ChefHat,
  ChevronDown,
  FolderTree,
  Home,
  LogOut,
  Menu,
  Package,
  Plus,
  Settings,
  ShoppingCart,
  Store,
  UserRound,
  UserStar,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
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

const STORAGE_KEY = "sidebar-sections";

type SectionState = {
  pages: boolean;
  catalogue: boolean;
  gestion: boolean;
};

const DEFAULT_STATE: SectionState = {
  pages: true,
  catalogue: true,
  gestion: true,
};

function useSectionState() {
  const [state, setState] = useState<SectionState>(DEFAULT_STATE);

  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY);
      if (stored) setState(JSON.parse(stored));
    } catch {}
  }, []);

  const toggle = useCallback((key: keyof SectionState) => {
    setState((prev) => {
      const next = { ...prev, [key]: !prev[key] };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
      return next;
    });
  }, []);

  return { state, toggle };
}

const navigation = [
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
    title: "Statistiques",
    url: "/stats",
    icon: BarChart3,
    roles: ["admin", "owner"],
  },
  {
    title: "Équipe",
    url: "/staff",
    icon: UserStar,
    roles: ["admin", "owner"],
  },
  {
    title: "Points de retrait",
    url: "/points-of-sale",
    icon: Store,
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
  const { state: sections, toggle } = useSectionState();

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
      <SidebarHeader className="border-b border-sidebar-border/50 relative group-data-[collapsible=icon]:p-0">
        <div className="flex items-center gap-2 px-2 py-2">
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-primary text-primary-foreground shadow-md">
            <Store className="h-4 w-4" />
          </div>
          <div className="flex flex-col overflow-hidden group-data-[collapsible=icon]:hidden">
            <span className="font-semibold text-primary">PrepareOS</span>
            <p className="text-xs truncate">{shopName}</p>
          </div>
        </div>
      </SidebarHeader>
      <SidebarContent className="relative">
        <div className="px-2 pt-2 space-y-1.5 group-data-[collapsible=icon]:px-1.5">
          {/* Quick nav buttons */}
          <div className="grid grid-cols-2 gap-1.5 group-data-[collapsible=icon]:grid-cols-1">
            <Button
              asChild
              variant="outline"
              className={`h-10 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 ${
                pathname === "/"
                  ? "bg-primary/10 border-primary/50 text-primary hover:bg-primary/15 hover:text-primary"
                  : ""
              }`}
            >
              <Link href="/">
                <Home className="h-5 w-5" />
              </Link>
            </Button>
            <Button
              asChild
              variant="outline"
              className={`h-10 group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0 ${
                pathname.startsWith("/preparation")
                  ? "bg-amber-50 border-amber-300 text-amber-700 hover:bg-amber-100 hover:text-amber-800 dark:bg-amber-950/30 dark:border-amber-700 dark:text-amber-400 dark:hover:bg-amber-950/50"
                  : ""
              }`}
            >
              <Link href="/preparation">
                <ChefHat className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </Link>
            </Button>
          </div>

          {/* New order button */}
          <Button
            asChild
            className="w-full group-data-[collapsible=icon]:size-8 group-data-[collapsible=icon]:p-0"
          >
            <Link href="/orders/new">
              <Plus className="h-4 w-4 group-data-[collapsible=icon]:mr-0" />
              <span className="group-data-[collapsible=icon]:hidden">
                Nouvelle commande
              </span>
            </Link>
          </Button>
        </div>

        <Collapsible open={sections.pages} onOpenChange={() => toggle("pages")}>
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="text-muted-foreground/70 cursor-pointer hover:text-muted-foreground">
                Pages
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${sections.pages ? "" : "-rotate-90"}`}
                />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
                        className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
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
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        <Collapsible
          open={sections.catalogue}
          onOpenChange={() => toggle("catalogue")}
        >
          <SidebarGroup>
            <CollapsibleTrigger asChild>
              <SidebarGroupLabel className="text-muted-foreground/70 cursor-pointer hover:text-muted-foreground">
                Catalogue
                <ChevronDown
                  className={`ml-auto h-4 w-4 transition-transform ${sections.catalogue ? "" : "-rotate-90"}`}
                />
              </SidebarGroupLabel>
            </CollapsibleTrigger>
            <CollapsibleContent>
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
                        className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
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
            </CollapsibleContent>
          </SidebarGroup>
        </Collapsible>

        {/* Management section - only for admin/owner */}
        {user?.role && ["admin", "owner"].includes(user.role) && (
          <Collapsible
            open={sections.gestion}
            onOpenChange={() => toggle("gestion")}
          >
            <SidebarGroup>
              <CollapsibleTrigger asChild>
                <SidebarGroupLabel className="text-muted-foreground/70 cursor-pointer hover:text-muted-foreground">
                  Gestion
                  <ChevronDown
                    className={`ml-auto h-4 w-4 transition-transform ${sections.gestion ? "" : "-rotate-90"}`}
                  />
                </SidebarGroupLabel>
              </CollapsibleTrigger>
              <CollapsibleContent>
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
                              pathname === item.url ||
                              pathname.startsWith(item.url)
                            }
                            tooltip={item.title}
                            className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
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
              </CollapsibleContent>
            </SidebarGroup>
          </Collapsible>
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
                    className="data-[active=true]:bg-primary/10 data-[active=true]:text-primary"
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
              className="h-auto group-data-[collapsible=icon]:size-8! group-data-[collapsible=icon]:p-0!"
            >
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm shrink-0">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <div className="flex flex-col items-start gap-0.5 overflow-hidden group-data-[collapsible=icon]:hidden">
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
    </Sidebar>
  );
}
