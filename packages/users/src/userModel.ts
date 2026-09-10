import { commonValidations } from "@alxarafe/core";
import { extendZodWithOpenApi } from "@asteasolutions/zod-to-openapi";
import { z } from "zod";

extendZodWithOpenApi(z);

export const userRoles = ["USER", "ADMIN"] as const;
export type UserRole = (typeof userRoles)[number];

export type User = z.infer<typeof UserSchema>;
export const UserSchema = z.object({
	id: z.number(),
	name: z.string(),
	email: z.string().email(),
	role: z.enum(userRoles),
	emailVerifiedAt: z.date().nullable(),
	createdAt: z.date(),
	updatedAt: z.date(),
});

// Input validation for 'GET users/:id' endpoint
export const GetUserSchema = z.object({
	params: z.object({ id: commonValidations.id }),
});
