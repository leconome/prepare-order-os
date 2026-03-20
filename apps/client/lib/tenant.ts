const BASE_DOMAIN = process.env.NEXT_PUBLIC_BASE_DOMAIN || "localhost";
const IS_LOCALHOST = BASE_DOMAIN === "localhost";
const PROTOCOL = IS_LOCALHOST ? "http" : "https";
const PORT_SUFFIX = IS_LOCALHOST ? ":3000" : "";

export function getTenantUrl(slug: string): string {
  return `${PROTOCOL}://${slug}.${BASE_DOMAIN}${PORT_SUFFIX}`;
}

export function getAdminPath() {
  return `${PROTOCOL}://admin.${BASE_DOMAIN}${PORT_SUFFIX}`;
}
