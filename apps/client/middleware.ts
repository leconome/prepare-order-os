import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

export function middleware(request: NextRequest) {
  const hostname = request.headers.get("host") ?? "";
  const subdomain = hostname.split(".")[0];

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
