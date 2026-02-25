import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "prepareos.fr";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host")?.split(":")[0] ?? "";
  const subdomain = hostname.split(".")[0];

  // Bare domain (prepareos.fr) or www → landing page
  if (
    hostname === BASE_DOMAIN ||
    subdomain === "www"
  ) {
    if (!request.nextUrl.pathname.startsWith("/landing")) {
      const url = request.nextUrl.clone();
      url.pathname = "/landing";
      return NextResponse.rewrite(url);
    }
    return NextResponse.next();
  }

  // admin.prepareos.fr/ → redirect to /admin
  if (subdomain === "admin" && request.nextUrl.pathname === "/") {
    const url = request.nextUrl.clone();
    url.pathname = "/admin";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
}

export const config = {
  // Skip static assets and API routes
  matcher: ["/((?!_next|api|favicon.ico).*)"],
};
