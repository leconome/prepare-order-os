const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "localhost";
const IS_DEV = process.env.NODE_ENV === "development";
const PROTOCOL = IS_DEV ? "http" : "https";

export function getTenantUrl(slug: string): string {
  return `${PROTOCOL}://${slug}.${BASE_DOMAIN}${IS_DEV ? ":3000" : ""}`;
}

export function getAdminPath() {
  return `${PROTOCOL}://admin.${BASE_DOMAIN}${IS_DEV ? ":3000" : ""}`;
}
