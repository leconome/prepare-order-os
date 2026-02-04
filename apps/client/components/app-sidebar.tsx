"use client";

import {
  FolderTree,
  Home,
  LogOut,
  Menu,
  Package,
  Settings,
  ShoppingCart,
  Store,
} from "lucide-react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";

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
import { useAuth } from "@/lib/auth";

const navigation = [
  {
    title: "Tableau de bord",
    url: "/",
    icon: Home,
  },
  {
    title: "Commandes",
    url: "/orders",
    icon: ShoppingCart,
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
          <span className="font-semibold bg-gradient-to-r from-blue-600 to-indigo-600 dark:from-blue-400 dark:to-indigo-400 bg-clip-text text-transparent group-data-[collapsible=icon]:hidden">
            Fromagerie
          </span>
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
            <SidebarMenuButton tooltip={user?.email ?? "User"}>
              <div className="flex h-6 w-6 items-center justify-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-xs text-white">
                {user?.name?.[0] ?? user?.email?.[0]?.toUpperCase() ?? "U"}
              </div>
              <span className="truncate">
                {user?.name ?? user?.email ?? "User"}
              </span>
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
