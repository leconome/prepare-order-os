import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createProductSchema,
  updateProductSchema,
  productFiltersSchema,
} from "@prepareos/data";
import * as productService from "../services/product.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { managerOrAdmin } from "../middleware/role-guard.js";

const products = new Hono();

products.use("*", authMiddleware);

products.get("/", zValidator("query", productFiltersSchema), async (c) => {
  const filters = c.req.valid("query");
  const result = await productService.listProducts(filters);
  return c.json(result);
});

products.get("/:id", async (c) => {
  const id = c.req.param("id");
  const product = await productService.getProductById(id);

  if (!product) {
    return c.json({ error: "Product not found" }, 404);
  }

  return c.json(product);
});

products.post(
  "/",
  managerOrAdmin,
  zValidator("json", createProductSchema),
  async (c) => {
    const data = c.req.valid("json");
    const product = await productService.createProduct(data);
    return c.json(product, 201);
  },
);

products.patch(
  "/:id",
  managerOrAdmin,
  zValidator("json", updateProductSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await productService.getProductById(id);
    if (!existing) {
      return c.json({ error: "Product not found" }, 404);
    }

    const product = await productService.updateProduct(id, data);
    return c.json(product);
  },
);

products.delete("/:id", managerOrAdmin, async (c) => {
  const id = c.req.param("id");

  const existing = await productService.getProductById(id);
  if (!existing) {
    return c.json({ error: "Product not found" }, 404);
  }

  await productService.deleteProduct(id);
  return c.json({ success: true });
});

export default products;
