import { createApiResponse, PaginatedListSchema, validateRequest } from "@alxarafe/core";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { requireAuth, requireRole, requireSameUserOrAdmin } from "./guards.js";
import { userController } from "./userController.js";
import { GetUserSchema, UpdateUserSchema, UserSchema } from "./userModel.js";

export const userRegistry = new OpenAPIRegistry();
export const userRouter: Router = express.Router();

const UserListQuerySchema = z.object({
	$top: z.coerce.number().int().positive().max(500).optional(),
	$skip: z.coerce.number().int().min(0).optional(),
	$count: z.enum(["true", "false"]).optional(),
	$filter: z.string().optional(),
	$orderby: z.string().optional(),
});

userRegistry.register("User", UserSchema);

userRegistry.registerPath({
	method: "get",
	path: "/users",
	tags: ["User"],
	request: { query: UserListQuerySchema },
	responses: createApiResponse(PaginatedListSchema(UserSchema), "Success"),
});

userRouter.get("/", requireAuth, requireRole("ADMIN"), userController.getUsers);

userRegistry.registerPath({
	method: "get",
	path: "/users/{id}",
	tags: ["User"],
	request: { params: GetUserSchema.shape.params },
	responses: createApiResponse(UserSchema, "Success"),
});

userRouter.get("/:id", requireAuth, validateRequest(GetUserSchema), requireSameUserOrAdmin, userController.getUser);

userRegistry.registerPath({
	method: "patch",
	path: "/users/{id}",
	tags: ["User"],
	request: {
		params: GetUserSchema.shape.params,
		body: { content: { "application/json": { schema: UpdateUserSchema.shape.body } } },
	},
	responses: createApiResponse(UserSchema, "User updated"),
});

userRouter.patch(
	"/:id",
	requireAuth,
	validateRequest(UpdateUserSchema),
	requireSameUserOrAdmin,
	userController.updateUser,
);
