import { z } from "zod";
import { productSchema } from "./product.schema.js";

export const menuSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable(),
  isActive: z.boolean(),
  sortOrder: z.number().int(),
  createdAt: z.coerce.date(),
  updatedAt: z.coerce.date(),
});

export const menuProductSchema = z.object({
  menuId: z.string().uuid(),
  productId: z.string().uuid(),
  sortOrder: z.number().int(),
});

export const menuWithProductsSchema = menuSchema.extend({
  products: z.array(productSchema),
});

export const createMenuSchema = z.object({
  name: z.string().min(1).max(100),
  description: z.string().max(500).optional(),
  isActive: z.boolean().default(true),
  sortOrder: z.number().int().default(0),
  productIds: z.array(z.string().uuid()).optional(),
});

export const updateMenuSchema = z.object({
  name: z.string().min(1).max(100).optional(),
  description: z.string().max(500).nullable().optional(),
  isActive: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
  productIds: z.array(z.string().uuid()).optional(),
});

export const menuFiltersSchema = z.object({
  isActive: z.coerce.boolean().optional(),
  page: z.coerce.number().int().positive().default(1),
  limit: z.coerce.number().int().positive().max(100).default(20),
});

export type Menu = z.infer<typeof menuSchema>;
export type MenuProduct = z.infer<typeof menuProductSchema>;
export type MenuWithProducts = z.infer<typeof menuWithProductsSchema>;
export type CreateMenu = z.infer<typeof createMenuSchema>;
export type UpdateMenu = z.infer<typeof updateMenuSchema>;
export type MenuFilters = z.infer<typeof menuFiltersSchema>;
