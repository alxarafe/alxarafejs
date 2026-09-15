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

// Input validation for 'PATCH users/:id' endpoint (profile fields of the
// authenticated user; only name and email are editable).
export const UpdateUserSchema = z.object({
	params: z.object({ id: commonValidations.id }),
	body: z
		.object({
			name: z.string().trim().min(2, "Name must be at least 2 characters").max(100).optional(),
			email: commonValidations.email.optional(),
		})
		.refine(
			({ name, email }) => name !== undefined || email !== undefined,
			"At least one of name or email is required",
		),
});
