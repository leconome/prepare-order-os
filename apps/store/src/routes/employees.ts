import { Hono } from "hono";
import { zValidator } from "@hono/zod-validator";
import {
  createEmployeeSchema,
  updateEmployeeSchema,
  employeeFiltersSchema,
} from "@repo/store-types";
import * as employeeService from "../services/employee.service.js";
import { authMiddleware } from "../middleware/auth.js";
import { managerOrAdmin } from "../middleware/role-guard.js";

const employees = new Hono();

employees.use("*", authMiddleware);

employees.get("/", zValidator("query", employeeFiltersSchema), async (c) => {
  const filters = c.req.valid("query");
  const result = await employeeService.listEmployees(filters);
  return c.json(result);
});

employees.get("/:id", async (c) => {
  const id = c.req.param("id");
  const employee = await employeeService.getEmployeeById(id);

  if (!employee) {
    return c.json({ error: "Employee not found" }, 404);
  }

  return c.json(employee);
});

employees.post(
  "/",
  managerOrAdmin,
  zValidator("json", createEmployeeSchema),
  async (c) => {
    const data = c.req.valid("json");
    const employee = await employeeService.createEmployee(data);
    return c.json(employee, 201);
  },
);

employees.patch(
  "/:id",
  managerOrAdmin,
  zValidator("json", updateEmployeeSchema),
  async (c) => {
    const id = c.req.param("id");
    const data = c.req.valid("json");

    const existing = await employeeService.getEmployeeById(id);
    if (!existing) {
      return c.json({ error: "Employee not found" }, 404);
    }

    const employee = await employeeService.updateEmployee(id, data);
    return c.json(employee);
  },
);

employees.delete("/:id", managerOrAdmin, async (c) => {
  const id = c.req.param("id");

  const existing = await employeeService.getEmployeeById(id);
  if (!existing) {
    return c.json({ error: "Employee not found" }, 404);
  }

  await employeeService.deleteEmployee(id);
  return c.json({ success: true });
});

export default employees;
