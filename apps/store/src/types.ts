import type { TenantVariables } from "./middleware/tenant.js";
import type { AuthVariables } from "./middleware/auth.js";

export type AppEnv = {
  Variables: TenantVariables & AuthVariables;
};
