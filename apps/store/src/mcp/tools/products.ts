// apps/store/src/mcp/tools/products.ts

import { unitTypeSchema } from "@prepareos/data";
import { tool } from "ai";
import { z } from "zod";
import * as productService from "../../services/product.service.js";

export function createProductTools(tenantId: string) {
  return {
    searchProducts: tool({
      description:
        "Search and list products. Only provide parameters you actually need — omit any you don't have a specific value for.",
      inputSchema: z.object({
        search: z.string().optional().describe("Text search on product name. Omit to list all."),
        isActive: z
          .boolean()
          .optional()
          .describe("Filter active (true) or inactive (false) products. Omit to include both."),
        page: z
          .number()
          .int()
          .positive()
          .optional()
          .describe("Page number (default 1)"),
        limit: z
          .number()
          .int()
          .positive()
          .max(100)
          .optional()
          .describe("Items per page (default 20, max 100)"),
      }),
      execute: async (params) => {
        // Only pass explicitly meaningful values — LLMs tend to hallucinate defaults
        const filters: Record<string, unknown> = {
          page: params.page ?? 1,
          limit: params.limit ?? 20,
        };
        if (params.search && params.search.trim() !== "") filters.search = params.search;
        if (params.isActive !== undefined) filters.isActive = params.isActive;
        // categoryId and maxStock are ONLY included via strict opt-in
        // to prevent LLMs from hallucinating UUIDs or arbitrary numbers


        const result = await productService.listProducts(
          tenantId,
          filters as Parameters<typeof productService.listProducts>[1],
        );

        return {
          products: result.data.map((p) => ({
            id: p.id,
            name: p.name,
            price: p.price,
            stock: p.stock,
            unitType: p.unitType,
            isActive: p.isActive,
            category: p.category?.name ?? null,
            hasVariants: p.hasVariants,
          })),
          pagination: result.pagination,
        };
      },
    }),

    getProduct: tool({
      description:
        "Get full details of a single product including its variants.",
      inputSchema: z.object({
        productId: z.string().uuid().describe("The product ID"),
      }),
      execute: async ({ productId }) => {
        const product = await productService.getProductById(
          tenantId,
          productId,
        );
        if (!product) {
          return { error: `Product with ID ${productId} not found.` };
        }
        return {
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price,
          stock: product.stock,
          unitType: product.unitType,
          defaultQty: product.defaultQty,
          isActive: product.isActive,
          hasVariants: product.hasVariants,
          sortOrder: product.sortOrder,
          category: product.category?.name ?? null,
          categoryId: product.categoryId,
          variants:
            product.variants?.map((v) => ({
              id: v.id,
              name: v.name,
              price: v.price,
              stock: v.stock,
              isActive: v.isActive,
            })) ?? [],
          createdAt: product.createdAt,
          updatedAt: product.updatedAt,
        };
      },
    }),

    createProduct: tool({
      description:
        "Create a new product. Always confirm the details with the user before calling this tool.",
      inputSchema: z.object({
        name: z.string().min(1).max(200).describe("Product name"),
        price: z.number().min(0).describe("Price in euros, e.g. 12.50"),
        description: z.string().max(1000).optional().describe("Product description"),
        stock: z.number().min(0).nullable().optional().describe("Initial stock quantity, null if not tracked"),
        unitType: unitTypeSchema.optional().describe("Unit type, defaults to 'piece'"),
        isActive: z.boolean().optional().describe("Whether the product is active, defaults to true"),
      }),
      execute: async (params) => {
        try {
          const data = {
            name: params.name,
            price: params.price.toFixed(2),
            description: params.description,
            stock: params.stock ?? null,
            unitType: params.unitType ?? "piece",
            isActive: params.isActive ?? true,
          };


          const created = await productService.createProduct(
            tenantId,
            data as Parameters<typeof productService.createProduct>[1],
          );
          if (!created) {
            return { success: false, error: "Failed to create product." };
          }
          return {
            success: true,
            product: {
              id: created.id,
              name: created.name,
              price: created.price,
              stock: created.stock,
              isActive: created.isActive,
              unitType: created.unitType,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Creation failed",
          };
        }
      },
    }),

    updateProduct: tool({
      description:
        "Update one or more fields on a product. Always confirm changes with the user before calling this tool.",
      inputSchema: z.object({
        productId: z.string().uuid().describe("The product ID to update"),
        updates: z.object({
          name: z.string().min(1).max(200).optional(),
          description: z.string().max(1000).optional(),
          price: z
            .number()
            .min(0)
            .optional()
            .describe("Price in euros, e.g. 12.50"),
          stock: z
            .number()
            .min(0)
            .nullable()
            .optional()
            .describe("Stock quantity, null to clear"),
          isActive: z.boolean().optional(),
          categoryId: z.string().uuid().optional(),
          unitType: unitTypeSchema.optional(),
          defaultQty: z.number().positive().nullable().optional(),
          sortOrder: z.number().int().optional(),
          hasVariants: z.boolean().optional(),
        }),
      }),
      execute: async ({ productId, updates }) => {
        // Coerce numbers to strings for decimal DB fields
        const coerced: Record<string, unknown> = { ...updates };
        if (updates.price !== undefined) {
          coerced.price = updates.price.toFixed(2);
        }
        if (updates.stock !== undefined && updates.stock !== null) {
          coerced.stock = updates.stock;
        }
        if (updates.defaultQty !== undefined && updates.defaultQty !== null) {
          coerced.defaultQty = updates.defaultQty;
        }

        try {
          const updated = await productService.updateProduct(
            tenantId,
            productId,
            coerced as Parameters<typeof productService.updateProduct>[2],
          );
          if (!updated) {
            return {
              success: false,
              error: "Product not found or does not belong to this tenant.",
            };
          }
          return {
            success: true,
            product: {
              id: updated.id,
              name: updated.name,
              price: updated.price,
              stock: updated.stock,
              isActive: updated.isActive,
            },
          };
        } catch (error) {
          return {
            success: false,
            error: error instanceof Error ? error.message : "Update failed",
          };
        }
      },
    }),
  };
}
