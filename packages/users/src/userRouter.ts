import { createApiResponse, PaginatedListSchema, validateRequest } from "@alxarafe/core";
import { OpenAPIRegistry } from "@asteasolutions/zod-to-openapi";
import express, { type Router } from "express";
import { z } from "zod";

import { requireAuth } from "./guards";
import { userController } from "./userController";
import { GetUserSchema, UserSchema } from "./userModel";

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

userRouter.get("/", requireAuth, userController.getUsers);

userRegistry.registerPath({
	method: "get",
	path: "/users/{id}",
	tags: ["User"],
	request: { params: GetUserSchema.shape.params },
	responses: createApiResponse(UserSchema, "Success"),
});

userRouter.get("/:id", requireAuth, validateRequest(GetUserSchema), userController.getUser);
